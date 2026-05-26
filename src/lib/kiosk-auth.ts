import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface AuthenticatedKiosk {
  device: {
    id: string;
    branchId: string;
    name: string;
  };
}

/** SHA-256 hex of a raw kiosk token. Stable lowercase. */
export function hashKioskToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Generate a new 32-byte base64url token for device provisioning. */
export function generateKioskToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Verify a kiosk request's `Authorization: Bearer <token>` + `X-Kiosk-Device-Id` headers.
 * Returns `{ device }` on success, `null` on any failure (caller decides 401 vs other status).
 *
 * Fires a fire-and-forget `lastSeenAt` update; failures are swallowed so monitoring noise
 * never blocks a punch.
 */
export async function authenticateKiosk(
  request: Request
): Promise<AuthenticatedKiosk | null> {
  const auth = request.headers.get("authorization");
  const deviceId = request.headers.get("x-kiosk-device-id");

  if (!auth || !deviceId) return null;
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const rawToken = auth.slice(7).trim();
  if (!rawToken) return null;

  const device = await prisma.kioskDevice.findUnique({
    where: { id: deviceId },
    select: { id: true, branchId: true, name: true, tokenHash: true, isActive: true },
  });
  if (!device || !device.isActive) return null;

  const incomingHash = hashKioskToken(rawToken);

  // Timing-safe compare — bail before timingSafeEqual on length mismatch (it throws otherwise)
  const a = Buffer.from(incomingHash, "utf8");
  const b = Buffer.from(device.tokenHash, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  // Fire-and-forget lastSeenAt update — never block a punch on this
  void prisma.kioskDevice
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => { /* swallow */ });

  return {
    device: { id: device.id, branchId: device.branchId, name: device.name },
  };
}
