import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const BRANCHES = [
  'cm7j152c40000uztwhl8ts1tm', // Chandivali
  'cm7j166lz0001uztwkiy0v7kz', // Lower Parel
];

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
  for (const branchId of BRANCHES) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });

    if (!branch) continue;

    const branchName = branch.name.split('-')[0].trim().toLowerCase();
    const managerEmail = `manager.${branchName.split(' ').join('_')}@example.com`;

    await prisma.user.create({
      data: {
        name: `${FIRST_NAMES[0]} ${LAST_NAMES[0]}`,
        email: managerEmail,
        password: await hash('password123', 12),
        role: UserRole.BRANCH_MANAGER,
        status: UserStatus.ACTIVE,
        branchId: branchId,
        managedBranchId: branchId,
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
          branchId: branchId,
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
