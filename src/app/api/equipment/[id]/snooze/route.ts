import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { snoozeSchema } from "@/lib/validations/equipment";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.snooze"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const item = await prisma.equipment.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = snoozeSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const snoozedUntil = parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil) : null;
    const updated = await prisma.equipment.update({ where: { id }, data: { snoozedUntil } });

    await logEntityActivity(
      ActivityType.EQUIPMENT_SNOOZED,
      user.id,
      "Equipment",
      id,
      snoozedUntil
        ? `Snoozed "${item.name}" until ${parsed.data.snoozedUntil}`
        : `Cleared snooze on "${item.name}"`,
      { equipmentId: id, snoozedUntil: parsed.data.snoozedUntil },
      req
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error in POST /api/equipment/[id]/snooze:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
