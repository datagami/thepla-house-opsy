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

  // Seed default warning types
  const defaultWarningTypes = [
    { name: 'Uniform not worn', description: 'Employee did not wear proper uniform' },
    { name: 'Nails not cut', description: 'Employee did not maintain proper nail hygiene' },
    { name: 'Beard not trimmed', description: 'Employee did not maintain proper facial grooming' },
    { name: 'Late arrival', description: 'Employee arrived late to work' },
    { name: 'Unprofessional behavior', description: 'Employee exhibited unprofessional conduct' },
    { name: 'Safety violation', description: 'Employee violated safety protocols' },
    { name: 'Insubordination', description: 'Employee failed to follow instructions' },
  ];

  for (const warningType of defaultWarningTypes) {
    const existing = await prisma.warningType.findUnique({
      where: { name: warningType.name },
    });

    if (!existing) {
      await prisma.warningType.create({
        data: warningType,
      });
      console.log(`Warning type "${warningType.name}" created`);
    } else {
      console.log(`Warning type "${warningType.name}" already exists`);
    }
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
