import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Version history for a single branch document. Lazy-loaded by the History dialog
// so the documents list payload stays lean.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ branchId: string; documentId: string }> }
) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    const role = session?.user?.role;
    if (!session || !["MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId, documentId } = await params;

    // Branch managers may only read their own branch's documents.
    if (role === "BRANCH_MANAGER") {
      const user = await prisma.user.findUnique({
        where: { id: session.user!.id as string },
        select: { managedBranchId: true },
      });
      if (user?.managedBranchId !== branchId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Ensure the document exists in this branch before exposing its versions.
    const document = await prisma.branchDocument.findFirst({
      where: { id: documentId, branchId },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const versions = await prisma.branchDocumentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: "desc" },
      include: { changedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching document versions:", error);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
