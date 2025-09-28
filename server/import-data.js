const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importData() {
    try {
        const importPath = path.join(__dirname, 'database-export.json');

        if (!fs.existsSync(importPath)) {
            console.error('Export file not found:', importPath);
            return;
        }

        const data = JSON.parse(fs.readFileSync(importPath, 'utf8'));
        console.log('Starting data import...');
        console.log('Export timestamp:', data.timestamp);

        // Clear existing data (optional - remove if you want to preserve existing data)
        console.log('Clearing existing data...');
        await prisma.discussionMessage.deleteMany();
        await prisma.cloneDiscussion.deleteMany();
        await prisma.stepHelp.deleteMany();
        await prisma.helpTopic.deleteMany();
        await prisma.userPracticeProgress.deleteMany();
        await prisma.practiceAnswer.deleteMany();
        await prisma.practiceClone.deleteMany();
        await prisma.message.deleteMany();
        await prisma.uploadedFile.deleteMany();
        await prisma.commonFeedback.deleteMany();
        await prisma.analysisQuestion.deleteMany();
        await prisma.programSettings.deleteMany();
        await prisma.loginLog.deleteMany();
        await prisma.demographics.deleteMany();
        await prisma.user.deleteMany();
        await prisma.school.deleteMany();

        // Import in correct order to respect foreign keys

        // 1. Schools (no dependencies)
        if (data.schools && data.schools.length > 0) {
            console.log(`Importing ${data.schools.length} schools...`);
            for (const school of data.schools) {
                await prisma.school.create({
                    data: {
                        ...school,
                        createdAt: new Date(school.createdAt),
                        updatedAt: new Date(school.updatedAt)
                    }
                });
            }
        }

        // 2. Users (depends on Schools)
        if (data.users && data.users.length > 0) {
            console.log(`Importing ${data.users.length} users...`);
            for (const user of data.users) {
                const userData = {
                    ...user,
                    createdAt: new Date(user.createdAt),
                    updatedAt: new Date(user.updatedAt),
                    resetTokenExpiry: user.resetTokenExpiry ? new Date(user.resetTokenExpiry) : null
                };
                await prisma.user.create({ data: userData });
            }
        }

        // 3. Demographics (depends on Users)
        if (data.demographics && data.demographics.length > 0) {
            console.log(`Importing ${data.demographics.length} demographics...`);
            for (const demo of data.demographics) {
                await prisma.demographics.create({
                    data: {
                        ...demo,
                        createdAt: new Date(demo.createdAt),
                        updatedAt: new Date(demo.updatedAt)
                    }
                });
            }
        }

        // 4. Login Logs (depends on Users)
        if (data.loginLogs && data.loginLogs.length > 0) {
            console.log(`Importing ${data.loginLogs.length} login logs...`);
            for (const log of data.loginLogs) {
                await prisma.loginLog.create({
                    data: {
                        ...log,
                        loginTime: new Date(log.loginTime),
                        createdAt: new Date(log.createdAt)
                    }
                });
            }
        }

        // 5. Program Settings (no dependencies)
        if (data.programSettings && data.programSettings.length > 0) {
            console.log(`Importing ${data.programSettings.length} program settings...`);
            for (const settings of data.programSettings) {
                await prisma.programSettings.create({
                    data: {
                        ...settings,
                        createdAt: new Date(settings.createdAt),
                        updatedAt: new Date(settings.updatedAt)
                    }
                });
            }
        }

        // 6. Analysis Questions (no dependencies)
        if (data.analysisQuestions && data.analysisQuestions.length > 0) {
            console.log(`Importing ${data.analysisQuestions.length} analysis questions...`);
            for (const question of data.analysisQuestions) {
                await prisma.analysisQuestion.create({
                    data: {
                        ...question,
                        createdAt: new Date(question.createdAt),
                        updatedAt: new Date(question.updatedAt)
                    }
                });
            }
        }

        // 7. Common Feedback (depends on Analysis Questions)
        if (data.commonFeedback && data.commonFeedback.length > 0) {
            console.log(`Importing ${data.commonFeedback.length} common feedback...`);
            for (const feedback of data.commonFeedback) {
                await prisma.commonFeedback.create({
                    data: {
                        ...feedback,
                        createdAt: new Date(feedback.createdAt),
                        updatedAt: new Date(feedback.updatedAt)
                    }
                });
            }
        }

        // 8. Uploaded Files (depends on Users)
        if (data.uploadedFiles && data.uploadedFiles.length > 0) {
            console.log(`Importing ${data.uploadedFiles.length} uploaded files...`);
            for (const file of data.uploadedFiles) {
                await prisma.uploadedFile.create({
                    data: {
                        ...file,
                        createdAt: new Date(file.createdAt),
                        updatedAt: new Date(file.updatedAt)
                    }
                });
            }
        }

        // 9. Practice Clones (no dependencies)
        if (data.practiceClones && data.practiceClones.length > 0) {
            console.log(`Importing ${data.practiceClones.length} practice clones...`);
            for (const clone of data.practiceClones) {
                await prisma.practiceClone.create({
                    data: {
                        ...clone,
                        uploadDate: new Date(clone.uploadDate),
                        createdAt: new Date(clone.createdAt),
                        updatedAt: new Date(clone.updatedAt)
                    }
                });
            }
        }

        // 10. Practice Answers (depends on Practice Clones)
        if (data.practiceAnswers && data.practiceAnswers.length > 0) {
            console.log(`Importing ${data.practiceAnswers.length} practice answers...`);
            for (const answer of data.practiceAnswers) {
                await prisma.practiceAnswer.create({ data: answer });
            }
        }

        // 11. User Practice Progress (depends on Users and Practice Clones)
        if (data.userPracticeProgress && data.userPracticeProgress.length > 0) {
            console.log(`Importing ${data.userPracticeProgress.length} user practice progress...`);
            for (const progress of data.userPracticeProgress) {
                await prisma.userPracticeProgress.create({
                    data: {
                        ...progress,
                        lastSaved: progress.lastSaved ? new Date(progress.lastSaved) : null,
                        submittedAt: progress.submittedAt ? new Date(progress.submittedAt) : null,
                        lastReviewed: progress.lastReviewed ? new Date(progress.lastReviewed) : null,
                        createdAt: new Date(progress.createdAt),
                        updatedAt: new Date(progress.updatedAt)
                    }
                });
            }
        }

        // 12. Help Topics (depends on Analysis Questions)
        if (data.helpTopics && data.helpTopics.length > 0) {
            console.log(`Importing ${data.helpTopics.length} help topics...`);
            for (const topic of data.helpTopics) {
                await prisma.helpTopic.create({
                    data: {
                        ...topic,
                        createdAt: new Date(topic.createdAt),
                        updatedAt: new Date(topic.updatedAt)
                    }
                });
            }
        }

        // 13. Step Help (no dependencies)
        if (data.stepHelp && data.stepHelp.length > 0) {
            console.log(`Importing ${data.stepHelp.length} step help...`);
            for (const help of data.stepHelp) {
                await prisma.stepHelp.create({
                    data: {
                        ...help,
                        createdAt: new Date(help.createdAt),
                        updatedAt: new Date(help.updatedAt)
                    }
                });
            }
        }

        // 14. Clone Discussions (depends on Users, Uploaded Files, Practice Clones)
        if (data.cloneDiscussions && data.cloneDiscussions.length > 0) {
            console.log(`Importing ${data.cloneDiscussions.length} clone discussions...`);
            for (const discussion of data.cloneDiscussions) {
                await prisma.cloneDiscussion.create({
                    data: {
                        ...discussion,
                        createdAt: new Date(discussion.createdAt),
                        updatedAt: new Date(discussion.updatedAt),
                        lastMessageAt: new Date(discussion.lastMessageAt)
                    }
                });
            }
        }

        // 15. Discussion Messages (depends on Clone Discussions and Users)
        if (data.discussionMessages && data.discussionMessages.length > 0) {
            console.log(`Importing ${data.discussionMessages.length} discussion messages...`);
            for (const message of data.discussionMessages) {
                await prisma.discussionMessage.create({
                    data: {
                        ...message,
                        createdAt: new Date(message.createdAt),
                        updatedAt: new Date(message.updatedAt)
                    }
                });
            }
        }

        // 16. Messages (depends on Users and Uploaded Files) - Import last due to complexity
        if (data.messages && data.messages.length > 0) {
            console.log(`Importing ${data.messages.length} messages...`);
            for (const message of data.messages) {
                await prisma.message.create({
                    data: {
                        ...message,
                        createdAt: new Date(message.createdAt),
                        updatedAt: new Date(message.updatedAt)
                    }
                });
            }
        }

        // CRITICAL: Reset all PostgreSQL sequences after import
        // CRITICAL: Reset all PostgreSQL sequences after import
        // CRITICAL: Reset all PostgreSQL sequences after import
        // CRITICAL: Reset all PostgreSQL sequences after import
        // CRITICAL: Reset all PostgreSQL sequences after import
        console.log('\nResetting PostgreSQL sequences to 1000...');

        const sequenceNames = [
            'School_id_seq', 'User_id_seq', 'Demographics_id_seq', 'LoginLog_id_seq',
            'ProgramSettings_id_seq', 'CommonFeedback_id_seq', 'UploadedFile_id_seq',
            'Message_id_seq', 'PracticeClone_id_seq', 'UserPracticeProgress_id_seq',
            'CloneDiscussion_id_seq', 'DiscussionMessage_id_seq'
        ];

        for (const seqName of sequenceNames) {
            try {
                // Use template literal to build the SQL string
                const sql = `SELECT setval('${seqName}', 1000)`;
                await prisma.$executeRawUnsafe(sql);
                console.log(`✅ Set ${seqName} to 1000`);
            } catch (error) {
                // Sequence might not exist, that's fine
                console.log(`⚠️  Skipped ${seqName} (might not exist)`);
            }
        }

        console.log('Sequence reset completed!');

        console.log('\n=== IMPORT COMPLETED SUCCESSFULLY ===');
        console.log('All data has been imported to the new database.');

    } catch (error) {
        console.error('Import failed:', error);
        console.error('Error details:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the import
importData();