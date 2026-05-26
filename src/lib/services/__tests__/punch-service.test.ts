import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { recordPunch } from '@/lib/services/punch-service';

// Stub the grooming + upload services — punch-service tests should not hit Azure
vi.mock('@/lib/services/grooming-check', () => ({
  checkGrooming: vi.fn(async () => ({
    uniform: { status: 'PASS', reason: 'ok', confidence: 0.9, rawResponse: '{}' },
    nails:   { status: 'PASS', reason: 'ok', confidence: 0.9, rawResponse: '{}' },
    overallPass: true,
  })),
}));
vi.mock('@/lib/azure-storage', () => ({
  AzureStorageService: class {
    async uploadBase64Image(_b: string, fileName: string, folder: string) {
      return `https://fake-blob/${folder}/${fileName}`;
    }
  },
}));

// Test fixtures — created fresh per test
let branchA: { id: string };
let branchB: { id: string };
let device: { id: string };
let user: { id: string };
let shift: { id: string };

beforeEach(async () => {
  const suffix = `_${Math.random().toString(36).slice(2, 8)}`;
  branchA = await prisma.branch.create({
    data: { name: `BR-A${suffix}`, city: 'Mumbai', state: 'MH' },
  });
  branchB = await prisma.branch.create({
    data: { name: `BR-B${suffix}`, city: 'Mumbai', state: 'MH' },
  });
  device = await prisma.kioskDevice.create({
    data: { name: `dev${suffix}`, branchId: branchA.id, tokenHash: `hash${suffix}`, isActive: true },
  });
  user = await prisma.user.create({
    data: {
      name: `Punch User${suffix}`,
      email: `punch${suffix}@test.local`,
      branchId: branchA.id,
      status: 'ACTIVE',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  shift = await prisma.shift.create({
    data: {
      name: `Full Day${suffix}`,
      branchId: null,
      isActive: true,
      sortOrder: 0,
      segments: { create: [{ startTime: '07:00', endTime: '19:00', sortOrder: 0 }] },
    },
  });
});

afterEach(async () => {
  // Clean up in FK-safe order
  await prisma.punchEvent.deleteMany({ where: { OR: [{ branchId: branchA.id }, { branchId: branchB.id }] } });
  await prisma.attendance.deleteMany({ where: { userId: user.id } });
  await prisma.fingerprintEnrollment.deleteMany({ where: { userId: user.id } });
  await prisma.salary.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.shiftSegment.deleteMany({ where: { shiftId: shift.id } });
  await prisma.shift.delete({ where: { id: shift.id } }).catch(() => {});
  await prisma.kioskDevice.delete({ where: { id: device.id } }).catch(() => {});
  await prisma.branch.delete({ where: { id: branchA.id } }).catch(() => {});
  await prisma.branch.delete({ where: { id: branchB.id } }).catch(() => {});
});

describe('recordPunch — outlet gate', () => {
  it('REJECTS when employee.branchId != device.branchId', async () => {
    // Move user to branchB but they punch at branchA's kiosk
    await prisma.user.update({ where: { id: user.id }, data: { branchId: branchB.id } });

    const result = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id,
      shiftId: shift.id,
      direction: 'IN',
      punchedAt: new Date('2026-05-26T03:30:00Z'),
      uniformPhotoBase64: 'AAAA',
      nailsPhotoBase64: 'BBBB',
    });

    expect(result.blocked).toBe(true);
    expect(result.outcome).toBe('BLOCKED_WRONG_OUTLET');
    expect(result.assignedBranchId).toBe(branchB.id);

    // A PunchEvent exists with the right shape
    const events = await prisma.punchEvent.findMany({ where: { userId: user.id } });
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('BLOCKED_WRONG_OUTLET');
    expect(events[0].branchId).toBe(branchA.id);          // where the attempt happened
    expect(events[0].assignedBranchId).toBe(branchB.id);  // where they should have punched
    expect(events[0].attendanceId).toBeNull();
    expect(events[0].uniformPhotoUrl).toBeNull();
    expect(events[0].nailsPhotoUrl).toBeNull();

    // No Attendance row created
    const att = await prisma.attendance.findMany({ where: { userId: user.id } });
    expect(att).toHaveLength(0);
  });

  it('RECORDS when employee.branchId == device.branchId', async () => {
    const result = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id,
      shiftId: shift.id,
      direction: 'IN',
      punchedAt: new Date('2026-05-26T03:30:00Z'),
      uniformPhotoBase64: 'AAAA',
      nailsPhotoBase64: 'BBBB',
    });

    expect(result.blocked).toBeFalsy();
    expect(result.outcome).toBe('RECORDED');
    expect(result.attendanceId).toBeTruthy();
    expect(result.grooming?.overallPass).toBe(true);

    const events = await prisma.punchEvent.findMany({ where: { userId: user.id } });
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('RECORDED');
    expect(events[0].attendanceId).toBe(result.attendanceId);
    expect(events[0].uniformPhotoUrl).toContain('uniform');
    expect(events[0].nailsPhotoUrl).toContain('nails');
  });
});

