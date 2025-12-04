import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping rules to normalize department names
// Key: normalized name, Value: array of variations to map to this name
const departmentMapping: Record<string, string[]> = {
  'Cook': ['Cook', 'cook', 'COOK'],
  'KOT': ['KOT', 'Kot', 'kot'],
  'Semi Cook': ['Semi Cook', 'Semi cook', 'semi cook'],
  'Roti': ['Roti', 'roti section'],
  'Chef': ['Chef', 'chef'],
  'Helper': ['Helper'],
  'Utility': ['Utility'],
  'Accountant': ['Accountant'],
  'Branch Manager': ['Branch Manager'],
  'Manager': ['Manager'],
  'Store Supervisor': ['Store Supervisor'],
  'Business Operation Analyst': ['Business Operation Analyst'],
  'Driver': ['Driver'],
  'Maharaj': ['Maharaj'],
  'Office Boy': ['Office Boy'],
  'Social Media': ['Social Media'],
  'Tech': ['Tech'],
  'Human Resource': ['Human Resource'],
  'Admin': ['Admin'],
  'Chief': ['Chief'],
  'Purchase Manager': ['Purchase manager', 'Purchase Manager'],
  'All Rounder': ['All Rounder'],
  'Chat': ['Chat'],
};

async function normalizeDepartments() {
  console.log('🔄 Starting department normalization...');

  try {
    // Get all users with their current department values using raw SQL
    // (reading from the old 'department' column that still exists in DB)
    const usersRaw = await prisma.$queryRaw<Array<{ id: string; department: string | null }>>`
      SELECT id, department FROM users1 WHERE department IS NOT NULL
    `;

    const users = usersRaw.map(u => ({
      id: u.id,
      department: u.department,
    }));

    console.log(`📊 Found ${users.length} users with department values`);

    // Create a reverse mapping: variation -> normalized name
    const variationToNormalized: Record<string, string> = {};
    for (const [normalized, variations] of Object.entries(departmentMapping)) {
      for (const variation of variations) {
        variationToNormalized[variation] = normalized;
      }
    }

    // Get all unique department values from users
    const uniqueDepartments = new Set<string>();
    users.forEach((user) => {
      if (user.department) {
        uniqueDepartments.add(user.department);
      }
    });

    console.log(`📋 Found ${uniqueDepartments.size} unique department values`);

    // Create Department records for all normalized names
    const departmentMap = new Map<string, string>(); // normalized name -> department id

    for (const normalizedName of Object.keys(departmentMapping)) {
      const department = await prisma.department.upsert({
        where: { name: normalizedName },
        update: {
          isActive: true,
        },
        create: {
          name: normalizedName,
          isActive: true,
        },
      });
      departmentMap.set(normalizedName, department.id);
      console.log(`✅ Created/Updated department: ${normalizedName}`);
    }

    // Handle any departments that don't match our mapping (create them as-is)
    for (const dept of uniqueDepartments) {
      if (!variationToNormalized[dept]) {
        // This department doesn't match any mapping, create it as-is
        const normalized = dept.trim();
        if (!departmentMap.has(normalized)) {
          const department = await prisma.department.upsert({
            where: { name: normalized },
            update: {
              isActive: true,
            },
            create: {
              name: normalized,
              isActive: true,
            },
          });
          departmentMap.set(normalized, department.id);
          variationToNormalized[dept] = normalized;
          console.log(`✅ Created department (unmapped): ${normalized}`);
        } else {
          variationToNormalized[dept] = normalized;
        }
      }
    }

    // Update all users to reference the correct Department
    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (!user.department) {
        skippedCount++;
        continue;
      }

      const normalizedName = variationToNormalized[user.department] || user.department.trim();
      const departmentId = departmentMap.get(normalizedName);

      if (departmentId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { departmentId },
        });
        updatedCount++;
      } else {
        console.warn(`⚠️  Could not find department ID for: ${user.department}`);
        skippedCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   - Created/Updated ${departmentMap.size} departments`);
    console.log(`   - Updated ${updatedCount} users`);
    console.log(`   - Skipped ${skippedCount} users`);

    console.log('\n🎉 Department normalization completed successfully!');
  } catch (error) {
    console.error('❌ Error normalizing departments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

normalizeDepartments();

