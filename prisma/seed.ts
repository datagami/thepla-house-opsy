import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: 'admin@example.com',
    },
  });

  if (!existingAdmin) {
    // Create admin user
    const hashedPassword = await hash('admin123', 12);
    
    const userData: Prisma.UserCreateInput = {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'MANAGEMENT',
      status: 'ACTIVE',
    };

    await prisma.user.create({
      data: userData,
    });
    
    console.log('Admin user created successfully');
  } else {
    console.log('Admin user already exists');
  }

  const existingHr = await prisma.user.findUnique({
    where: {
      email: 'hr@example.com',
    },
  });

  if (!existingHr) {
    // create Hr user
    const hashedPassword = await hash('hr123', 12);
  const hrData: Prisma.UserCreateInput = {
    email: 'hr@example.com',
    name: 'HR User',
    password: hashedPassword,
    role: 'HR',
    status: 'ACTIVE',
  };

    await prisma.user.create({
      data: hrData,
    });

    console.log('HR user created successfully');
  } else {
    console.log('HR user already exists');
  }
}



main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
