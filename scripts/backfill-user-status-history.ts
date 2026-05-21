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

    // Always insert an initial-state row at user.createdAt assuming ACTIVE.
    await prisma.userStatusHistory.create({
      data: {
        userId: user.id,
        fromStatus: null,
        toStatus: UserStatus.ACTIVE,
        changedAt: user.createdAt,
        reason: 'backfill: initial state',
      },
    });

    // If current status isn't ACTIVE, insert a transition row at updatedAt.
    if (user.status !== UserStatus.ACTIVE && user.updatedAt > user.createdAt) {
      await prisma.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: UserStatus.ACTIVE,
          toStatus: user.status,
          changedAt: user.updatedAt,
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
