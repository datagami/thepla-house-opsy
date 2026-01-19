import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

const patchSchema = z.object({
  isArchived: z.boolean(),
});

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; warningId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, warningId } = await params;
    const role = getRole(session);
    const actorId = getSessionUserId(session);

    if (!actorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only HR/MANAGEMENT/BRANCH_MANAGER can archive/unarchive
    if (!role || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (role === "BRANCH_MANAGER") {
      const ok = await assertBranchManagerCanAccessUser(actorId, userId);
      if (!ok) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const json = await req.json();
    const body = patchSchema.parse(json);

    const warning = await prisma.warning.findFirst({
      where: { id: warningId, userId },
      select: { id: true, reason: true, isArchived: true },
    });

    if (!warning) {
      return NextResponse.json({ error: "Warning not found" }, { status: 404 });
    }

    const updated = await prisma.warning.update({
      where: { id: warningId },
      data: body.isArchived
        ? {
            isArchived: true,
            archivedAt: new Date(),
            archivedById: actorId,
          }
        : {
            isArchived: false,
            archivedAt: null,
            archivedById: null,
          },
      include: {
        reportedBy: { select: { id: true, name: true } },
        archivedBy: { select: { id: true, name: true } },
      },
    });

    await logEntityActivity(
      ActivityType.OTHER,
      actorId,
      "Warning",
      warningId,
      body.isArchived ? `Archived warning: ${warning.reason}` : `Unarchived warning: ${warning.reason}`,
      {
        warningId,
        userId,
        isArchived: body.isArchived,
      },
      req
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating warning:", error);
    return NextResponse.json({ error: "Failed to update warning" }, { status: 500 });
  }
}

