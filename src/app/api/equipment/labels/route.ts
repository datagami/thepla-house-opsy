// src/app/api/equipment/labels/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { assetTag } from "@/lib/asset-tag";
import { renderEquipmentLabels, type LabelInput } from "@/lib/services/equipment-label-pdf";
import { categoryLabel } from "@/lib/equipment-display";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_LABELS = 1000;
type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const role = user.role ?? "";
  if (!hasAccess(role, "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  // Cap the ids list (results are capped at MAX_LABELS anyway) so a pathologically
  // large list can't hit Postgres bind-parameter limits and surface as a 500.
  const ids = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_LABELS)
    : null;
  const category = searchParams.get("category") ?? undefined;
  const outlet = searchParams.get("outlet") ?? undefined;
  const lifecycle = searchParams.get("lifecycle") ?? "active";

  const where = {
    ...equipmentWhereForRole(role, user.branchId ?? null), // scope is always AND-ed → no cross-outlet leak
    ...(ids ? { id: { in: ids } } : {}),
    ...(category ? { category: category as never } : {}),
    ...(outlet && (role === "HR" || role === "MANAGEMENT") ? { branchId: outlet } : {}),
    ...(lifecycle === "inactive" ? { status: "RETIRED" as const } : lifecycle === "all" ? {} : { status: "ACTIVE" as const }),
  };

  const items = await prisma.equipment.findMany({
    where,
    select: { id: true, name: true, numId: true, category: true, branch: { select: { name: true, code: true } } },
    orderBy: [{ branch: { name: "asc" } }, { numId: "asc" }],
    take: MAX_LABELS,
  });

  if (items.length === 0)
    return NextResponse.json({ error: "No assets to label" }, { status: 400 });

  const appUrl = (process.env.NEXTAUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const labels: LabelInput[] = items.map((i) => ({
    tag: assetTag(i.branch.code, i.numId, i.branch.name),
    name: i.name,
    outlet: i.branch.name,
    category: categoryLabel(i.category),
    url: `${appUrl}/equipment/${i.id}`,
  }));

  const buffer = await renderEquipmentLabels(labels);
  const today = new Date().toISOString().slice(0, 10);
  const scope = role === "BRANCH_MANAGER" ? "outlet" : "all";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asset-labels-${scope}-${today}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
