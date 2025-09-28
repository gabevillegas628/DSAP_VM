// components/InstructorDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDNAContext } from '../context/DNAContext';
import InstructorOverview from './InstructorOverview';
import InstructorAnalysisReview from './InstructorAnalysisReview';
import InstructorSettings from './InstructorSettings';
import InstructorStudents from './InstructorStudents.jsx';
import SimpleInstructorChat from './SimpleInstructorChat.jsx';
import { getReviewStatus } from '../statusConstraints.js';
import apiService from '../services/apiService';

const InstructorDashboard = () => {
  const { currentUser, updateCurrentUser } = useDNAContext();
  const [activeTab, setActiveTab] = useState('overview'); // Start with overview tab
  const [unreadCount, setUnreadCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // Fetch message count for instructor's students only
  const fetchMessageCount = useCallback(async () => {
    if (!currentUser?.school?.id) return;

    try {
      console.log('📄 Fetching message count for instructor:', currentUser.id, 'at school:', currentUser.school.id);

      // Get messages only from students in instructor's school
      const receivedMessages = await apiService.get(`/messages/user/${currentUser.id}?type=received&schoolId=${currentUser.school.id}`);

      //console.log('📨 Total received messages from my school:', receivedMessages.length);

      // Count unread messages
      const unreadMessages = receivedMessages.filter(message => {
        const readBy = message.readBy || [];
        return !readBy.some(read => read.userId === currentUser.id);
      });

      //console.log('📬 Unread messages:', unreadMessages.length);
      setUnreadCount(unreadMessages.length);
    } catch (error) {
      console.error('Error fetching instructor message count:', error);
      setUnreadCount(0);
    }
  }, [currentUser]);

  // Fetch review count for instructor's students only
  // In InstructorDashboard.jsx, update this function:
  const fetchReviewCount = useCallback(async () => {
    if (!currentUser?.school?.id) return;

    try {
      //console.log('=== INSTRUCTOR REVIEW COUNT DEBUG ===');

      // Use the same API calls as InstructorAnalysisReview (WITHOUT includeTeacherReviewed)
      const schoolName = currentUser.school.name;
      const files = await apiService.get(`/uploaded-files?reviewReady=true&schoolName=${encodeURIComponent(schoolName)}`);
      const practiceSubmissions = await apiService.get(`/practice-submissions?reviewReady=true&schoolName=${encodeURIComponent(schoolName)}`);

      //console.log('Regular submissions from my school awaiting review:', files.length);
      //console.log('Practice submissions from my school awaiting review:', practiceSubmissions.length);

      // Count ALL files returned (since API already filtered to only instructor-reviewable items)
      const totalNeedsReview = files.length + practiceSubmissions.length;

      //console.log('Total instructor review count:', totalNeedsReview);
      setReviewCount(totalNeedsReview);
    } catch (error) {
      console.error('Error fetching instructor review count:', error);
      setReviewCount(0);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.school?.id) {
      fetchMessageCount();
      fetchReviewCount();

      // Poll for updates
      const messageInterval = setInterval(fetchMessageCount, 30000);
      const reviewInterval = setInterval(fetchReviewCount, 60000);

      return () => {
        clearInterval(messageInterval);
        clearInterval(reviewInterval);
      };
    }
  }, [currentUser, fetchMessageCount, fetchReviewCount]);

  const instructorTabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'students', name: 'Students' },
    {
      id: 'messages',
      name: 'Messages',
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      id: 'analysis-review',
      name: 'Analysis Review',
      badge: reviewCount > 0 ? reviewCount : null
    },
    { id: 'settings', name: 'Settings' }
  ];

  // Replace the renderTabContent function in InstructorDashboard.jsx

  const renderTabContent = () => {
    return (
      <div>
        {/* Static tabs - keep all mounted but hide inactive ones */}
        <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          <InstructorOverview onNavigateToTab={setActiveTab} />
        </div>

        <div style={{ display: activeTab === 'students' ? 'block' : 'none' }}>
          <InstructorStudents />
        </div>

        <div style={{ display: activeTab === 'analysis-review' ? 'block' : 'none' }}>
          <InstructorAnalysisReview onReviewCompleted={() => setReviewCount(prev => Math.max(0, prev - 1))} />
        </div>

        <div style={{ display: activeTab === 'messages' ? 'block' : 'none' }}>
          <SimpleInstructorChat onMessageRead={fetchMessageCount} />
        </div>

        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          <InstructorSettings currentUser={currentUser} onUserUpdate={updateCurrentUser} />
        </div>
      </div>
    );
  };

  // Don't render if instructor doesn't have a school assigned
  if (!currentUser?.school?.id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">School Assignment Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>You need to be assigned to a school before you can access the instructor dashboard. Please contact your program director.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-[95%] max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            {currentUser.name} - {currentUser.school?.name || 'No School Assigned'}
          </h2>
          <h3 className="text-2xl text-gray-900">Instructor Dashboard</h3>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {instructorTabs.map(tab => (
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

export default InstructorDashboard;