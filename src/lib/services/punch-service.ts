import { ActivityType, PunchDirection, PunchOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type GroomingResult } from "@/lib/services/grooming-check";
import { logEntityActivity } from "@/lib/services/activity-log";

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

export async function recordPunch(input: RecordPunchInput): Promise<RecordPunchResult> {
  const { device, userId, direction, punchedAt, request } = input;

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

  // Authorized — TODO in next tasks: upload, grooming, PunchEvent, Attendance upsert, salary guard
  throw new Error("NOT_IMPLEMENTED_YET");
}
