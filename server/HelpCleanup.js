const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    await prisma.helpTopic.deleteMany();
    await prisma.stepHelp.deleteMany();
    console.log('Help topics deleted');
    await prisma.$disconnect();
}

cleanup().catch(console.error);