describe('recordPunch — authorized path', () => {
  it('creates Attendance with checkIn (IST) on first IN of the day', async () => {
    const r = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id,
      shiftId: shift.id,
      direction: 'IN',
      punchedAt: new Date('2026-05-26T03:30:00Z'), // 09:00 IST
      uniformPhotoBase64: 'AAAA',
      nailsPhotoBase64: 'BBBB',
    });
    const att = await prisma.attendance.findFirstOrThrow({ where: { id: r.attendanceId } });
    expect(att.userId).toBe(user.id);
    expect(att.branchId).toBe(branchA.id);
    expect(att.checkIn).toBe('09:00');
    expect(att.checkOut).toBeNull();
    expect(att.isPresent).toBe(true);
    expect(att.status).toBe('PENDING_VERIFICATION');
  });

  it('upserts the same Attendance and sets checkOut on the OUT punch', async () => {
    const inR = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: shift.id, direction: 'IN',
      punchedAt: new Date('2026-05-26T03:30:00Z'),
      uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    const outR = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: shift.id, direction: 'OUT',
      punchedAt: new Date('2026-05-26T13:30:00Z'), // 19:00 IST
      uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    expect(outR.attendanceId).toBe(inR.attendanceId); // same row, upserted

    const att = await prisma.attendance.findFirstOrThrow({ where: { id: inR.attendanceId } });
    expect(att.checkIn).toBe('09:00');
    expect(att.checkOut).toBe('19:00');

    const events = await prisma.punchEvent.findMany({ where: { userId: user.id }, orderBy: { punchedAt: 'asc' } });
    expect(events).toHaveLength(2);
    expect(events[0].direction).toBe('IN');
    expect(events[1].direction).toBe('OUT');
    expect(events.every((e) => e.attendanceId === inR.attendanceId)).toBe(true);
  });

  it('places a near-midnight punch on the correct IST calendar day', async () => {
    // 2026-05-26T18:35:00Z == 00:05 IST on 2026-05-27 — must be on the 27th
    const r = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: shift.id, direction: 'IN',
      punchedAt: new Date('2026-05-26T18:35:00Z'),
      uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    const att = await prisma.attendance.findFirstOrThrow({ where: { id: r.attendanceId } });
    expect(att.date.toISOString().slice(0, 10)).toBe('2026-05-27');
    expect(att.checkIn).toBe('00:05');
  });

  it('maps a split-shift IN at 07:00 IST to shift1 (best-effort legacy flag)', async () => {
    // Break One: 07:00-15:00 + 19:00-23:00
    const breakOne = await prisma.shift.create({
      data: {
        name: `Break One ${Math.random()}`,
        branchId: null,
        isActive: true,
        sortOrder: 0,
        segments: { create: [
          { startTime: '07:00', endTime: '15:00', sortOrder: 0 },
          { startTime: '19:00', endTime: '23:00', sortOrder: 1 },
        ]},
      },
    });
    const r = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: breakOne.id, direction: 'IN',
      punchedAt: new Date('2026-05-26T01:30:00Z'), // 07:00 IST
      uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    const att = await prisma.attendance.findFirstOrThrow({ where: { id: r.attendanceId } });
    expect(att.shift1).toBe(true);
    expect(att.shift2 ?? false).toBe(false);
    expect(att.shift3 ?? false).toBe(false);

    // Cleanup
    await prisma.punchEvent.deleteMany({ where: { shiftId: breakOne.id } });
    await prisma.shiftSegment.deleteMany({ where: { shiftId: breakOne.id } });
    await prisma.shift.delete({ where: { id: breakOne.id } });
  });

  it('handles concurrent IN punches for the same user/day (P2002 retry)', async () => {
    // Two parallel IN punches with the same userId+date
    const [r1, r2] = await Promise.all([
      recordPunch({
        device: { id: device.id, branchId: branchA.id },
        userId: user.id, shiftId: shift.id, direction: 'IN',
        punchedAt: new Date('2026-05-26T03:30:00Z'),
        uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
      }),
      recordPunch({
        device: { id: device.id, branchId: branchA.id },
        userId: user.id, shiftId: shift.id, direction: 'IN',
        punchedAt: new Date('2026-05-26T03:30:00Z'),
        uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
      }),
    ]);
    // Both succeed; both reference the same Attendance row
    expect(r1.outcome).toBe('RECORDED');
    expect(r2.outcome).toBe('RECORDED');
    expect(r1.attendanceId).toBe(r2.attendanceId);
    // Exactly one Attendance row exists
    const atts = await prisma.attendance.findMany({ where: { userId: user.id } });
    expect(atts).toHaveLength(1);
    // Two PunchEvents exist, both referencing it
    const events = await prisma.punchEvent.findMany({ where: { userId: user.id } });
    expect(events).toHaveLength(2);
    expect(events.every(e => e.attendanceId === r1.attendanceId)).toBe(true);
  });
});

