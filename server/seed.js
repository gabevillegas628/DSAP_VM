const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create schools first
  const schools = [
    {
      name: 'Isla Nublar High School',
      schoolId: 'INHS001',
      instructor: 'Claire Dearing',
      students: 0
    },
    {
      name: 'Nedry Land Academy',
      schoolId: 'NLA002', 
      instructor: 'Dennis Nedry',
      students: 0
    },
    {
      name: 'Grant Paleontology Institute',
      schoolId: 'GPI003',
      instructor: 'Dr. Alan Grant',
      students: 0
    },
    {
      name: 'Malcolm Chaos Theory School',
      schoolId: 'MCTS004',
      instructor: 'Dr. Ian Malcolm', 
      students: 0
    },
    {
      name: 'Hammond Biotech Academy',
      schoolId: 'HBA005',
      instructor: 'John Hammond',
      students: 0
    }
  ];

  console.log('Creating schools...');
  const createdSchools = [];
  for (const school of schools) {
    const created = await prisma.school.create({ data: school });
    createdSchools.push(created);
    console.log(`Created school: ${school.name}`);
  }

  // Hash password once
  const hashedPassword = await bcrypt.hash('password', 10);

  // Create the specific accounts requested
  console.log('Creating specific accounts...');
  
  const director = await prisma.user.create({
    data: {
      email: 'director@program.edu',
      password: hashedPassword,
      name: 'Program Director',
      role: 'director',
      status: 'approved',
      schoolId: null
    }
  });
  console.log('Created director account');

  const dennis = await prisma.user.create({
    data: {
      email: 'dennis@nedryland.com',
      password: hashedPassword,
      name: 'Dennis Nedry',
      role: 'student', 
      status: 'approved',
      schoolId: createdSchools[1].id // Nedry Land Academy
    }
  });
  console.log('Created Dennis student account');

  const claire = await prisma.user.create({
    data: {
      email: 'claire@jp.com',
      password: hashedPassword,
      name: 'Claire Dearing',
      role: 'instructor',
      status: 'approved',
      schoolId: createdSchools[0].id // Isla Nublar High School
    }
  });
  console.log('Created Claire instructor account');

  // Create 4 additional instructors
  console.log('Creating additional instructors...');
  const instructors = [
    { name: 'Dr. Alan Grant', email: 'alan.grant@fossil.edu', schoolId: createdSchools[2].id },
    { name: 'Dr. Ian Malcolm', email: 'ian.malcolm@chaos.edu', schoolId: createdSchools[3].id },
    { name: 'Dr. Ellie Sattler', email: 'ellie.sattler@plants.edu', schoolId: createdSchools[2].id },
    { name: 'John Hammond', email: 'john.hammond@ingen.com', schoolId: createdSchools[4].id }
  ];

  for (const instructor of instructors) {
    await prisma.user.create({
      data: {
        email: instructor.email,
        password: hashedPassword,
        name: instructor.name,
        role: 'instructor',
        status: 'approved',
        schoolId: instructor.schoolId
      }
    });
    console.log(`Created instructor: ${instructor.name}`);
  }

  // Create 20 students with Jurassic Park themed names
  console.log('Creating student accounts...');
  const students = [
    { name: 'Timothy Murphy', email: 'tim.murphy@student.edu' },
    { name: 'Alexis Murphy', email: 'lex.murphy@student.edu' },
    { name: 'Gerry Harding', email: 'gerry.harding@student.edu' },
    { name: 'Donald Gennaro', email: 'donald.gennaro@student.edu' },
    { name: 'Ray Arnold', email: 'ray.arnold@student.edu' },
    { name: 'Robert Muldoon', email: 'robert.muldoon@student.edu' },
    { name: 'Dr. Henry Wu', email: 'henry.wu@student.edu' },
    { name: 'Martin Guitierrez', email: 'martin.guitierrez@student.edu' },
    { name: 'Roberta Carter', email: 'roberta.carter@student.edu' },
    { name: 'Ed Regis', email: 'ed.regis@student.edu' },
    { name: 'Roland Tembo', email: 'roland.tembo@student.edu' },
    { name: 'Sarah Harding', email: 'sarah.harding@student.edu' },
    { name: 'Nick Van Owen', email: 'nick.vanowen@student.edu' },
    { name: 'Kelly Curtis', email: 'kelly.curtis@student.edu' },
    { name: 'Peter Ludlow', email: 'peter.ludlow@student.edu' },
    { name: 'Billy Brennan', email: 'billy.brennan@student.edu' },
    { name: 'Amanda Kirby', email: 'amanda.kirby@student.edu' },
    { name: 'Paul Kirby', email: 'paul.kirby@student.edu' },
    { name: 'Erik Kirby', email: 'erik.kirby@student.edu' },
    { name: 'Cooper Pilot', email: 'cooper.pilot@student.edu' }
  ];

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const schoolIndex = i % createdSchools.length; // Distribute across schools
    
    await prisma.user.create({
      data: {
        email: student.email,
        password: hashedPassword,
        name: student.name,
        role: 'student',
        status: 'approved',
        schoolId: createdSchools[schoolIndex].id
      }
    });
    console.log(`Created student: ${student.name}`);
  }

  // Create default program settings
  console.log('Creating program settings...');
  await prisma.programSettings.create({
    data: {
      projectHeader: 'Waksman Student Scholars Program',
      principalInvestigator: 'Dr. Program Director',
      projectName: 'DNA Sequence Analysis Platform',
      staffEmail: 'director@program.edu',
      welcomeText: 'Welcome to the DNA Analysis Platform! This system helps students analyze DNA sequences and learn about molecular biology.',
      overview: 'Students will upload DNA sequence files, perform BLAST analysis, and submit their findings for instructor review.',
      collectDemographics: false
    }
  });

  console.log('\n=== SEED COMPLETED SUCCESSFULLY ===');
  console.log('Created accounts:');
  console.log('📧 director@program.edu (Director) - Password: password');
  console.log('📧 dennis@nedryland.com (Student) - Password: password'); 
  console.log('📧 claire@jp.com (Instructor) - Password: password');
  console.log('📧 + 4 more instructors');
  console.log('📧 + 20 students');
  console.log('🏫 5 schools created');
  console.log('\nAll passwords are: password');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });