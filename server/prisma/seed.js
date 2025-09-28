const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create default admin/director
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'director',
      status: 'approved'
    }
  });

  console.log('Created admin user:', admin.email);

  // Create default program settings
  const settings = await prisma.programSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      projectHeader: 'DNA Analysis Program',
      principalInvestigator: 'Dr. Sample Investigator',
      projectName: 'Sample DNA Research Project',
      staffEmail: 'support@example.com',
      welcomeText: 'Welcome to the DNA Analysis Platform',
      overview: 'This platform helps students analyze DNA sequences.',
      collectDemographics: false
    }
  });

  console.log('Created program settings');

  // Create sample school
  const school = await prisma.school.upsert({
    where: { schoolId: 'SAMPLE001' },
    update: {},
    create: {
      name: 'Sample High School',
      schoolId: 'SAMPLE001',
      instructor: 'Unassigned',
      students: 0
    }
  });

  console.log('Created sample school');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });