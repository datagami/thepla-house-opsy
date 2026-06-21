import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";
import { logActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";
import {
  computeDocumentChanges,
  describeDocumentChanges,
  versionsToPrune,
  DOCUMENT_ALLOWED_FILE_TYPES,
  DOCUMENT_MAX_FILE_BYTES,
} from "@/lib/services/branch-document-versions";

const BRANCH_DOCUMENTS_FOLDER = 'branch-documents';

const DOCUMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true } },
  documentType: { select: { id: true, name: true, mandatory: true } },
} as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ branchId: string; documentId: string }> }
) {
  let uploadedFileUrl: string | null = null;
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    const role = session?.user?.role;
    if (!session || role !== "MANAGEMENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId, documentId } = await params;
    const userId = session.user!.id as string;

    const document = await prisma.branchDocument.findFirst({
      where: { id: documentId, branchId },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const name = formData.get("name") as string | null;
    const description = formData.get("description") as string | null;
    const renewalDate = formData.get("renewalDate") as string | null;
    const reminderDate = formData.get("reminderDate") as string | null;
    const documentTypeId = formData.get("documentTypeId") as string | null;
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;

    if (!name || !renewalDate || !reminderDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (hasFile) {
      if (!(DOCUMENT_ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
        return NextResponse.json(
          { error: "Invalid file type. Only PDF, images, and ZIP files are allowed" },
          { status: 400 }
        );
      }
      if (file.size > DOCUMENT_MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
      }
    }

    const incoming = {
      name,
      description: description || null,
      documentTypeId: documentTypeId || null,
      renewalDate: new Date(renewalDate),
      reminderDate: new Date(reminderDate),
    };
    const changedFields = computeDocumentChanges(
      {
        name: document.name,
        description: document.description,
        documentTypeId: document.documentTypeId,
        renewalDate: document.renewalDate,
        reminderDate: document.reminderDate,
      },
      incoming,
      hasFile
    );

    if (changedFields.length === 0) {
      // Nothing changed — return the document as-is (with relations).
      const unchanged = await prisma.branchDocument.findUnique({
        where: { id: documentId },
        include: DOCUMENT_INCLUDE,
      });
      return NextResponse.json(unchanged);
    }

    const azureStorage = new AzureStorageService();

    // Upload the replacement file first (old blob stays — it becomes a version).
    let newFileData: { fileName: string; fileUrl: string; fileSize: number; fileType: string } | null = null;
    if (hasFile) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${branchId}-${Date.now()}-${file.name}`;
      uploadedFileUrl = await azureStorage.uploadImage(buffer, filename, BRANCH_DOCUMENTS_FOLDER, file.type);
      newFileData = { fileName: file.name, fileUrl: uploadedFileUrl, fileSize: file.size, fileType: file.type };
    }

    // Apply the edit. When the file changes, snapshot the superseded file+metadata
    // into a version row in the same transaction.
    const updated = await prisma.$transaction(async (tx) => {
      if (newFileData) {
        const priorVersions = await tx.branchDocumentVersion.count({ where: { documentId } });
        await tx.branchDocumentVersion.create({
          data: {
            documentId,
            versionNumber: priorVersions + 1,
            fileName: document.fileName,
            fileUrl: document.fileUrl,
            fileSize: document.fileSize,
            fileType: document.fileType,
            name: document.name,
            description: document.description,
            renewalDate: document.renewalDate,
            reminderDate: document.reminderDate,
            documentTypeId: document.documentTypeId,
            changedById: userId,
          },
        });
      }
      return tx.branchDocument.update({
        where: { id: documentId },
        data: {
          name: incoming.name,
          description: incoming.description,
          documentTypeId: incoming.documentTypeId,
          renewalDate: incoming.renewalDate,
          reminderDate: incoming.reminderDate,
          ...(newFileData ?? {}),
        },
        include: DOCUMENT_INCLUDE,
      });
    });

    // Retention: prune the oldest version blobs beyond the cap (best-effort).
    if (newFileData) {
      try {
        const versions = await prisma.branchDocumentVersion.findMany({
          where: { documentId },
          select: { id: true, versionNumber: true, fileUrl: true, filePruned: true },
        });
        for (const v of versionsToPrune(versions)) {
          if (v.fileUrl) {
            try {
              await azureStorage.deleteByUrl(v.fileUrl);
            } catch (e) {
              console.error("Version blob prune failed for", v.id, e);
            }
            await prisma.branchDocumentVersion.update({
              where: { id: v.id },
              data: { fileUrl: null, filePruned: true },
            });
          }
        }
      } catch (e) {
        console.error("Version retention pass failed for document", documentId, e);
      }
    }

    await logActivity({
      activityType: ActivityType.DOCUMENT_UPDATED,
      userId,
      targetId: documentId,
      entityType: "BranchDocument",
      description: `Updated document "${updated.name}" (${describeDocumentChanges(changedFields)})`,
      metadata: { branchId, changedFields, fileReplaced: hasFile },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating document:", error);
    // Roll back the orphaned upload if the DB write failed.
    if (uploadedFileUrl) {
      try {
        await new AzureStorageService().deleteByUrl(uploadedFileUrl);
      } catch (e) {
        console.error("Failed to clean up orphaned upload:", e);
      }
    }
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ branchId: string; documentId: string }> }
) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!session || role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { branchId, documentId } = await params;

    // Check if document exists and belongs to the branch
    const document = await prisma.branchDocument.findFirst({
      where: {
        id: documentId,
        branchId,
      },
      include: { versions: { select: { fileUrl: true } } },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete the current file + every retained version blob from Azure (best-effort).
    const azureStorage = new AzureStorageService();
    const blobUrls = [document.fileUrl, ...document.versions.map((v) => v.fileUrl)].filter(
      (u): u is string => Boolean(u)
    );
    for (const url of blobUrls) {
      try {
        await azureStorage.deleteByUrl(url);
      } catch (error) {
        console.error("Error deleting file from Azure:", error);
        // Continue with database deletion even if Azure deletion fails
      }
    }

    // Delete from database (versions cascade via FK)
    await prisma.branchDocument.delete({
      where: { id: documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
