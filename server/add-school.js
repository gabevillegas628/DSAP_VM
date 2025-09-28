const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create a default school
  const school = await prisma.school.create({
    data: {
      name: 'Lincoln High School',
      schoolId: '001',
      instructor: 'Dr. Sarah Johnson',
      students: 45
    }
  });
  
  console.log('Created school:', school);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());