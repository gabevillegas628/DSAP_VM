// discussionUtils.js - Utility functions for CloneDiscussion system
import apiService from '../services/apiService';

/**
 * Check if a discussion exists for a student+clone combination
 * @param {number} studentId - The student's user ID
 * @param {number|string} cloneId - The clone ID ('general' for general discussions)
 * @returns {Promise<{exists: boolean, discussion?: object}>}
 */
export const checkForExistingDiscussion = async (studentId, cloneId) => {
  try {
    const discussion = await apiService.get(`/clone-discussions/${studentId}/${cloneId}`);
    
    if (discussion && discussion.messages && discussion.messages.length > 0) {
      return {
        exists: true,
        discussion: discussion,
        messageCount: discussion.messages.length,
        cloneName: discussion.clone?.cloneName || 'General Discussion',
        lastMessageDate: discussion.lastMessageAt
      };
    } else {
      return { exists: false };
    }
  } catch (error) {
    console.error('Error checking for existing discussion:', error);
    return { exists: false };
  }
};

/**
 * Create or get a discussion for student+clone and add a message
 * @param {number} studentId 
 * @param {number|string} cloneId 
 * @param {number} senderId 
 * @param {string} content 
 * @param {string} messageType 
 * @returns {Promise<object>} The created message
 */
export const sendMessageToDiscussion = async (studentId, cloneId, senderId, content, messageType = 'message') => {
  try {
    // Get or create the discussion
    const discussion = await apiService.get(`/clone-discussions/${studentId}/${cloneId}`);
    
    // Add the message
    const message = await apiService.post(`/clone-discussions/${discussion.id}/messages`, {
      senderId,
      content,
      messageType
    });
    
    return message;
  } catch (error) {
    console.error('Error sending message to discussion:', error);
    throw error;
  }
};

/**
 * Mark all messages in a discussion as read by a specific user
 * @param {number} discussionId 
 * @param {number} userId 
 * @returns {Promise<void>}
 */
export const markDiscussionAsRead = async (discussionId, userId) => {
  try {
    await apiService.patch(`/clone-discussions/${discussionId}/mark-read`, {
      userId
    });
  } catch (error) {
    console.error('Error marking discussion as read:', error);
    throw error;
  }
};

/**
 * Legacy compatibility function - maintains the same API as the old checkForExistingDiscussion
 * but uses the new CloneDiscussion system
 */
export const legacyCheckForExistingDiscussion = async (studentId, cloneId) => {
  const result = await checkForExistingDiscussion(studentId, cloneId);
  
  if (result.exists) {
    const lastMessage = result.discussion.messages[result.discussion.messages.length - 1];
    return {
      exists: true,
      messageCount: result.messageCount,
      cloneName: result.cloneName,
      lastMessageDate: result.lastMessageDate,
      lastMessagePreview: lastMessage?.content?.substring(0, 100) + 
        (lastMessage?.content?.length > 100 ? '...' : '')
    };
  } else {
    return { exists: false };
  }
};