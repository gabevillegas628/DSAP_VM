// Updated MessageModal.jsx - Uses CloneDiscussion system
import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, X, AlertCircle, CheckCircle, User, FileText, BarChart3, ArrowRight, Clock } from 'lucide-react';
import apiService from '../services/apiService';

const MessageModal = ({
  isOpen,
  onClose,
  currentUser,
  cloneData,
  currentProgress = 0,
  currentStep = 'clone-editing',
  onNavigateToMessages,
  initialContent = '',
  initialSubject = ''
}) => {
  console.log('MessageModal render - currentUser:', currentUser);
  console.log('MessageModal render - cloneData:', cloneData);

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // New states for discussion check
  const [checkingDiscussion, setCheckingDiscussion] = useState(false);
  const [existingDiscussion, setExistingDiscussion] = useState(null);
  const [showNewMessageForm, setShowNewMessageForm] = useState(false);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
    if (initialSubject) {
      setSubject(initialSubject);
    }
  }, [initialContent, initialSubject]);

  // Check for existing discussion when modal opens
  useEffect(() => {
    if (isOpen && currentUser && cloneData?.id) {
      checkForExistingDiscussion();
    } else if (isOpen && !cloneData?.id) {
      // No clone context, allow new message
      setShowNewMessageForm(true);
    }
  }, [isOpen, currentUser, cloneData]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetModalState();
    }
  }, [isOpen]);

  const resetModalState = () => {
    setSubject('');
    setContent('');
    setSending(false);
    setSent(false);
    setError('');
    setCheckingDiscussion(false);
    setExistingDiscussion(null);
    setShowNewMessageForm(false);
  };

  const checkForExistingDiscussion = async () => {
    setCheckingDiscussion(true);
    setError('');

    try {
      console.log('Checking for existing discussion...');
      console.log('Student ID:', currentUser.id);
      console.log('Clone ID:', cloneData.id);

      // Use the new CloneDiscussion API
      const discussion = await apiService.get(`/clone-discussions/${currentUser.id}/${cloneData.id}`);

      console.log('Discussion check result:', discussion);

      if (discussion && discussion.messages && discussion.messages.length > 0) {
        setExistingDiscussion({
          exists: true,
          messageCount: discussion.messageCount || discussion.messages.length,
          cloneName: discussion.clone?.cloneName || 'Unknown Clone',
          lastMessageDate: discussion.lastMessageAt,
          lastMessagePreview: discussion.messages[discussion.messages.length - 1]?.content?.substring(0, 100) + '...'
        });
        setShowNewMessageForm(false);
      } else {
        setExistingDiscussion(null);
        setShowNewMessageForm(true);
      }
    } catch (error) {
      console.error('Error checking for existing discussion:', error);
      // If check fails, allow new message as fallback
      setShowNewMessageForm(true);
    } finally {
      setCheckingDiscussion(false);
    }
  };

  const handleSendMessage = async () => {
    console.log('=== STARTING MESSAGE SEND ===');
    console.log('Current User Object:', currentUser);
    console.log('Current User ID:', currentUser?.id);
    console.log('Clone Data:', cloneData);

    // Enhanced validation
    if (!currentUser) {
      console.error('ERROR: currentUser is null/undefined');
      setError('User information not available. Please refresh the page and try again.');
      return;
    }

    if (!currentUser.id) {
      console.error('ERROR: currentUser.id is missing:', currentUser);
      setError('User ID not available. Please refresh the page and try again.');
      return;
    }

    if (!content || content.trim() === '') {
      console.error('ERROR: Content is empty');
      setError('Please enter a message.');
      return;
    }

    setSending(true);
    setError('');

    try {
      // Step 1: Get or create the discussion
      const cloneId = cloneData?.id || 'general';
      console.log('📝 MessageModal: Getting/creating discussion for student:', currentUser.id, 'clone:', cloneId);

      const discussion = await apiService.get(`/clone-discussions/${currentUser.id}/${cloneId}`);
      console.log('📝 MessageModal: Got discussion:', discussion);


      console.log('Got/created discussion:', discussion.id);

      // Step 2: Add the message to the discussion
      const message = await apiService.post(`/clone-discussions/${discussion.id}/messages`, {
        senderId: currentUser.id,
        content: content.trim(),
        messageType: 'message'
      });

      console.log('Message sent successfully:', message);
      setSent(true);
      setSubject('');
      setContent('');
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.message.includes('400')) {
        setError('Please check that all required fields are filled out correctly.');
      } else if (error.message.includes('403')) {
        setError('You don\'t have permission to send this message.');
      } else if (error.message.includes('500')) {
        setError('Server error. Please try again in a moment.');
      } else {
        setError('Failed to send message. Please check your connection and try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleNavigateToExistingDiscussion = () => {
    console.log('Navigating to existing discussion for clone:', cloneData?.id);
    handleClose();
    if (onNavigateToMessages) {
      onNavigateToMessages(cloneData.id);
    }
  };

  const getStepDisplayName = (step) => {
    const stepNames = {
      'clone-editing': 'Clone Editing',
      'blast': 'BLAST Analysis',
      'analysis-submission': 'Analysis & Submission',
      'review': 'Review'
    };
    return stepNames[step] || step;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {sent ? 'Message Sent!' :
                    existingDiscussion ? 'Existing Discussion Found' :
                      checkingDiscussion ? 'Checking...' : 'Send Message'}
                </h3>
                <p className="text-sm text-gray-600">
                  {sent ? 'Your message has been sent to the instructors.' :
                    existingDiscussion ? 'You already have an ongoing discussion for this clone.' :
                      checkingDiscussion ? 'Checking for existing discussion...' :
                        cloneData ? `About ${cloneData.cloneName || 'your clone'}` : 'General message'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {sent ? (
            // Success state
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Message Sent Successfully!</h4>
              <p className="text-gray-600 mb-6">
                Your message has been added to the discussion. The instructors will be notified and can respond.
              </p>
              <div className="flex justify-center space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                {onNavigateToMessages && (
                  <button
                    onClick={() => {
                      onNavigateToMessages(cloneData?.id);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>View Discussion</span>
                  </button>
                )}
              </div>
            </div>
          ) : existingDiscussion ? (
            // Existing discussion found
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 mb-1">Discussion Already Started</h4>
                    <p className="text-blue-800 text-sm mb-3">
                      You have an ongoing discussion about <strong>{existingDiscussion.cloneName}</strong> with {existingDiscussion.messageCount} message{existingDiscussion.messageCount !== 1 ? 's' : ''}.
                    </p>
                    {existingDiscussion.lastMessagePreview && (
                      <div className="bg-white/50 rounded p-2 text-sm text-blue-900 mb-3">
                        <p className="text-xs text-blue-600 mb-1">Last message:</p>
                        <p>"{existingDiscussion.lastMessagePreview}"</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {formatDate(existingDiscussion.lastMessageDate)}
                        </p>
                      </div>
                    )}
                    <p className="text-blue-800 text-sm">
                      Would you like to continue this discussion or send a new message?
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowNewMessageForm(true)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  Send New Message
                </button>
                <button
                  onClick={handleNavigateToExistingDiscussion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <span>View Discussion</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : checkingDiscussion ? (
            // Loading state
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Checking for existing discussion...</p>
            </div>
          ) : showNewMessageForm ? (
            // New message form
            <div className="space-y-6">
              {cloneData && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <FileText className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{cloneData.cloneName}</h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <BarChart3 className="w-3 h-3" />
                          <span>Progress: {currentProgress}%</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Step: {getStepDisplayName(currentStep)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Describe the issue you're experiencing or question you have..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={6}
                    disabled={sending}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!content.trim() || sending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Send Message</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MessageModal;