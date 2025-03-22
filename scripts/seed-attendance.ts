import { PrismaClient, UserRole } from '@prisma/client';
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
          branchId: true,
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

      // Set fixed date range for January and February 2025
      const startDate = new Date(2024, 0, 1); // January 1st, 2025
      const endDate = new Date(); // February 28th, 2025

      // Create attendance records for each user
      for (const employee of employees) {
        if (!employee.branchId) {
          console.log(`Skipping user ${employee.id} - no branch assigned`);
          continue;
        }

        // Create attendance for the entire period
        for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
          const isWeekendDay = isWeekend(date);

          const isPresent = Math.random() > (isWeekendDay ? 0.3 : 0.1);
          let isHalfDay = Math.random() > (isWeekendDay ? 0.95 : 0.9);
          let overtime = Math.random() > (isWeekendDay ? 0.6 : 0.8);

          if (isPresent) {
            if (overtime && isHalfDay) {
              isHalfDay = false;
            }
          }

          if (!isPresent) {
            isHalfDay = false;
            overtime = false
          }
          


          
          try {
            await prisma.attendance.create({
              data: {
                userId: employee.id,
                date: date,
                // Lower presence probability on weekends
                isPresent: isPresent,
                isHalfDay: isHalfDay,
                overtime: overtime,
                branchId: employee.branchId,
                status: "APPROVED",
                verifiedById: verifierIds[0],
                verifiedAt: date,
                // Different timings for weekends
                checkIn: isWeekendDay ? "10:00" : "09:00",
                checkOut: isWeekendDay ? "16:00" : "18:00",
                // Different shift patterns for weekends
                shift1: isWeekendDay ? Math.random() > 0.7 : Math.random() > 0.5, // 30% shift1 on weekends
                shift2: isWeekendDay ? Math.random() > 0.8 : Math.random() > 0.8, // 20% shift2 on weekends
                shift3: isWeekendDay ? Math.random() > 0.9 : Math.random() > 0.9, // 10% shift3 on both
              },
            });
          } catch (error) {
            console.error(`Error creating attendance for user ${employee.id} on ${format(date, 'yyyy-MM-dd')}:`, error);
          }
        }

        console.log(`Completed attendance for employee ${employee.id}`);
      }

      console.log(`Completed attendance for branch ${branch.id}`);
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
