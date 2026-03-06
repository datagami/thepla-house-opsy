import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUserId = (session.user as { id?: string }).id;
    const isOwnProfile = sessionUserId === id;

    // @ts-expect-error - role is not defined in the session type
    const canViewUsers = hasAccess(session.user.role, "users.view");

    if (!canViewUsers && !isOwnProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const appraisals = await prisma.salaryAppraisal.findMany({
      where: { userId: id },
      include: {
        changedBy: {
          select: { name: true, numId: true },
        },
      },
      orderBy: { effectiveDate: "desc" },
    });

    return NextResponse.json(appraisals);
  } catch (error) {
    console.error("Error fetching appraisals:", error);
    return NextResponse.json(
      { error: "Failed to fetch appraisals" },
      { status: 500 }
    );
  }
}
