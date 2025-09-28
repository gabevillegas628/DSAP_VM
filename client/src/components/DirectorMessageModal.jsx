// DirectorDirectMessageModal.jsx - Modal for directors to send direct messages to students
import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, X, User, Search, CheckCircle, AlertCircle, School } from 'lucide-react';
import apiService from '../services/apiService'; // Updated import path

const DirectorDirectMessageModal = ({ 
  isOpen, 
  onClose, 
  currentUser
}) => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
      // Reset form when modal opens
      setSelectedStudent(null);
      setSearchTerm('');
      setSubject('');
      setContent('');
      setSent(false);
      setError('');
    }
  }, [isOpen]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const studentData = await apiService.get('/users?role=student&status=approved');
      setStudents(studentData);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Error loading students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSendMessage = async () => {
    console.log('=== DIRECTOR DIRECT MESSAGE SEND ===');
    console.log('Director:', currentUser?.name);
    console.log('Student:', selectedStudent?.name);
    console.log('Subject:', subject);

    // Validation
    if (!currentUser?.id) {
      setError('Director information not available. Please refresh and try again.');
      return;
    }

    if (!selectedStudent) {
      setError('Please select a student to message.');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject for your message.');
      return;
    }

    if (!content.trim()) {
      setError('Please enter a message.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const messageData = {
        senderId: currentUser.id,
        recipientId: selectedStudent.id,
        subject: subject.trim(),
        content: content.trim()
      };

      console.log('Sending message data:', messageData);

      const result = await apiService.post('/messages/direct', messageData);
      console.log('Message sent successfully:', result);
      setSent(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error sending direct message:', error);
      setError(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setSubject('');
    setContent('');
    setSending(false);
    setSent(false);
    setError('');
    onClose();
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchTerm('');
  };

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.school?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {sent ? 'Message Sent!' : 'Send Direct Message'}
                </h3>
                <p className="text-sm text-gray-600">
                  {sent ? 'Your message has been delivered' : 'Start a direct conversation with a student'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {sent ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Message Sent Successfully!</h4>
              <p className="text-gray-600 mb-4">
                Your direct message has been sent to {selectedStudent?.name}. They will see it in their messages.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                  <strong>What happens next:</strong> {selectedStudent?.name} will receive your message in their Direct Messages conversation. 
                  You can continue the conversation from your messages interface.
                </p>
              </div>
            </div>
          ) : (
            /* Message Form */
            <>
              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Student Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Student <span className="text-red-500">*</span>
                  </label>
                  
                  {selectedStudent ? (
                    /* Selected Student Display */
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-green-900">{selectedStudent.name}</p>
                          <p className="text-sm text-green-700">{selectedStudent.email}</p>
                          {selectedStudent.school && (
                            <p className="text-xs text-green-600">{selectedStudent.school.name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedStudent(null)}
                        className="text-green-600 hover:text-green-800"
                        title="Change student"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Student Search and Selection */
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search students by name, email, or school..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          disabled={loadingStudents}
                        />
                      </div>

                      {searchTerm.length > 0 && (
                        <>
                          {loadingStudents ? (
                            <div className="text-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                              <p className="text-gray-600 text-sm mt-2">Loading students...</p>
                            </div>
                          ) : (
                            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                              {filteredStudents.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                  <p>No students found matching "{searchTerm}"</p>
                                </div>
                              ) : (
                                <div className="space-y-1 p-2">
                                  {filteredStudents.map((student) => (
                                    <button
                                      key={student.id}
                                      onClick={() => handleStudentSelect(student)}
                                      className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                          <User className="w-3 h-3 text-blue-600" />
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900">{student.name}</p>
                                          <p className="text-xs text-gray-600">{student.email}</p>
                                          {student.school && (
                                            <div className="flex items-center space-x-1 mt-1">
                                              <School className="w-3 h-3 text-gray-500" />
                                              <p className="text-xs text-gray-500">{student.school.name}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {searchTerm.length === 0 && (
                        <p className="text-sm text-gray-500 p-3 text-center bg-gray-50 rounded-lg">
                          Start typing to search for students...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter message subject..."
                    disabled={sending}
                  />
                </div>

                {/* Message Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Type your message to the student..."
                    disabled={sending}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This message will appear in the student's Direct Messages conversation.
                  </p>
                </div>

                {/* Info Panel */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Direct Message Info:</h5>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• This message is not tied to any specific clone analysis</li>
                    <li>• The student will receive it in their "Direct Messages" conversation</li>
                    <li>• You can continue the conversation from your messages interface</li>
                    <li>• Both you and the student can reply to maintain the thread</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleClose}
                disabled={sending}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sending || !selectedStudent || !subject.trim() || !content.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 disabled:bg-green-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectorDirectMessageModal;