import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

function buildPassword(name: string | null, aadharNo: string | null): string | null {
  if (!name || !aadharNo) return null;
  const namePart = name.replace(/\s+/g, "").slice(0, 3);
  const digits = (aadharNo.match(/\d+/g) || []).join("");
  const aadharPart = digits.slice(-4);
  if (!namePart || aadharPart.length !== 4) return null;
  return `${namePart}@${aadharPart}`;
}

async function main() {
  console.log("Starting password reset...");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, aadharNo: true, email: true },
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const newPlain = buildPassword(user.name ?? null, user.aadharNo ?? null);
    if (!newPlain) {
      skippedCount += 1;
      console.warn(`Skipping user ${user.id} (${user.email || user.name}) - missing/invalid name or aadhar`);
      continue;
    }

    const hashed = await hash(newPlain, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    updatedCount += 1;
    console.log(`Updated password for user (${user.email || user.name}) - : ${newPlain}`);
  }

  console.log(`Done. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
