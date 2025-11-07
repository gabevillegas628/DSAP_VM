// Replace the entire DirectorDashboard component with this fixed version:

import React, { useState, useEffect, useCallback } from 'react';
import { useDNAContext } from '../context/DNAContext';
import DirectorOverview from './DirectorOverview';
import DirectorStudents from './DirectorStudents';
import DirectorSchools from './DirectorSchools';
import DirectorCloneLibrary from './DirectorCloneLibrary';
import DirectorEditQuestions from './DirectorEditQuestions';
import DirectorUserManagement from './DirectorUserManagement';
import DirectorMessagesChat from './DirectorMessagesChat';
import DirectorAnalysisReview from './DirectorAnalysisReview';
import DirectorSettings from './DirectorSettings';
import DirectorHelp from './DirectorHelp.jsx';
import BugReportsTab from './BugReportsTab.jsx';
import { CLONE_STATUSES, getReviewStatus } from '../statusConstraints.js';
import apiService from '../services/apiService';

const DirectorDashboard = () => {
  const { currentUser } = useDNAContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [unreadCount, setUnreadCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // Create a refetch function that can be called from child components
  // Replace the fetchMessageCount function in DirectorDashboard.jsx
  const fetchMessageCount = useCallback(async () => {
    if (!currentUser) return;

    try {
      //console.log('📄 Director fetching discussion unread count for user:', currentUser.id);

      // Get all discussions that directors can see
      const discussions = await apiService.get('/clone-discussions/director');
      //console.log('📨 Director total discussions:', discussions.length);

      // Sum up unread counts from all discussions
      const totalUnreadCount = discussions.reduce((total, discussion) => {
        return total + (discussion.unreadCount || 0);
      }, 0);

      //console.log('📬 Director total unread messages from discussions:', totalUnreadCount);
      setUnreadCount(totalUnreadCount);
    } catch (error) {
      console.error('Error fetching director discussion unread count:', error);
      setUnreadCount(0);
    }
  }, [currentUser]);

  // Fetch unread message count
  useEffect(() => {
    fetchMessageCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchMessageCount, 30000);

    return () => clearInterval(interval);
  }, [fetchMessageCount]);

  // Fetch analysis review count

  const fetchReviewCount = async () => {
    try {
      // Use the same API calls as DirectorAnalysisReview (WITH includeTeacherReviewed=true)
      const [files, practiceSubmissions] = await Promise.all([
        apiService.get('/uploaded-files?reviewReady=true&includeTeacherReviewed=true'),
        apiService.get('/practice-submissions?reviewReady=true&includeTeacherReviewed=true')
      ]);


      // Count ALL files returned (since API already filtered to only director-reviewable items)
      const totalNeedsReview = files.length + practiceSubmissions.length;

      //console.log('Total director review count:', totalNeedsReview);
      setReviewCount(totalNeedsReview);
    } catch (error) {
      console.error('Error fetching review count:', error);
      setReviewCount(0);
    }
  };


  // In DirectorDashboard.jsx, update this function:
  useEffect(() => {
    if (!currentUser) return;

    fetchReviewCount();

    // Poll for updates every 60 seconds (less frequent than messages)
    const interval = setInterval(fetchReviewCount, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const directorTabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'students', name: 'Students' },
    { id: 'schools', name: 'Schools' },
    { id: 'users', name: 'User Management' },
    { id: 'clone-library', name: 'Clone Library' },
    { id: 'help-topics', name: 'Help Topics' },
    {
      id: 'messages',
      name: 'Messages',
      badge: unreadCount > 0 ? unreadCount : null
    },
    { id: 'edit-questions', name: 'Edit Questions' },
    {
      id: 'analysis-review',
      name: 'Analysis Review',
      badge: reviewCount > 0 ? reviewCount : null
    },
    { id: 'settings', name: 'Settings' },
    { id: 'bug-reports', name: 'Bug Reports' }
  ];

  // Replace the renderTabContent function and return statement in DirectorDashboard.jsx

  const renderTabContent = () => {
    return (
      <div>
        {/* Static tabs - keep all mounted but hide inactive ones */}
        <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          <DirectorOverview onNavigateToTab={setActiveTab} />
        </div>

        <div style={{ display: activeTab === 'students' ? 'block' : 'none' }}>
          <DirectorStudents />
        </div>

        <div style={{ display: activeTab === 'schools' ? 'block' : 'none' }}>
          <DirectorSchools />
        </div>

        <div style={{ display: activeTab === 'clone-library' ? 'block' : 'none' }}>
          <DirectorCloneLibrary />
        </div>

        <div style={{ display: activeTab === 'edit-questions' ? 'block' : 'none' }}>
          <DirectorEditQuestions />
        </div>

        <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
          <DirectorUserManagement />
        </div>

        <div style={{ display: activeTab === 'analysis-review' ? 'block' : 'none' }}>
          <DirectorAnalysisReview onReviewCompleted={() => setReviewCount(prev => Math.max(0, prev - 1))} />
        </div>

        <div style={{ display: activeTab === 'messages' ? 'block' : 'none' }}>
          <DirectorMessagesChat onMessageRead={fetchMessageCount} />
        </div>

        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          <DirectorSettings />
        </div>

        <div style={{ display: activeTab === 'help-topics' ? 'block' : 'none' }}>
          <DirectorHelp />
        </div>

        <div style={{ display: activeTab === 'bug-reports' ? 'block' : 'none' }}>
          <BugReportsTab />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-[95%] max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Program Administration</h2>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {directorTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm relative ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {tab.name}
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {renderTabContent()}
      </div>
    </div>
  );
};

export default DirectorDashboard;