import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authenticateKiosk, hashKioskToken } from '@/lib/kiosk-auth';
import { prisma } from '@/lib/prisma';

// Use an in-test fake of prisma.kioskDevice
vi.mock('@/lib/prisma', () => ({
  prisma: {
    kioskDevice: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

function reqWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/kiosk/handshake', { headers });
}

// Helper: builds a complete KioskDevice for mocking findUnique. The production
// code only `select`s a subset, but vi.mocked types the return as the full
// model — so we fill in defaults for the un-touched fields.
function mockDevice(overrides: {
  id: string;
  branchId: string;
  name: string;
  tokenHash: string;
  isActive: boolean;
}) {
  return {
    numId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hashKioskToken', () => {
  it('produces a stable lowercase hex SHA-256', () => {
    expect(hashKioskToken('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });
});

describe('authenticateKiosk', () => {
  it('returns null when Authorization header is missing', async () => {
    const result = await authenticateKiosk(
      reqWith({ 'X-Kiosk-Device-Id': 'dev_1' })
    );
    expect(result).toBeNull();
  });

  it('returns null when X-Kiosk-Device-Id is missing', async () => {
    const result = await authenticateKiosk(
      reqWith({ Authorization: 'Bearer abc' })
    );
    expect(result).toBeNull();
  });

  it('returns null when device not found', async () => {
    vi.mocked(prisma.kioskDevice.findUnique).mockResolvedValueOnce(null);
    const result = await authenticateKiosk(
      reqWith({ Authorization: 'Bearer abc', 'X-Kiosk-Device-Id': 'dev_x' })
    );
    expect(result).toBeNull();
  });

  it('returns null when device is inactive', async () => {
    vi.mocked(prisma.kioskDevice.findUnique).mockResolvedValueOnce(mockDevice({
      id: 'dev_1',
      branchId: 'b1',
      name: 'Smoke Kiosk',
      tokenHash: hashKioskToken('correct-token'),
      isActive: false,
    }));
    const result = await authenticateKiosk(
      reqWith({ Authorization: 'Bearer correct-token', 'X-Kiosk-Device-Id': 'dev_1' })
    );
    expect(result).toBeNull();
  });

  it('returns null when token hash mismatches', async () => {
    vi.mocked(prisma.kioskDevice.findUnique).mockResolvedValueOnce(mockDevice({
      id: 'dev_1',
      branchId: 'b1',
      name: 'Smoke Kiosk',
      tokenHash: hashKioskToken('correct-token'),
      isActive: true,
    }));
    const result = await authenticateKiosk(
      reqWith({ Authorization: 'Bearer WRONG', 'X-Kiosk-Device-Id': 'dev_1' })
    );
    expect(result).toBeNull();
  });

  it('returns { device } on a valid match and fires lastSeenAt update', async () => {
    vi.mocked(prisma.kioskDevice.findUnique).mockResolvedValueOnce(mockDevice({
      id: 'dev_1',
      branchId: 'b1',
      name: 'Smoke Kiosk',
      tokenHash: hashKioskToken('correct-token'),
      isActive: true,
    }));
    const result = await authenticateKiosk(
      reqWith({ Authorization: 'Bearer correct-token', 'X-Kiosk-Device-Id': 'dev_1' })
    );
    expect(result).not.toBeNull();
    expect(result!.device.id).toBe('dev_1');
    expect(prisma.kioskDevice.update).toHaveBeenCalledWith({
      where: { id: 'dev_1' },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('uses timing-safe compare (different hash lengths return null)', async () => {
    vi.mocked(prisma.kioskDevice.findUnique).mockResolvedValueOnce(mockDevice({
      id: 'dev_1',
      branchId: 'b1',
      name: 'Smoke Kiosk',
      tokenHash: 'short',
      isActive: true,
    }));
    const result = await authenticateKiosk(
      reqWith({ Authorization: 'Bearer anything', 'X-Kiosk-Device-Id': 'dev_1' })
    );
    expect(result).toBeNull();
  });
});
