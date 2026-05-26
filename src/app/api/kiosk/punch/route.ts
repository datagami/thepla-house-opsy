import { NextResponse } from "next/server";
import { PunchDirection, PunchOutcome } from "@prisma/client";
import { authenticateKiosk } from "@/lib/kiosk-auth";
import { recordPunch } from "@/lib/services/punch-service";

export const runtime = "nodejs";
export const maxDuration = 30; // 8s grooming + safety margin
export const dynamic = "force-dynamic";

/**
 * POST /api/kiosk/punch
 *
 * Body:
 *   {
 *     userId: string,
 *     shiftId: string,
 *     direction: "IN" | "OUT",
 *     punchedAt: ISO-UTC string,          // kiosk-stamped
 *     uniformPhoto: base64 string,         // no data: prefix
 *     nailsPhoto:   base64 string
 *   }
 *
 * Responses:
 *   200 OK { punchEventId, attendanceId, direction, punchedAt, grooming, overallGroomingPass }
 *   403 { blocked: true, reason: "WRONG_OUTLET", assignedBranch: { id, name } }  ← outlet gate
 *   400 invalid body, 401 bad auth, 404 user missing, 500 unexpected
 */
export async function POST(req: Request) {
  const authed = await authenticateKiosk(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    userId?: string;
    shiftId?: string;
    direction?: string;
    punchedAt?: string;
    uniformPhoto?: string;
    nailsPhoto?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, shiftId, direction, punchedAt, uniformPhoto, nailsPhoto } = body;
  if (!userId || !shiftId || !direction || !punchedAt || !uniformPhoto || !nailsPhoto) {
    return NextResponse.json(
      { error: "userId, shiftId, direction, punchedAt, uniformPhoto, nailsPhoto are all required" },
      { status: 400 }
    );
  }
  if (direction !== "IN" && direction !== "OUT") {
    return NextResponse.json({ error: 'direction must be "IN" or "OUT"' }, { status: 400 });
  }
  const punchedAtDate = new Date(punchedAt);
  if (isNaN(punchedAtDate.getTime())) {
    return NextResponse.json({ error: "punchedAt must be a valid ISO date" }, { status: 400 });
  }

  try {
    const result = await recordPunch({
      device: { id: authed.device.id, branchId: authed.device.branchId },
      userId,
      shiftId,
      direction: direction as PunchDirection,
      punchedAt: punchedAtDate,
      uniformPhotoBase64: uniformPhoto,
      nailsPhotoBase64: nailsPhoto,
      request: req,
    });

    if (result.outcome === PunchOutcome.BLOCKED_WRONG_OUTLET) {
      return NextResponse.json(
        {
          blocked: true,
          reason: "WRONG_OUTLET",
          assignedBranch:
            result.assignedBranchId
              ? { id: result.assignedBranchId, name: result.assignedBranchName ?? null }
              : null,
          punchEventId: result.punchEventId,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      punchEventId: result.punchEventId,
      attendanceId: result.attendanceId,
      direction: result.direction,
      punchedAt: result.punchedAt,
      grooming: result.grooming,
      overallGroomingPass: result.grooming?.overallPass ?? false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("[kiosk/punch] unexpected error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
