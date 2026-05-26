import { NextResponse } from "next/server";
import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  generateKioskToken,
  hashKioskToken,
} from "@/lib/kiosk-auth";
import { logEntityActivity } from "@/lib/services/activity-log";

/**
 * Admin-only: provision a new KioskDevice.
 *
 * Returns the raw token EXACTLY ONCE in the response. We only store its SHA-256.
 * The kiosk operator must copy this into the device's secure storage immediately.
 *
 * Body: { name: string; branchId: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  // @ts-expect-error session.user.role typed in app
  const role: string | undefined = session?.user?.role;
  if (!session || !role || !["HR", "MANAGEMENT"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; branchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const branchId = body.branchId?.trim();
  if (!name || !branchId) {
    return NextResponse.json({ error: "name and branchId are required" }, { status: 400 });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  const rawToken = generateKioskToken();
  const tokenHash = hashKioskToken(rawToken);

  let device;
  try {
    device = await prisma.kioskDevice.create({
      data: { name, branchId, tokenHash, isActive: true },
      select: { id: true, name: true, branchId: true, isActive: true, createdAt: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A kiosk device with this name already exists at this branch" },
        { status: 409 }
      );
    }
    throw e;
  }

  await logEntityActivity(
    ActivityType.KIOSK_DEVICE_CREATED,
    // @ts-expect-error session.user.id typed in app
    session.user.id,
    "KioskDevice",
    device.id,
    `Provisioned kiosk device "${device.name}" for branch ${branch.name}`,
    { deviceId: device.id, branchId, branchName: branch.name },
    req
  );

  return NextResponse.json({
    device,
    token: rawToken,
    warning: "Token shown ONCE. Store it in the kiosk's secure credential store now — it cannot be retrieved later.",
  }, { status: 201 });
}
