// SessionExpiredModal.jsx - FRIENDLY VERSION
// More casual, less alarming design

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const SessionExpiredModal = ({ onClose }) => {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
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
          <div className="bg-blue-100 p-2 rounded-full">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome Back!
          </h2>
        </div>
        
        <p className="text-gray-600 mb-6">
          You've been away for a while. Please log in again to continue your work.
        </p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Log In {countdown > 0 && `(${countdown})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
