import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AzureStorageService } from "@/lib/azure-storage";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

const WARNING_PHOTOS_FOLDER = "warnings/photos";

function getRole(session: unknown): string | undefined {
  const s = session as { user?: { role?: string } };
  return s.user?.role;
}

function getSessionUserId(session: unknown): string | undefined {
  const s = session as { user?: { id?: string } };
  return s.user?.id;
}

async function assertBranchManagerCanAccessUser(managerId: string, targetUserId: string) {
  const [target, manager] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetUserId }, select: { branchId: true } }),
    prisma.user.findUnique({ where: { id: managerId }, select: { managedBranchId: true, branchId: true } }),
  ]);

  const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
  if (!managerBranchId || managerBranchId !== target?.branchId) {
    return false;
  }
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const role = getRole(session);
    const reporterId = getSessionUserId(session);

    if (!reporterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only HR/MANAGEMENT/BRANCH_MANAGER can register warnings
    if (!role || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, branchId: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Branch managers can only register warnings for users in their branch
    if (role === "BRANCH_MANAGER") {
      const ok = await assertBranchManagerCanAccessUser(reporterId, userId);
      if (!ok) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const formData = await req.formData();
    const reason = (formData.get("reason") as string | null)?.trim();
    const file = formData.get("file") as File | null;

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }

    let photoUrl: string | null = null;
    if (file) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Photo must be an image" }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Photo size must be less than 5MB" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const azureStorage = new AzureStorageService();
      const filename = `${userId}-${Date.now()}-${file.name}`;
      photoUrl = await azureStorage.uploadImage(buffer, filename, WARNING_PHOTOS_FOLDER, file.type);
    }

    const warning = await prisma.warning.create({
      data: {
        userId,
        reportedById: reporterId,
        reason,
        photoUrl,
        isArchived: false,
      },
      include: {
        reportedBy: { select: { id: true, name: true } },
      },
    });

    await logEntityActivity(
      ActivityType.OTHER,
      reporterId,
      "Warning",
      warning.id,
      `Registered warning for ${targetUser.name ?? "employee"}: ${reason}`,
      {
        warningId: warning.id,
        userId,
        reportedById: reporterId,
        hasPhoto: Boolean(photoUrl),
      },
      req
    );

    return NextResponse.json(warning, { status: 201 });
  } catch (error) {
    console.error("Error creating warning:", error);
    return NextResponse.json({ error: "Failed to create warning" }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;
    const role = getRole(session);
    const sessionUserId = getSessionUserId(session);
    const isSelf = sessionUserId === userId;

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Self can view their warnings; HR/MANAGEMENT/BRANCH_MANAGER can view (branch-scoped for BRANCH_MANAGER)
    if (!isSelf && (!role || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isSelf && role === "BRANCH_MANAGER") {
      const ok = await assertBranchManagerCanAccessUser(sessionUserId, userId);
      if (!ok) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const url = new URL(req.url);
    const archivedParam = (url.searchParams.get("archived") || "false").toLowerCase();
    const includeArchived = archivedParam === "all";
    const isArchived = archivedParam === "true";

    const warnings = await prisma.warning.findMany({
      where: includeArchived ? { userId } : { userId, isArchived },
      include: {
        reportedBy: { select: { id: true, name: true } },
        archivedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(warnings);
  } catch (error) {
    console.error("Error fetching warnings:", error);
    return NextResponse.json({ error: "Failed to fetch warnings" }, { status: 500 });
  }
}

