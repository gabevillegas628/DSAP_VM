const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportData() {
  try {
    console.log('Starting data export...');

    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    // Export all tables in the right order (avoiding foreign key issues)
    console.log('Exporting Schools...');
    exportData.schools = await prisma.school.findMany();

    console.log('Exporting Users...');
    exportData.users = await prisma.user.findMany();

    console.log('Exporting Demographics...');
    exportData.demographics = await prisma.demographics.findMany();

    console.log('Exporting Login Logs...');
    exportData.loginLogs = await prisma.loginLog.findMany();

    console.log('Exporting Program Settings...');
    exportData.programSettings = await prisma.programSettings.findMany();

    console.log('Exporting Analysis Questions...');
    exportData.analysisQuestions = await prisma.analysisQuestion.findMany();

    console.log('Exporting Common Feedback...');
    exportData.commonFeedback = await prisma.commonFeedback.findMany();

    console.log('Exporting Uploaded Files...');
    exportData.uploadedFiles = await prisma.uploadedFile.findMany();

    console.log('Exporting Messages...');
    exportData.messages = await prisma.message.findMany();

    console.log('Exporting Practice Clones...');
    exportData.practiceClones = await prisma.practiceClone.findMany();

    console.log('Exporting Practice Answers...');
    exportData.practiceAnswers = await prisma.practiceAnswer.findMany();

    console.log('Exporting User Practice Progress...');
    exportData.userPracticeProgress = await prisma.userPracticeProgress.findMany();

    console.log('Exporting Help Topics...');
    exportData.helpTopics = await prisma.helpTopic.findMany();

    console.log('Exporting Step Help...');
    exportData.stepHelp = await prisma.stepHelp.findMany();

    console.log('Exporting Clone Discussions...');
    exportData.cloneDiscussions = await prisma.cloneDiscussion.findMany();

    console.log('Exporting Discussion Messages...');
    exportData.discussionMessages = await prisma.discussionMessage.findMany();

    // Write to file
    const exportPath = path.join(__dirname, 'database-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    // Print summary
    console.log('\n=== EXPORT SUMMARY ===');
    Object.keys(exportData).forEach(key => {
      if (Array.isArray(exportData[key])) {
        console.log(`${key}: ${exportData[key].length} records`);
      }
    });

    console.log(`\nExport completed! File saved to: ${exportPath}`);

  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();