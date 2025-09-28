// Refactored StudentDashboard.jsx - Updated to use apiService
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import { useDNAContext } from '../context/DNAContext';
import DNAAnalysisInterface from './DNAAnalysisInterface';
import StudentSoftware from './StudentSoftware';
import StudentSettings from './StudentSettings';
import StudentClones from './StudentClones';
import StudentHelp from './StudentHelp.jsx';
import SimpleStudentChat from './SimpleStudentChat.jsx';
import { CLONE_STATUSES } from '../statusConstraints.js';
import { getDisplayFilename } from '../utils/fileUtils.js';
import apiService from '../services/apiService'; // Updated import

const StudentDashboard = () => {
  const { currentUser, updateCurrentUser } = useDNAContext();
  const [activeTab, setActiveTab] = useState('my-clones');
  const [openAnalysisTabs, setOpenAnalysisTabs] = useState([]);
  const [assignedFiles, setAssignedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadRepliesCount, setUnreadRepliesCount] = useState(0);
  const [openHelpTabs, setOpenHelpTabs] = useState([]); // Track open help tabs
  const [prePopulatedReplyText, setPrePopulatedReplyText] = useState('');



  // Track which tabs have unsaved changes
  const [tabsWithUnsavedChanges, setTabsWithUnsavedChanges] = useState(new Set());

  // State for logout warning
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(null);

  // Practice clones that all students get
  const [practiceClones, setPracticeClones] = useState([]);

  // Add new state for message navigation
  const [selectedCloneForMessages, setSelectedCloneForMessages] = useState(null);

  // In StudentDashboard.jsx, modify the openHelpTab function to handle both types:

  const openHelpTab = (questionId, questionText, isStepHelp = false) => {

    const tabId = `help-${isStepHelp ? questionText : questionId}`; // Use step name for step help

    // Check if tab is already open
    if (!openHelpTabs.find(tab => tab.id === tabId)) {
      const newTab = {
        id: tabId,
        name: isStepHelp ? `Step Help: ${questionText}` : `Help: ${questionText?.substring(0, 30)}...`,
        type: 'help',
        questionId: isStepHelp ? null : questionId,
        stepName: isStepHelp ? questionText : null, // questionText will be the step name for step help
        questionText: isStepHelp ? null : questionText
      };

      setOpenHelpTabs(prev => [...prev, newTab]);
      setActiveTab(tabId);
    } else {
      setActiveTab(tabId);
    }
  };

  // Function to close help tab
  const closeHelpTab = (tabId) => {
    setOpenHelpTabs(prev => prev.filter(tab => tab.id !== tabId));

    // If we're on the tab being closed, switch to 'my-clones'
    if (activeTab === tabId) {
      setActiveTab('my-clones');
    }
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good Afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good Evening';
    } else {
      return 'Good Evening';
    }
  };

  // In StudentDashboard.jsx, update this function:
  const handleNavigateToMessages = (cloneId, replyText = '') => {
    setSelectedCloneForMessages(cloneId);
    setPrePopulatedReplyText(replyText);
    setActiveTab('messages');

    // Clear the selection after a short delay to allow the messages component to process it
    setTimeout(() => {
      setSelectedCloneForMessages(null);
    }, 100);
  };

  // MOVED: Define fetchUnreadRepliesCount BEFORE it's used in useEffect
  // Replace the fetchUnreadRepliesCount function in StudentDashboard.jsx
  const fetchUnreadRepliesCount = useCallback(async () => {
    if (!currentUser) return;

    try {
      //console.log('📄 Student fetching discussion unread count for user:', currentUser.id);

      // Get all discussions for this student
      const discussions = await apiService.get(`/clone-discussions/student/${currentUser.id}`);
      //console.log('📨 Student total discussions:', discussions.length);

      // Sum up unread counts from all discussions
      const totalUnreadCount = discussions.reduce((total, discussion) => {
        return total + (discussion.unreadCount || 0);
      }, 0);

      //console.log('📬 Student total unread messages from discussions:', totalUnreadCount);
      setUnreadRepliesCount(totalUnreadCount);
    } catch (error) {
      console.error('Error fetching student discussion unread count:', error);
      setUnreadRepliesCount(0);
    }
  }, [currentUser]);

  // Function to download files
  const downloadFile = async (clone) => {
    try {
      //console.log('Downloading file for clone:', clone);

      // Use different endpoints based on clone type
      let downloadUrl;
      if (clone.type === 'practice') {
        downloadUrl = `/practice-clones/${clone.id}/download`;
      } else {
        downloadUrl = `/uploaded-files/${clone.id}/download`;
      }

      const blob = await apiService.downloadBlob(downloadUrl);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = getDisplayFilename(clone) || 'download.ab1';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('File download completed');
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  // Function to open analysis tab
  const openAnalysisTab = async (clone) => {
    //console.log('Opening analysis tab for clone:', clone);

    const tabId = `analysis-${clone.id}`;

    // Log the start of clone activity
    try {
      await apiService.post('/clone-activity-log', {
        cloneName: clone.cloneName,
        cloneType: clone.type || 'research', // Determine if practice or research
        cloneId: clone.id,
        action: 'start',
        currentStep: clone.currentStep || 'clone-editing',
        progress: clone.progress || 0
      });
    } catch (error) {
      console.error('Failed to log clone activity start:', error);
      // Don't prevent the analysis from opening if logging fails
    }

    // Check if tab is already open
    if (!openAnalysisTabs.find(tab => tab.id === tabId)) {
      const newTab = {
        id: tabId,
        name: clone.cloneName,
        clone: clone,
        closable: true
      };
      setOpenAnalysisTabs(prev => [...prev, newTab]);
    }

    setActiveTab(tabId);
  };

  // Function to close analysis tab
  const closeAnalysisTab = (tabId) => {
    setOpenAnalysisTabs(prev => prev.filter(tab => tab.id !== tabId));

    // If we're on the tab being closed, switch to 'my-clones'
    if (activeTab === tabId) {
      setActiveTab('my-clones');
    }

    // Remove from unsaved changes tracking
    setTabsWithUnsavedChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(tabId);
      return newSet;
    });
  };

  const fetchPracticeClones = useCallback(async () => {
    try {
      const practiceCloneData = await apiService.get('/practice-clones');

      // Add progress information for each practice clone
      const clonesWithProgress = await Promise.all(
        practiceCloneData.map(async (clone) => {
          let progress = 0;
          let status = CLONE_STATUSES.AVAILABLE; // Declare status variable here

          if (currentUser?.id) {
            try {
              const progressData = await apiService.get(`/practice-clones/${clone.id}/progress/${currentUser.id}`);
              progress = progressData.progress || 0;
              status = progressData.status || CLONE_STATUSES.AVAILABLE; // Set status here where progressData is in scope
            } catch (error) {
              console.log('No progress found for clone:', clone.id);
              // Keep progress as 0 and status as AVAILABLE if no data found
            }
          }

          return {
            ...clone,
            type: 'practice',
            progress: progress,
            status: status // Use the properly scoped status variable
          };
        })
      );

      setPracticeClones(clonesWithProgress);
    } catch (error) {
      console.error('Error fetching practice clones:', error);
    }
  }, [currentUser]);

  const fetchAssignedFiles = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const allFiles = await apiService.get('/uploaded-files');

      // Filter files assigned to current student
      const studentFiles = allFiles.filter(file =>
        file.assignedTo && file.assignedTo.id === currentUser.id
      );

      // Transform to match the expected format
      const formattedFiles = studentFiles.map(file => ({
        id: file.id,
        cloneName: file.cloneName,
        filename: file.originalName,
        originalName: file.originalName,
        type: 'assigned',
        progress: file.progress,
        status: file.status,
        uploadDate: file.uploadDate,
        createdAt: file.createdAt
      }));

      setAssignedFiles(formattedFiles);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching assigned files:', error);
      setLoading(false);
    }
  }, [currentUser]);

  const refreshAllCloneData = useCallback(async () => {
    // Refresh both practice clones and assigned files
    await Promise.all([
      fetchPracticeClones(),
      fetchAssignedFiles()
    ]);
  }, [currentUser], fetchAssignedFiles, fetchPracticeClones);


  // Function to check if there are any unsaved changes
  const hasUnsavedChanges = () => {
    return tabsWithUnsavedChanges.size > 0;
  };

  // Function to handle logout attempts
  const handleLogoutAttempt = (logoutCallback) => {
    //console.log('handleLogoutAttempt called, hasUnsavedChanges:', hasUnsavedChanges());
    //console.log('tabsWithUnsavedChanges:', tabsWithUnsavedChanges);

    if (hasUnsavedChanges()) {
      //console.log('Showing logout warning modal');
      setPendingLogout(() => logoutCallback); // Use function to store callback properly
      setShowLogoutWarning(true);
    } else {
      //console.log('No unsaved changes, proceeding with logout');
      logoutCallback();
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchPracticeClones();
    fetchAssignedFiles();
  }, [currentUser, fetchAssignedFiles, fetchPracticeClones]);

  // Fetch unread count and set up polling - NOW AFTER fetchUnreadRepliesCount is defined
  useEffect(() => {
    fetchUnreadRepliesCount();

    // Add polling every 30 seconds like DirectorDashboard
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        fetchUnreadRepliesCount();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchUnreadRepliesCount]);

  // Expose the logout handler to parent components via window object
  useEffect(() => {
    //console.log('Setting up window.handleStudentLogoutAttempt');
    window.handleStudentLogoutAttempt = handleLogoutAttempt;

    // Cleanup function
    return () => {
      //console.log('Cleaning up window.handleStudentLogoutAttempt');
      delete window.handleStudentLogoutAttempt;
    };
  }, [tabsWithUnsavedChanges, handleLogoutAttempt]); // Add dependency to recreate when unsaved changes update


  // Combine practice clones with assigned files
  const allClones = [...practiceClones, ...assignedFiles];

  const baseStudentTabs = [
    { id: 'my-clones', name: 'My Clones' },
    { id: 'software', name: 'Software' },
    {
      id: 'messages',
      name: 'Messages',
      badge: unreadRepliesCount > 0 ? unreadRepliesCount : null
    },
    { id: 'settings', name: 'Settings' }
  ];

  // Combine base tabs with dynamic analysis tabs
  const studentTabs = [...baseStudentTabs, ...openAnalysisTabs, ...openHelpTabs];

  const renderHelpTab = (helpTab) => {
    return (
      <StudentHelp
        key={helpTab.id}
        questionId={helpTab.questionId}        // ✅ Use questionId for question-specific help
        stepName={helpTab.stepName}            // ✅ Use stepName for step-level help  
        questionText={helpTab.questionText}
        onClose={() => closeHelpTab(helpTab.id)}
      />
    );
  };

  const renderAnalysisTab = (analysisTab) => {
    return (
      <DNAAnalysisInterface
        key={analysisTab.id}
        cloneData={analysisTab.clone}
        onClose={() => closeAnalysisTab(analysisTab.id)}
        onProgressUpdate={(progress) => {
          // Update progress in both practice clones and assigned files
          setPracticeClones(prev =>
            prev.map(file =>
              file.id === analysisTab.clone.id
                ? { ...file, progress }
                : file
            ));
          setAssignedFiles(prev =>
            prev.map(file =>
              file.id === analysisTab.clone.id
                ? { ...file, progress }
                : file
            ));
        }}
        onUnsavedChangesUpdate={(hasUnsaved) => {
          setTabsWithUnsavedChanges(prev => {
            const newSet = new Set(prev);
            if (hasUnsaved) {
              newSet.add(analysisTab.id);
            } else {
              newSet.delete(analysisTab.id);
            }
            return newSet;
          });
        }}
        currentUser={currentUser}
        onNavigateToMessages={handleNavigateToMessages}
        onOpenHelp={openHelpTab} // ADD THIS LINE
      />
    );
  };

  const renderTabContent = () => {
    return (
      <div>
        {/* Static tabs */}
        <div className="h-full" style={{ display: activeTab === 'my-clones' ? 'block' : 'none' }}>
          <StudentClones
            allClones={allClones}
            loading={loading}
            assignedFiles={assignedFiles}
            practiceClones={practiceClones}
            openAnalysisTab={openAnalysisTab}
            downloadFile={downloadFile}
            currentUser={currentUser} // ADD THIS LINE
            onClonesUpdated={refreshAllCloneData} // ADD THIS LINE
          />
        </div>

        <div className="h-full" style={{ display: activeTab === 'software' ? 'block' : 'none' }}>
          <StudentSoftware />
        </div>

        <div className="h-full" style={{ display: activeTab === 'messages' ? 'block' : 'none' }}>
          <SimpleStudentChat
            selectedCloneId={selectedCloneForMessages}
            onMessageRead={fetchUnreadRepliesCount}
            prePopulatedReplyText={prePopulatedReplyText}
            onReplyTextUsed={() => setPrePopulatedReplyText('')}
          />
        </div>

        <div className="h-full" style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          <StudentSettings currentUser={currentUser} onUserUpdate={updateCurrentUser} />
        </div>

        {/* Dynamic analysis tabs - render all but hide inactive ones */}
        {openAnalysisTabs.map(analysisTab => (
          <div
            key={analysisTab.id}
            style={{ display: activeTab === analysisTab.id ? 'block' : 'none' }}
          >
            {renderAnalysisTab(analysisTab)}
          </div>
        ))}

        {/* Dynamic help tabs - render all but hide inactive ones */}
        {openHelpTabs.map(helpTab => (
          <div
            key={helpTab.id}
            style={{ display: activeTab === helpTab.id ? 'block' : 'none' }}
          >
            {renderHelpTab(helpTab)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-50">
      <div className="w-[95%] max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">{getTimeBasedGreeting()}, {currentUser?.name?.split(' ')[0]}</h2>
          <p className="text-gray-600 mt-2">{currentUser?.school?.name}</p>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-0 bg-gray-50 z-10 mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {studentTabs.map(tab => (
                <div key={tab.id} className="flex items-center">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm relative ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {tab.name}
                    {/* Show badge for unread messages */}
                    {tab.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                    {/* Show indicator if tab has unsaved changes */}
                    {tab.id.startsWith('analysis-') && tabsWithUnsavedChanges.has(tab.id) && (
                      <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full inline-block" title="Unsaved changes"></span>
                    )}
                  </button>
                  {/* Close button for non-analysis tabs */}
                  {tab.closable && !tab.id.startsWith('analysis-') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tab.id.startsWith('analysis-')) {
                          closeAnalysisTab(tab.id);
                        } else if (tab.id.startsWith('help-')) {
                          closeHelpTab(tab.id);
                        }
                      }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {renderTabContent()}
        </div>
      </div>

      {/* Logout Warning Modal */}
      {showLogoutWarning && (
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
                  <p className="text-sm text-gray-600">You have unsaved analysis work</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 text-sm mb-3">
                  You have unsaved changes in {tabsWithUnsavedChanges.size} analysis {tabsWithUnsavedChanges.size === 1 ? 'tab' : 'tabs'}.
                  If you logout now, you'll lose your progress.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-xs">
                    <strong>Recommendation:</strong> Go back to your analysis tabs and save your work using the "Save Progress" button before logging out.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex space-x-3">
                {/* Cancel - go back */}
                <button
                  onClick={() => {
                    setShowLogoutWarning(false);
                    setPendingLogout(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-200 flex items-center justify-center space-x-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  <span>Cancel - Keep Working</span>
                </button>

                {/* Logout anyway */}
                <button
                  onClick={() => {
                    setShowLogoutWarning(false);
                    if (pendingLogout) {
                      pendingLogout();
                    }
                    setPendingLogout(null);
                  }}
                  className="flex-1 px-4 py-2 text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition duration-200 flex items-center justify-center space-x-2 font-medium"
                >
                  <X className="w-4 h-4" />
                  <span>Logout Anyway</span>
                </button>
              </div>

              {/* Warning text */}
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-500">
                  Tip: Use the save button in your analysis tabs before logging out
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;