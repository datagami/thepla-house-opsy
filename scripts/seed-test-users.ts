import { UserRole, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const FIRST_NAMES = ['Aarav','Mira','Rohan','Tara','Dev','Neha'];
const LAST_NAMES = ['Sharma','Patel','Singh','Mehta','Joshi','Kumar'];
const TITLES = ['Mr','Ms','Mrs'];
const DEPARTMENTS = ['Kitchen','Service','Housekeeping','Management','Accounts'];
const BANK_IFSC_PREFIXES = ['HDFC0','ICIC0','SBIN0'];

function daysAgo(numDays: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - numDays);
  return d;
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function digits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function randomHex(len = 6): string {
  // simple non-crypto hex suffix for uniqueness in seed runs
  return Math.random().toString(16).slice(2, 2 + len);
}

async function main() {
  // Temporary shim for referral client typing in environments where Prisma client
  // might not yet include the Referral model (e.g., before generation in scripts)
  interface ReferralClient {
    create(args: { data: { referrerId: string; referredUserId: string; eligibleAt: Date } }): Promise<unknown>;
  }
  const referralClient = (prisma as unknown as { referral: ReferralClient }).referral;
  
  // Ensure all departments exist
  const departmentMap = new Map<string, string>();
  for (const deptName of DEPARTMENTS) {
    const department = await prisma.department.upsert({
      where: { name: deptName },
      update: {},
      create: {
        name: deptName,
        isActive: true,
      },
    });
    departmentMap.set(deptName, department.id);
  }
  
  // Ensure there is at least one branch to attach users to
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Test Branch',
        address: 'Test Address',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
    });
    console.log('Created fallback branch:', branch.name);
  }

  // Create 10 employees with staggered DOJ across ~6 months
  const schedule = [0, 7, 14, 21, 30, 60, 90, 120, 150, 180];

  const createdUsers: { id: string; name: string; doj: Date }[] = [];

  for (let i = 0; i < schedule.length; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const email = `test.user.${i + 1}.${randomHex()}@example.com`;

    const doj = daysAgo(schedule[i]);
    const dob = new Date(1990, (i % 12), (i + 5));

    const passwordHash = await hash('password123', 12);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        branchId: branch.id,
        title: randomOf(TITLES),
        departmentId: departmentMap.get(randomOf(DEPARTMENTS)) || undefined,
        dob,
        doj,
        gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
        mobileNo: digits(10),
        panNo: `ABCDE${digits(4)}F`,
        aadharNo: digits(12),
        salary: 15000 + i * 2000,
        bankAccountNo: digits(12),
        bankIfscCode: `${randomOf(BANK_IFSC_PREFIXES)}${digits(6)}`,
        totalAdvanceBalance: 0,
        totalEmiDeduction: 0,
      },
    });

    createdUsers.push({ id: created.id, name, doj });
    console.log(`Created test user ${i + 1}: ${name} (DOJ: ${doj.toISOString().slice(0,10)})`);
  }

  // Referrals: use first two users as referrers
  if (createdUsers.length >= 6) {
    const referrers = createdUsers.slice(0, 2);
    const referredEligible = createdUsers.slice(2, 7); // 5 users eligible now
    const referredIneligible = createdUsers.slice(7);   // remaining users not yet eligible

    // Eligible referrals: eligibleAt in the past (today - 1 day)
    for (let i = 0; i < referredEligible.length; i++) {
      const referrer = referrers[i % referrers.length];
      const r = referredEligible[i];
      const eligibleAt = new Date();
      eligibleAt.setDate(eligibleAt.getDate() - 1);
      await referralClient.create({
        data: {
          referrerId: referrer.id,
          referredUserId: r.id,
          eligibleAt,
        },
      });
      console.log(`Linked referral (eligible): ${referrer.name} -> ${r.name} (eligible ${eligibleAt.toISOString().slice(0,10)})`);
    }

    // Not yet eligible referrals: eligibleAt in the future (today + 30 days)
    for (let i = 0; i < referredIneligible.length; i++) {
      const referrer = referrers[i % referrers.length];
      const r = referredIneligible[i];
      const eligibleAt = new Date();
      eligibleAt.setDate(eligibleAt.getDate() + 30);
      await referralClient.create({
        data: {
          referrerId: referrer.id,
          referredUserId: r.id,
          eligibleAt,
        },
      });
      console.log(`Linked referral (not yet eligible): ${referrer.name} -> ${r.name} (eligible ${eligibleAt.toISOString().slice(0,10)})`);
    }
  }

  console.log('Seeded 10 test users with staggered DOJ and referrals (~50% eligible).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


