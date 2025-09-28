// components/Navigation.jsx - Updated with mobile fixes for your current version
import React from 'react';
import { User, FileText, Bug } from 'lucide-react';
import ProfilePicture from './ProfilePicture';
import BugReportModal from './BugReportModal';

const Navigation = ({ currentUser, onLogout }) => {
  // Logo imports (adjust path based on your setup)
  const rutgersLogo = "/images/RSUNJ_H_RED_BLACK_RGB.png";
  const waksmanLogo = "/images/wssp-banner-bldg.png";
  const [showBugReportModal, setShowBugReportModal] = React.useState(false);

  const handleLogoutClick = () => {
    console.log('Logout button clicked');
    console.log('Current user role:', currentUser?.role);
    console.log('window.handleStudentLogoutAttempt exists:', !!window.handleStudentLogoutAttempt);

    // Only use the student logout handler for students
    if (currentUser?.role === 'student' && window.handleStudentLogoutAttempt) {
      console.log('Using student logout handler');
      window.handleStudentLogoutAttempt(onLogout);
    } else {
      console.log('Using direct logout');
      onLogout();
    }
  };

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 relative">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logos at absolute edges - hidden on mobile, smaller on tablet */}
          <img
            src={rutgersLogo}
            alt="Rutgers University"
            className="absolute left-1 md:left-2 top-1/2 transform -translate-y-1/2 h-6 md:h-8 lg:h-10 w-auto z-10 hidden sm:block"
          />
          <img
            src={waksmanLogo}
            alt="Waksman Institute"
            className="absolute right-1 md:right-2 top-1/2 transform -translate-y-1/2 h-8 md:h-10 lg:h-12 w-auto z-10 hidden sm:block"
          />

          {/* Main navigation content */}
          <div className="flex justify-between items-center h-16 min-h-[64px]">
            {/* Left side - Icon and title with responsive margins */}
            <div className="flex items-center space-x-2 md:space-x-4 ml-0 sm:ml-10 md:ml-12 lg:ml-14 flex-1 min-w-0">
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <h1 className="font-semibold text-gray-900 truncate">
                {/* Responsive title text */}
                <span className="hidden lg:inline text-xl">WSSP DNA Sequence Analysis Platform</span>
                <span className="hidden md:inline lg:hidden text-lg">WSSP Analysis Platform</span>
                <span className="md:hidden text-base">WSSP</span>
              </h1>
            </div>

            {/* Right side - User info and logout with responsive margins */}
            <div className="flex items-center space-x-2 md:space-x-4 mr-0 sm:mr-12 md:mr-14 lg:mr-16 flex-shrink-0">
              {/* Bug Report Button */}
              <button
                onClick={() => setShowBugReportModal(true)} // Change this line
                className="text-gray-500 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors"
                title="Report a Bug">
                <Bug className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm text-gray-600">
                <ProfilePicture
                  src={currentUser?.profilePicture}
                  name={currentUser?.name}
                  size="sm"
                  className="flex-shrink-0"
                />
                {/* Hide full name on very small screens */}
                <span className="hidden sm:inline truncate max-w-[120px] lg:max-w-none">
                  {currentUser?.name}
                </span>
                <span className="text-indigo-600 font-medium capitalize">
                  ({currentUser?.role})
                </span>
              </div>
              {/* Logout Button */}
              <button
                onClick={handleLogoutClick}
                className="text-gray-500 hover:text-gray-700 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium min-h-[44px] md:min-h-auto"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Add the Bug Report Modal */}
      {showBugReportModal && (
        <BugReportModal
          isOpen={showBugReportModal}
          onClose={() => setShowBugReportModal(false)}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default Navigation;