describe('recordPunch — salary recalc guard', () => {
  it('no salary row → no recalc, punch succeeds', async () => {
    const r = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: shift.id, direction: 'IN',
      punchedAt: new Date('2026-05-26T03:30:00Z'),
      uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    expect(r.outcome).toBe('RECORDED');
    // No throw, no salary row — nothing to assert beyond the punch succeeding
  });

  it('PROCESSING salary → punch succeeds, recalc SKIPPED (status preserved)', async () => {
    const punchAt = new Date('2026-05-26T03:30:00Z');
    const sal = await prisma.salary.create({
      data: {
        userId: user.id,
        month: 5, // May in IST
        year: 2026,
        status: 'PROCESSING',
        baseSalary: 0,
        netSalary: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const r = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: shift.id, direction: 'IN',
      punchedAt: punchAt, uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    expect(r.outcome).toBe('RECORDED');
    const after = await prisma.salary.findUnique({ where: { id: sal.id } });
    expect(after?.status).toBe('PROCESSING');
    await prisma.salary.delete({ where: { id: sal.id } });
  });

  it('PENDING salary → punch succeeds, calculateSalary called', async () => {
    const punchAt = new Date('2026-05-26T03:30:00Z');
    // calculateSalary() requires User.salary to be set; the default fixture
    // user has no base salary, so the calculator would throw "Employee base
    // salary not found". Give the user a base salary for this test.
    await prisma.user.update({ where: { id: user.id }, data: { salary: 10000 } });
    const sal = await prisma.salary.create({
      data: {
        userId: user.id,
        month: 5,
        year: 2026,
        status: 'PENDING',
        baseSalary: 0,
        netSalary: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    // We can't easily assert calculateSalary was called without mocking the module,
    // so assert downstream: the Salary row was updated (updatedAt > created).
    const beforeUpdatedAt = sal.updatedAt;
    await new Promise((r) => setTimeout(r, 20));
    const r = await recordPunch({
      device: { id: device.id, branchId: branchA.id },
      userId: user.id, shiftId: shift.id, direction: 'IN',
      punchedAt: punchAt, uniformPhotoBase64: 'A', nailsPhotoBase64: 'B',
    });
    expect(r.outcome).toBe('RECORDED');
    const after = await prisma.salary.findUnique({ where: { id: sal.id } });
    expect(after!.updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
    await prisma.salary.delete({ where: { id: sal.id } });
  });
});
