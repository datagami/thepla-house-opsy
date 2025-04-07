import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();



// TODO: create branches
const BRANCHES_DATA = [
  {
    name: 'Chandivali',
    address: 'Chandivali',
    city: 'Mumbai',
    state: 'Maharashtra',
  },
  {
    name: 'Lower Parel',
    address: 'Lower Parel',
    city: 'Mumbai',
    state: 'Maharashtra',
  },
  {
    name: 'Santacruz',
    address: '789 Main St, Anytown, USA',
    city: 'Mumbai',
    state: 'Maharashtra',
  },
];

// Department options
const DEPARTMENTS = ['Kitchen', 'Service', 'Housekeeping', 'Management', 'Accounts'];

// Title options
const TITLES = ['Mr', 'Mrs', 'Ms'];

// Bank options
const BANKS = [
  { name: 'HDFC', ifscPrefix: 'HDFC0' },
  { name: 'ICICI', ifscPrefix: 'ICIC0' },
  { name: 'SBI', ifscPrefix: 'SBIN0' }
];

// Generate random date within a range
function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random number string of specific length
function generateRandomNumber(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// Generate random salary between range
function generateRandomSalary(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = [
  'Aarav', 'Advait', 'Arjun', 'Dev', 'Ishaan',
  'Kavya', 'Mira', 'Neha', 'Priya', 'Riya',
  'Rohan', 'Sahil', 'Tara', 'Veer', 'Zara'
];

const LAST_NAMES = [
  'Patel', 'Shah', 'Kumar', 'Singh', 'Sharma',
  'Mehta', 'Desai', 'Joshi', 'Verma', 'Malhotra'
];

async function main() {
  await prisma.branch.createMany({
    data: BRANCHES_DATA,
  });

  const BRANCHES = await prisma.branch.findMany({});

  // Create branch managers first
  for (const branchData of BRANCHES) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchData.id },
      select: { name: true },
    });

    if (!branch) continue;

    const branchName = branch.name.split('-')[0].trim().toLowerCase();
    const managerEmail = `manager.${branchName.split(' ').join('_')}@example.com`;

    await prisma.user.create({
      data: {
        name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
        email: managerEmail,
        password: await hash('password123', 12),
        role: UserRole.BRANCH_MANAGER,
        status: UserStatus.ACTIVE,
        branchId: branchData.id,
        managedBranchId: branchData.id,
        // Additional fields for managers
        title: TITLES[Math.floor(Math.random() * TITLES.length)],
        department: 'Management',
        dob: randomDate(new Date(1970, 0, 1), new Date(1995, 11, 31)),
        doj: randomDate(new Date(2020, 0, 1), new Date(2024, 11, 31)),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        mobileNo: generateRandomNumber(10),
        panNo: `ABCDE${generateRandomNumber(4)}F`,
        aadharNo: generateRandomNumber(12),
        salary: Math.floor(generateRandomSalary(12000, 35000) / 1000) * 1000,
        bankAccountNo: generateRandomNumber(12),
        bankIfscCode: `${BANKS[Math.floor(Math.random() * BANKS.length)].ifscPrefix}${generateRandomNumber(6)}`,
        totalAdvanceBalance: 0,
        totalEmiDeduction: 0
      },
    });

    console.log(`Created branch manager for ${branch.name}`);

    // Create 10 employees for each branch
    for (let i = 0; i < 10; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${branchName.split(" ").join("_")}${i}@example.com`;
      const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
      const selectedBank = BANKS[Math.floor(Math.random() * BANKS.length)];

      await prisma.user.create({
        data: {
          name,
          email,
          password: await hash('password123', 12),
          role: UserRole.EMPLOYEE,
          status: UserStatus.ACTIVE,
          branchId: branchData.id,
          // Additional employee data
          title: TITLES[Math.floor(Math.random() * TITLES.length)],
          department,
          dob: randomDate(new Date(1980, 0, 1), new Date(2000, 11, 31)),
          doj: randomDate(new Date(2022, 0, 1), new Date(2024, 11, 31)),
          gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
          mobileNo: generateRandomNumber(10),
          panNo: `ABCDE${generateRandomNumber(4)}F`,
          aadharNo: generateRandomNumber(12),
          salary: Math.floor(generateRandomSalary(12000, 35000) / 1000) * 1000,
          bankAccountNo: generateRandomNumber(12),
          bankIfscCode: `${selectedBank.ifscPrefix}${generateRandomNumber(6)}`,
          totalAdvanceBalance: 0,
          totalEmiDeduction: 0 // This will be calculated based on advances
        },
      });
    }

    console.log(`Created 10 employees for ${branch.name}`);
  }

  // Create Management users
  for (let i = 0; i < 2; i++) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;
    const email = `management${i + 1}@example.com`;

    await prisma.user.create({
      data: {
        name,
        email,
        password: await hash('password123', 12),
        role: UserRole.MANAGEMENT,
        status: UserStatus.ACTIVE,
        // Additional fields for management
        title: TITLES[Math.floor(Math.random() * TITLES.length)],
        department: 'Management',
        dob: randomDate(new Date(1970, 0, 1), new Date(1990, 11, 31)),
        doj: randomDate(new Date(2020, 0, 1), new Date(2024, 11, 31)),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        mobileNo: generateRandomNumber(10),
        panNo: `ABCDE${generateRandomNumber(4)}F`,
        aadharNo: generateRandomNumber(12),
        salary: Math.floor(generateRandomSalary(50000, 100000) / 1000) * 1000,
        bankAccountNo: generateRandomNumber(12),
        bankIfscCode: `${BANKS[Math.floor(Math.random() * BANKS.length)].ifscPrefix}${generateRandomNumber(6)}`,
        totalAdvanceBalance: 0,
        totalEmiDeduction: 0
      },
    });
  }
  console.log('Created Management users');

  // Create HR users
  for (let i = 0; i < 2; i++) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;
    const email = `hr${i + 1}@example.com`;

    await prisma.user.create({
      data: {
        name,
        email,
        password: await hash('password123', 12),
        role: UserRole.HR,
        status: UserStatus.ACTIVE,
        // Additional fields for HR
        title: TITLES[Math.floor(Math.random() * TITLES.length)],
        department: 'HR',
        dob: randomDate(new Date(1980, 0, 1), new Date(1995, 11, 31)),
        doj: randomDate(new Date(2020, 0, 1), new Date(2024, 11, 31)),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        mobileNo: generateRandomNumber(10),
        panNo: `ABCDE${generateRandomNumber(4)}F`,
        aadharNo: generateRandomNumber(12),
        salary: Math.floor(generateRandomSalary(40000, 80000) / 1000) * 1000,
        bankAccountNo: generateRandomNumber(12),
        bankIfscCode: `${BANKS[Math.floor(Math.random() * BANKS.length)].ifscPrefix}${generateRandomNumber(6)}`,
        totalAdvanceBalance: 0,
        totalEmiDeduction: 0
      },
    });
  }
  console.log('Created HR users');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
