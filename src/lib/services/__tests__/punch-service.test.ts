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
