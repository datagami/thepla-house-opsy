import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying department migration...\n');

    // Check users with departmentId
    const usersWithNewDepartment = await prisma.user.count({
      where: {
        departmentId: {
          not: null,
        },
      },
    });

    // Check users with old department (using raw SQL since it's not in schema)
    const usersWithOldDepartment = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM users1 WHERE department IS NOT NULL
    `;

    const oldCount = Number(usersWithOldDepartment[0]?.count || 0);

    console.log(`✅ Users with departmentId (new): ${usersWithNewDepartment}`);
    console.log(`📊 Users with department column (old): ${oldCount}`);

    // Verify all users with old department also have departmentId
    const usersMissingMigration = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM users1 
      WHERE department IS NOT NULL 
      AND department_id IS NULL
    `;

    const missingCount = Number(usersMissingMigration[0]?.count || 0);

    if (missingCount > 0) {
      console.log(`\n⚠️  WARNING: ${missingCount} users have old department but no departmentId!`);
      console.log('   Migration may have failed for some users.');
      return false;
    }

    // Check that all departmentIds reference valid departments
    const invalidReferences = await prisma.user.count({
      where: {
        departmentId: {
          not: null,
        },
        department: null, // This means the foreign key doesn't exist
      },
    });

    if (invalidReferences > 0) {
      console.log(`\n⚠️  WARNING: ${invalidReferences} users have invalid departmentId references!`);
      return false;
    }

    console.log('\n✅ All checks passed! Migration is safe.');
    console.log(`\n📝 Summary:`);
    console.log(`   - ${usersWithNewDepartment} users migrated successfully`);
    console.log(`   - ${oldCount} users still have old department column (safe to drop)`);
    console.log(`   - 0 users missing migration`);
    console.log(`   - 0 invalid references`);
    console.log('\n✨ Safe to drop the old department column!');

    return true;
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();

