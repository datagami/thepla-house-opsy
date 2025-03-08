import { PrismaClient, UserRole, AttendanceStatus } from '@prisma/client';
import { addDays, format, isWeekend } from 'date-fns';

const prisma = new PrismaClient();

// Helper function to generate random salary based on role
function generateSalary(role: string): number {
  const baseSalaries = {
    EMPLOYEE: { min: 13000, max: 20000 },
    BRANCH_MANAGER: { min: 25000, max: 30000 },
    HR: { min: 30000, max: 40000 },
    MANAGEMENT: { min: 80000, max: 150000 },
  };

  const { min, max } = baseSalaries[role as keyof typeof baseSalaries] || baseSalaries.EMPLOYEE;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to update users without salary
async function updateUserSalaries() {
  const usersWithoutSalary = await prisma.user.findMany({
    where: {
      salary: null,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      role: true,
    },
  });

  console.log(`Found ${usersWithoutSalary.length} users without salary`);

  // Update users in batches
  const batchSize = 50;
  for (let i = 0; i < usersWithoutSalary.length; i += batchSize) {
    const batch = usersWithoutSalary.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(user =>
        prisma.user.update({
          where: { id: user.id },
          data: { salary: generateSalary(user.role) },
        })
      )
    );

    console.log(`Updated salary for batch ${Math.floor(i / batchSize) + 1}`);
  }

  console.log('Successfully updated all user salaries');
}

// Helper function to generate random time between two hours
function randomTime(startHour: number, endHour: number): string {
  const hour = Math.floor(Math.random() * (endHour - startHour) + startHour);
  const minute = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// Helper function to generate random attendance data for a day
function generateAttendanceForDay(
  userId: string, 
  date: Date, 
  verifierIds: string[],
  isWeekend: boolean
) {
  // 85% chance of being present on weekdays, 30% chance on weekends
  const presenceProbability = isWeekend ? 0.3 : 0.85;
  const isPresent = Math.random() < presenceProbability;
  
  // Random verifier from the branch managers/HR
  const verifiedById = verifierIds[Math.floor(Math.random() * verifierIds.length)];

  if (!isPresent) {
    return {
      userId,
      date,
      isPresent: false,
      checkIn: null,
      checkOut: null,
      isHalfDay: false,
      overtime: false,
      shift1: false,
      shift2: false,
      shift3: false,
      status: AttendanceStatus.APPROVED,
      verifiedById,
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // For present employees
  // Weekend shifts have different timings
  const isShift1 = isWeekend ? Math.random() < 0.4 : Math.random() < 0.6;
  const isShift2 = isWeekend ? Math.random() < 0.4 : (Math.random() >= 0.6 && Math.random() < 0.9);
  const isShift3 = isWeekend ? Math.random() < 0.2 : Math.random() >= 0.9;

  // Adjust check-in and check-out times based on shifts
  let checkIn, checkOut;
  if (isShift1) {
    checkIn = randomTime(8, 10);
    checkOut = randomTime(17, 19);
  } else if (isShift2) {
    checkIn = randomTime(14, 15);
    checkOut = randomTime(22, 23);
  } else if (isShift3) {
    checkIn = randomTime(22, 23);
    checkOut = randomTime(6, 7); // Next day
  } else {
    checkIn = randomTime(9, 10);
    checkOut = randomTime(17, 18);
  }

  // Higher chance of overtime on weekends
  const overtime = isWeekend ? Math.random() < 0.4 : Math.random() < 0.2;

  // Lower chance of half day on weekends
  const isHalfDay = isWeekend ? Math.random() < 0.05 : Math.random() < 0.1;

  return {
    userId,
    date,
    isPresent: true,
    checkIn,
    checkOut,
    isHalfDay,
    overtime,
    shift1: isShift1,
    shift2: isShift2,
    shift3: isShift3,
    status: AttendanceStatus.APPROVED,
    verifiedById,
    verifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function main() {
  try {
    // First update any missing salaries
    await updateUserSalaries();

    // Get all branches
    const branches = await prisma.branch.findMany({
      select: { id: true },
    });

    console.log(`Found ${branches.length} branches`);

    for (const branch of branches) {
      // Get all active employees for this branch
      const employees = await prisma.user.findMany({
        where: {
          role: UserRole.EMPLOYEE,
          status: 'ACTIVE',
          branchId: branch.id,
        },
        select: {
          id: true,
        },
      });

      // Get verifiers (Branch Managers and HR) for this branch
      const verifiers = await prisma.user.findMany({
        where: {
          branchId: branch.id,
          role: {
            in: [UserRole.BRANCH_MANAGER, UserRole.HR],
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });

      const verifierIds = verifiers.map(v => v.id);

      console.log(`Processing branch with ${employees.length} employees and ${verifiers.length} verifiers`);

      if (employees.length === 0 || verifierIds.length === 0) {
        console.log(`Skipping branch due to no employees or verifiers`);
        continue;
      }

      // Generate attendance for January and February 2025
      const startDate = new Date(2025, 0, 1); // January 1st, 2025
      const endDate = new Date(2025, 1, 28); // February 28th, 2025
      
      let currentDate = startDate;
      const attendanceData = [];

      while (currentDate <= endDate) {
        const isWeekendDay = isWeekend(currentDate);
        for (const employee of employees) {
          const attendance = generateAttendanceForDay(
            employee.id, 
            new Date(currentDate), 
            verifierIds,
            isWeekendDay
          );
          if (attendance) {
            attendanceData.push(attendance);
          }
        }
        currentDate = addDays(currentDate, 1);
      }

      // Insert attendance data in batches of 100
      const batchSize = 100;
      for (let i = 0; i < attendanceData.length; i += batchSize) {
        const batch = attendanceData.slice(i, i + batchSize);
        await prisma.attendance.createMany({
          data: batch,
          skipDuplicates: true,
        });
        console.log(`Branch: Inserted batch ${i / batchSize + 1} of ${Math.ceil(attendanceData.length / batchSize)}`);
      }
    }

    console.log('Successfully seeded attendance data for all branches');
  } catch (error) {
    console.error('Error seeding attendance data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 