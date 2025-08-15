import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    const document = await prisma.branchDocument.findFirst({
      where: {
        id: documentId,
        branchId: branchId,
      },
    });

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

    // Redirect to the stored file URL
    return NextResponse.redirect(document.fileUrl);
  } catch (error) {
    console.error("Error downloading document:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
} 