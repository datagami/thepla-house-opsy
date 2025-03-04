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

const branchIds = await prisma.branch.createMany({
  data: BRANCHES_DATA,
});

const BRANCHES = await prisma.branch.findMany({});


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
      },
    });

    console.log(`Created branch manager for ${branch.name}`);

    // Create 10 employees for each branch
    for (let i = 0; i < 10; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${branchName.split(" ").join("_")}${i}@example.com`;

      await prisma.user.create({
        data: {
          name,
          email,
          password: await hash('password123', 12),
          role: UserRole.EMPLOYEE,
          status: UserStatus.ACTIVE,
          branchId: branchData.id,
        },
      });
    }

    console.log(`Created 10 employees for ${branch.name}`);
  }

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
