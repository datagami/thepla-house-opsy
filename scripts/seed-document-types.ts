import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const documentTypes = [
  {
    name: 'Food License',
    description: 'License required for food service operations',
    mandatory: true,
  },
  {
    name: 'Registration Certificate',
    description: 'Business registration certificate',
    mandatory: true,
  },
  {
    name: 'Health License',
    description: 'Health department license for operations',
    mandatory: true,
  },
  {
    name: 'Health Certificate (Staff Fitness)',
    description: 'Medical fitness certificates for staff members',
    mandatory: true,
  },
  {
    name: 'Vaccination Records (Staff Immunization)',
    description: 'Staff immunization and vaccination certificates',
    mandatory: true,
  },
  {
    name: 'Fire Safety Certificate / NOC',
    description: 'Fire safety compliance certificate or No Objection Certificate',
    mandatory: true,
  },
  {
    name: 'Insurance Policy',
    description: 'Business insurance policy documents',
    mandatory: true,
  },
  {
    name: 'Police Verification Certificates',
    description: 'Police verification certificates for staff',
    mandatory: true,
  },
  {
    name: 'Fire Exhibition / Fire Drill Compliance Certificate',
    description: 'Fire drill and safety training compliance certificates',
    mandatory: false,
  },
  {
    name: 'Rent Agreement',
    description: 'Property rental or lease agreements',
    mandatory: true,
  },
  {
    name: 'GST Registration',
    description: 'Goods and Services Tax registration certificate',
    mandatory: false,
  },
  {
    name: 'PAN Card',
    description: 'Permanent Account Number card',
    mandatory: true,
  },
  {
    name: 'Trade License',
    description: 'Local trade license for business operations',
    mandatory: true,
  },
  {
    name: 'Building Completion Certificate',
    description: 'Building completion and occupancy certificate',
    mandatory: false,
  },
  {
    name: 'Environmental Clearance',
    description: 'Environmental compliance certificates',
    mandatory: false,
  },
];

async function seedDocumentTypes() {
  console.log('🌱 Seeding document types...');

  try {
    for (const docType of documentTypes) {
      await prisma.documentType.upsert({
        where: { name: docType.name },
        update: {
          description: docType.description,
          mandatory: docType.mandatory,
        },
        create: {
          name: docType.name,
          description: docType.description,
          mandatory: docType.mandatory,
        },
      });
      console.log(`✅ Created/Updated: ${docType.name}`);
    }

    console.log('🎉 Document types seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding document types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDocumentTypes(); 