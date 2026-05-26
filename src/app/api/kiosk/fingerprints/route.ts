import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateKiosk } from "@/lib/kiosk-auth";

const PAGE_SIZE = 200;

/**
 * GET /api/kiosk/fingerprints
 *
 * Query params:
 *   ?updatedSince=ISO  → delta (returns enrollments whose enrollment-or-user changed since that instant; INCLUDES tombstones)
 *   (no updatedSince)  → full reconcile (returns ALL enrollments whose owner is currently ACTIVE; no tombstones — kiosk diffs locally)
 *   ?cursor=enrollmentId → pagination cursor
 *
 * Returns:
 *   {
 *     enrollments: [{ id, userId, fingerIndex, templateData, isActive, branchId (owner's current outlet), updatedAt }],
 *     nextCursor: string | null,
 *     serverTime: ISO  (kiosk persists as its new updatedSince)
 *   }
 *
 * Effective active = enrollment.isActive AND user.status === "ACTIVE".
 * A tombstone is a row with isActive=false the kiosk should DELETE from its local cache.
 */
export async function GET(req: Request) {
  const authed = await authenticateKiosk(req);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const updatedSinceParam = url.searchParams.get("updatedSince");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const updatedSince = updatedSinceParam ? new Date(updatedSinceParam) : null;
  if (updatedSinceParam && isNaN(updatedSince!.getTime())) {
    return NextResponse.json({ error: "Invalid updatedSince" }, { status: 400 });
  }

  // Build the where:
  //   - Delta mode: include EVERY enrollment whose enrollment.updatedAt > since OR whose user.updatedAt > since.
  //     We don't filter by user.status here — tombstones (user moved to LEFT) must propagate.
  //   - Full reconcile mode: only enrollments whose user is currently ACTIVE; no tombstones.
  const where = updatedSince
    ? {
        OR: [
          { updatedAt: { gt: updatedSince } },
          { user: { is: { updatedAt: { gt: updatedSince } } } },
        ],
      }
    : {
        isActive: true,
        user: { is: { status: "ACTIVE" as const } },
      };

  const rows = await prisma.fingerprintEnrollment.findMany({
    where,
    take: PAGE_SIZE + 1, // peek for "more"
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" },
    select: {
      id: true,
      userId: true,
      fingerIndex: true,
      templateData: true,
      isActive: true,
      updatedAt: true,
      user: { select: { status: true, branchId: true, updatedAt: true } },
    },
  });

  const more = rows.length > PAGE_SIZE;
  const page = more ? rows.slice(0, PAGE_SIZE) : rows;

  const enrollments = page.map((r) => ({
    id: r.id,
    userId: r.userId,
    fingerIndex: r.fingerIndex,
    templateData: r.templateData,
    // Effective active for the kiosk: must be active on both sides to be matchable
    isActive: r.isActive && r.user.status === "ACTIVE",
    // Owner's current outlet — for the kiosk's local outlet pre-check
    branchId: r.user.branchId,
    // Use the max of enrollment.updatedAt and user.updatedAt so the kiosk's next
    // updatedSince checkpoint covers both kinds of changes
    updatedAt: new Date(
      Math.max(r.updatedAt.getTime(), r.user.updatedAt.getTime())
    ).toISOString(),
  }));

  return NextResponse.json({
    enrollments,
    nextCursor: more ? page[page.length - 1].id : null,
    serverTime: new Date().toISOString(),
  });
}
