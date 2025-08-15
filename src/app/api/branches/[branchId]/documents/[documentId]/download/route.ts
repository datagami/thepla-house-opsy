import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";

const BRANCH_DOCUMENTS_FOLDER = 'branch-documents';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ branchId: string; documentId: string }> }
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

    const { branchId, documentId } = await params;

    // Check if document exists and belongs to the branch
    const documents = await prisma.$queryRaw`
      SELECT * FROM branch_documents 
      WHERE id = ${documentId} AND branch_id = ${branchId}
      LIMIT 1
    `;
    
    const document = (documents as any[])[0];

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // For BRANCH_MANAGER, check if they manage this branch
    if (role === "BRANCH_MANAGER") {
      const user = await prisma.user.findUnique({
        where: { id: session.user!.id },
        select: { managedBranchId: true },
      });

      if (user?.managedBranchId !== branchId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // Generate a SAS URL for temporary access
    const azureStorage = new AzureStorageService();
    const filename = document.file_url.split('/').pop();
    
    if (!filename) {
      return NextResponse.json(
        { error: "Invalid file URL" },
        { status: 400 }
      );
    }

    const sasUrl = await azureStorage.generateSasUrl(filename, BRANCH_DOCUMENTS_FOLDER, 1, document.file_type); // 1 hour expiry

    // Redirect to the SAS URL
    return NextResponse.redirect(sasUrl);
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
} 