// seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('zerocool', 10);

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists, updating password...');
      
      // Update existing admin with new password
      await prisma.user.update({
        where: { email: 'admin@example.com' },
        data: {
          password: hashedPassword,
          name: 'Admin User',
          role: 'director',
          status: 'approved'
        }
      });
      
      console.log('✅ Admin user updated successfully!');
    } else {
      // Create new admin user
      const admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          name: 'Admin User',
          role: 'director',
          status: 'approved',
          schoolId: null
        }
      });

      console.log('✅ Admin user created successfully!');
    }

    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: zerocool');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });