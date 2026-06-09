import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole, canManageBranch } from "@/lib/maintenance-access";
import { equipmentCreateSchema, EQUIPMENT_CATEGORIES } from "@/lib/validations/equipment";
import { logEntityActivity } from "@/lib/services/activity-log";
import { computeNextDueDate } from "@/lib/services/maintenance-schedule";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

const EQUIPMENT_STATUSES = ["ACTIVE", "RETIRED"] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.view"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);

    const categoryParam = searchParams.get("category");
    const statusParam = searchParams.get("status");
    const category =
      categoryParam && (EQUIPMENT_CATEGORIES as readonly string[]).includes(categoryParam)
        ? categoryParam
        : undefined;
    const status =
      statusParam && (EQUIPMENT_STATUSES as readonly string[]).includes(statusParam)
        ? statusParam
        : undefined;
    const branchFilter = searchParams.get("branchId") ?? undefined;

    const where = {
      ...equipmentWhereForRole(user.role ?? "", user.branchId ?? null),
      ...(category ? { category: category as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(branchFilter && (user.role === "HR" || user.role === "MANAGEMENT") ? { branchId: branchFilter } : {}),
    };

    const equipment = await prisma.equipment.findMany({
      where,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: [{ nextDueDate: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error in GET /api/equipment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = equipmentCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;

    if (!canManageBranch(user.role ?? "", user.branchId ?? null, data.branchId))
      return NextResponse.json({ error: "Cannot create equipment for this outlet" }, { status: 403 });

    const nextDueDate = data.nextDueDate
      ? new Date(data.nextDueDate)
      : computeNextDueDate(new Date(), data.frequencyMonths ?? null);

    const created = await prisma.equipment.create({
      data: {
        name: data.name,
        category: data.category,
        branchId: data.branchId,
        location: data.location ?? null,
        frequencyMonths: data.frequencyMonths ?? null,
        reminderLeadDays: data.reminderLeadDays,
        nextDueDate,
        notes: data.notes ?? null,
        createdById: user.id,
      },
    });

    await logEntityActivity(
      ActivityType.EQUIPMENT_CREATED,
      user.id,
      "Equipment",
      created.id,
      `Registered maintenance item "${created.name}" (${created.category})`,
      { equipmentId: created.id, branchId: created.branchId },
      req
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/equipment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
