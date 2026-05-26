import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateKiosk } from "@/lib/kiosk-auth";

/**
 * GET /api/kiosk/shifts
 *
 * Returns active shifts available at the device's branch:
 *   - branch-specific shifts (branchId = device.branchId), AND
 *   - global shifts (branchId = null)
 *
 * Includes ordered segments. The kiosk renders this as the shift-picker dialog.
 */
export async function GET(req: Request) {
  const authed = await authenticateKiosk(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shifts = await prisma.shift.findMany({
    where: {
      isActive: true,
      OR: [{ branchId: authed.device.branchId }, { branchId: null }],
    },
    include: {
      segments: { orderBy: { sortOrder: "asc" }, select: { startTime: true, endTime: true, sortOrder: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    shifts: shifts.map((s) => ({
      id: s.id,
      name: s.name,
      segments: s.segments.map((seg) => ({ startTime: seg.startTime, endTime: seg.endTime })),
    })),
  });
}
