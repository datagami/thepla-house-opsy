// src/app/api/equipment/bulk-export/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { buildEquipmentWorkbook, type ExportItem } from "@/lib/services/equipment-bulk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const role = user.role ?? "";
  if (!hasAccess(role, "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.equipment.findMany({
    where: equipmentWhereForRole(role, user.branchId ?? null),
    include: { branch: { select: { name: true } } },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
  });

  // Outlet dropdown options: a manager only sees their own outlet; management sees all.
  const branchNames =
    role === "BRANCH_MANAGER"
      ? [...new Set(items.map((i) => i.branch.name))]
      : (await prisma.branch.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map((b) => b.name);

  const exportItems: ExportItem[] = items.map((i) => ({
    id: i.id, name: i.name, category: i.category, branchName: i.branch.name,
    location: i.location, frequencyMonths: i.frequencyMonths, reminderLeadDays: i.reminderLeadDays,
    status: i.status, nextDueDate: i.nextDueDate, lastServiceDate: i.lastServiceDate, notes: i.notes,
  }));

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
