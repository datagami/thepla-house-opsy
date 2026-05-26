/**
 * Seed the three baseline shifts (global — branchId = null).
 * Idempotent: re-running upserts by (name, branchId=null) and replaces segments.
 *
 * Run: npm run seed:shifts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHIFTS: Array<{
  name: string;
  sortOrder: number;
  segments: Array<{ startTime: string; endTime: string }>;
}> = [
  { name: "Full Day",  sortOrder: 1, segments: [{ startTime: "07:00", endTime: "19:00" }] },
  { name: "Break One", sortOrder: 2, segments: [
      { startTime: "07:00", endTime: "15:00" },
      { startTime: "19:00", endTime: "23:00" },
    ] },
  { name: "Mid-Night", sortOrder: 3, segments: [{ startTime: "11:00", endTime: "23:00" }] },
];

async function main() {
  console.log("🌱 Seeding shifts...");
  for (const s of SHIFTS) {
    // upsert by composite unique (name, branchId) — branchId is null (global)
    const existing = await prisma.shift.findFirst({
      where: { name: s.name, branchId: null },
    });
    const shift = existing
      ? await prisma.shift.update({
          where: { id: existing.id },
          data: { sortOrder: s.sortOrder, isActive: true },
        })
      : await prisma.shift.create({
          data: { name: s.name, branchId: null, sortOrder: s.sortOrder, isActive: true },
        });

    // Replace segments wholesale (cheap, deterministic, avoids drift)
    await prisma.shiftSegment.deleteMany({ where: { shiftId: shift.id } });
    await prisma.shiftSegment.createMany({
      data: s.segments.map((seg, i) => ({
        shiftId: shift.id,
        startTime: seg.startTime,
        endTime: seg.endTime,
        sortOrder: i,
      })),
    });
    console.log(`✅ ${existing ? "Updated" : "Created"} shift: ${s.name} (${s.segments.length} segment(s))`);
  }
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
