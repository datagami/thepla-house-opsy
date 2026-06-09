// src/app/api/equipment/bulk-import/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { parseEquipmentWorkbook, applyBulkImport } from "@/lib/services/equipment-bulk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let buffer: Buffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Missing file field" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "File too large (max 10MB)" }, { status: 400 });
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = await parseEquipmentWorkbook(buffer);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.fileError }, { status: 400 });

  const summary = await applyBulkImport({
    prisma,
    user: { id: user.id, role: user.role ?? "", branchId: user.branchId ?? null },
    rows: parsed.rows,
    req,
  });
  return NextResponse.json(summary);
}
