import { ActivityType, Prisma, PunchDirection, PunchOutcome, type GroomingCheckStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkGrooming, type GroomingResult } from "@/lib/services/grooming-check";
import { logEntityActivity } from "@/lib/services/activity-log";
import { AzureStorageService } from "@/lib/azure-storage";
import { toISTDate, toISTTimeString } from "@/lib/kiosk-time";

export interface RecordPunchInput {
  device: { id: string; branchId: string };
  userId: string;
  shiftId: string;
  direction: PunchDirection;
  punchedAt: Date; // UTC, sent by kiosk
  uniformPhotoBase64: string;
  nailsPhotoBase64: string;
  request?: Request; // for activity-log IP/UA
}

export interface RecordPunchResult {
  punchEventId: string;
  outcome: PunchOutcome;
  blocked?: boolean;
  reason?: "WRONG_OUTLET";
  assignedBranchId?: string;
  assignedBranchName?: string;
  attendanceId?: string;
  direction?: PunchDirection;
  punchedAt?: string;
  grooming?: GroomingResult;
}

const azure = new AzureStorageService();

export async function recordPunch(input: RecordPunchInput): Promise<RecordPunchResult> {
  const { device, userId, shiftId, direction, punchedAt, request } = input;

  // Resolve the employee
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, branchId: true, status: true },
  });
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  // ─── Outlet gate ───
  if (employee.branchId !== device.branchId) {
    const blocked = await prisma.punchEvent.create({
      data: {
        userId: employee.id,
        kioskDeviceId: device.id,
        branchId: device.branchId,
        assignedBranchId: employee.branchId,
        direction,
        punchedAt,
        outcome: PunchOutcome.BLOCKED_WRONG_OUTLET,
        // no photos, no grooming, no shift, no attendanceId
      },
      select: { id: true },
    });

    const assignedBranch = employee.branchId
      ? await prisma.branch.findUnique({
          where: { id: employee.branchId },
          select: { id: true, name: true },
        })
      : null;

    await logEntityActivity(
      ActivityType.PUNCH_BLOCKED_WRONG_OUTLET,
      employee.id,
      "PunchEvent",
      blocked.id,
      `Punch blocked: ${employee.name} attempted at kiosk branch ${device.branchId} but assigned to ${employee.branchId ?? "<none>"}`,
      {
        punchEventId: blocked.id,
        attemptedBranchId: device.branchId,
        assignedBranchId: employee.branchId,
      },
      request
    );

    return {
      punchEventId: blocked.id,
      outcome: PunchOutcome.BLOCKED_WRONG_OUTLET,
      blocked: true,
      reason: "WRONG_OUTLET",
      assignedBranchId: employee.branchId ?? undefined,
      assignedBranchName: assignedBranch?.name,
    };
  }

  // ─── Authorized path ───

  // 1. Create the PunchEvent first (without urls/grooming) so we have a stable
  //    id to use as the filename for the photo uploads.
  const tempPunch = await prisma.punchEvent.create({
    data: {
      userId: employee.id,
      kioskDeviceId: device.id,
      branchId: device.branchId,
      assignedBranchId: employee.branchId,
      shiftId,
      direction,
      punchedAt,
      outcome: PunchOutcome.RECORDED,
    },
    select: { id: true },
  });

  const ymd = toISTDate(punchedAt).toISOString().slice(0, 10);
  const [uniformUrl, nailsUrl] = await Promise.all([
    azure
      .uploadBase64Image(
        input.uniformPhotoBase64,
        `${tempPunch.id}-uniform.jpg`,
        `kiosk-punches/${ymd.replace(/-/g, "/")}`,
        "image/jpeg"
      )
      .catch(() => null),
    azure
      .uploadBase64Image(
        input.nailsPhotoBase64,
        `${tempPunch.id}-nails.jpg`,
        `kiosk-punches/${ymd.replace(/-/g, "/")}`,
        "image/jpeg"
      )
      .catch(() => null),
  ]);

  // 2. Grooming verdicts (parallel inside the service; never throws)
  const grooming = await checkGrooming(uniformUrl, nailsUrl);

  // 3. Attendance upsert (IST date + IST HH:mm)
  const istDate = toISTDate(punchedAt);
  const istHHmm = toISTTimeString(punchedAt);

  // Compute legacy shift flag (best-effort) by segment overlap at the punch instant
  const shiftRow = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { segments: { orderBy: { sortOrder: "asc" } } },
  });
  const legacyFlag = pickLegacyShiftFlag(shiftRow?.segments ?? [], istHHmm);

  // Race handling (P2002 on simultaneous upsert): Prisma's `upsert` is not atomic
  // across processes — two concurrent IN punches for the same (userId, date) can
  // both enter the create branch and one will throw P2002. The retry below
  // re-attempts; on the second pass the row exists so it becomes a pure update.
  const attendance = await upsertAttendanceWithRetry({
    where: { userId_date: { userId: employee.id, date: istDate } },
    create: {
      userId: employee.id,
      date: istDate,
      isPresent: true,
      checkIn: direction === PunchDirection.IN ? istHHmm : null,
      checkOut: direction === PunchDirection.OUT ? istHHmm : null,
      branchId: device.branchId,
      status: "PENDING_VERIFICATION",
      shift1: legacyFlag === 1,
      shift2: legacyFlag === 2,
      shift3: legacyFlag === 3,
    } as any,
    update: {
      isPresent: true,
      // On OUT: always set checkOut (latest OUT of the day wins)
      ...(direction === PunchDirection.OUT ? { checkOut: istHHmm } : {}),
      // On IN: do NOT set checkIn here — Prisma update can't do "set only if null".
      //        We do that as a separate updateMany below so a re-punch IN
      //        doesn't overwrite the original morning checkIn.
    },
  });

  // Conditional "set checkIn only if empty" for IN punches
  if (direction === PunchDirection.IN) {
    await prisma.attendance.updateMany({
      where: { id: attendance.id, checkIn: null },
      data: { checkIn: istHHmm },
    });
  }

  // 4. Patch the PunchEvent with photo URLs + grooming verdicts + attendanceId
  const punchEvent = await prisma.punchEvent.update({
    where: { id: tempPunch.id },
    data: {
      attendanceId: attendance.id,
      uniformPhotoUrl: uniformUrl,
      nailsPhotoUrl: nailsUrl,
      uniformCheckStatus: grooming.uniform.status as GroomingCheckStatus,
      nailsCheckStatus: grooming.nails.status as GroomingCheckStatus,
      uniformCheckReason: grooming.uniform.reason,
      nailsCheckReason: grooming.nails.reason,
      uniformConfidence: grooming.uniform.confidence,
      nailsConfidence: grooming.nails.confidence,
      aiRawResponse: JSON.stringify({
        uniform: grooming.uniform.rawResponse,
        nails: grooming.nails.rawResponse,
      }),
    },
    select: { id: true },
  });

  // 5. Salary recalc guard — implemented in Task 13
  await maybeRecalcSalary(employee.id, punchedAt, request);

  // 6. Activity logs
  await logEntityActivity(
    direction === PunchDirection.IN ? ActivityType.PUNCH_IN : ActivityType.PUNCH_OUT,
    employee.id,
    "PunchEvent",
    punchEvent.id,
    `${employee.name} punched ${direction} at ${istHHmm} IST`,
    {
      punchEventId: punchEvent.id,
      attendanceId: attendance.id,
      shiftId,
      grooming: { uniform: grooming.uniform.status, nails: grooming.nails.status, overallPass: grooming.overallPass },
    },
    request
  );
  if (!grooming.overallPass) {
    await logEntityActivity(
      ActivityType.GROOMING_CHECK_FAILED,
      employee.id,
      "PunchEvent",
      punchEvent.id,
      `Grooming failed: uniform=${grooming.uniform.status} (${grooming.uniform.reason ?? "-"}), nails=${grooming.nails.status} (${grooming.nails.reason ?? "-"})`,
      { punchEventId: punchEvent.id, grooming },
      request
    );
  }

  return {
    punchEventId: punchEvent.id,
    outcome: PunchOutcome.RECORDED,
    attendanceId: attendance.id,
    direction,
    punchedAt: punchedAt.toISOString(),
    grooming,
  };
}

