import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

function getRole(session: unknown): string | undefined {
  const s = session as { user?: { role?: string } };
  return s.user?.role;
}

function getSessionUserId(session: unknown): string | undefined {
  const s = session as { user?: { id?: string } };
  return s.user?.id;
}

async function assertBranchManagerCanAccessUser(managerId: string, targetUserId: string) {
  const [target, manager] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetUserId }, select: { branchId: true } }),
    prisma.user.findUnique({ where: { id: managerId }, select: { managedBranchId: true, branchId: true } }),
  ]);

  const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
  if (!managerBranchId || managerBranchId !== target?.branchId) {
    return false;
  }
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const role = getRole(session);
    const actorId = getSessionUserId(session);

    if (!actorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!role || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (role === "BRANCH_MANAGER") {
      const ok = await assertBranchManagerCanAccessUser(actorId, userId);
      if (!ok) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const now = new Date();

    const result = await prisma.warning.updateMany({
      where: { userId, isArchived: false },
      data: { isArchived: true, archivedAt: now, archivedById: actorId },
    });

    await logEntityActivity(
      ActivityType.OTHER,
      actorId,
      "Warning",
      userId,
      `Archived all active warnings (${result.count})`,
      { userId, archivedCount: result.count },
      req
    );

    return NextResponse.json({ archivedCount: result.count });
  } catch (error) {
    console.error("Error archiving warnings:", error);
    return NextResponse.json({ error: "Failed to archive warnings" }, { status: 500 });
  }
}

