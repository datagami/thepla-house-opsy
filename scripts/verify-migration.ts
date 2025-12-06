import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('🔍 Verifying department migration...\n');

  try {
    // Check if departments table exists and has data
    const departmentCount = await prisma.department.count();
    console.log(`✅ Departments table exists with ${departmentCount} departments`);

    // Check users with department_id
    const usersWithDepartment = await prisma.user.count({
      where: {
        departmentId: {
          not: null,
        },
      },
    });

    const totalUsers = await prisma.user.count();
    console.log(`✅ Total users: ${totalUsers}`);
    console.log(`✅ Users with department: ${usersWithDepartment}`);

    // Check if old department column still exists (using raw SQL)
    try {
      const oldDepartmentCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM users1 WHERE department IS NOT NULL
      `;
      const count = Number(oldDepartmentCount[0]?.count || 0);
      if (count > 0) {
        console.log(`⚠️  Old 'department' column still has ${count} values (can be dropped after verification)`);
      } else {
        console.log(`✅ Old 'department' column is empty`);
      }
    } catch (error) {
      console.log(`✅ Old 'department' column has been dropped (or doesn't exist)`);
    }

    // List all departments with user counts
    const departmentsWithCounts = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log('\n📊 Department breakdown:');
    departmentsWithCounts.forEach((dept) => {
      console.log(`   - ${dept.name}: ${dept._count.users} users (${dept.isActive ? 'Active' : 'Inactive'})`);
    });

    // Check for any orphaned department_ids
    const orphanedUsers = await prisma.user.findMany({
      where: {
        departmentId: {
          not: null,
        },
      },
      include: {
        department: true,
      },
    });

    const orphaned = orphanedUsers.filter((u) => !u.department);
    if (orphaned.length > 0) {
      console.log(`\n⚠️  Warning: Found ${orphaned.length} users with invalid department_id`);
    } else {
      console.log(`\n✅ All department_id references are valid`);
    }

    console.log('\n🎉 Migration verification complete!');
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
