import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";

const USER_DOCUMENTS_FOLDER = 'user-documents';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    if (!session || !['MANAGEMENT', 'HR', 'BRANCH_MANAGER'].includes(role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id, documentId } = await params;

    const [document, targetUser, manager] = await Promise.all([
      prisma.userDocument.findFirst({ where: { id: documentId, userId: id } }),
      prisma.user.findUnique({ where: { id }, select: { branchId: true } }),
      prisma.user.findUnique({ where: { id: session.user!.id as string }, select: { managedBranchId: true, branchId: true } })
    ]);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (role === 'BRANCH_MANAGER') {
      const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
      if (!managerBranchId || managerBranchId !== targetUser?.branchId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    try {
      const azureStorage = new AzureStorageService();
      const filename = document.fileUrl.split('/').pop();
      if (filename) {
        await azureStorage.deleteImage(filename, USER_DOCUMENTS_FOLDER);
      }
    } catch (error) {
      console.error("Error deleting file from Azure:", error);
    }

    await prisma.userDocument.delete({ where: { id: documentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

