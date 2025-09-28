import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, ChevronRight, CheckCircle, AlertCircle, Save, Eye, AlertTriangle, X, BarChart3, ZoomIn, ZoomOut, RotateCcw, MessageCircle, Clock, XCircle, RefreshCw, User, Dna, HelpCircle } from 'lucide-react';
import MessageModal from './MessageModal';
import ChromatogramViewer from './ChromatogramViewer';
import ORFTranslator from './ORFTranslator';
import apiService from '../services/apiService';
import {
  CLONE_STATUSES,
  STATUS_CONFIGS,
  getStatusConfig,
  canStudentEdit,
  isReadOnly,
  shouldShowFeedback,
  validateAndWarnStatus
} from '../statusConstraints.js';


// Review Status Banner Component
const ReviewStatusBanner = ({ status, onRefresh }) => {
  const config = getStatusConfig(status);
  if (!config) return null;

  // Convert string icon name to actual icon component
  let Icon;
  switch (config.icon) {
    case 'Clock':
      Icon = Clock;
      break;
    case 'RefreshCw':
      Icon = RefreshCw;
      break;
    case 'CheckCircle':
      Icon = CheckCircle;
      break;
    default:
      Icon = AlertCircle;
  }

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-6`}>
      <div className="flex items-start space-x-3">
        <Icon className={`w-6 h-6 ${config.iconColor} mt-0.5`} />
        <div className="flex-1">
          <h4 className={`font-semibold ${config.textColor} mb-1`}>{config.title}</h4>
          <p className={`text-sm ${config.textColor}`}>{config.message}</p>
          {config.showRefresh && (
            <button
              onClick={onRefresh}
              className={`mt-2 text-sm ${config.textColor} hover:underline flex items-center space-x-1`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Check for updates</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Submit Confirmation Modal Component
const SubmitConfirmationModal = ({ isOpen, onClose, onConfirm, cloneName, progress, isSubmitting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Submit for Review</h3>
              <p className="text-sm text-gray-600">Ready to submit your analysis?</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-gray-900">{cloneName}</span>
            </div>
            <p className="text-gray-700 text-sm mb-3">
              You're about to submit your analysis for instructor review. Your work will be locked for editing until the review is complete.
            </p>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Current Progress: {progress}%</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">What happens next:</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Your analysis will be submitted to instructors</li>
              <li>• You won't be able to edit until review is complete</li>
              <li>• You'll receive feedback through the messaging system</li>
              <li>• If changes are needed, editing will be re-enabled</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>

            <button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200 disabled:bg-purple-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Submit for Review</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Use your existing ChromatogramViewer component


// Enhanced Close Modal Component
const EnhancedCloseModal = ({
  isOpen,
  onClose,
  onSaveAndClose,
  onCloseAnyway,
  cloneName,
  unsavedChanges = 0,
  isAutoSaving = false
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      await onSaveAndClose();
    } catch (error) {
      console.error('Error saving:', error);
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Unsaved Changes</h3>
              <p className="text-sm text-gray-600">You have unsaved progress</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-gray-900">{cloneName}</span>
            </div>
            <p className="text-gray-700 text-sm">
              You have unsaved changes to your analysis. What would you like to do?
            </p>
          </div>

          {unsavedChanges > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  {unsavedChanges} unsaved {unsavedChanges === 1 ? 'answer' : 'answers'}
                </span>
              </div>
            </div>
          )}

          {isAutoSaving && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-blue-800">Auto-saving in progress...</span>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Your options:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span><strong>Save & Close:</strong> Keep your progress and close</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span><strong>Keep Working:</strong> Continue with your analysis</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span><strong>Discard:</strong> Lose unsaved changes and close</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Keep Working - Left button */}
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Keep Working
            </button>

            {/* Save & Close - Middle button */}
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving || isAutoSaving}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 disabled:bg-green-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save & Close</span>
                </>
              )}
            </button>

            {/* Discard - Right button */}
            <button
              onClick={onCloseAnyway}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
            >
              <X className="w-4 h-4" />
              <span>Discard</span>
            </button>
          </div>

          {/* Warning text */}
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              Tip: Your work is automatically saved every few minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Feedback Messages Component
const FeedbackMessagesPanel = ({ cloneData, currentUser, isVisible, onToggle }) => {
  const [feedbackMessages, setFeedbackMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isVisible && cloneData?.type === 'assigned') {
      fetchFeedbackMessages();
    }
  }, [isVisible, cloneData]);

  const fetchFeedbackMessages = async () => {
    setLoading(true);
    try {
      const allMessages = await apiService.get(`/messages/user/${currentUser.id}?type=received`);

      const cloneFeedback = allMessages.filter(msg =>
        msg.cloneId === cloneData.id &&
        (msg.messageType === 'review_feedback' || msg.subject.includes('Review Feedback'))
      );

      setFeedbackMessages(cloneFeedback);
      const unread = cloneFeedback.filter(msg => !msg.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching feedback messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await apiService.put(`/messages/${messageId}/read`);

      setFeedbackMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, isRead: true } : msg
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6">
      <div className="p-4 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-blue-900">
              Instructor Feedback
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h4>
          </div>
          <button
            onClick={onToggle}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Hide Feedback
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading feedback...</p>
          </div>
        ) : feedbackMessages.length === 0 ? (
          <div className="p-6 text-center">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No instructor feedback yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Feedback will appear here after your analysis is reviewed
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {feedbackMessages.map(message => (
              <div
                key={message.id}
                className={`p-4 cursor-pointer transition-colors ${!message.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                onClick={() => !message.isRead && markAsRead(message.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {message.sender.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(message.createdAt)}
                      </p>
                    </div>
                  </div>
                  {!message.isRead && (
                    <span className="bg-blue-500 w-2 h-2 rounded-full"></span>
                  )}
                </div>

                <div className="ml-10">
                  <h5 className="font-medium text-gray-900 mb-1">
                    {message.subject}
                  </h5>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Review Status Banner Component
const EnhancedReviewStatusBanner = ({ status, onRefresh, onToggleFeedback, hasUnreadFeedback }) => {
  // Use the imported function directly - no local wrapper needed
  const config = getStatusConfig(status);
  if (!config) return null;

  // Convert string icon name to actual icon component
  let Icon;
  switch (config.icon) {
    case 'Clock':
      Icon = Clock;
      break;
    case 'RefreshCw':
      Icon = RefreshCw;
      break;
    case 'CheckCircle':
      Icon = CheckCircle;
      break;
    case 'AlertCircle':
      Icon = AlertCircle;
      break;
    default:
      Icon = AlertCircle;
  }

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-6`}>
      <div className="flex items-start space-x-3">
        <Icon className={`w-6 h-6 ${config.iconColor} mt-0.5`} />
        <div className="flex-1">
          <h4 className={`font-semibold ${config.textColor} mb-1`}>{config.title}</h4>
          <p className={`text-sm ${config.textColor} mb-3`}>{config.message}</p>

          <div className="flex items-center space-x-3">
            {config.showRefresh && (
              <button
                onClick={onRefresh}
                className={`text-sm ${config.textColor} hover:underline flex items-center space-x-1`}
              >
                <RefreshCw className="w-3 h-3" />
                <span>Check for updates</span>
              </button>
            )}

            {config.showFeedbackButton && (
              <button
                onClick={onToggleFeedback}
                className={`text-sm ${config.textColor} hover:underline flex items-center space-x-1 font-medium`}
              >
                <MessageCircle className="w-3 h-3" />
                <span>
                  View Instructor Feedback
                  {hasUnreadFeedback && (
                    <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main DNA Analysis Interface Component
const DNAAnalysisInterface = ({ cloneData, onClose, onProgressUpdate, onUnsavedChangesUpdate, currentUser, onNavigateToMessages, onOpenHelp }) => {
  console.log('DNAAnalysisInterface currentUser:', currentUser);
  console.log('DNAAnalysisInterface component rendering...');

  const [currentStep, setCurrentStep] = useState('clone-editing');
  const [analysisQuestions, setAnalysisQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showChromatogram, setShowChromatogram] = useState(false);
  const [chromatogramData, setChromatogramData] = useState(null);
  const [loadingChromatogram, setLoadingChromatogram] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(cloneData?.status || '');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [hasUnreadFeedback, setHasUnreadFeedback] = useState(false);
  const [reviewComments, setReviewComments] = useState([]);
  const [showORFTranslator, setShowORFTranslator] = useState(false);

  const steps = [
    { id: 'clone-editing', name: 'Clone Editing', description: 'Quality check and sequence preparation' },
    { id: 'blast', name: 'BLAST Analysis', description: 'Database search and identification' },
    { id: 'analysis-submission', name: 'Analysis & Submission', description: 'Final analysis and results' },
    { id: 'review', name: 'Review', description: 'Instructor feedback and corrections' }
  ];

  useEffect(() => {
    console.log('useEffect running...');
    fetchAnalysisQuestions();

    if (cloneData) {
      console.log('Loading progress for', cloneData.type, 'file...');
      loadProgress();
    }
  }, [cloneData?.id, cloneData?.type]); // Only trigger when ID or type actually changes

  useEffect(() => {
    if (currentUser && cloneData?.type === 'assigned') {
      checkForUnreadFeedback();
    }
  }, [currentUser, cloneData]);

  // 1. ADD this useEffect to clear chromatogram data when cloneData changes
  useEffect(() => {
    // Reset chromatogram state when switching between clones
    console.log('CloneData changed, resetting chromatogram state');
    setChromatogramData(null);
    setShowChromatogram(false);
    setLoadingChromatogram(false);
  }, [cloneData.id, cloneData.type]); // Dependency on both ID and type

  // Add state for help topics
  const [helpTopics, setHelpTopics] = useState({});

  // Fetch help topics when questions load
  useEffect(() => {
    const fetchHelpTopics = async () => {
      try {
        const topics = await apiService.get('/help-topics');
        const topicMap = {};
        topics.forEach(topic => {
          topicMap[topic.analysisQuestionId] = topic;
        });
        setHelpTopics(topicMap);
      } catch (error) {
        console.error('Error fetching help topics:', error);
      }
    };

    if (analysisQuestions.length > 0) {
      fetchHelpTopics();
    }
  }, [analysisQuestions]);

  // Function to open help in new tab
  const openHelp = (questionId) => {
    const helpTopic = helpTopics[questionId];
    if (helpTopic) {
      const url = `/student-help/${helpTopic.id}`;
      window.open(url, '_blank');
    }
  };

  const handleSubmitForReview = async () => {
    // First, check if there are unsaved changes and save them
    if (hasUnsavedChanges && !saving) {
      console.log('Saving unsaved changes before submit...');
      try {
        // Call the existing saveProgress function and wait for it to complete
        await saveProgress();
        console.log('Changes saved successfully, proceeding with submit...');
      } catch (error) {
        console.error('Error saving before submit:', error);
        // If save fails, don't proceed with submit
        return;
      }
    }

    // After saving (or if no unsaved changes), show the submit modal
    setShowSubmitModal(true);
  };
  // Add this new function to handle navigation to messages
  const handleNavigateToMessages = () => {
    console.log('Navigating to messages for clone:', cloneData?.id);

    // Close the current analysis interface
    if (onClose) {
      onClose();
    }

    // Navigate to messages tab and optionally select the clone
    if (onNavigateToMessages) {
      onNavigateToMessages(cloneData?.id);
    }
  };

  const getQuestionComments = (questionId) => {
    console.log('=== GET QUESTION COMMENTS DEBUG ===');
    console.log('Looking for comments for questionId:', questionId, 'Type:', typeof questionId);
    console.log('All reviewComments:', reviewComments);

    const comments = reviewComments.filter(comment => {
      console.log('Checking comment:', comment);
      console.log('Comment questionId:', comment.questionId, 'Type:', typeof comment.questionId);
      console.log('Match?', comment.questionId === questionId, 'Loose match?', comment.questionId == questionId);
      return comment.questionId === questionId;
    });

    console.log('Found comments for question:', comments);
    return comments;
  };

  const isQuestionCorrect = (questionId) => {
    return reviewComments.some(comment =>
      comment.questionId === questionId && comment.comment === 'Correct!'
    );
  };

  const checkForUnreadFeedback = async () => {
    try {
      const unreadMessages = await apiService.get(`/messages/user/${currentUser.id}?type=received&unreadOnly=true`);
      const unreadFeedback = unreadMessages.filter(msg =>
        msg.cloneId === cloneData.id &&
        (msg.messageType === 'review_feedback' || msg.subject.includes('Review Feedback'))
      );
      setHasUnreadFeedback(unreadFeedback.length > 0);

      // Auto-show feedback panel if there's unread feedback and status allows it
      if (unreadFeedback.length > 0 && (
        currentStatus === CLONE_STATUSES.NEEDS_REANALYSIS ||
        currentStatus === CLONE_STATUSES.REVIEWED_CORRECT
      )) {
        setShowFeedbackPanel(true);
      }
    } catch (error) {
      console.error('Error checking for unread feedback:', error);
    }
  };

  const fetchAnalysisQuestions = async () => {
    try {
      const questions = await apiService.get('/analysis-questions');
      setAnalysisQuestions(questions);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analysis questions:', error);
      setLoading(false);
    }
  };

  // MODIFY the loadProgress function in DNAAnalysisInterface.jsx:
  // CORRECTED loadProgress function in DNAAnalysisInterface.jsx:
  // ENHANCED DEBUGGING version of loadProgress function
  // REPLACE your loadProgress function with this version:
  const loadProgress = async () => {
    try {
      if (hasUnsavedChanges) {
        console.log('Skipping loadProgress due to unsaved changes');
        return;
      }
      console.log('=== LOAD PROGRESS DEBUG ===');
      console.log('Loading progress for clone:', cloneData.cloneName, 'Type:', cloneData.type);
      console.log('Initial currentStatus state:', currentStatus);
      console.log('cloneData.status:', cloneData.status);

      let progressData;
      if (cloneData.type === 'assigned') {
        progressData = await apiService.get(`/uploaded-files/${cloneData.id}/progress`);
      } else if (cloneData.type === 'practice') {
        progressData = await apiService.get(`/practice-clones/${cloneData.id}/progress/${currentUser.id}`);
      } else {
        console.error('Unknown clone type:', cloneData.type);
        return;
      }

      console.log('*** RAW RESPONSE FROM SERVER ***');
      console.log('Full progressData object:', progressData);
      console.log('progressData.answers:', progressData.answers);

      // Handle analysisData field (for assigned files) or direct fields (for practice)
      // Handle analysisData field (for assigned files) or direct fields (for practice)
      // Handle analysisData field (for assigned files) or direct fields (for practice)
      let fullAnalysisData = {};
      if (cloneData.type === 'assigned') {
        // ALWAYS set status for assigned clones, regardless of analysisData
        if (progressData.status) {
          setCurrentStatus(progressData.status);
          console.log('*** STATUS DEBUG FOR ASSIGNED ***');
          console.log('progressData.status:', progressData.status);
          console.log('cloneData.status:', cloneData.status);
          console.log('Setting currentStatus to:', progressData.status);
        }

        // Parse analysisData if it exists
        if (progressData.analysisData) {
          try {
            fullAnalysisData = JSON.parse(progressData.analysisData);
            console.log('*** PARSED ANALYSIS DATA ***');
            console.log('Parsed analysis data object:', fullAnalysisData);
          } catch (parseError) {
            console.error('*** ERROR PARSING ANALYSIS DATA ***');
            console.error('Parse error:', parseError);
          }
        }

      } else if (cloneData.type === 'practice') {
        // For practice clones, data is already parsed
        fullAnalysisData = {
          answers: progressData.answers || {},
          currentStep: progressData.currentStep || 'clone-editing',
          reviewComments: progressData.reviewComments || [],
          lastSaved: progressData.lastSaved,
          status: progressData.status,
          progress: progressData.progress
        };

        // Also set the status for practice clones
        if (progressData.status) {
          setCurrentStatus(progressData.status);
          console.log('*** STATUS DEBUG FOR PRACTICE ***');
          console.log('progressData.status:', progressData.status);
          console.log('Setting currentStatus to:', progressData.status);
        }
      }

      // Set review comments
      if (fullAnalysisData.reviewComments) {
        console.log('*** SETTING REVIEW COMMENTS ***');
        console.log('reviewComments:', fullAnalysisData.reviewComments);
        setReviewComments(fullAnalysisData.reviewComments);
      }

      // Set answers and other progress data
      if (fullAnalysisData.answers && Object.keys(fullAnalysisData.answers).length > 0) {
        setAnswers(fullAnalysisData.answers);
        setHasUnsavedChanges(false);
        if (onUnsavedChangesUpdate) {
          onUnsavedChangesUpdate(false);
        }
        console.log('Restored answers:', fullAnalysisData.answers);
      }

      if (fullAnalysisData.currentStep) {
        setCurrentStep(fullAnalysisData.currentStep);
      }

      if (fullAnalysisData.lastSaved) {
        setLastSaved(new Date(fullAnalysisData.lastSaved));
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  // REMOVE the separate loadReviewComments function and its call

  // NEW: Check if interface should be read-only
  const isReadOnlyStatus = () => {
    return isReadOnly(currentStatus);
  };

  // NEW: Check if student can edit (status allows editing)
  // NEW: Check if student can edit (status allows editing)
  const canEdit = () => {
    // Validate current status and warn if invalid
    validateAndWarnStatus(currentStatus, 'DNAAnalysisInterface');

    return canStudentEdit(currentStatus);
  };

  // NEW: Refresh current status from server
  const refreshStatus = async () => {
    if (!cloneData || cloneData.type !== 'assigned') return;

    try {
      const data = await apiService.get(`/uploaded-files/${cloneData.id}/progress`);
      setCurrentStatus(data.status || cloneData.status);
      // Also check for new feedback after status refresh
      checkForUnreadFeedback();
      // NEW: Reload review comments
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  // NEW: Submit for review function
  const submitForReview = async () => {
    if (!canEdit()) return;

    setSaving(true);
    try {
      const progress = getOverallProgress();

      // Determine new status based on current status
      let newStatus = CLONE_STATUSES.COMPLETED_WAITING_REVIEW;
      if (currentStatus === CLONE_STATUSES.NEEDS_REANALYSIS) {
        newStatus = CLONE_STATUSES.CORRECTED_WAITING_REVIEW;
      }

      const requestData = {
        progress,
        answers,
        currentStep,
        status: newStatus,  // This will now be COMPLETED_WAITING_REVIEW
        reviewComments: reviewComments,
        reviewScore: undefined,
        lastReviewed: undefined,
        submittedAt: new Date().toISOString()
      };

      if (cloneData.type === 'assigned') {
        await apiService.put(`/uploaded-files/${cloneData.id}/progress`, requestData);
      } else if (cloneData.type === 'practice') {
        await apiService.put(`/practice-clones/${cloneData.id}/progress/${currentUser.id}`, requestData);
      }

      setCurrentStatus(newStatus);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      onProgressUpdate && onProgressUpdate(progress);

      if (onUnsavedChangesUpdate) {
        onUnsavedChangesUpdate(false);
      }

      setShowSubmitModal(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error submitting for review:', error);
      alert('Error submitting for review');
    } finally {
      setSaving(false);
    }
  };

  // Function to load the .ab1 file data for chromatogram viewing
  // Enhanced loadChromatogramData function with better debugging
  // REPLACE your loadChromatogramData function with this improved version
  // that handles multiple tabs correctly

  const loadChromatogramData = async () => {
    // Prevent loading if already loaded or loading
    if (chromatogramData || loadingChromatogram) return;

    setLoadingChromatogram(true);

    // Create a unique identifier for this specific component instance
    const componentId = `${cloneData.type}-${cloneData.id}`;

    try {
      console.log('=== CHROMATOGRAM LOADING (MULTI-TAB SAFE) ===');
      console.log('Component ID:', componentId);
      console.log('cloneData:', cloneData);

      let downloadEndpoint;
      let expectedCloneId;

      if (cloneData.type === 'assigned') {
        downloadEndpoint = `/uploaded-files/${cloneData.id}/download`;
        expectedCloneId = cloneData.id;
      } else if (cloneData.type === 'practice') {
        expectedCloneId = cloneData.id;
        downloadEndpoint = `/practice-clones/${expectedCloneId}/download`;
      } else {
        console.error('Unknown clone type:', cloneData.type);
        setLoadingChromatogram(false);
        return;
      }

      console.log('Download endpoint:', downloadEndpoint);

      // UPDATED: Use apiService.downloadBlob instead of raw fetch
      const blob = await apiService.downloadBlob(downloadEndpoint);

      // CRITICAL: Check if this component is still working with the same clone
      const currentComponentId = `${cloneData.type}-${cloneData.id}`;
      if (currentComponentId !== componentId) {
        console.log('Component clone changed during fetch, aborting');
        return;
      }

      console.log('Downloaded blob size:', blob.size, 'bytes');

      if (blob.size === 0) {
        console.warn('Downloaded file is empty, using mock data');
        setChromatogramData('mock');
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('File data loaded for component:', componentId, 'size:', uint8Array.length);

      if (uint8Array.length > 0) {
        // FINAL CHECK: Ensure we're still the same component before setting data
        const preSetComponentId = `${cloneData.type}-${cloneData.id}`;
        if (preSetComponentId === componentId) {
          setChromatogramData(uint8Array);
          console.log('Successfully set chromatogram data for component:', componentId);
        } else {
          console.log('Component changed before setting data, aborting');
        }
      } else {
        setChromatogramData('mock');
      }
    } catch (error) {
      console.error('Error loading chromatogram data for component:', componentId, error);
      setChromatogramData('mock');
    } finally {
      // Only update loading state if we're still the same component
      const endComponentId = `${cloneData.type}-${cloneData.id}`;
      if (endComponentId === componentId) {
        setLoadingChromatogram(false);
      }
    }
  };


  const handleAnswerChange = (questionId, answer) => {
    // Prevent changes if read-only
    if (isReadOnlyStatus()) {
      return;
    }

    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
    setHasUnsavedChanges(true);

    // Notify parent component about unsaved changes
    if (onUnsavedChangesUpdate) {
      onUnsavedChangesUpdate(true);
    }
  };

  const saveProgress = async () => {
    setSaving(true);
    setSaveStatus('saving');

    try {
      const progress = getOverallProgress();
      const requestData = {
        progress,
        answers,
        currentStep,
        reviewComments: reviewComments,
        reviewScore: undefined,
        lastReviewed: undefined
      };

      if (cloneData.type === 'assigned') {
        await apiService.put(`/uploaded-files/${cloneData.id}/progress`, requestData);
      } else if (cloneData.type === 'practice') {
        await apiService.put(`/practice-clones/${cloneData.id}/progress/${currentUser.id}`, requestData);
      } else {
        console.error('Unknown clone type for saving:', cloneData.type);
        setSaving(false);
        setSaveStatus('error');
        return;
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      onProgressUpdate && onProgressUpdate(progress);

      if (onUnsavedChangesUpdate) {
        onUnsavedChangesUpdate(false);
      }

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving progress:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  const getOverallProgress = () => {
    const sections = ['clone-editing', 'blast', 'analysis-submission', 'review'];
    let totalProgress = 0;

    sections.forEach(sectionId => {
      const sectionProgress = getStepProgress(sectionId);
      totalProgress += (sectionProgress * 0.25); // Each section contributes 25%
    });

    return Math.round(totalProgress);
  };

  const getStepProgress = (stepId) => {
    // Only count rendered questions (using shouldShowQuestion filter)
    const stepQuestions = analysisQuestions
      .filter(q => q.step === stepId)
      .filter(q => shouldShowQuestion(q));

    if (stepQuestions.length === 0) return 0;

    const answeredQuestions = stepQuestions.filter(q =>
      answers[q.id] !== undefined && answers[q.id] !== ''
    );

    return Math.round((answeredQuestions.length / stepQuestions.length) * 100);
  };

  const shouldShowQuestion = (question) => {
    if (!question.conditionalLogic) return true;

    const { showIf } = question.conditionalLogic;
    const dependentAnswer = answers[showIf.questionId];

    return dependentAnswer === showIf.answer;
  };

  const getCurrentStepQuestions = () => {
    return analysisQuestions
      .filter(q => q.step === currentStep)
      .sort((a, b) => a.order - b.order)
      .filter(q => shouldShowQuestion(q));
  };

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved!';
      case 'error': return 'Error';
      default: return hasUnsavedChanges ? 'Save Progress' : 'All Saved';
    }
  };

  const getSaveButtonClass = () => {
    const baseClass = "px-3 py-1 text-white text-sm rounded transition duration-200 flex items-center space-x-1";

    switch (saveStatus) {
      case 'saved': return "bg-green-500 hover:bg-green-600 " + baseClass;
      case 'error': return "bg-red-600 hover:bg-red-700 " + baseClass;
      default:
        if (hasUnsavedChanges) {
          return "bg-green-600 hover:bg-green-700 " + baseClass;
        } else {
          return "bg-gray-400 cursor-not-allowed " + baseClass;
        }
    }
  };

  // Helper function to count unsaved changes
  const getUnsavedChangesCount = () => {
    return Object.keys(answers).filter(key => answers[key] !== undefined && answers[key] !== '').length;
  };

  // Handle chromatogram toggle - load data when first opened
  const handleChromatogramToggle = async () => {
    if (showChromatogram) {
      // Closing chromatogram viewer
      setShowChromatogram(false);
    } else {
      // Opening chromatogram viewer
      console.log('=== OPENING CHROMATOGRAM VIEWER ===');
      console.log('Clone:', cloneData.cloneName, 'Type:', cloneData.type, 'ID:', cloneData.id);

      setShowChromatogram(true);

      // Only load data if we don't have it yet
      if (!chromatogramData && !loadingChromatogram) {
        await loadChromatogramData();
      }
    }
  };


  const renderQuestion = (question) => {
    const answer = answers[question.id] || '';
    const disabled = isReadOnlyStatus();
    const questionComments = getQuestionComments(question.id);
    const isCorrect = isQuestionCorrect(question.id);

    console.log('=== RENDER QUESTION DEBUG ===');
    console.log('Question ID:', question.id, 'Type:', typeof question.id);
    console.log('Question text:', question.text);
    console.log('Found comments for this question:', questionComments.length);
    console.log('Is question marked correct:', isCorrect);
    console.log('reviewComments state length:', reviewComments.length);

    return (
      <div>
        {/* Original question rendering */}
        <div className="mb-3">
          {/* Your existing input rendering code stays exactly the same */}
          {question.type === 'yes_no' && (
            <div className="space-y-2">
              {['yes', 'no'].map(option => (
                <label key={option} className={`flex items-center space-x-2 ${disabled ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answer === option}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    disabled={disabled}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 capitalize">{option}</span>
                </label>
              ))}
            </div>
          )}

          {question.type === 'select' && (
            <div className="space-y-2">
              {question.options && question.options.map(option => (
                <label key={option} className={`flex items-center space-x-2 ${disabled ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answer === option}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    disabled={disabled}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          )}



          {question.type === 'text' && (
            <input
              type="text"
              value={answer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder={disabled ? "Read-only" : "Enter your answer..."}
            />
          )}

          {question.type === 'textarea' && (
            <textarea
              value={answer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              disabled={disabled}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder={disabled ? "Read-only" : "Enter your detailed answer..."}
            />
          )}

          {question.type === 'number' && (
            <input
              type="number"
              value={answer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder={disabled ? "Read-only" : "Enter a number..."}
            />
          )}

          {question.type === 'blast' && (
            <div className="space-y-3">
              {question.options?.blastTitle && (
                <h6 className="text-sm font-medium text-gray-900">{question.options.blastTitle}</h6>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Accession
                      </th>
                      <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Definition
                      </th>
                      <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Organism
                      </th>
                      <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Start
                      </th>
                      <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        End
                      </th>
                      <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        E-value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: question.options?.blastResultsCount || 5 }, (_, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-b border-gray-200">
                          <input
                            type="text"
                            value={answer[`accession_${index}`] || ''}
                            onChange={(e) => {
                              const newAnswer = { ...answer };
                              newAnswer[`accession_${index}`] = e.target.value;
                              handleAnswerChange(question.id, newAnswer);
                            }}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={disabled ? "Read-only" : "Accession"}
                          />
                        </td>
                        <td className="px-3 py-2 border-b border-gray-200">
                          <input
                            type="text"
                            value={answer[`definition_${index}`] || ''}
                            onChange={(e) => {
                              const newAnswer = { ...answer };
                              newAnswer[`definition_${index}`] = e.target.value;
                              handleAnswerChange(question.id, newAnswer);
                            }}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={disabled ? "Read-only" : "Definition"}
                          />
                        </td>
                        <td className="px-3 py-2 border-b border-gray-200">
                          <input
                            type="text"
                            value={answer[`organism_${index}`] || ''}
                            onChange={(e) => {
                              const newAnswer = { ...answer };
                              newAnswer[`organism_${index}`] = e.target.value;
                              handleAnswerChange(question.id, newAnswer);
                            }}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={disabled ? "Read-only" : "Organism"}
                          />
                        </td>
                        <td className="px-3 py-2 border-b border-gray-200">
                          <input
                            type="text"
                            value={answer[`start_${index}`] || ''}
                            onChange={(e) => {
                              const newAnswer = { ...answer };
                              newAnswer[`start_${index}`] = e.target.value;
                              handleAnswerChange(question.id, newAnswer);
                            }}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={disabled ? "Read-only" : "Start"}
                          />
                        </td>
                        <td className="px-3 py-2 border-b border-gray-200">
                          <input
                            type="text"
                            value={answer[`end_${index}`] || ''}
                            onChange={(e) => {
                              const newAnswer = { ...answer };
                              newAnswer[`end_${index}`] = e.target.value;
                              handleAnswerChange(question.id, newAnswer);
                            }}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={disabled ? "Read-only" : "End"}
                          />
                        </td>
                        <td className="px-3 py-2 border-b border-gray-200">
                          <input
                            type="text"
                            value={answer[`evalue_${index}`] || ''}
                            onChange={(e) => {
                              const newAnswer = { ...answer };
                              newAnswer[`evalue_${index}`] = e.target.value;
                              handleAnswerChange(question.id, newAnswer);
                            }}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={disabled ? "Read-only" : "E-value"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!['yes_no', 'select', 'text', 'textarea', 'number', 'blast'].includes(question.type) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">
                Unknown question type: "{question.type}". Please contact your instructor.
              </p>
            </div>
          )}
        </div>

        {/* Display instructor feedback for this question */}
        {questionComments.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <h6 className="text-sm font-medium text-blue-900">Instructor Feedback:</h6>
            </div>
            {questionComments.map((comment, index) => (
              <div
                key={index}
                className={`p-3 border rounded-lg ${comment.comment === 'Correct!'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-blue-50 border-blue-200'
                  }`}
              >
                <div className="flex items-start space-x-2">
                  {comment.comment === 'Correct!' ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${comment.comment === 'Correct!' ? 'text-green-800' : 'text-blue-800'
                      }`}>
                      {comment.comment}
                    </p>
                    {comment.timestamp && (
                      <p className={`text-xs mt-1 ${comment.comment === 'Correct!' ? 'text-green-600' : 'text-blue-600'
                        }`}>
                        {new Date(comment.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!cloneData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 text-center">
          <p className="text-red-600">Error: Clone data not found</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 text-center">
          <p className="text-gray-600">Loading analysis interface...</p>
        </div>
      </div>
    );
  }

  const currentStepQuestions = getCurrentStepQuestions();

  // Fixed return statement structure - replace your current return statement with this:

  // Replace your current return statement with this updated version:

  return (
    <div className="flex items-start space-x-4">
      {/* Main Interface */}
      <div className="flex-1">
        <div className="bg-white rounded-xl shadow-sm border">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Analyzing {cloneData.cloneName}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    File: {cloneData.filename} • Progress: {getOverallProgress()}%
                    {lastSaved && (
                      <span className="text-green-600 ml-2">
                        • Auto-saved at {lastSaved instanceof Date ? lastSaved.toLocaleTimeString() : 'unknown time'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex">
            {/* Step Navigation Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200">
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Analysis Steps</h4>
                <div className="space-y-2">
                  {steps.map(step => {
                    const progress = getStepProgress(step.id);
                    const isActive = currentStep === step.id;
                    const isCompleted = progress === 100;

                    return (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStep(step.id)}
                        disabled={isReadOnlyStatus()}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${isActive
                          ? 'bg-indigo-100 border-2 border-indigo-500'
                          : 'border-2 border-transparent hover:bg-gray-100'
                          } ${isReadOnlyStatus() ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={`text-sm font-medium ${isActive ? 'text-indigo-900' : 'text-gray-700'}`}>
                              {step.name}
                            </span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                        </div>
                        <p className={`text-xs mt-1 ${isActive ? 'text-indigo-700' : 'text-gray-500'}`}>
                          {step.description}
                        </p>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${progress === 100 ? 'bg-green-600' : 'bg-indigo-600'}`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{progress}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6">
              {/* Review Status Banner */}
              <EnhancedReviewStatusBanner
                status={currentStatus}
                onRefresh={refreshStatus}
                onToggleFeedback={() => setShowFeedbackPanel(!showFeedbackPanel)}
                hasUnreadFeedback={hasUnreadFeedback}
              />

              <FeedbackMessagesPanel
                cloneData={cloneData}
                currentUser={currentUser}
                isVisible={showFeedbackPanel}
                onToggle={() => setShowFeedbackPanel(false)}
              />

              {/* Chromatogram Viewer */}
              {showChromatogram && (
                <div className="mb-6">
                  {loadingChromatogram ? (
                    <div className="bg-white rounded-lg border p-6">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading .ab1 file data...</p>
                        <p className="text-sm text-gray-500 mt-2">
                          {cloneData.type === 'assigned' ? 'Downloading and parsing your sequence file...' : 'Preparing practice sequence data...'}
                        </p>
                      </div>
                    </div>
                  ) : chromatogramData ? (
                    <ChromatogramViewer
                      fileData={chromatogramData}
                      fileName={cloneData.filename || cloneData.originalName}
                      fileType={cloneData.type}
                      onClose={() => setShowChromatogram(false)}
                    />
                  ) : (
                    <div className="bg-white rounded-lg border p-6">
                      <div className="text-center">
                        <p className="text-red-600 mb-2">Unable to load chromatogram data</p>
                        <p className="text-sm text-gray-600">
                          The .ab1 file could not be loaded. Please check that the file is accessible.
                        </p>
                        <button
                          onClick={() => {
                            setChromatogramData(null);
                            loadChromatogramData();
                          }}
                          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {steps.find(s => s.id === currentStep)?.name}
                </h4>
                <p className="text-sm text-gray-600">
                  {steps.find(s => s.id === currentStep)?.description}
                </p>

                {/* Read-only notification */}
                {isReadOnlyStatus() && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        <strong>Read-only mode:</strong> Your analysis is under review or completed. You cannot make changes at this time.
                      </span>
                    </div>
                  </div>
                )}

                {/* Helpful tip for chromatogram */}
                {!showChromatogram && canEdit() && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        <strong>Tip:</strong> Click "View Chromatogram" above to load and visualize your {cloneData.type === 'assigned' ? '.ab1' : 'practice'} sequence data while answering questions.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Questions Section */}
              <div className="space-y-6">
                {currentStepQuestions.length > 0 ? (
                  currentStepQuestions.map((question, index) => {
                    const isCorrect = isQuestionCorrect(question.id);

                    return (
                      <div
                        key={question.id}
                        className={`border rounded-lg p-4 ${isReadOnlyStatus() ? 'bg-gray-50' :
                          isCorrect ? 'bg-green-50 border-green-200' :
                            'border-gray-200'
                          }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h5 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                            <span>
                              Question {index + 1}
                              {question.required && <span className="text-red-500 ml-1">*</span>}
                            </span>
                            {helpTopics[question.id] && (
                              <button
                                onClick={() => onOpenHelp && onOpenHelp(helpTopics[question.id].id, question.text)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Get help with this question"
                              >
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            )}
                            {isCorrect && (
                              <CheckCircle className="w-4 h-4 text-green-600" title="Marked correct by instructor" />
                            )}
                          </h5>
                          <span className={`text-xs px-2 py-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-800' :
                            answers[question.id] ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                            {isCorrect ? 'Correct' :
                              answers[question.id] ? 'Answered' :
                                'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{question.text}</p>
                        {renderQuestion(question)}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h5 className="text-lg font-medium text-gray-900 mb-2">No Questions Yet</h5>
                    <p className="text-gray-600">
                      No questions have been set up for this step. Contact your instructor if this seems incorrect.
                    </p>
                  </div>
                )}
              </div>

              {/* Step Navigation */}
              {canEdit() && (
                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => {
                      const currentIndex = steps.findIndex(s => s.id === currentStep);
                      if (currentIndex > 0) {
                        setCurrentStep(steps[currentIndex - 1].id);
                      }
                    }}
                    disabled={steps.findIndex(s => s.id === currentStep) === 0}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous Step
                  </button>

                  <button
                    onClick={() => {
                      const currentIndex = steps.findIndex(s => s.id === currentStep);
                      if (currentIndex < steps.length - 1) {
                        setCurrentStep(steps[currentIndex + 1].id);
                      }
                    }}
                    disabled={steps.findIndex(s => s.id === currentStep) === steps.length - 1}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Step
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* UPDATED: Sticky Floating Action Menu */}
      <div className="sticky top-6 z-40 flex flex-col space-y-2 self-start">
        <div className="flex flex-col space-y-2">
          {/* Floating toolbar indicator - shows when content is scrolled */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-full text-center mb-2 whitespace-nowrap">
              Quick Actions
            </div>
          </div>

          {/* Analysis Tools Section */}
          <div className="flex flex-col space-y-1">
            {/* Chromatogram Button */}
            <div className="group relative">
              <button
                onClick={handleChromatogramToggle}
                disabled={loadingChromatogram}
                className="p-3 bg-blue-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingChromatogram ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <BarChart3 className="w-5 h-5" />
                )}
              </button>
              <div className="absolute left-14 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  {showChromatogram ? 'Hide Chromatogram' : 'View Chromatogram'}
                  <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-0 h-0 border-r-4 border-r-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
              </div>
            </div>

            {/* ORF Translator Button */}
            <div className="group relative">
              <button
                onClick={() => setShowORFTranslator(true)}
                className="p-3 bg-purple-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110"
              >
                <Dna className="w-5 h-5" />
              </button>
              <div className="absolute left-14 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  Translate ORFs
                  <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-0 h-0 border-r-4 border-r-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Actions - Only when editing */}
          {canEdit() && (
            <div className="flex flex-col space-y-1 pt-2">
              {/* Save Button */}
              <div className="group relative">
                <button
                  onClick={saveProgress}
                  disabled={saving || !hasUnsavedChanges}
                  className={`p-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 ${hasUnsavedChanges
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <Save className="w-5 h-5" />
                </button>
                <div className="absolute left-14 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                  <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                    {getSaveButtonText()}
                    <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-0 h-0 border-r-4 border-r-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="group relative">
                <button
                  onClick={handleSubmitForReview}
                  disabled={saving}
                  className="p-3 bg-purple-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <div className="absolute left-14 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                  <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                    Submit for Review
                    <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-0 h-0 border-r-4 border-r-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Support Actions */}
          <div className="flex flex-col space-y-1 pt-2">
            {/* Help Button */}
            <div className="group relative">
              <button
                onClick={() => setShowMessageModal(true)}
                className="p-3 bg-green-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <div className="absolute left-14 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  Need Help?
                  <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-0 h-0 border-r-4 border-r-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="group relative">
              <button
                onClick={() => {
                  if (hasUnsavedChanges && canEdit()) {
                    setShowWarning(true);
                  } else {
                    onClose();
                  }
                }}
                className="p-3 bg-red-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute left-14 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  Close Analysis
                  <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-0 h-0 border-r-4 border-r-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* All your modals go here - after the main content */}
      <EnhancedCloseModal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onSaveAndClose={async () => {
          setShowWarning(false);
          await saveProgress();
          onClose();
        }}
        onCloseAnyway={() => {
          setShowWarning(false);
          onClose();
        }}
        cloneName={cloneData?.cloneName}
        unsavedChanges={getUnsavedChangesCount()}
        isAutoSaving={saving}
      />

      <MessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        currentUser={currentUser}
        cloneData={cloneData}
        currentProgress={getOverallProgress()}
        currentStep={currentStep}
        onNavigateToMessages={handleNavigateToMessages}
      />

      <SubmitConfirmationModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={submitForReview}
        cloneName={cloneData?.cloneName}
        progress={getOverallProgress()}
        isSubmitting={saving}
      />

      <ORFTranslator
        isOpen={showORFTranslator}
        onClose={() => setShowORFTranslator(false)}
        initialSequence=""
      />
    </div>
  );
};


export default DNAAnalysisInterface;