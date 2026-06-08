import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { maintenanceRecordCreateSchema } from "@/lib/validations/equipment";
import { uploadMaintenanceFiles } from "@/lib/maintenance-upload";
import { computeNextDueDate } from "@/lib/services/maintenance-schedule";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.view"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const item = await prisma.equipment.findUnique({ where: { id }, select: { branchId: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const records = await prisma.maintenanceRecord.findMany({
      where: { equipmentId: id },
      orderBy: { serviceDate: "desc" },
      include: { loggedBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Error in GET /api/equipment/[id]/records:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.records.create"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const item = await prisma.equipment.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = maintenanceRecordCreateSchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const { billUrl, photoUrls } = await uploadMaintenanceFiles(
      { bill: d.bill ?? null, photos: d.photos },
      id,
      item.branchId
    );

    const serviceDate = new Date(d.serviceDate);
    const nextDueDate = d.nextDueDate
      ? new Date(d.nextDueDate)
      : computeNextDueDate(serviceDate, item.frequencyMonths);

    const record = await prisma.maintenanceRecord.create({
      data: {
        equipmentId: id,
        branchId: item.branchId,
        serviceDate,
        maintenanceType: d.maintenanceType,
        issue: d.issue ?? null,
        vendorName: d.vendorName ?? null,
        vendorContact: d.vendorContact ?? null,
        cost: d.cost,
        status: d.status,
        remarks: d.remarks ?? null,
        billUrl,
        photoUrls,
        nextDueDate,
        loggedById: user.id,
      },
    });

    if (d.status === "DONE") {
      // Recompute the schedule from the most recent COMPLETED service rather than
      // blindly using the record we just created. Otherwise, logging records out of
      // chronological order (e.g. backfilling an older service after a newer one)
      // would let an older service overwrite the next-due date. The latest service
      // by serviceDate (tie-broken by most-recently logged) is authoritative.
      const latestDone = await prisma.maintenanceRecord.findFirst({
        where: { equipmentId: id, status: "DONE" },
        orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
        select: { serviceDate: true, nextDueDate: true },
      });
      if (latestDone) {
        await prisma.equipment.update({
          where: { id },
          data: {
            lastServiceDate: latestDone.serviceDate,
            nextDueDate: latestDone.nextDueDate,
            snoozedUntil: null,
          },
        });
      }
    }

    await logEntityActivity(
      ActivityType.EQUIPMENT_MAINTENANCE_LOGGED,
      user.id,
      "MaintenanceRecord",
      record.id,
      `Logged ${d.maintenanceType} on "${item.name}" — ₹${d.cost}`,
      { equipmentId: id, recordId: record.id, cost: d.cost, maintenanceType: d.maintenanceType },
      req
    );

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/equipment/[id]/records:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
