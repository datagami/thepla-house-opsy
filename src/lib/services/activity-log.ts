import { prisma } from "@/lib/prisma";
import { ActivityType } from "@prisma/client";

export interface ActivityLogInput {
  activityType: ActivityType;
  userId?: string;
  targetUserId?: string;
  targetId?: string;
  entityType?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Creates an immutable activity log entry
 * This function should never throw errors to ensure application flow isn't interrupted
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        activityType: input.activityType,
        userId: input.userId,
        targetUserId: input.targetUserId,
        targetId: input.targetId,
        entityType: input.entityType,
        description: input.description,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    // Log to console but don't throw - activity logging should never break the app
    console.error("Failed to log activity:", error);
  }
}

/**
 * Logs user-related activities
 */
export async function logUserActivity(
  activityType: ActivityType,
  userId: string,
  description: string,
  metadata?: Record<string, any>,
  request?: Request
): Promise<void> {
  const ipAddress = request?.headers.get("x-forwarded-for") || 
                    request?.headers.get("x-real-ip") || 
                    undefined;
  const userAgent = request?.headers.get("user-agent") || undefined;

  await logActivity({
    activityType,
    userId,
    targetUserId: userId,
    entityType: "User",
    description,
    metadata,
    ipAddress,
    userAgent,
  });
}

/**
 * Logs activities that affect other users
 */
export async function logTargetUserActivity(
  activityType: ActivityType,
  userId: string,
  targetUserId: string,
  description: string,
  metadata?: Record<string, any>,
  request?: Request
): Promise<void> {
  const ipAddress = request?.headers.get("x-forwarded-for") || 
                    request?.headers.get("x-real-ip") || 
                    undefined;
  const userAgent = request?.headers.get("user-agent") || undefined;

  await logActivity({
    activityType,
    userId,
    targetUserId,
    entityType: "User",
    description,
    metadata,
    ipAddress,
    userAgent,
  });
}

/**
 * Logs generic entity activities
 */
export async function logEntityActivity(
  activityType: ActivityType,
  userId: string,
  entityType: string,
  targetId: string,
  description: string,
  metadata?: Record<string, any>,
  request?: Request
): Promise<void> {
  const ipAddress = request?.headers.get("x-forwarded-for") || 
                    request?.headers.get("x-real-ip") || 
                    undefined;
  const userAgent = request?.headers.get("user-agent") || undefined;

  await logActivity({
    activityType,
    userId,
    targetId,
    entityType,
    description,
    metadata,
    ipAddress,
    userAgent,
  });
}

/**
 * Retrieves activity logs with filtering and pagination
 */
export async function getActivityLogs(options: {
  userId?: string;
  targetUserId?: string;
  activityType?: ActivityType;
  entityType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const {
    userId,
    targetUserId,
    activityType,
    entityType,
    targetId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  const where: any = {};

  if (userId) where.userId = userId;
  if (targetUserId) where.targetUserId = targetUserId;
  if (activityType) where.activityType = activityType;
  if (entityType) where.entityType = entityType;
  if (targetId) where.targetId = targetId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Gets activity summary statistics
 */
export async function getActivityStats(options: {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
}) {
  const { startDate, endDate, userId } = options;

  const where: any = {};
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const stats = await prisma.activityLog.groupBy({
    by: ["activityType"],
    where,
    _count: {
      id: true,
    },
  });

  return stats.map((stat) => ({
    activityType: stat.activityType,
    count: stat._count.id,
  }));
}
