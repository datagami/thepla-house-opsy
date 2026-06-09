import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { AzureStorageService } from "@/lib/azure-storage";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    const item = await prisma.equipment.findUnique({ where: { id }, select: { name: true, branchId: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const records = await prisma.maintenanceRecord.findMany({
      where: { equipmentId: id, billUrl: { not: null } },
      select: { billUrl: true, serviceDate: true },
      orderBy: { serviceDate: "asc" },
    });
    if (records.length === 0) return NextResponse.json({ error: "No bills to export" }, { status: 404 });

    const azure = new AzureStorageService();
    const zip = new JSZip();
    let added = 0;
    for (const r of records) {
      const dl = await azure.downloadByUrl(r.billUrl!);
      if (dl) {
        const base = dl.blobName.split("/").pop() ?? `bill-${added}.bin`;
        zip.file(base, dl.buffer);
        added++;
      }
    }
    if (added === 0) return NextResponse.json({ error: "Bills could not be retrieved" }, { status: 502 });

    const content = await zip.generateAsync({ type: "nodebuffer" });
    const safeName = item.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "item";
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bills-${safeName}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/equipment/[id]/bills/export:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
