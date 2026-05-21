import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, status: true, createdAt: true, updatedAt: true },
  });

  let seeded = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await prisma.userStatusHistory.count({ where: { userId: user.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    if (user.status === UserStatus.PENDING) {
      // Never approved; initial state IS PENDING.
      await prisma.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: null,
          toStatus: UserStatus.PENDING,
          changedAt: user.createdAt,
          reason: 'backfill: initial state (pending)',
        },
      });
    } else if (user.status === UserStatus.ACTIVE) {
      // Single initial-state row at createdAt.
      await prisma.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: null,
          toStatus: UserStatus.ACTIVE,
          changedAt: user.createdAt,
          reason: 'backfill: initial state',
        },
      });
    } else {
      // INACTIVE or PARTIAL_INACTIVE: assume created ACTIVE then transitioned.
      // Use updatedAt for the transition row; if updatedAt === createdAt, bump by 1ms
      // so the two rows sort deterministically.
      const transitionAt =
        user.updatedAt.getTime() > user.createdAt.getTime()
          ? user.updatedAt
          : new Date(user.createdAt.getTime() + 1);

      await prisma.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: null,
          toStatus: UserStatus.ACTIVE,
          changedAt: user.createdAt,
          reason: 'backfill: initial state',
        },
      });

      await prisma.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: UserStatus.ACTIVE,
          toStatus: user.status,
          changedAt: transitionAt,
          reason: 'backfill: current state from updatedAt',
        },
      });
    }
    seeded++;
  }

  console.log(`Backfill complete. Seeded ${seeded} user(s). Skipped ${skipped} (already had history).`);
  console.log('Note: history granularity is limited for users with multiple past transitions.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
