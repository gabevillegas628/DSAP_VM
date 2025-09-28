// components/BugReportModal.jsx
import React, { useState } from 'react';
import { X, Bug, AlertTriangle, CheckCircle } from 'lucide-react';
import { submitBugReport } from '../services/bugReportService'; // Use the service

const BugReportModal = ({ isOpen, onClose, currentUser }) => {
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!description.trim()) {
      alert('Please describe the bug you encountered.');
      return;
    }

    setSubmitting(true);
    
    try {
      // Use the service instead of direct API call
      const result = await submitBugReport({
        description: description.trim(),
        steps: steps.trim(),
        urgency
      });

      if (result.success) {
        setSubmitted(true);
        
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
          // Reset form state
          setDescription('');
          setSteps('');
          setUrgency('medium');
          setSubmitted(false);
        }, 2000);
      }

    } catch (error) {
      console.error('Error submitting bug report:', error);
      alert('Failed to submit bug report. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {submitted ? (
          // Success state
          <div className="p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Bug Report Submitted!</h3>
            <p className="text-gray-600">Thank you for helping us improve the platform. We'll review your report and get back to you if needed.</p>
          </div>
        ) : (
          // Form state
          <>
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Bug className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Report a Bug</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What happened? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows="4"
                  placeholder="Describe the bug you encountered..."
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Steps to reproduce (optional)
                </label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows="3"
                  placeholder="1. I clicked on...&#10;2. Then I...&#10;3. The bug occurred when..."
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How urgent is this?
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={submitting}
                >
                  <option value="low">Low - Minor inconvenience</option>
                  <option value="medium">Medium - Affects my work</option>
                  <option value="high">High - Blocking my progress</option>
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-md">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Automatically included:</p>
                    <p>Your user info, current page, browser details, and timestamp will be included to help us debug the issue.</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default BugReportModal;