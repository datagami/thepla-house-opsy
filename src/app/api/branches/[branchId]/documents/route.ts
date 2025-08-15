import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";

const BRANCH_DOCUMENTS_FOLDER = 'branch-documents';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
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

    const { branchId } = await params;

    // Check if branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const renewalDate = formData.get("renewalDate") as string;
    const reminderDate = formData.get("reminderDate") as string;
    const documentTypeId = formData.get("documentTypeId") as string;

    if (!file || !name || !renewalDate || !reminderDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF, images, and ZIP files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Upload to Azure
    const buffer = Buffer.from(await file.arrayBuffer());
    const azureStorage = new AzureStorageService();
    const filename = `${branchId}-${Date.now()}-${file.name}`;
    const fileUrl = await azureStorage.uploadImage(buffer, filename, BRANCH_DOCUMENTS_FOLDER, file.type);

    const userId = session.user!.id as string;

    // Create document record
    const document = await prisma.branchDocument.create({
      data: {
        name,
        description: description || null,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        fileType: file.type,
        renewalDate: new Date(renewalDate),
        reminderDate: new Date(reminderDate),
        uploadedById: userId,
        branchId,
        documentTypeId: documentTypeId || null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        documentType: {
          select: {
            id: true,
            name: true,
            mandatory: true,
          },
        },
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!session || !['MANAGEMENT', 'BRANCH_MANAGER'].includes(role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { branchId } = await params;

    // Check if branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    const userId = session.user!.id;

    // For BRANCH_MANAGER, check if they manage this branch
    if (role === "BRANCH_MANAGER") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { managedBranchId: true },
      });

      if (user?.managedBranchId !== branchId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    const documents = await prisma.branchDocument.findMany({
      where: { branchId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        documentType: {
          select: {
            id: true,
            name: true,
            mandatory: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
} 
