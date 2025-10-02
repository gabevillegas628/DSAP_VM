import React, { useState, useEffect } from 'react';
import { FileText, ChevronDown, CheckCircle, AlertCircle, Save, Eye, AlertTriangle, X, BarChart3, MessageCircle, Clock, RefreshCw, User, Dna, HelpCircle } from 'lucide-react';
import MessageModal from './MessageModal';
import ChromatogramViewer from './ChromatogramViewer';
import ORFTranslator from './ORFTranslator';
import apiService from '../services/apiService';
import {
  CLONE_STATUSES,
  getStatusConfig,
  canStudentEdit,
  isReadOnly,
  validateAndWarnStatus
} from '../statusConstraints.js';



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
  const [messageModalPrepopulatedContent, setMessageModalPrepopulatedContent] = useState('');
  const [messageModalPrepopulatedSubject, setMessageModalPrepopulatedSubject] = useState('');
  const [stepHelp, setStepHelp] = useState({});
  const [currentGroup, setCurrentGroup] = useState(null);
  //const [helpTopics, setHelpTopics] = useState({});
  const [masterHelpTopics, setMasterHelpTopics] = useState({});
  const [selectedText, setSelectedText] = useState('');
  const [highlightPositions, setHighlightPositions] = useState([]);
  const [currentSequenceQuestionId, setCurrentSequenceQuestionId] = useState(null);



  const steps = [
    { id: 'clone-editing', name: 'Clone Editing', description: 'Quality check and sequence preparation' },
    { id: 'blast', name: 'BLAST Analysis', description: 'Database search and identification' },
    { id: 'analysis-submission', name: 'Analysis & Submission', description: 'Final analysis and results' },
    { id: 'review', name: 'Review', description: 'Instructor feedback and corrections' }
  ];

  // Fetch master step help on mount
  useEffect(() => {
    const fetchMasterStepHelp = async () => {
      try {
        const masterStepHelpData = await apiService.get('/master-step-helps');
        const stepHelpMap = {};
        masterStepHelpData.forEach(master => {
          stepHelpMap[master.step] = master;
        });
        setStepHelp(stepHelpMap);
      } catch (error) {
        console.error('Error fetching master step help:', error);
      }
    };

    fetchMasterStepHelp();
  }, []);

  useEffect(() => {
    fetchAnalysisQuestions();

    if (cloneData) {
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
    setChromatogramData(null);
    setShowChromatogram(false);
    setLoadingChromatogram(false);
  }, [cloneData.id, cloneData.type]); // Dependency on both ID and type



  // Fetch master help topics when questions load
  useEffect(() => {
    const fetchMasterHelpTopics = async () => {
      try {
        const masterTopics = await apiService.get('/master-help-topics');
        const topicMap = {};
        masterTopics.forEach(master => {
          topicMap[master.analysisQuestionId] = master;
        });
        setMasterHelpTopics(topicMap);
      } catch (error) {
        console.error('Error fetching master help topics:', error);
      }
    };

    if (analysisQuestions.length > 0) {
      fetchMasterHelpTopics();
    }
  }, [analysisQuestions]);

  // Initialize sequence_range answers when questions load
  useEffect(() => {
    if (analysisQuestions.length > 0) {
      setAnswers(prev => {
        const updatedAnswers = { ...prev };
        let hasChanges = false;

        analysisQuestions.forEach(question => {
          if (question.type === 'sequence_range' && !updatedAnswers[question.id]) {
            updatedAnswers[question.id] = { value1: '', value2: '' };
            hasChanges = true;
          }
        });

        return hasChanges ? updatedAnswers : prev;
      });
    }
  }, [analysisQuestions]);



  const openStepHelp = (step) => {
    const masterStepHelp = stepHelp[step];
    if (masterStepHelp && onOpenHelp) {
      onOpenHelp(null, step, true); // Pass step name and true for isStepHelp
    }
  };

  // Handler for replying to director comments
  // Handler for replying to director comments - UPDATED for CloneDiscussion
  const handleReplyToComment = async (comment) => {
    // Use comment.feedback instead of comment.comment
    const replyText = `Replying to instructor feedback: ${comment.feedback}`;

    try {
      // Check if a clone discussion already exists using new API
      const discussion = await apiService.get(`/clone-discussions/${currentUser.id}/${cloneData.id}`);

      if (discussion && discussion.messages && discussion.messages.length > 0) {
        // Case 1: Clone discussion exists - navigate to messages and pre-populate reply

        // Navigate to messages tab with the clone selected and pre-populate reply
        if (onNavigateToMessages) {
          onNavigateToMessages(cloneData.id, replyText); // Pass the reply text
        }
      } else {
        // Case 2: No discussion exists - open MessageModal with pre-populated content
        setMessageModalPrepopulatedContent(replyText);
        setMessageModalPrepopulatedSubject('Help with question feedback');
        setShowMessageModal(true);
      }
    } catch (error) {
      console.error('Error checking for existing discussion:', error);
      // Fallback to MessageModal if check fails
      setMessageModalPrepopulatedContent(replyText);
      setMessageModalPrepopulatedSubject('Help with question feedback');
      setShowMessageModal(true);
    }
  };

  const handleSubmitForReview = async () => {
    // First, check if there are unsaved changes and save them
    if (hasUnsavedChanges && !saving) {
      //console.log('Saving unsaved changes before submit...');
      try {
        // Call the existing saveProgress function and wait for it to complete
        await saveProgress();
        //console.log('Changes saved successfully, proceeding with submit...');
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
    //console.log('Navigating to messages for clone:', cloneData?.id);



    // Navigate to messages tab and optionally select the clone
    if (onNavigateToMessages) {
      onNavigateToMessages(cloneData?.id);
    }
  };

  const getQuestionComments = (questionId) => {
    /*
    console.log('=== GET QUESTION COMMENTS DEBUG ===');
    console.log('Looking for comments for questionId:', questionId, 'Type:', typeof questionId);
    console.log('All reviewComments:', reviewComments);
    */

    // Filter to only return visible feedback
    const comments = reviewComments.filter(comment => {
      /*
      console.log('Checking comment:', comment);
      console.log('Comment questionId:', comment.questionId, 'Type:', typeof comment.questionId);
      console.log('Match?', comment.questionId === questionId);
      console.log('Feedback visible?', comment.feedbackVisible);
      */

      // Only return comments for this question that are marked as visible
      return comment.questionId === questionId && comment.feedbackVisible === true;
    });

    console.log('Found visible comments for question:', comments);
    return comments;
  };

  const isQuestionCorrect = (questionId) => {
    const comment = reviewComments.find(c => c.questionId === questionId);
    return comment?.isCorrect === true;
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
        //console.log('Skipping loadProgress due to unsaved changes');
        return;
      }
      /*
      console.log('=== LOAD PROGRESS DEBUG ===');
      console.log('Loading progress for clone:', cloneData.cloneName, 'Type:', cloneData.type);
      console.log('Initial currentStatus state:', currentStatus);
      console.log('cloneData.status:', cloneData.status);
      */

      let progressData;
      if (cloneData.type === 'assigned') {
        progressData = await apiService.get(`/uploaded-files/${cloneData.id}/progress`);
      } else if (cloneData.type === 'practice') {
        progressData = await apiService.get(`/practice-clones/${cloneData.id}/progress/${currentUser.id}`);
      } else {
        console.error('Unknown clone type:', cloneData.type);
        return;
      }

      // Handle analysisData field (for assigned files) or direct fields (for practice)
      let fullAnalysisData = {};
      if (cloneData.type === 'assigned') {
        // ALWAYS set status for assigned clones, regardless of analysisData
        if (progressData.status) {
          setCurrentStatus(progressData.status);
        }

        // Parse analysisData if it exists
        if (progressData.analysisData) {
          try {
            fullAnalysisData = JSON.parse(progressData.analysisData);
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
        }
      }

      // Set review comments
      if (fullAnalysisData.reviewComments) {
        setReviewComments(fullAnalysisData.reviewComments);
      }

      // Set answers and other progress data
      if (fullAnalysisData.answers && Object.keys(fullAnalysisData.answers).length > 0) {
        // Initialize sequence_range questions that don't have answers yet
        const initializedAnswers = { ...fullAnalysisData.answers };
        analysisQuestions.forEach(question => {
          if (question.type === 'sequence_range' && !initializedAnswers[question.id]) {
            initializedAnswers[question.id] = { value1: '', value2: '' };
          }
        });

        setAnswers(initializedAnswers);
        setHasUnsavedChanges(false);
        if (onUnsavedChangesUpdate) {
          onUnsavedChangesUpdate(false);
        }
      } else {
        // Initialize empty answers with proper structure for sequence_range questions
        const emptyAnswers = {};
        analysisQuestions.forEach(question => {
          if (question.type === 'sequence_range') {
            emptyAnswers[question.id] = { value1: '', value2: '' };
          }
        });

        setAnswers(emptyAnswers);
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

  // Determine if a question is answered to display correct badge
  const isQuestionAnswered = (question) => {
    const answer = answers[question.id];

    if (question.type === 'sequence_range') {
      return answer && (answer.value1 || answer.value2);
    }

    return answer !== undefined && answer !== '';
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
      /*
      console.log('=== CHROMATOGRAM LOADING (MULTI-TAB SAFE) ===');
      console.log('Component ID:', componentId);
      console.log('cloneData:', cloneData);
      */

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
          //console.log('Successfully set chromatogram data for component:', componentId);
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

      // Log clone activity after successful save
      try {
        await apiService.post('/clone-activity-log', {
          cloneName: cloneData.cloneName,
          cloneType: cloneData.type === 'practice' ? 'practice' : 'research',
          cloneId: cloneData.id,
          action: 'stop',
          currentStep: currentStep,
          progress: progress
        });
        //console.log('Clone activity logged successfully');
      } catch (activityError) {
        console.error('Failed to log clone activity (non-critical):', activityError);
        // Don't fail the save if activity logging fails
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
    // Define which types don't require answers
    const nonQuestionTypes = ['text_header', 'section_divider', 'info_text', 'blast_comparison', 'sequence_display'];

    // Only count actual questions (excluding display-only types)
    const stepQuestions = analysisQuestions
      .filter(q => q.step === stepId)
      .filter(q => shouldShowQuestion(q))
      .filter(q => !nonQuestionTypes.includes(q.type));

    if (stepQuestions.length === 0) return 0;

    const answeredQuestions = stepQuestions.filter(q => {
      const answer = answers[q.id];

      // Handle sequence_range questions (object with value1 and value2)
      if (q.type === 'sequence_range') {
        return answer && (answer.value1 || answer.value2); // Consider answered if either field has content
      }

      // Handle all other question types
      return answer !== undefined && answer !== '';
    });

    return Math.round((answeredQuestions.length / stepQuestions.length) * 100);
  };

  const shouldShowQuestion = (question) => {
    if (!question.conditionalLogic) return true;

    const { showIf } = question.conditionalLogic;
    const dependentAnswer = answers[showIf.questionId];

    return dependentAnswer === showIf.answer;
  };

  const getCurrentStepQuestions = () => {
    let stepQuestions = analysisQuestions
      .filter(q => q.step === currentStep)
      .filter(q => shouldShowQuestion(q));

    // If a specific group is selected, filter to only that group
    if (currentGroup) {
      stepQuestions = stepQuestions.filter(q =>
        (q.questionGroup || 'General') === currentGroup
      );
    }

    return stepQuestions.sort((a, b) => {
      if (a.groupOrder !== b.groupOrder) {
        return a.groupOrder - b.groupOrder;
      }
      return a.order - b.order;
    });
  };

  const getGroupedStepQuestions = () => {
    const stepQuestions = getCurrentStepQuestions();

    // Group questions by questionGroup
    const grouped = stepQuestions.reduce((groups, question) => {
      const groupName = question.questionGroup || 'General';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(question);
      return groups;
    }, {});

    // Sort groups by the minimum groupOrder of questions in each group
    const sortedGroups = Object.entries(grouped).sort(([, questionsA], [, questionsB]) => {
      const minOrderA = Math.min(...questionsA.map(q => q.groupOrder || 0));
      const minOrderB = Math.min(...questionsB.map(q => q.groupOrder || 0));
      return minOrderA - minOrderB;
    });

    return sortedGroups;
  };

  const getGroupsForStep = (stepId) => {
    const stepQuestions = analysisQuestions
      .filter(q => q.step === stepId)
      .filter(q => shouldShowQuestion(q));

    const grouped = stepQuestions.reduce((groups, question) => {
      const groupName = question.questionGroup || 'General';
      if (!groups[groupName]) {
        groups[groupName] = {
          name: groupName,
          questions: [],
          groupOrder: question.groupOrder || 0
        };
      }
      groups[groupName].questions.push(question);
      return groups;
    }, {});

    // Sort groups by groupOrder
    return Object.values(grouped).sort((a, b) => a.groupOrder - b.groupOrder);
  };

  // Function to handle step navigation (reset group when changing steps)
  const handleStepChange = (stepId) => {
    setCurrentStep(stepId);

    // Set to the first group in the new step (if groups exist)
    const stepGroups = getGroupsForStep(stepId);
    if (stepGroups.length > 0) {
      setCurrentGroup(stepGroups[0].name);
    } else {
      setCurrentGroup(null); // No groups, show all
    }
  };

  // Function to handle group navigation
  const handleGroupChange = (groupName) => {
    setCurrentGroup(currentGroup === groupName ? null : groupName); // Toggle group selection
  };

  // Get all groups across all steps in sequential order
  const getAllGroupsInOrder = () => {
    const allGroups = [];
    steps.forEach(step => {
      const stepGroups = getGroupsForStep(step.id);
      if (stepGroups.length > 0) {
        stepGroups.forEach(group => {
          allGroups.push({
            stepId: step.id,
            groupName: group.name
          });
        });
      } else {
        // If no groups in step, add a placeholder for the step itself
        allGroups.push({
          stepId: step.id,
          groupName: null // Represents "show all" for this step
        });
      }
    });
    return allGroups;
  };

  // Find current position in the group sequence
  const getCurrentGroupIndex = () => {
    const allGroups = getAllGroupsInOrder();
    return allGroups.findIndex(g =>
      g.stepId === currentStep && g.groupName === currentGroup
    );
  };

  // Navigate to next or previous group
  const navigateToGroup = (direction) => {
    const allGroups = getAllGroupsInOrder();
    const currentIndex = getCurrentGroupIndex();

    if (currentIndex === -1) return; // Current position not found

    let newIndex;
    if (direction === 'next') {
      newIndex = Math.min(currentIndex + 1, allGroups.length - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, 0);
    }

    if (newIndex === currentIndex) return; // Already at boundary

    const targetGroup = allGroups[newIndex];

    // Change step if needed
    if (targetGroup.stepId !== currentStep) {
      setCurrentStep(targetGroup.stepId);
    }

    // Set the group
    setCurrentGroup(targetGroup.groupName);
  };

  // Get progress for a specific group
  const getGroupProgress = (stepId, groupName) => {
    const nonQuestionTypes = ['text_header', 'section_divider', 'info_text', 'blast_comparison', 'sequence_display'];

    const groupQuestions = analysisQuestions
      .filter(q => q.step === stepId)
      .filter(q => (q.questionGroup || 'General') === groupName)
      .filter(q => shouldShowQuestion(q))
      .filter(q => !nonQuestionTypes.includes(q.type));

    if (groupQuestions.length === 0) return 100;

    const answeredQuestions = groupQuestions.filter(q => {
      const answer = answers[q.id];

      // Handle sequence_range questions (object with value1 and value2)
      if (q.type === 'sequence_range') {
        return answer && (answer.value1 || answer.value2); // Consider answered if either field has content
      }

      // Handle all other question types
      return answer !== undefined && answer !== '';
    });

    return Math.round((answeredQuestions.length / groupQuestions.length) * 100);
  };

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved!';
      case 'error': return 'Error';
      default: return hasUnsavedChanges ? 'Save Progress' : 'All Saved';
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

      setShowChromatogram(true);

      // Only load data if we don't have it yet
      if (!chromatogramData && !loadingChromatogram) {
        await loadChromatogramData();
      }
    }
  };



  const renderQuestion = (question) => {
    const answer = answers[question.id] || (question.type === 'sequence_range' ? { value1: '', value2: '' } : '');
    const disabled = isReadOnlyStatus();
    const questionComments = getQuestionComments(question.id);
    const isCorrect = isQuestionCorrect(question.id);

    /*
    console.log('=== RENDER QUESTION DEBUG ===');
    console.log('Question ID:', question.id, 'Type:', typeof question.id);
    console.log('Question text:', question.text);
    console.log('Found comments for this question:', questionComments.length);
    console.log('Is question marked correct:', isCorrect);
    console.log('reviewComments state length:', reviewComments.length);
    */


    // Render special types first
    if (question.type === 'blast_comparison') {
      return renderBlastComparison(question);
    }

    // Add this after the blast_comparison check
    if (question.type === 'sequence_display') {
      return renderSequenceDisplay(question);
    }

    if (question.type === 'text_header') {
      return (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {question.text}
          </h3>
        </div>
      );
    }

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

          {(question.type === 'dna_sequence' || question.type === 'protein_sequence') && (
            <textarea
              value={answer}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              disabled={disabled}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
              placeholder={disabled ? "Read-only" : `Enter your ${question.type === 'dna_sequence' ? 'DNA' : 'protein'} sequence...`}
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

          {question.type === 'sequence_range' && (
            <div className="space-y-3">
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {question.options?.label1 || 'Begin'}
                  </label>
                  <input
                    type="text"
                    value={answer?.value1 || ''}
                    onChange={(e) => {
                      const newAnswer = {
                        ...answer,
                        value1: e.target.value
                      };
                      handleAnswerChange(question.id, newAnswer);
                    }}
                    disabled={disabled}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder={disabled ? "Read-only" : ""}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {question.options?.label2 || 'End'}
                  </label>
                  <input
                    type="text"
                    value={answer?.value2 || ''}
                    onChange={(e) => {
                      const newAnswer = {
                        ...answer,
                        value2: e.target.value
                      };
                      handleAnswerChange(question.id, newAnswer);
                    }}
                    disabled={disabled}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder={disabled ? "Read-only" : ""}
                  />
                </div>
              </div>
            </div>
          )}
          {!['yes_no', 'select', 'text', 'textarea', 'dna_sequence', 'protein_sequence', 'number', 'blast', 'sequence_range', 'sequence_display'].includes(question.type) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">
                Unknown question type: "{question.type}". Please contact your instructor.
              </p>
            </div>
          )}
        </div>

        {/* Display instructor feedback for this question - ONLY VISIBLE FEEDBACK */}
        {questionComments.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <h6 className="text-sm font-medium text-blue-900">Instructor Feedback:</h6>
            </div>
            {questionComments.map((comment, index) => (
              <div
                key={index}
                className={`p-3 border rounded-lg ${comment.isCorrect === true
                  ? 'bg-green-50 border-green-200'
                  : comment.isCorrect === false
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                  }`}
              >
                <div className="flex items-start space-x-2">
                  {comment.isCorrect === true ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : comment.isCorrect === false ? (
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    {/* Status label */}
                    <div className="mb-1">
                      <span className={`text-xs font-medium ${comment.isCorrect === true ? 'text-green-800' :
                        comment.isCorrect === false ? 'text-red-800' :
                          'text-blue-800'
                        }`}>
                        {comment.isCorrect === true ? '✓ Correct' :
                          comment.isCorrect === false ? '✗ Needs Improvement' :
                            'ℹ Instructor Feedback'}
                      </span>
                    </div>

                    {/* Display feedback text if it exists and is not empty */}
                    {comment.feedback && comment.feedback.trim() !== '' && (
                      <p className={`text-sm ${comment.isCorrect === true ? 'text-green-800' :
                        comment.isCorrect === false ? 'text-red-800' :
                          'text-blue-800'
                        }`}>
                        {comment.feedback}
                      </p>
                    )}

                    {/* Timestamp */}
                    {comment.timestamp && (
                      <p className={`text-xs mt-1 ${comment.isCorrect === true ? 'text-green-600' :
                        comment.isCorrect === false ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                        {new Date(comment.timestamp).toLocaleString()}
                      </p>
                    )}

                    {/* Reply button - only show if there's actual feedback text */}
                    {comment.feedback && comment.feedback.trim() !== '' && (
                      <button
                        onClick={() => handleReplyToComment(comment)}
                        className={`text-xs hover:underline mt-2 flex items-center space-x-1 ${comment.isCorrect === true ? 'text-green-600 hover:text-green-800' :
                          comment.isCorrect === false ? 'text-red-600 hover:text-red-800' :
                            'text-blue-600 hover:text-blue-800'
                          }`}
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Reply to Instructor</span>
                      </button>
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

  const renderBlastComparison = (question) => {
    const { blastQuestion1Id, blastQuestion2Id } = question.options || {};

    // Get the answers for both BLAST questions
    let blast1Answer = answers[blastQuestion1Id];
    let blast2Answer = answers[blastQuestion2Id];

    // Find the question titles for headers
    const blast1Question = analysisQuestions.find(q => q.id === blastQuestion1Id);
    const blast2Question = analysisQuestions.find(q => q.id === blastQuestion2Id);

    // Parse BLAST results if they're JSON strings
    let blast1Data = {};
    let blast2Data = {};

    try {
      // BLAST answers might be stored as JSON strings, so parse them
      if (typeof blast1Answer === 'string' && blast1Answer.trim().startsWith('{')) {
        blast1Data = JSON.parse(blast1Answer);
      } else if (typeof blast1Answer === 'object' && blast1Answer) {
        blast1Data = blast1Answer;
      }
    } catch (e) {
      console.error('Error parsing BLAST 1 results:', e);
    }

    try {
      if (typeof blast2Answer === 'string' && blast2Answer.trim().startsWith('{')) {
        blast2Data = JSON.parse(blast2Answer);
      } else if (typeof blast2Answer === 'object' && blast2Answer) {
        blast2Data = blast2Answer;
      }
    } catch (e) {
      console.error('Error parsing BLAST 2 results:', e);
    }

    // Convert the object format to arrays for table display
    const convertBlastDataToArray = (data) => {
      const results = [];
      let index = 0;

      // BLAST data is stored as accession_0, evalue_0, accession_1, evalue_1, etc.
      while (data[`accession_${index}`] !== undefined || data[`evalue_${index}`] !== undefined) {
        results.push({
          accession: data[`accession_${index}`] || 'N/A',
          evalue: data[`evalue_${index}`] || 'N/A'
        });
        index++;
      }

      return results;
    };

    const blast1Results = convertBlastDataToArray(blast1Data);
    const blast2Results = convertBlastDataToArray(blast2Data);


    return (
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h4 className="text-lg font-medium text-blue-900">{question.text}</h4>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Analysis Tool
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* First BLAST Results Table */}
          <div>
            <h5 className="font-medium text-gray-700 mb-3">
              {blast1Question?.options?.blastTitle || blast1Question?.text?.substring(0, 50) || 'BLAST Results 1'}
            </h5>
            {!blast1Answer ? (
              <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                Results will appear here once you complete the previous BLAST question.
              </div>
            ) : blast1Results.length === 0 ? (
              <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                No BLAST results found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Accession #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        E-value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {blast1Results.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {result.accession}
                        </td>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {result.evalue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Second BLAST Results Table */}
          <div>
            <h5 className="font-medium text-gray-700 mb-3">
              {blast2Question?.options?.blastTitle || blast2Question?.text?.substring(0, 50) || 'BLAST Results 2'}
            </h5>
            {!blast2Answer ? (
              <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                Results will appear here once you complete the previous BLAST question.
              </div>
            ) : blast2Results.length === 0 ? (
              <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                No BLAST results found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Accession #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        E-value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {blast2Results.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {result.accession}
                        </td>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {result.evalue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSequenceDisplay = (question) => {
    const { sourceQuestionId } = question.options || {};

    // Get the source sequence from the referenced question
    const sourceAnswer = answers[sourceQuestionId];
    const sourceQuestion = analysisQuestions.find(q => q.id === sourceQuestionId);

    // Clean the sequence (remove whitespace and convert to uppercase)
    const cleanSequence = sourceAnswer ? sourceAnswer.replace(/\s/g, '').toUpperCase() : '';

    // Reset selection when switching to a different sequence question
    if (currentSequenceQuestionId !== question.id) {
      setCurrentSequenceQuestionId(question.id);
      setSelectedText('');
      setHighlightPositions([]);
    }

    const updateSelection = () => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer.parentElement;

        // Make sure selection is within our sequence container
        if (container && container.classList.contains('sequence-display')) {
          const selectedText = selection.toString();

          if (selectedText.length > 0) {
            // Calculate position in the sequence (1-based indexing)
            const startPos = range.startOffset + 1;
            const endPos = range.endOffset;

            setSelectedText(selectedText);

            // Create array of highlighted positions
            const positions = [];
            for (let i = startPos; i <= endPos; i++) {
              positions.push(i);
            }
            setHighlightPositions(positions);
          } else {
            // Clear selection if nothing is selected
            setSelectedText('');
            setHighlightPositions([]);
          }
        }
      } else {
        // Clear selection if no range
        setSelectedText('');
        setHighlightPositions([]);
      }
    };

    // Real-time selection tracking
    const handleMouseDown = () => {
      // Start tracking for real-time updates
      const interval = setInterval(() => {
        updateSelection();
      }, 50); // Update every 50ms for smooth real-time feedback

      // Clean up interval when mouse is released
      const handleMouseUp = () => {
        clearInterval(interval);
        updateSelection(); // Final update
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mouseup', handleMouseUp);
    };

    return (
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h4 className="text-lg font-medium text-blue-900">{question.text}</h4>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Interactive Tool
          </span>
        </div>

        {!sourceAnswer ? (
          <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
            Sequence will appear here once you complete the source question: {sourceQuestion?.text}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sequence Display */}
            <div className="border border-gray-300 rounded-lg p-4 bg-white">
              <div
                className="sequence-display font-mono text-lg leading-relaxed cursor-text select-text"
                onMouseDown={handleMouseDown}
                onMouseUp={updateSelection}
                onKeyUp={updateSelection}
                style={{
                  wordBreak: 'break-all',
                  userSelect: 'text',
                  lineHeight: '1.8'
                }}
              >
                {cleanSequence}
              </div>
            </div>

            {/* Real-time Position Display - Show above sequence */}
            {highlightPositions.length > 0 && currentSequenceQuestionId === question.id && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="font-medium text-blue-900">Positions:</span>
                      <span className="ml-2 bg-blue-100 px-2 py-1 rounded font-mono">
                        {highlightPositions[0]} - {highlightPositions[highlightPositions.length - 1]}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Length:</span>
                      <span className="ml-2 bg-blue-100 px-2 py-1 rounded font-mono">
                        {selectedText.length}
                      </span>
                    </div>
                  </div>
                  <div className="text-blue-700 text-xs">
                    Highlighting {highlightPositions.length} positions
                  </div>
                </div>
              </div>
            )}

            {/* Instruction text */}
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>
                  <strong>Instructions:</strong> Click and drag to select any portion of the sequence.
                  Position numbers update in real-time as you select.
                </span>
              </div>
            </div>

            {/* Sequence Info */}
            <div className="text-sm text-gray-600">
              Total sequence length: {cleanSequence.length} characters
            </div>
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
            {/* Step Navigation Sidebar - UPDATED with group navigation */}
            <div className="w-64 bg-gray-50 border-r border-gray-200">
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Analysis Steps</h4>
                <div className="space-y-2">
                  {steps.map((step, index) => {
                    const isCurrentStep = step.id === currentStep;
                    const isCompleted = getStepProgress(step.id) === 100;
                    const hasStepHelp = stepHelp[step.id];
                    const stepGroups = getGroupsForStep(step.id);
                    const hasGroups = stepGroups.length > 1 || (stepGroups.length === 1 && stepGroups[0].name !== 'General');

                    return (
                      <div key={step.id} className="space-y-1">
                        {/* Main Step Button */}
                        <div
                          onClick={() => handleStepChange(step.id)}
                          className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${isCurrentStep
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isCurrentStep
                                ? 'bg-white text-indigo-600'
                                : isCompleted
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-600'
                                }`}>
                                {isCompleted ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  <span className="text-sm font-medium">{index + 1}</span>
                                )}
                              </div>
                              <div>
                                <h4 className="font-medium">{step.name}</h4>
                                <p className={`text-sm ${isCurrentStep ? 'text-indigo-200' : 'text-gray-500'}`}>
                                  {getStepProgress(step.id)}% complete
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              {hasStepHelp && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStepHelp(step.id);
                                  }}
                                  className={`p-1 rounded ${isCurrentStep ? 'text-white hover:bg-indigo-500' : 'text-gray-400 hover:text-gray-600'}`}
                                  title="Step help"
                                >
                                  <HelpCircle className="w-4 h-4" />
                                </button>
                              )}
                              {hasGroups && isCurrentStep && (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Group Navigation - Show when step is current and has groups */}
                        {isCurrentStep && hasGroups && (
                          <div className="ml-4 space-y-1">
                            {stepGroups.map((group) => {
                              const isCurrentGroup = currentGroup === group.name;
                              const groupProgress = getGroupProgress(step.id, group.name);
                              const isGroupCompleted = groupProgress === 100;

                              return (
                                <div
                                  key={group.name}
                                  onClick={() => handleGroupChange(group.name)}
                                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${isCurrentGroup
                                    ? 'bg-emerald-500 text-white shadow-md'
                                    : 'bg-white text-gray-600 hover:bg-emerald-100 border border-gray-200'
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-3 h-3 rounded-full ${isCurrentGroup
                                        ? 'bg-white'
                                        : isGroupCompleted
                                          ? 'bg-green-500'
                                          : 'bg-gray-300'
                                        }`}></div>
                                      <div>
                                        <p className="text-sm font-medium">{group.name}</p>
                                        <p className={`text-xs ${isCurrentGroup ? 'text-emerald-200' : 'text-gray-500'}`}>
                                          {group.questions.length} question{group.questions.length !== 1 ? 's' : ''} • {groupProgress}%
                                        </p>
                                      </div>
                                    </div>
                                    {isGroupCompleted && (
                                      <CheckCircle className={`w-4 h-4 ${isCurrentGroup ? 'text-white' : 'text-green-600'}`} />
                                    )}
                                  </div>
                                </div>
                              );
                            })}


                            {/* 
                            <div
                              onClick={() => setCurrentGroup(null)}
                              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${currentGroup === null
                                ? 'bg-indigo-500 text-white shadow-md'
                                : 'bg-white text-gray-600 hover:bg-indigo-100 border border-gray-200'
                                }`}
                            >
                              <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${currentGroup === null ? 'bg-white' : 'bg-gray-300'}`}></div>
                                <p className="text-sm font-medium">Show All Groups</p>
                              </div>
                            </div>
                            */}
                          </div>
                        )}
                      </div>
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

              {/* Questions Section - UPDATED to work with group filtering */}
              <div className="space-y-6">
                {(() => {
                  const currentStepQuestions = getCurrentStepQuestions(); // This now respects currentGroup filter

                  if (currentStepQuestions.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h5 className="text-lg font-medium text-gray-900 mb-2">
                          {currentGroup ? `No Questions in "${currentGroup}"` : 'No Questions Yet'}
                        </h5>
                        <p className="text-gray-600">
                          {currentGroup
                            ? `No questions have been set up for the "${currentGroup}" group in this step.`
                            : 'No questions have been set up for this step. Contact your instructor if this seems incorrect.'
                          }
                        </p>
                      </div>
                    );
                  }

                  // If showing a specific group, display questions normally (not grouped)
                  if (currentGroup) {
                    return currentStepQuestions.map((question, index) => {
                      const isCorrect = isQuestionCorrect(question.id);
                      return (
                        <div
                          key={question.id}
                          className={`border-2 border-gray-300 rounded-lg p-4 ${isReadOnlyStatus() ? 'bg-gray-50' :
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
                              {masterHelpTopics[question.id] && (
                                <button
                                  onClick={() => onOpenHelp && onOpenHelp(question.id, question.text)}
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
                              isQuestionAnswered(question) ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                              {isCorrect ? 'Correct' :
                                isQuestionAnswered(question) ? 'Answered' :
                                  'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{question.text}</p>
                          {renderQuestion(question)}
                        </div>
                      );
                    });
                  }

                  // If showing all groups, use the previous grouped display logic
                  const groupedQuestions = getGroupedStepQuestions();

                  // If there's only one group or all questions are ungrouped, display normally
                  if (groupedQuestions.length === 1 && (groupedQuestions[0][0] === 'General' || !groupedQuestions[0][0])) {
                    const questions = groupedQuestions[0][1];
                    return questions.map((question, index) => {
                      const isCorrect = isQuestionCorrect(question.id);
                      return (
                        <div
                          key={question.id}
                          className={`border-2 border-gray-300 rounded-lg p-4 ${isReadOnlyStatus() ? 'bg-gray-50' :
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
                              {masterHelpTopics[question.id] && (
                                <button
                                  onClick={() => onOpenHelp && onOpenHelp(question.id, question.text)}
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
                              isQuestionAnswered(question) ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                              {isCorrect ? 'Correct' :
                                isQuestionAnswered(question) ? 'Answered' :
                                  'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{question.text}</p>
                          {renderQuestion(question)}
                        </div>
                      );
                    });
                  }

                  // Display grouped questions
                  let globalQuestionIndex = 0;
                  return groupedQuestions.map(([groupName, questions]) => (
                    <div key={groupName} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Group Header */}
                      <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3">
                        <h4 className="font-medium text-indigo-900 flex items-center space-x-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                          <span>{groupName}</span>
                          <span className="text-sm text-indigo-700 bg-indigo-200 px-2 py-1 rounded-full">
                            {questions.length} question{questions.length !== 1 ? 's' : ''}
                          </span>
                        </h4>
                      </div>

                      {/* Group Questions */}
                      <div className="p-4 space-y-4 bg-white">
                        {questions.map((question) => {
                          globalQuestionIndex++;
                          const isCorrect = isQuestionCorrect(question.id);

                          return (
                            <div
                              key={question.id}
                              className={`border-2 border-gray-300 rounded-lg p-4 ${isReadOnlyStatus() ? 'bg-gray-50' :
                                isCorrect ? 'bg-green-50 border-green-200' :
                                  'border-gray-200'
                                }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h5 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                                  <span>
                                    Question {globalQuestionIndex}
                                    {question.required && <span className="text-red-500 ml-1">*</span>}
                                  </span>
                                  {masterHelpTopics[question.id] && (
                                    <button
                                      onClick={() => onOpenHelp && onOpenHelp(question.id, question.text)}
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
                                  isQuestionAnswered(question) ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                  {isCorrect ? 'Correct' :
                                    isQuestionAnswered(question) ? 'Answered' :
                                      'Pending'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{question.text}</p>
                              {renderQuestion(question)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Group Navigation */}
              {canEdit() && (
                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => navigateToGroup('previous')}
                    disabled={getCurrentGroupIndex() <= 0}
                    className="px-4 py-2 text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous Step
                  </button>

                  <button
                    onClick={() => navigateToGroup('next')}
                    disabled={getCurrentGroupIndex() >= getAllGroupsInOrder().length - 1}
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
              <div className="absolute right-24 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  {showChromatogram ? 'Hide Chromatogram' : 'View Chromatogram'}
                  <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
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
              <div className="absolute right-24 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  Translate ORFs
                  <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
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
                <div className="absolute right-24 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                  <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                    {getSaveButtonText()}
                    <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
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
                <div className="absolute right-24 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                  <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                    Submit for Review
                    <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
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
              <div className="absolute right-24 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  Need Help?
                  <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
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
              <div className="absolute right-24 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                  Close Analysis
                  <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
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
        onClose={() => {
          setShowMessageModal(false);
          setMessageModalPrepopulatedContent('');
          setMessageModalPrepopulatedSubject('');
        }}
        currentUser={currentUser}
        cloneData={cloneData}
        currentProgress={getOverallProgress()}
        currentStep={currentStep}
        onNavigateToMessages={handleNavigateToMessages}
        initialContent={messageModalPrepopulatedContent}
        initialSubject={messageModalPrepopulatedSubject}
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