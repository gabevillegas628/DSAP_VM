// migration-messages-to-clone-discussions.js
// Run this with: node migration-messages-to-clone-discussions.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateToCloneDiscussions() {
  console.log('🚀 Starting migration from Messages to CloneDiscussions...');
  
  try {
    // Step 1: Find all support and general messages that need migration
    console.log('\n📝 Step 1: Finding messages to migrate...');
    
    const messagesToMigrate = await prisma.message.findMany({
      where: {
        messageType: {
          in: ['support', 'general', 'group_support']
        }
      },
      include: {
        sender: true,
        recipient: true,
        clone: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${messagesToMigrate.length} messages to migrate`);

    // Step 2: Group messages by unique student+clone combinations
    console.log('\n🔍 Step 2: Grouping messages by student+clone combinations...');
    
    const discussionGroups = new Map();
    
    messagesToMigrate.forEach(message => {
      // Determine the student ID (could be sender or recipient)
      let studentId = null;
      let studentInfo = null;
      
      if (message.sender.role === 'student') {
        studentId = message.senderId;
        studentInfo = message.sender;
      } else if (message.recipient.role === 'student') {
        studentId = message.recipientId;
        studentInfo = message.recipient;
      } else if (message.isGroupMessage && message.groupParticipants) {
        // For group messages, we need to find the student from participants
        try {
          const participants = JSON.parse(message.groupParticipants);
          // We'll need to query each participant to find the student
          // For now, let's skip this complex case and handle it manually if needed
          console.warn(`⚠️  Skipping complex group message ${message.id} - manual review needed`);
          return;
        } catch (e) {
          console.warn(`⚠️  Could not parse groupParticipants for message ${message.id}`);
          return;
        }
      }

      if (!studentId) {
        console.warn(`⚠️  Could not determine student for message ${message.id}`);
        return;
      }

      // Create unique key for this student+clone combination
      const cloneId = message.cloneId || 'general';
      const discussionKey = `${studentId}-${cloneId}`;
      
      if (!discussionGroups.has(discussionKey)) {
        discussionGroups.set(discussionKey, {
          studentId: studentId,
          studentInfo: studentInfo,
          cloneId: message.cloneId, // null for general discussions
          clone: message.clone,
          messages: []
        });
      }
      
      discussionGroups.get(discussionKey).messages.push(message);
    });

    console.log(`Grouped into ${discussionGroups.size} unique discussions`);

    // Step 3: Create CloneDiscussion records
    console.log('\n💾 Step 3: Creating CloneDiscussion records...');
    
    const discussionMap = new Map(); // Maps old discussion key to new CloneDiscussion.id
    
    for (const [discussionKey, group] of discussionGroups) {
      const { studentId, studentInfo, cloneId, clone, messages } = group;
      
      // Sort messages by creation date to get first and last
      const sortedMessages = messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const firstMessage = sortedMessages[0];
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      
      // Generate discussion title
      let title;
      if (clone) {
        title = `Discussion: ${clone.cloneName}`;
      } else {
        title = `General Discussion with ${studentInfo.name}`;
      }
      
      try {
        // Check if CloneDiscussion already exists (in case script is run multiple times)
        const existingDiscussion = await prisma.cloneDiscussion.findFirst({
          where: {
            studentId: studentId,
            ...(cloneId ? { cloneId: cloneId } : { cloneId: null })
          }
        });

        let discussion;
        if (existingDiscussion) {
          console.log(`   ↻ Discussion already exists for student ${studentId}, clone ${cloneId || 'general'}`);
          discussion = existingDiscussion;
        } else {
          discussion = await prisma.cloneDiscussion.create({
            data: {
              studentId: studentId,
              cloneId: cloneId,
              title: title,
              status: 'active',
              createdAt: firstMessage.createdAt,
              lastMessageAt: lastMessage.createdAt
            }
          });
          console.log(`   ✓ Created discussion ${discussion.id}: ${title}`);
        }
        
        discussionMap.set(discussionKey, discussion.id);
      } catch (error) {
        console.error(`   ❌ Error creating discussion for ${discussionKey}:`, error.message);
      }
    }

    // Step 4: Create DiscussionMessage records
    console.log('\n💬 Step 4: Creating DiscussionMessage records...');
    
    let messageCount = 0;
    let errorCount = 0;
    
    for (const [discussionKey, group] of discussionGroups) {
      const discussionId = discussionMap.get(discussionKey);
      if (!discussionId) {
        console.warn(`   ⚠️  No discussion ID found for ${discussionKey}, skipping messages`);
        continue;
      }
      
      for (const oldMessage of group.messages) {
        try {
          // Check if DiscussionMessage already exists
          const existingDiscussionMessage = await prisma.discussionMessage.findFirst({
            where: {
              discussionId: discussionId,
              senderId: oldMessage.senderId,
              content: oldMessage.content,
              createdAt: oldMessage.createdAt
            }
          });

          if (existingDiscussionMessage) {
            console.log(`   ↻ Discussion message already exists for original message ${oldMessage.id}`);
            continue;
          }

          // Determine message type
          let messageType = 'message';
          if (oldMessage.messageType === 'review_feedback') {
            messageType = 'feedback';
          }
          
          // Create readBy array - mark as read by sender, unread by others
          const readBy = [oldMessage.senderId];
          if (oldMessage.isRead && oldMessage.recipientId !== oldMessage.senderId) {
            readBy.push(oldMessage.recipientId);
          }
          
          const discussionMessage = await prisma.discussionMessage.create({
            data: {
              discussionId: discussionId,
              senderId: oldMessage.senderId,
              content: oldMessage.content,
              messageType: messageType,
              readBy: JSON.stringify(readBy),
              createdAt: oldMessage.createdAt,
              updatedAt: oldMessage.updatedAt
            }
          });
          
          messageCount++;
          
          if (messageCount % 10 === 0) {
            console.log(`   📈 Migrated ${messageCount} messages so far...`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error migrating message ${oldMessage.id}:`, error.message);
          errorCount++;
        }
      }
    }

    // Step 5: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   • Found ${messagesToMigrate.length} messages to migrate`);
    console.log(`   • Created ${discussionGroups.size} clone discussions`);
    console.log(`   • Migrated ${messageCount} discussion messages`);
    console.log(`   • Encountered ${errorCount} errors`);
    
    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n🔍 Verification queries you can run:');
      console.log('   SELECT COUNT(*) FROM CloneDiscussion;');
      console.log('   SELECT COUNT(*) FROM DiscussionMessage;');
      console.log('   SELECT * FROM CloneDiscussion LIMIT 5;');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the error messages above.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to verify migration results
