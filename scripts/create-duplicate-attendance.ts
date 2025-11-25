import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_DUPLICATE_COUNT = 5;

function getLastMonthRange() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

async function main() {
  const desiredCount = Number(process.argv[2]) || DEFAULT_DUPLICATE_COUNT;
  const { start, end } = getLastMonthRange();

  console.log(
    `Creating ${desiredCount} duplicate attendance entries between ${start.toDateString()} and ${end.toDateString()}`
  );

  const candidates = await prisma.attendance.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      date: "asc",
    },
    take: desiredCount,
  });

  if (candidates.length === 0) {
    console.log("No attendance entries found for last month. Nothing to duplicate.");
    return;
  }

  for (const candidate of candidates) {
    const duplicate = await prisma.attendance.create({
      data: {
        userId: candidate.userId,
        branchId: candidate.branchId,
        date: candidate.date,
        isPresent: candidate.isPresent,
        checkIn: candidate.checkIn,
        checkOut: candidate.checkOut,
        isHalfDay: candidate.isHalfDay,
        overtime: candidate.overtime,
        shift1: candidate.shift1,
        shift2: candidate.shift2,
        shift3: candidate.shift3,
        status: candidate.status,
        verifiedById: candidate.verifiedById,
        verifiedAt: candidate.verifiedAt,
        verificationNote: candidate.verificationNote,
      },
    });

    console.log(
      `Created duplicate ${duplicate.id} for user ${candidate.userId} on ${candidate.date.toISOString().split("T")[0]}`
    );
  }

  console.log("Done creating duplicate entries.");
}

main()
  .catch((error) => {
    console.error("Failed to create duplicate attendance entries:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


