import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { equipmentUpdateSchema } from "@/lib/validations/equipment";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

async function loadAndAuthorize(id: string, user: SessionUser, write: boolean) {
  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (write) {
    if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  } else if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { item };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.view"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const item = await prisma.equipment.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        records: {
          orderBy: { serviceDate: "desc" },
          include: { loggedBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Error in GET /api/equipment/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const guard = await loadAndAuthorize(id, user, true);
    if (guard.error) return guard.error;

    const parsed = equipmentUpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.category !== undefined ? { category: d.category } : {}),
        ...(d.location !== undefined ? { location: d.location ?? null } : {}),
        ...(d.frequencyMonths !== undefined ? { frequencyMonths: d.frequencyMonths ?? null } : {}),
        ...(d.reminderLeadDays !== undefined ? { reminderLeadDays: d.reminderLeadDays } : {}),
        ...(d.nextDueDate !== undefined ? { nextDueDate: d.nextDueDate ? new Date(d.nextDueDate) : null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
      },
    });

    await logEntityActivity(
      ActivityType.EQUIPMENT_UPDATED,
      user.id,
      "Equipment",
      id,
      `Updated maintenance item "${updated.name}"`,
      { equipmentId: id },
      req
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error in PATCH /api/equipment/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const guard = await loadAndAuthorize(id, user, true);
    if (guard.error) return guard.error;

    await prisma.equipment.delete({ where: { id } });
    await logEntityActivity(
      ActivityType.EQUIPMENT_DELETED,
      user.id,
      "Equipment",
      id,
      `Deleted maintenance item "${guard.item!.name}"`,
      { equipmentId: id },
      req
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/equipment/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
