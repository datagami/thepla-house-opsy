/**
 * Verify Test Employee Setup for Weekly Off Cron Job
 * 
 * This script helps verify that an employee is configured correctly
 * for testing the weekly off cron job with Saturday as weekly off.
 * 
 * Usage:
 *   npx tsx scripts/verify-test-employee.ts [employee-email]
 */

import { prisma } from '../src/lib/prisma';

async function main() {
  const email = process.argv[2];

  console.log('==========================================');
  console.log('Weekly Off Test Employee Verification');
  console.log('==========================================');
  console.log('');

  if (!email) {
    console.log('Usage: npx tsx scripts/verify-test-employee.ts <employee-email>');
    console.log('');
    console.log('Example: npx tsx scripts/verify-test-employee.ts test@example.com');
    process.exit(1);
  }

  try {
    // Find the employee
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        hasWeeklyOff: true,
        weeklyOffType: true,
        weeklyOffDay: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        status: true,
      },
    });

    if (!user) {
      console.error(`❌ Employee not found with email: ${email}`);
      process.exit(1);
    }

    console.log('Employee Details:');
    console.log(`  Name: ${user.name || 'N/A'}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    console.log(`  Status: ${user.status}`);
    console.log(`  Branch: ${user.branch?.name || 'N/A'} (ID: ${user.branchId || 'N/A'})`);
    console.log('');

    // Check weekly off configuration
    console.log('Weekly Off Configuration:');
    console.log(`  hasWeeklyOff: ${user.hasWeeklyOff}`);
    console.log(`  weeklyOffType: ${user.weeklyOffType || 'N/A'}`);
    console.log(`  weeklyOffDay: ${user.weeklyOffDay ?? 'N/A'}`);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (user.weeklyOffDay !== null && user.weeklyOffDay !== undefined) {
      console.log(`  Weekly Off Day Name: ${dayNames[user.weeklyOffDay]}`);
    }
    console.log('');

    // Verify configuration
    let isValid = true;
    const issues: string[] = [];

    if (!user.hasWeeklyOff) {
      isValid = false;
      issues.push('❌ hasWeeklyOff is false - should be true');
    }

    if (user.weeklyOffType !== 'FIXED') {
      isValid = false;
      issues.push('❌ weeklyOffType is not "FIXED" - should be "FIXED"');
    }

    if (user.weeklyOffDay !== 6) {
      isValid = false;
      issues.push(`❌ weeklyOffDay is ${user.weeklyOffDay} - should be 6 (Saturday)`);
    }

    if (!user.branchId) {
      isValid = false;
      issues.push('❌ branchId is not set - required for attendance creation');
    }

    if (user.status !== 'ACTIVE') {
      console.log(`⚠️  Warning: User status is ${user.status} (not ACTIVE)`);
    }

    console.log('==========================================');
    if (isValid) {
      console.log('✅ Employee is correctly configured for testing!');
      console.log('');
      console.log('This employee will have weekly off on:');
      console.log(`  - Day: ${dayNames[user.weeklyOffDay!]} (${user.weeklyOffDay})`);
      console.log('');
      console.log('Next steps:');
      console.log('1. Wait for the cron job to run (or trigger it manually)');
      console.log('2. Check attendance records for this employee on Saturday');
      console.log('3. Verify the attendance record has:');
      console.log('   - isWeeklyOff: true');
      console.log('   - isPresent: true');
      console.log('   - status: APPROVED');
    } else {
      console.log('❌ Employee configuration has issues:');
      console.log('');
      issues.forEach((issue) => console.log(`  ${issue}`));
      console.log('');
      console.log('To fix:');
      console.log('1. Update the employee in the UI or database:');
      console.log('   - Set hasWeeklyOff: true');
      console.log('   - Set weeklyOffType: "FIXED"');
      console.log('   - Set weeklyOffDay: 6 (Saturday)');
      if (!user.branchId) {
        console.log('   - Assign a branch (branchId)');
      }
    }
    console.log('==========================================');

    // Check for existing attendance records
    console.log('');
    console.log('Checking existing attendance records...');
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const saturday = new Date(startOfWeek);
    saturday.setDate(startOfWeek.getDate() + 6); // Saturday
    saturday.setHours(0, 0, 0, 0);

    const saturdayEnd = new Date(saturday);
    saturdayEnd.setHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: saturday,
          lte: saturdayEnd,
        },
      },
      select: {
        id: true,
        date: true,
        isWeeklyOff: true,
        isPresent: true,
        status: true,
      },
    });

    if (attendance) {
      console.log('');
      console.log('✅ Found attendance record for this week\'s Saturday:');
      console.log(`  Date: ${attendance.date.toISOString()}`);
      console.log(`  isWeeklyOff: ${attendance.isWeeklyOff}`);
      console.log(`  isPresent: ${attendance.isPresent}`);
      console.log(`  status: ${attendance.status}`);
      
      if (attendance.isWeeklyOff && attendance.isPresent && attendance.status === 'APPROVED') {
        console.log('');
        console.log('✅ Attendance record is correctly configured!');
      } else {
        console.log('');
        console.log('⚠️  Attendance record exists but may need updating');
      }
    } else {
      console.log('');
      console.log('ℹ️  No attendance record found for this week\'s Saturday yet');
      console.log('   The cron job will create one when it runs');
    }

    process.exit(isValid ? 0 : 1);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
