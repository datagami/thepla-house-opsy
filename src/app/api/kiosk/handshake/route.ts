import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateKiosk } from "@/lib/kiosk-auth";

/**
 * GET /api/kiosk/handshake
 *
 * Validates the device's token and returns:
 *   { device: { id, name, branchId }, branch: { id, name }, serverTime: ISO-UTC }
 *
 * The kiosk uses serverTime to bound local clock skew when stamping `punchedAt`.
 */
export async function GET(req: Request) {
  const authed = await authenticateKiosk(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const branch = await prisma.branch.findUnique({
    where: { id: authed.device.branchId },
    select: { id: true, name: true },
  });
  if (!branch) {
    return NextResponse.json({ error: "Device branch missing" }, { status: 500 });
  }
  return NextResponse.json({
    device: authed.device,
    branch,
    serverTime: new Date().toISOString(),
  });
}
