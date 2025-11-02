// SessionExpiredModal.jsx
// Place in: client/src/components/SessionExpiredModal.jsx

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const SessionExpiredModal = ({ onClose }) => {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-fadeIn">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 p-2 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Session Expired
          </h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          You've been away for a while and your session has expired. 
          Please log in again to continue working.
        </p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Log In Again {countdown > 0 && `(${countdown})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;