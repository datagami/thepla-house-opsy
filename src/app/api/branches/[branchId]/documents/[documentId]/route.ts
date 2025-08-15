import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";

const BRANCH_DOCUMENTS_FOLDER = 'branch-documents';

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
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete from Azure
    try {
      const azureStorage = new AzureStorageService();
      const filename = document.fileUrl.split('/').pop();
      if (filename) {
        await azureStorage.deleteImage(filename, BRANCH_DOCUMENTS_FOLDER);
      }
    } catch (error) {
      console.error("Error deleting file from Azure:", error);
      // Continue with database deletion even if Azure deletion fails
    }

    // Delete from database
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