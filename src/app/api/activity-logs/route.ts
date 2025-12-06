import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActivityLogs, getActivityStats } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";
import { hasAccess } from "@/lib/access-control";

/**
 * GET /api/activity-logs
 * Retrieves activity logs with filtering and pagination
 * 
 * Query parameters:
 * - userId: Filter by user who performed the action
 * - targetUserId: Filter by target user
 * - activityType: Filter by activity type
 * - entityType: Filter by entity type
 * - targetId: Filter by target entity ID
 * - startDate: Start date for filtering (ISO string)
 * - endDate: End date for filtering (ISO string)
 * - limit: Number of results (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 * - stats: If true, returns statistics instead of logs
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only HR and MANAGEMENT can view activity logs
    // @ts-expect-error - role is not defined in the session type
    const canViewLogs = hasAccess(session.user.role, "activity-logs.view");
    
    if (!canViewLogs) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Check if stats are requested
    const statsOnly = searchParams.get("stats") === "true";
    
    if (statsOnly) {
      const startDate = searchParams.get("startDate")
        ? new Date(searchParams.get("startDate")!)
        : undefined;
      const endDate = searchParams.get("endDate")
        ? new Date(searchParams.get("endDate")!)
        : undefined;

      const stats = await getActivityStats({
        startDate,
        endDate,
        userId: searchParams.get("userId") || undefined,
      });

      return NextResponse.json({ stats });
    }

    // Parse query parameters
    const userId = searchParams.get("userId") || undefined;
    const targetUserId = searchParams.get("targetUserId") || undefined;
    const activityType = searchParams.get("activityType") as ActivityType | null;
    const entityType = searchParams.get("entityType") || undefined;
    const targetId = searchParams.get("targetId") || undefined;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50"),
      500
    );
    const offset = parseInt(searchParams.get("offset") || "0");

    // Regular users can only see their own activities unless they're HR/MANAGEMENT
    // @ts-expect-error - role is not defined in the session type
    const isPrivileged = ["HR", "MANAGEMENT"].includes(session.user.role);
    const sessionUserId = (session.user as { id?: string }).id;
    const effectiveUserId = isPrivileged ? userId : sessionUserId;

    const result = await getActivityLogs({
      userId: effectiveUserId,
      targetUserId,
      activityType: activityType || undefined,
      entityType,
      targetId,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}
