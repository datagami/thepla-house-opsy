import { NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateKiosk } from "@/lib/kiosk-auth";
import { logEntityActivity } from "@/lib/services/activity-log";

/**
 * POST /api/kiosk/fingerprints/enroll
 *
 * Body: { userId: string; fingerIndex: number (0..9); templateData: string (base64 ISO 19794-2) }
 *
 * Globally enrollable — any kiosk in HR enroll-mode can enroll any active user
 * (the spec calls this out: identification is global so the user can punch
 * anywhere they're assigned). Upserts on (userId, fingerIndex) so re-enrolling
 * a finger replaces the old template.
 */
export async function POST(req: Request) {
  const authed = await authenticateKiosk(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; fingerIndex?: number; templateData?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, fingerIndex, templateData } = body;
  if (!userId || typeof fingerIndex !== "number" || !templateData) {
    return NextResponse.json(
      { error: "userId, fingerIndex (number), and templateData are required" },
      { status: 400 }
    );
  }
  if (fingerIndex < 0 || fingerIndex > 9 || !Number.isInteger(fingerIndex)) {
    return NextResponse.json({ error: "fingerIndex must be an integer 0..9" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, status: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "User is not ACTIVE" }, { status: 409 });
  }

  const enrollment = await prisma.fingerprintEnrollment.upsert({
    where: { userId_fingerIndex: { userId, fingerIndex } },
    create: {
      userId,
      fingerIndex,
      templateData,
      enrolledByDeviceId: authed.device.id,
      isActive: true,
    },
    update: {
      templateData,
      isActive: true,
      enrolledByDeviceId: authed.device.id,
    },
    select: { id: true, userId: true, fingerIndex: true, isActive: true, updatedAt: true },
  });

  await logEntityActivity(
    ActivityType.FINGERPRINT_ENROLLED,
    user.id,
    "FingerprintEnrollment",
    enrollment.id,
    `Fingerprint enrolled for ${user.name} (finger ${fingerIndex})`,
    { userId, fingerIndex, kioskDeviceId: authed.device.id },
    req
  );

  return NextResponse.json({ enrollment }, { status: 201 });
}
