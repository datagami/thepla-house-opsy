// src/app/api/equipment/bulk-export/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { buildEquipmentWorkbook, type ExportItem } from "@/lib/services/equipment-bulk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Cap the export at the latest N active items per outlet, so an all-outlet
// (Management) export is bounded at n * N rows.
const PER_OUTLET_LIMIT = 200;

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const role = user.role ?? "";
  if (!hasAccess(role, "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Outlets in scope: a BRANCH_MANAGER sees only their own; MANAGEMENT sees all.
  const branches =
    role === "BRANCH_MANAGER"
      ? user.branchId
        ? await prisma.branch.findMany({ where: { id: user.branchId }, select: { id: true, name: true } })
        : []
      : await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  // Latest PER_OUTLET_LIMIT ACTIVE items per outlet (≤ n * PER_OUTLET_LIMIT total).
  const perOutlet = await Promise.all(
    branches.map((b) =>
      prisma.equipment
        .findMany({
          where: { branchId: b.id, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: PER_OUTLET_LIMIT,
          select: {
            id: true, name: true, category: true, location: true, frequencyMonths: true,
            reminderLeadDays: true, status: true, nextDueDate: true, lastServiceDate: true, notes: true,
          },
        })
        .then((rows) => rows.map((r) => ({ ...r, branchName: b.name })))
    )
  );

  const exportItems: ExportItem[] = perOutlet
    .flat()
    .sort((a, b) => a.branchName.localeCompare(b.branchName) || a.name.localeCompare(b.name))
    .map((i) => ({
      id: i.id, name: i.name, category: i.category, branchName: i.branchName,
      location: i.location, frequencyMonths: i.frequencyMonths, reminderLeadDays: i.reminderLeadDays,
      status: i.status, nextDueDate: i.nextDueDate, lastServiceDate: i.lastServiceDate, notes: i.notes,
    }));

  const branchNames = branches.map((b) => b.name);

  const buffer = await buildEquipmentWorkbook(exportItems, { branchNames });
  const today = new Date().toISOString().slice(0, 10);
  const scope = role === "BRANCH_MANAGER" ? "outlet" : "all";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="equipment-${scope}-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
