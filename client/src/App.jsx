// App.jsx - WITH SESSION EXPIRATION HANDLING
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DNAProvider } from './context/DNAContext';
import { ProgramSettingsProvider } from './context/ProgramSettingsContext';
import TitleManager from './components/TitleManager';
import LoginScreen from './components/LoginScreen';
import LoginScreenMobile from './components/LoginScreenMobile';
import Navigation from './components/Navigation';
import DirectorDashboard from './components/DirectorDashboard';
import InstructorDashboard from './components/InstructorDashboard';
import StudentDashboard from './components/StudentDashboard';
import StudentHelp from './components/StudentHelp';
import ResetPasswordPage from './components/ResetPasswordPage';

// ========== NEW IMPORTS - ADDED FOR SESSION HANDLING ==========
import { useSessionCheck } from './hooks/useSessionCheck';
import SessionExpiredModal from './components/SessionExpiredModal';
import apiService from './services/apiService';
// ===============================================================

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

const App = () => {
  const isMobile = useIsMobile();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ========== NEW STATE - ADDED FOR SESSION HANDLING ==========
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  // ============================================================

  // Sample data - in a real app, this would come from an API
  const [schools, setSchools] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages] = useState([
    { id: 1, from: 'John Smith', school: 'Lincoln High School', instructor: 'Dr. Sarah Johnson', assignedFile: 'sample_001.ab1', progress: 4, content: 'I need help identifying the start position', timestamp: '2024-01-16T10:30:00Z', replied: false },
    { id: 2, from: 'Maria Garcia', school: 'Roosevelt Academy', instructor: 'Prof. Michael Chen', assignedFile: 'sample_002.ab1', progress: 2, content: 'The chromatogram quality seems poor in my sample', timestamp: '2024-01-16T14:20:00Z', replied: true }
  ]);

  // ========== NEW HOOK - ADDED FOR SESSION HANDLING ==========
  // Monitor session and show modal when token expires
  useSessionCheck(() => {
    console.log('Session expired detected in App.jsx');
    setShowSessionExpiredModal(true);
  });
  // ===========================================================

  // Check for existing authentication on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const loginAs = (user) => {
    //console.log('Logging in as:', user);
    setCurrentUser(user);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateCurrentUser = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // ========== NEW HANDLER - ADDED FOR SESSION HANDLING ==========
  const handleSessionExpiredClose = () => {
    // Clear all authentication data
    setCurrentUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    apiService.setToken(null);
    setShowSessionExpiredModal(false);
    // Force redirect to login page
    window.location.href = '/';
  };
  // ==============================================================

  const contextValue = {
    currentUser,
    setCurrentUser,
    updateCurrentUser,
    schools,
    setSchools,
    uploadedFiles,
    setUploadedFiles,
    messages,
    loginAs,
    logout
  };


  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Main app with Router
  return (
    <Router>
      <DNAProvider value={contextValue}>
        <ProgramSettingsProvider>
          <TitleManager>
            <Routes>
              {/* Help route - accessible without login */}
              <Route path="/student-help/:helpTopicId" element={<StudentHelp />} />

              {/* Reset password route - accessible without login */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Main app routes */}
              <Route path="/*" element={
                !currentUser ? (
                  <div>
                    {isMobile ? (
                      <LoginScreenMobile onLogin={loginAs} />
                    ) : (
                      <LoginScreen onLogin={loginAs} />
                    )}
                  </div>
                ) : (
                  <div className="min-h-screen bg-gray-50">
                    <Navigation currentUser={currentUser} onLogout={logout} />

                    {currentUser.role === 'director' && <DirectorDashboard />}
                    {currentUser.role === 'instructor' && <InstructorDashboard />}
                    {currentUser.role === 'student' && <StudentDashboard />}
                  </div>
                )
              } />
            </Routes>

            {/* ========== NEW MODAL - ADDED FOR SESSION HANDLING ========== */}
            {showSessionExpiredModal && (
              <SessionExpiredModal onClose={handleSessionExpiredClose} />
            )}
            {/* ============================================================ */}

          </TitleManager>
        </ProgramSettingsProvider>
      </DNAProvider>
    </Router>
  );
};

export default App;