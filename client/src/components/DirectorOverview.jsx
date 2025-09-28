// components/DirectorOverview.jsx
import React, { useState, useEffect } from 'react';
import { School, Users, CheckCircle, Upload, X } from 'lucide-react';
import { useDNAContext } from '../context/DNAContext';
import apiService from '../services/apiService';

const DirectorOverview = ({ onNavigateToTab }) => {
  const { currentUser } = useDNAContext();
  const [schools, setSchools] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // NEW: Upload functionality state (copied from DirectorCloneLibrary)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSchools(),
        fetchUploadedFiles(),
        fetchStudents()
      ]);
    } catch (error) {
      console.error('Error fetching overview data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const data = await apiService.get('/schools');
      setSchools(data);
    } catch (error) {
      console.error('Error fetching schools:', error);
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const data = await apiService.get('/uploaded-files');
      setUploadedFiles(data);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await apiService.get('/users?role=student&status=approved');
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  // NEW: Upload functionality (copied from DirectorCloneLibrary)
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);

    try {
      const formData = new FormData();

      // Add all selected files
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      // Add the current user ID as the uploader
      formData.append('uploadedById', currentUser.id);

      const newFiles = await apiService.uploadFiles('/uploaded-files', formData);

      // Update the uploadedFiles state with new files
      setUploadedFiles(prev => [...newFiles, ...prev]);
      setShowUploadModal(false);

      // Reset the file input
      event.target.value = '';

      console.log(`Successfully uploaded ${newFiles.length} files`);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert(error.message || 'Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  // Calculate real completion rate from uploaded files
  const calculateCompletionRate = () => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return 0;
    }

    // Count files that are completed (100% progress)
    const completedFiles = uploadedFiles.filter(file => file.progress === 100);
    const completionRate = Math.round((completedFiles.length / uploadedFiles.length) * 100);

    return completionRate;
  };

  // Identify students who may need support based on their file progress
  const calculateStudentSupportItems = () => {
    const supportItems = [];

    students.forEach(student => {
      // Students with assigned files but no progress
      const stuckFiles = uploadedFiles.filter(f =>
        f.assignedTo?.id === student.id && f.progress === 0
      );

      if (stuckFiles.length > 0) {
        supportItems.push({
          id: `stuck-${student.id}`,
          studentId: student.id,
          studentName: student.name,
          reason: `${stuckFiles.length} assigned file${stuckFiles.length > 1 ? 's' : ''} with no progress`,
          priority: stuckFiles.length > 2 ? 'high' : 'medium'
        });
      }

      // Students with multiple incomplete assignments
      const incompleteFiles = uploadedFiles.filter(f =>
        f.assignedTo?.id === student.id && f.progress > 0 && f.progress < 100
      );

      if (incompleteFiles.length > 3) {
        supportItems.push({
          id: `overloaded-${student.id}`,
          studentId: student.id,
          studentName: student.name,
          reason: `${incompleteFiles.length} incomplete assignments - may be overloaded`,
          priority: 'medium'
        });
      }

      // Students with completed work awaiting review
      const needsReview = uploadedFiles.filter(f =>
        f.assignedTo?.id === student.id && f.progress === 100 && f.status !== 'approved'
      );

      if (needsReview.length > 0) {
        supportItems.push({
          id: `review-${student.id}`,
          studentId: student.id,
          studentName: student.name,
          reason: `${needsReview.length} submission${needsReview.length > 1 ? 's' : ''} awaiting your review`,
          priority: 'high'
        });
      }
    });

    // Sort by priority and limit duplicates per student
    const uniqueItems = supportItems.reduce((acc, item) => {
      const existing = acc.find(i => i.studentId === item.studentId);
      if (!existing || item.priority === 'high') {
        return acc.filter(i => i.studentId !== item.studentId).concat(item);
      }
      return acc;
    }, []);

    return uniqueItems.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  // Calculate average progress across all files
  const calculateAverageProgress = () => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return 0;
    }

    const totalProgress = uploadedFiles.reduce((sum, file) => sum + (file.progress || 0), 0);
    return Math.round(totalProgress / uploadedFiles.length);
  };

  const completionRate = calculateCompletionRate();
  const averageProgress = calculateAverageProgress();

  // Calculate total students from actual student records rather than school.students field
  const totalStudents = students.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border animate-pulse">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-300 rounded"></div>
                <div className="ml-4 space-y-2">
                  <div className="w-20 h-4 bg-gray-300 rounded"></div>
                  <div className="w-12 h-8 bg-gray-300 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <X className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchAllData}
              className="mt-2 text-sm text-red-600 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards - Now Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Schools Card - Clickable */}
        <button
          onClick={() => onNavigateToTab && onNavigateToTab('schools')}
          className="bg-white rounded-xl shadow-sm border p-6 text-left hover:shadow-md hover:border-indigo-200 transition-all duration-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {schools.length}
              </p>
              <p className="text-sm text-gray-600 group-hover:text-indigo-500">Schools Registered</p>
            </div>
            <div className="bg-blue-50 group-hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <School className="w-6 h-6 text-blue-600 group-hover:text-indigo-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500 group-hover:text-indigo-400">
            <span>Click to manage schools</span>
            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Students Card - Clickable */}
        <button
          onClick={() => onNavigateToTab && onNavigateToTab('students')}
          className="bg-white rounded-xl shadow-sm border p-6 text-left hover:shadow-md hover:border-indigo-200 transition-all duration-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {students.length}
              </p>
              <p className="text-sm text-gray-600 group-hover:text-indigo-500">Active Students</p>
            </div>
            <div className="bg-green-50 group-hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <Users className="w-6 h-6 text-green-600 group-hover:text-indigo-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500 group-hover:text-indigo-400">
            <span>Click to manage students</span>
            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Completion Rate Card - Clickable */}
        <button
          onClick={() => onNavigateToTab && onNavigateToTab('clone-library')}
          className="bg-white rounded-xl shadow-sm border p-6 text-left hover:shadow-md hover:border-indigo-200 transition-all duration-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {calculateCompletionRate()}%
              </p>
              <p className="text-sm text-gray-600 group-hover:text-indigo-500">Completion Rate</p>
            </div>
            <div className="bg-purple-50 group-hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <CheckCircle className="w-6 h-6 text-purple-600 group-hover:text-indigo-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500 group-hover:text-indigo-400">
            <span>Click to view all files</span>
            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Analysis Pipeline */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Analysis Pipeline</h3>
              <p className="text-sm text-gray-600 mt-1">Workflow status and bottlenecks</p>
            </div>
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('clone-library')}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View All Files →
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{uploadedFiles.filter(f => !f.assignedTo).length}</p>
                <p className="text-sm text-yellow-800">Awaiting Assignment</p>
                {uploadedFiles.filter(f => !f.assignedTo).length > 0 && (
                  <button className="text-xs text-yellow-700 hover:text-yellow-900 mt-1">
                    Assign Now
                  </button>
                )}
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {uploadedFiles.filter(f => f.progress > 0 && f.progress < 100).length}
                </p>
                <p className="text-sm text-blue-800">In Progress</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {uploadedFiles.filter(f => f.progress === 100 && f.status !== 'approved').length}
                </p>
                <p className="text-sm text-purple-800">Awaiting Review</p>
                {uploadedFiles.filter(f => f.progress === 100 && f.status !== 'approved').length > 0 && (
                  <button
                    onClick={() => onNavigateToTab && onNavigateToTab('analysis-review')}
                    className="text-xs text-purple-700 hover:text-purple-900 mt-1"
                  >
                    Review Now
                  </button>
                )}
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {uploadedFiles.filter(f => f.status === 'approved').length}
                </p>
                <p className="text-sm text-green-800">Completed</p>
              </div>
            </div>

            {/* Show any "stuck" files */}
            {uploadedFiles.filter(f => f.assignedTo && f.progress === 0).length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-800 mb-2">
                  ⚠️ Files Needing Attention ({uploadedFiles.filter(f => f.assignedTo && f.progress === 0).length})
                </h4>
                <p className="text-sm text-orange-700">
                  Files assigned but no progress started. Students may need reminders.
                </p>
                <button
                  onClick={() => onNavigateToTab && onNavigateToTab('clone-library')}
                  className="text-sm text-orange-800 hover:text-orange-900 font-medium mt-2"
                >
                  View Details →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Student Support */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Student Support</h3>
              <p className="text-sm text-gray-600 mt-1">Students who may need check-ins</p>
            </div>
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('students')}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View All Students →
            </button>
          </div>
          <div className="p-6">
            {calculateStudentSupportItems().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>All students are on track!</p>
                <p className="text-xs mt-1">No immediate support needs detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calculateStudentSupportItems().slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${item.priority === 'high' ? 'bg-red-500' :
                          item.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
                        <p className="font-medium text-gray-900">{item.studentName}</p>
                        <span className="text-xs text-gray-500">
                          {students.find(s => s.id === item.studentId)?.school?.name}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.reason}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {/* Add send message functionality */ }}
                        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
                      >
                        Message
                      </button>
                      <button
                        onClick={() => onNavigateToTab && onNavigateToTab('students')}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
                {calculateStudentSupportItems().length > 5 && (
                  <div className="text-center pt-3">
                    <button
                      onClick={() => onNavigateToTab && onNavigateToTab('students')}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      View {calculateStudentSupportItems().length - 5} more →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* School Performance Comparison */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">School Performance</h3>
          <button
            onClick={() => onNavigateToTab && onNavigateToTab('schools')}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            View All Schools →
          </button>
        </div>

        {schools.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <School className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No schools to compare yet</p>
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('schools')}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-2"
            >
              Add your first school →
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Scrollable container */}
            <div
              className="overflow-x-auto pb-4"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#d1d5db #f3f4f6'
              }}
            >
              <div
                className="grid gap-4 w-max"
                style={{
                  gridTemplateRows: 'repeat(3, 1fr)',
                  gridAutoFlow: 'column',
                  gridAutoColumns: '280px', // Fixed card width
                  minHeight: '420px' // Fixed height for 3 rows
                }}
              >
                {schools.map(school => {
                  const schoolStudents = students.filter(s => s.school?.id === school.id);
                  const schoolFiles = uploadedFiles.filter(f =>
                    schoolStudents.some(student => student.id === f.assignedTo?.id)
                  );
                  const completedFiles = schoolFiles.filter(f => f.progress === 100);
                  const completionRate = schoolFiles.length > 0 ?
                    Math.round((completedFiles.length / schoolFiles.length) * 100) : 0;

                  // Calculate average progress for in-progress files
                  const inProgressFiles = schoolFiles.filter(f => f.progress > 0 && f.progress < 100);

                  return (
                    <div key={school.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 truncate">{school.name}</h4>
                          <p className="text-sm text-gray-600 truncate">{school.instructor}</p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex-shrink-0 ml-2">
                          {schoolStudents.length} student{schoolStudents.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* Completion Rate */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Completion Rate</span>
                            <span className="font-medium text-gray-900">{completionRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${completionRate >= 80 ? 'bg-green-500' :
                                completionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                              style={{ width: `${completionRate}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-blue-50 rounded p-2">
                            <p className="font-semibold text-blue-600">{schoolFiles.length}</p>
                            <p className="text-blue-800">Total Files</p>
                          </div>
                          <div className="bg-yellow-50 rounded p-2">
                            <p className="font-semibold text-yellow-600">{inProgressFiles.length}</p>
                            <p className="text-yellow-800">In Progress</p>
                          </div>
                          <div className="bg-green-50 rounded p-2">
                            <p className="font-semibold text-green-600">{completedFiles.length}</p>
                            <p className="text-green-800">Completed</p>
                          </div>
                        </div>

                        {/* Performance indicator */}
                        {schoolFiles.length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">Performance</span>
                              <span className={`font-medium ${completionRate >= 80 ? 'text-green-600' :
                                completionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                {completionRate >= 80 ? '🟢 Excellent' :
                                  completionRate >= 60 ? '🟡 Good' : '🔴 Needs Support'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scroll indicator */}
            {schools.length > 9 && (
              <div className="absolute top-0 right-0 bg-gradient-to-l from-white via-white to-transparent w-8 h-full pointer-events-none"></div>
            )}
          </div>
        )}
      </div>

      {/* NEW: Upload Modal (copied from DirectorCloneLibrary) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Upload .ab1 Files</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploadingFiles}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select DNA sequence files (.ab1)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".ab1"
                  onChange={handleFileUpload}
                  disabled={uploadingFiles}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">File Requirements:</p>
                  <ul className="space-y-1">
                    <li>• Only .ab1 files are accepted</li>
                    <li>• Multiple files can be selected</li>
                    <li>• Maximum file size: 10MB per file</li>
                    <li>• Files will be available for assignment after upload</li>
                  </ul>
                </div>
              </div>
              {uploadingFiles && (
                <div className="text-center py-4">
                  <p className="text-indigo-600">Uploading files...</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploadingFiles}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DirectorOverview;