/**
 * Best-effort legacy shift1/2/3 flag from segment start times (HH:mm in branch-local / IST).
 *  - Segment starting < 12:00 → 1
 *  - Segment starting 12:00..16:59 → 2
 *  - Segment starting >= 17:00 → 3
 * If a shift has multiple segments we pick the one whose [start, end] window covers `nowHHmm`,
 * else fall back to the first segment.
 */
export function pickLegacyShiftFlag(
  segments: Array<{ startTime: string; endTime: string }>,
  nowHHmm: string
): 1 | 2 | 3 | null {
  if (segments.length === 0) return null;
  const inWindow = segments.find((s) => withinWindow(s.startTime, s.endTime, nowHHmm)) ?? segments[0];
  const startHour = parseInt(inWindow.startTime.split(":")[0], 10);
  if (startHour < 12) return 1;
  if (startHour < 17) return 2;
  return 3;
}

function withinWindow(start: string, end: string, now: string): boolean {
  // Compare as "HH:mm" — works for windows fully within a single day.
  // For wrap-around windows (start > end, e.g. "22:00"-"06:00"), treat as crossing midnight.
  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}

// Stub — implemented in Task 13
async function maybeRecalcSalary(_userId: string, _punchedAt: Date, _req?: Request): Promise<void> {
  // intentional no-op until Task 13
}

/**
 * Wrap Prisma's upsert with a single retry for P2002 races. Two concurrent
 * IN punches for the same (userId, date) can both enter the create branch
 * and one will throw `Prisma.PrismaClientKnownRequestError` with code 'P2002'.
 * On retry, the row exists, so the upsert collapses to a pure update.
 */
async function upsertAttendanceWithRetry(
  args: Parameters<typeof prisma.attendance.upsert>[0],
  attempts = 2
): Promise<Awaited<ReturnType<typeof prisma.attendance.upsert>>> {
  try {
    return await prisma.attendance.upsert(args);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      attempts > 1
    ) {
      // The other request won the create race — re-attempt; this time the
      // row exists, so it'll go through the update branch.
      return upsertAttendanceWithRetry(args, attempts - 1);
    }
    throw e;
  }
}