async function verifyMigration() {
  console.log('\n🔍 Verifying migration results...');
  
  try {
    const discussionCount = await prisma.cloneDiscussion.count();
    const discussionMessageCount = await prisma.discussionMessage.count();
    const oldMessageCount = await prisma.message.count({
      where: {
        messageType: {
          in: ['support', 'general', 'group_support']
        }
      }
    });

    console.log(`   • CloneDiscussions created: ${discussionCount}`);
    console.log(`   • DiscussionMessages created: ${discussionMessageCount}`);
    console.log(`   • Original messages to migrate: ${oldMessageCount}`);

    // Sample some discussions
    const sampleDiscussions = await prisma.cloneDiscussion.findMany({
      take: 3,
      include: {
        student: { select: { name: true } },
        clone: { select: { cloneName: true } },
        messages: {
          take: 2,
          include: {
            sender: { select: { name: true, role: true } }
          }
        }
      }
    });

    console.log('\n📋 Sample discussions:');
    sampleDiscussions.forEach(discussion => {
      console.log(`   • ${discussion.title} (${discussion.student.name})`);
      console.log(`     ${discussion.messages.length} messages, last: ${discussion.lastMessageAt}`);
    });

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--verify')) {
    verifyMigration();
  } else if (args.includes('--help')) {
    console.log('Usage:');
    console.log('  node migration-messages-to-clone-discussions.js          # Run migration');
    console.log('  node migration-messages-to-clone-discussions.js --verify # Verify results');
    console.log('  node migration-messages-to-clone-discussions.js --help   # Show this help');
  } else {
    migrateToCloneDiscussions();
  }
}