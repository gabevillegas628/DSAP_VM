// components/DirectorCloneLibrary.jsx
import React, { useState, useEffect } from 'react';
import { Upload, Download, Search, Filter, Eye, Trash2, Plus, AlertTriangle, CheckCircle, RefreshCw, FileText, Link, X } from 'lucide-react';
import { useDNAContext } from '../context/DNAContext';
import DirectorPracticeAnswers from './DirectorPracticeAnswers';
import NCBISubmissionModal from './NCBISubmissionModal';
import apiService from '../services/apiService';

// Add these imports after your existing imports
import {
  CLONE_STATUSES,
  getStatusConfig,
  validateAndWarnStatus,
  STATUS_DROPDOWN_OPTIONS
} from '../statusConstraints.js';

const DirectorCloneLibrary = () => {
  const { currentUser } = useDNAContext();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFilters, setSearchFilters] = useState({
    status: '',
    assignedStudent: '',
    school: ''
  });

  // NEW: Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);


  // NEW: Practice clone state
  const [uploadMode, setUploadMode] = useState('regular'); // 'regular' or 'practice'
  const [practiceClones, setPracticeClones] = useState([]);
  const [showPracticeUploadModal, setShowPracticeUploadModal] = useState(false);
  const [showPracticeAnswersModal, setShowPracticeAnswersModal] = useState(false);
  const [selectedPracticeClone, setSelectedPracticeClone] = useState(null);

  // State variable for bulk uploads (for missing files)
  const [missingFiles, setMissingFiles] = useState([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [loadingMissingFiles, setLoadingMissingFiles] = useState(false);
  const [bulkUploadFiles, setBulkUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [manualMatches, setManualMatches] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [bulkUploadResults, setBulkUploadResults] = useState(null);
  const [foundFiles, setFoundFiles] = useState([]);

  // NEW: NCBI submission state
  const [showNCBISubmissionModal, setShowNCBISubmissionModal] = useState(false);
  const [selectedForNCBI, setSelectedForNCBI] = useState(new Set());
  const [ncbiSubmissionInProgress, setNCBISubmissionInProgress] = useState(false);
  const [ncbiSubmissionResults, setNCBISubmissionResults] = useState(null);
  const [programSettings, setProgramSettings] = useState(null);
  const [ncbiSubmissionFiles, setNCBISubmissionFiles] = useState([]);

  // NEW: File replacement state
  const [showReplaceFileModal, setShowReplaceFileModal] = useState(false);
  const [fileToReplace, setFileToReplace] = useState(null);
  const [replacingFile, setReplacingFile] = useState(false);

  // NEW: Unassign confirmation state
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [fileToUnassign, setFileToUnassign] = useState(null);

  // NEW: Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [fileToAssign, setFileToAssign] = useState(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  const checkMissingFiles = async () => {
    setLoadingMissingFiles(true);

    try {
      const response = await apiService.get('/practice-clones/missing-files');

      setMissingFiles(response.missingFiles || []);
      setFoundFiles(response.foundFiles || []);

      if (response.fixedFilenames > 0) {
        // Refresh practice clones list to show updated data
        await fetchPracticeClones();
      }



    } catch (error) {
      console.log(`Error checking for missing files: ${error.message}`);
    } finally {
      setLoadingMissingFiles(false);
    }
  };

  const fetchProgramSettings = async () => {
    try {
      const settings = await apiService.get('/program-settings');
      setProgramSettings(settings);
    } catch (error) {
      console.error('Error fetching program settings:', error);
    }
  };

  // Fettch existing NCBI submission files
  const fetchNCBISubmissionFiles = async () => {
    try {
      const files = await apiService.get('/ncbi/submissions');
      setNCBISubmissionFiles(files);
    } catch (error) {
      console.error('Error fetching NCBI submission files:', error);
    }
  };


  // Update your useEffect to fetch both normal and practice clones
  useEffect(() => {
    fetchUploadedFiles();
    fetchStudents();
    fetchPracticeClones();
    fetchProgramSettings();
    fetchNCBISubmissionFiles();
  }, []);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchFilters]);

  // Check for missing files on component mount
  useEffect(() => {
    checkMissingFiles();
  }, []);

  const openPracticeAnswersModal = (practiceClone) => {
    setSelectedPracticeClone(practiceClone);
    setShowPracticeAnswersModal(true);
  };

  // Add this function to get clones ready for NCBI submission
  const getClonesReadyForNCBI = () => {
    return uploadedFiles.filter(file =>
      file.status === CLONE_STATUSES.TO_BE_SUBMITTED_NCBI &&
      file.assignedTo // Only assigned files
    );
  };

  // Toggle selection for NCBI submission
  const toggleNCBISelection = (fileId) => {
    setSelectedForNCBI(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all ready for NCBI
  const selectAllForNCBI = () => {
    const readyClones = getClonesReadyForNCBI();
    setSelectedForNCBI(new Set(readyClones.map(f => f.id)));
  };

  // Clear NCBI selection
  const clearNCBISelection = () => {
    setSelectedForNCBI(new Set());
  };

  // Submit to NCBI
  const submitToNCBI = async (submissionData) => {
    setNCBISubmissionInProgress(true);
    try {
      const fileIds = Array.from(selectedForNCBI);

      const response = await apiService.post('/ncbi/submit', {
        fileIds,
        submitterInfo: submissionData
      });

      // Update local state for successfully submitted files
      if (response.successful && response.successful.length > 0) {
        setUploadedFiles(prev => prev.map(file =>
          response.successful.includes(file.id)
            ? { ...file, status: CLONE_STATUSES.SUBMITTED_TO_NCBI }
            : file
        ));
      }

      // Return response to modal - DON'T clear selection here
      return response;

    } catch (error) {
      console.error('Error submitting to NCBI:', error);
      return {
        success: false,
        error: error.message || 'Failed to submit to NCBI'
      };
    } finally {
      setNCBISubmissionInProgress(false);
    }
  };

  // Functions for bulk upload modal for missing files
  const handleBulkFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    const ab1Files = files.filter(file => file.name.toLowerCase().endsWith('.ab1'));

    if (ab1Files.length !== files.length) {
      alert(`Only .ab1 files are allowed. ${files.length - ab1Files.length} files were filtered out.`);
    }

    setBulkUploadFiles(ab1Files);

    // Get suggestions for auto-matching
    if (ab1Files.length > 0) {
      try {
        const filenames = ab1Files.map(f => f.name);
        const suggestionData = await apiService.post('/practice-clones/suggest-matches', { filenames });
        setSuggestions(suggestionData);
      } catch (error) {
        console.error('Error getting suggestions:', error);
      }
    }
  };

  const handleManualMatch = (filename, cloneId) => {
    setManualMatches(prev => ({
      ...prev,
      [filename]: cloneId
    }));
  };

  const removeManualMatch = (filename) => {
    setManualMatches(prev => {
      const updated = { ...prev };
      delete updated[filename];
      return updated;
    });
  };

  const handleBulkUpload = async () => {
    if (bulkUploadFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setUploadProgress({ status: 'uploading', current: 0, total: bulkUploadFiles.length });

    try {
      const formData = new FormData();

      // Add all files
      bulkUploadFiles.forEach(file => {
        formData.append('files', file);
      });

      // Add manual matches
      formData.append('manualMatches', JSON.stringify(manualMatches));

      const response = await apiService.uploadFiles('/practice-clones/bulk-upload', formData);

      setBulkUploadResults(response.results);
      setUploadProgress({ status: 'completed', results: response.results });

      // Refresh the missing files list and practice clones
      await checkMissingFiles();
      await fetchPracticeClones();

    } catch (error) {
      console.error('Bulk upload error:', error);
      setUploadProgress({ status: 'error', error: error.message });
    }
  };

  const resetBulkUpload = () => {
    setBulkUploadFiles([]);
    setManualMatches({});
    setSuggestions({});
    setUploadProgress(null);
    setBulkUploadResults(null);
    setShowBulkUpload(false);
  };

  const getMatchStatus = (filename) => {
    if (manualMatches[filename]) {
      const clone = missingFiles.find(mf => mf.id === parseInt(manualMatches[filename]));
      return { type: 'manual', clone };
    }

    const autoSuggestions = suggestions[filename] || [];
    const bestMatch = autoSuggestions.find(s => s.similarity >= 60);
    if (bestMatch) {
      return { type: 'auto', suggestion: bestMatch };
    }

    return { type: 'unmatched' };
  };

  const togglePracticeCloneStatus = async (cloneId, newStatus) => {
    try {
      const updatedClone = await apiService.put(`/practice-clones/${cloneId}/status`,
        { isActive: newStatus }
      );
      setPracticeClones(prev => prev.map(clone =>
        clone.id === cloneId ? updatedClone : clone
      ));
    } catch (error) {
      console.error('Error updating practice clone status:', error);
    }
  };

  const deletePracticeClone = async (cloneId) => {
    if (window.confirm('Are you sure you want to delete this practice clone? This action cannot be undone.')) {
      try {
        await apiService.delete(`/practice-clones/${cloneId}`);
        setPracticeClones(prev => prev.filter(clone => clone.id !== cloneId));
      } catch (error) {
        console.error('Error deleting practice clone:', error);
        alert('Failed to delete practice clone');
      }
    }
  };

  // NEW: Search and filter logic
  const getFilteredFiles = () => {
    let filtered = uploadedFiles;

    // Text search across multiple fields
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(file =>
        file.cloneName.toLowerCase().includes(term) ||
        file.originalName.toLowerCase().includes(term) ||
        file.assignedTo?.name.toLowerCase().includes(term) ||
        file.assignedTo?.school?.name.toLowerCase().includes(term) ||
        file.status.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (searchFilters.status) {
      filtered = filtered.filter(file => file.status === searchFilters.status);
    }

    // Assigned student filter
    if (searchFilters.assignedStudent) {
      if (searchFilters.assignedStudent === 'unassigned') {
        filtered = filtered.filter(file => !file.assignedTo);
      } else {
        filtered = filtered.filter(file =>
          file.assignedTo?.id === parseInt(searchFilters.assignedStudent)
        );
      }
    }

    // School filter
    if (searchFilters.school) {
      filtered = filtered.filter(file =>
        file.assignedTo?.school?.name === searchFilters.school
      );
    }

    return filtered;
  };

  // NEW: Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setSearchFilters({
      status: '',
      assignedStudent: '',
      school: ''
    });
    setCurrentPage(1);
  };

  const handlePracticeCloneUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);

    try {
      const formData = new FormData();

      // Add all selected files
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const newPracticeClones = await apiService.uploadFiles('/practice-clones/upload', formData);
      setPracticeClones(prev => [...newPracticeClones, ...prev]);
      setShowPracticeUploadModal(false);
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading practice clones:', error);
      alert(error.message || 'Failed to upload practice clones');
    } finally {
      setUploadingFiles(false);
    }
  };

  // NEW: Get unique values for filter dropdowns
  const getUniqueSchools = () => {
    const schools = uploadedFiles
      .map(file => file.assignedTo?.school?.name)
      .filter(Boolean);
    return [...new Set(schools)].sort();
  };

  const getUniqueStatuses = () => {
    const statuses = uploadedFiles.map(file => file.status);
    return [...new Set(statuses)].sort();
  };

  const fetchUploadedFiles = async () => {
    try {
      const data = await apiService.get('/uploaded-files');
      setUploadedFiles(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await apiService.get('/users');
      const approvedStudents = data.filter(user =>
        user.role === 'student' && user.status === 'approved'
      );
      setStudents(approvedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchPracticeClones = async () => {
    try {
      const data = await apiService.get('/practice-clones');
      setPracticeClones(data);
    } catch (error) {
      console.error('Error fetching practice clones:', error);
    }
  };


  const getStatusColor = (status) => {
    // Validate and warn about invalid status
    validateAndWarnStatus(status, 'DirectorCloneLibrary');

    const config = getStatusConfig(status);
    return config.badgeColor;
  };

  const sortTable = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedFiles = () => {
    const filteredFiles = getFilteredFiles(); // Changed this line

    if (!sortConfig.key) return filteredFiles;

    return [...filteredFiles].sort((a, b) => {
      // rest of your existing sorting logic stays the same
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'assignedTo') {
        aVal = a.assignedTo?.name || '';
        bVal = b.assignedTo?.name || '';
      } else if (sortConfig.key === 'school') {
        aVal = a.assignedTo?.school?.name || '';
        bVal = b.assignedTo?.school?.name || '';
      }

      if (!aVal) aVal = '';
      if (!bVal) bVal = '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortConfig.direction === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  };

  // NEW: Get paginated files
  const getPaginatedFiles = () => {
    const sortedFiles = getSortedFiles();

    if (itemsPerPage === 'all') {
      return sortedFiles;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedFiles.slice(startIndex, endIndex);
  };

  // NEW: Calculate total pages
  const getTotalPages = () => {
    if (itemsPerPage === 'all') return 1;
    const filteredCount = getFilteredFiles().length; // Changed this line
    return Math.ceil(filteredCount / itemsPerPage);
  };

  // NEW: Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

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
      setUploadedFiles(prev => [...newFiles, ...prev]);
      setShowUploadModal(false);
      // Reset the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading files:', error);
      alert(error.message || 'Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const openAssignModal = (file) => {
    setFileToAssign(file);
    setStudentSearchTerm('');
    setShowAssignModal(true);
  };

  const assignFile = async (fileId, studentId) => {
    try {
      const updatedFile = await apiService.put(`/uploaded-files/${fileId}/assign`,
        { assignedToId: studentId }
      );
      setUploadedFiles(prev => prev.map(file =>
        file.id === fileId ? updatedFile : file
      ));
      setShowAssignModal(false);
      setFileToAssign(null);
      setStudentSearchTerm('');
    } catch (error) {
      console.error('Error assigning file:', error);
      alert('Failed to assign file: ' + error.message);
    }
  };

  const getFilteredStudents = () => {
    if (!studentSearchTerm.trim()) {
      return students;
    }

    const term = studentSearchTerm.toLowerCase();
    return students.filter(student =>
      student.name.toLowerCase().includes(term) ||
      student.email?.toLowerCase().includes(term) ||
      student.school?.name?.toLowerCase().includes(term)
    );
  };

  const unassignFile = (fileId) => {
    // Find the file to get student info for confirmation
    const file = uploadedFiles.find(f => f.id === fileId);

    if (!file || !file.assignedTo) {
      return;
    }

    setFileToUnassign(file);
    setShowUnassignModal(true);
  };

  const confirmUnassign = async () => {
    if (!fileToUnassign) return;

    try {
      const updatedFile = await apiService.put(`/uploaded-files/${fileToUnassign.id}/assign`,
        { assignedToId: null }
      );
      setUploadedFiles(prev => prev.map(file =>
        file.id === fileToUnassign.id ? updatedFile : file
      ));
      setShowUnassignModal(false);
      setFileToUnassign(null);
    } catch (error) {
      console.error('Error unassigning file:', error);
      alert('Failed to unassign file: ' + error.message);
    }
  };

  const updateFileStatus = async (fileId, newStatus) => {
    try {
      const updatedFile = await apiService.put(`/uploaded-files/${fileId}/status`,
        { status: newStatus }
      );
      setUploadedFiles(prev => prev.map(file =>
        file.id === fileId ? updatedFile : file
      ));
    } catch (error) {
      console.error('Error updating file status:', error);
    }
  };

  const downloadFile = async (fileId, originalName) => {
    try {
      const blob = await apiService.downloadBlob(`/uploaded-files/${fileId}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(error.message || 'Failed to download file');
    }
  };

  const downloadNCBISubmission = async (sqnFilename) => {
    try {
      const blob = await apiService.downloadBlob(`/ncbi/download/${sqnFilename}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sqnFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading NCBI submission:', error);
      alert('Failed to download NCBI submission file');
    }
  };

  const downloadPracticeClone = async (cloneId, originalName) => {
    try {
      const blob = await apiService.downloadBlob(`/practice-clones/${cloneId}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = originalName || 'practice_clone.ab1';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading practice clone:', error);
      alert(error.message || 'Failed to download practice clone');
    }
  };


  const deleteFile = async (fileId) => {
    // First, find the file to check if it's assigned
    const fileToDelete = uploadedFiles.find(file => file.id === fileId);

    // Check if the file is assigned to a student
    if (fileToDelete?.assignedTo) {
      alert(`Cannot delete this clone because it is currently assigned to ${fileToDelete.assignedTo.name} (${fileToDelete.assignedTo.school?.name || 'Unknown School'}).\n\nPlease unassign the clone first before deleting it.`);
      return; // Exit the function without deleting
    }

    // If not assigned, proceed with deletion confirmation
    if (window.confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      try {
        await apiService.delete(`/uploaded-files/${fileId}`);
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
      } catch (error) {
        console.error('Error deleting file:', error);
        alert(error.message || 'Failed to delete file');
      }
    }
  };

  const replaceFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !fileToReplace) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.ab1')) {
      alert('Please select a valid .ab1 file');
      return;
    }

    setReplacingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const updatedFile = await apiService.uploadFiles(`/uploaded-files/${fileToReplace.id}/replace`, formData);

      // Update the file in state
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileToReplace.id ? updatedFile : f
      ));

      setShowReplaceFileModal(false);
      setFileToReplace(null);
      event.target.value = '';

      alert('File replaced successfully!');
    } catch (error) {
      console.error('Error replacing file:', error);
      alert(error.message || 'Failed to replace file');
    } finally {
      setReplacingFile(false);
    }
  };

  const filteredFiles = getFilteredFiles();
  const paginatedFiles = getPaginatedFiles();
  const totalPages = getTotalPages();

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 text-center">
          <p className="text-gray-600">Loading clone library...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Clone Library</h3>
              <p className="text-sm text-gray-600 mt-1">
                {uploadMode === 'regular'
                  ? 'All uploaded DNA sequence clones and their status'
                  : 'Practice clones available to all students'
                }
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUploadMode('regular')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${uploadMode === 'regular'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Regular Clones ({uploadedFiles.length})
                </button>
                <button
                  onClick={() => setUploadMode('practice')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${uploadMode === 'practice'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Practice Clones ({practiceClones.length})
                </button>
              </div>

              {/* Upload Button */}
              <button
                onClick={() => {
                  if (uploadMode === 'regular') {
                    setShowUploadModal(true);
                  } else {
                    setShowPracticeUploadModal(true);
                  }
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                {uploadMode === 'regular' ? 'Upload Student Clones' : 'Upload Practice Clones'}
              </button>
            </div>
          </div>

          {/* NEW: Search and Filter Section */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search clones, files, students, schools, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Filters:</span>

                {/* Status Filter */}
                <select
                  value={searchFilters.status}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Statuses</option>
                  {getUniqueStatuses().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>

                {/* Student Filter */}
                <select
                  value={searchFilters.assignedStudent}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, assignedStudent: e.target.value }))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Students</option>
                  <option value="unassigned">Unassigned</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>

                {/* School Filter */}
                <select
                  value={searchFilters.school}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, school: e.target.value }))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Schools</option>
                  {getUniqueSchools().map(school => (
                    <option key={school} value={school}>{school}</option>
                  ))}
                </select>

                {/* Clear Filters Button */}
                {(searchTerm || searchFilters.status || searchFilters.assignedStudent || searchFilters.school) && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Items per page */}
              <div className="flex items-center space-x-2 ml-auto">
                <span className="text-sm text-gray-600">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
                <span className="text-sm text-gray-600">clones</span>
              </div>
            </div>

            {/* Results Summary */}
            <div className="text-sm text-gray-600">
              Showing {filteredFiles.length} of {uploadedFiles.length} clones
              {(searchTerm || searchFilters.status || searchFilters.assignedStudent || searchFilters.school) &&
                <span className="text-indigo-600"> (filtered)</span>
              }
            </div>
          </div>
        </div>
        <div className="p-6">
          {uploadMode === 'regular' ? (
            <>
              {/* NCBI Submission Section - MOVE IT HERE */}
              {getClonesReadyForNCBI().length > 0 && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Upload className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-semibold text-indigo-900">
                        NCBI Submission Queue
                      </h4>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                        {getClonesReadyForNCBI().length} ready
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedForNCBI.size > 0 && (
                        <>
                          <span className="text-sm text-indigo-700">
                            {selectedForNCBI.size} selected
                          </span>
                          <button
                            onClick={clearNCBISelection}
                            className="text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            Clear
                          </button>
                        </>
                      )}
                      <button
                        onClick={selectAllForNCBI}
                        className="px-3 py-1 text-sm bg-white border border-indigo-300 rounded hover:bg-indigo-50"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setShowNCBISubmissionModal(true)}
                        disabled={selectedForNCBI.size === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Submit to NCBI ({selectedForNCBI.size})
                      </button>
                    </div>
                  </div>

                  {/* Quick preview of ready clones */}
                  <div className="mt-3 space-y-1">
                    {getClonesReadyForNCBI().slice(0, 5).map(file => (
                      <div
                        key={file.id}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedForNCBI.has(file.id)}
                          onChange={() => toggleNCBISelection(file.id)}
                          className="rounded border-indigo-300"
                        />
                        <span className="font-mono text-indigo-900">{file.filename}</span>
                        <span className="text-indigo-600">•</span>
                        <span className="text-indigo-700">{file.assignedTo.name}</span>
                      </div>
                    ))}
                    {getClonesReadyForNCBI().length > 5 && (
                      <p className="text-sm text-indigo-600 italic">
                        + {getClonesReadyForNCBI().length - 5} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Existing NCBI Submission Files */}
              {ncbiSubmissionFiles.length > 0 && uploadMode === 'regular' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    NCBI Submission Files ({ncbiSubmissionFiles.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ncbiSubmissionFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-green-200">
                        <div>
                          <div className="font-medium text-gray-900">{file.filename}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(file.createdAt).toLocaleString()} • {(file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <button
                          onClick={() => downloadNCBISubmission(file.filename)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              selectAllForNCBI();
                            } else {
                              clearNCBISelection();
                            }
                          }}
                          checked={selectedForNCBI.size > 0 && selectedForNCBI.size === getClonesReadyForNCBI().length}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                        onClick={() => sortTable('cloneName')}
                      >
                        Clone Name {sortConfig.key === 'cloneName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                        onClick={() => sortTable('originalName')}
                      >
                        Original File {sortConfig.key === 'originalName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                        onClick={() => sortTable('assignedTo')}
                      >
                        Assigned Student {sortConfig.key === 'assignedTo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                        onClick={() => sortTable('school')}
                      >
                        School {sortConfig.key === 'school' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50"
                        onClick={() => sortTable('status')}
                      >
                        Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Progress</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFiles.map(file => (
                      <tr key={file.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {file.status === CLONE_STATUSES.TO_BE_SUBMITTED_NCBI && file.assignedTo && (
                            <input
                              type="checkbox"
                              checked={selectedForNCBI.has(file.id)}
                              onChange={() => toggleNCBISelection(file.id)}
                              className="rounded border-gray-300"
                            />
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-600">{file.cloneName}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => downloadFile(file.id, file.originalName)}
                            className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0"
                            title={`Download ${file.originalName}`}
                          >
                            {file.originalName}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {file.assignedTo ? (
                            <span className="text-green-700 font-medium">{file.assignedTo.name}</span>
                          ) : (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {file.assignedTo?.school?.name || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {file.assignedTo ? (
                            <select
                              value={file.status}
                              onChange={(e) => updateFileStatus(file.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${getStatusColor(file.status)}`}
                            >
                              {[...STATUS_DROPDOWN_OPTIONS,
                              { value: CLONE_STATUSES.TO_BE_SUBMITTED_NCBI, label: 'To be submitted to NCBI' },
                              { value: CLONE_STATUSES.SUBMITTED_TO_NCBI, label: 'Submitted to NCBI' },
                              { value: CLONE_STATUSES.UNREADABLE, label: 'Unreadable' }
                              ].map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(file.status)}`}>
                              {file.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${file.progress === 100 ? 'bg-green-600' : file.progress > 0 ? 'bg-blue-600' : 'bg-gray-400'}`}
                                style={{ width: `${file.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600">{file.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {file.assignedTo ? (
                              <button
                                onClick={() => unassignFile(file.id)}
                                className="text-orange-600 hover:text-orange-800 text-sm"
                              >
                                Unassign
                              </button>
                            ) : (
                              <button
                                onClick={() => openAssignModal(file)}
                                className="text-green-600 hover:text-green-800 text-sm"
                              >
                                Assign
                              </button>
                            )}

                            {/* REPLACE FILE BUTTON */}
                            <button
                              onClick={() => {
                                setFileToReplace(file);
                                setShowReplaceFileModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Replace ab1 file"
                            >
                              Replace
                            </button>

                            {/* ENHANCED DELETE BUTTON */}
                            <button
                              onClick={() => deleteFile(file.id)}
                              disabled={file.assignedTo} // Disable button if assigned
                              className={`p-1 ${file.assignedTo
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-red-600 hover:text-red-800'
                                }`}
                              title={
                                file.assignedTo
                                  ? `Cannot delete - assigned to ${file.assignedTo.name}`
                                  : 'Delete file'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // NEW: Practice clones table
            <div className="overflow-x-auto">
              {/* Missing Files Alert Section - Updated with debug info */}
              {(missingFiles.length > 0 || loadingMissingFiles) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    {loadingMissingFiles ? (
                      <RefreshCw className="text-blue-600 mt-1 animate-spin" size={20} />
                    ) : missingFiles.length > 0 ? (
                      <AlertTriangle className="text-yellow-600 mt-1" size={20} />
                    ) : (
                      <CheckCircle className="text-green-600 mt-1" size={20} />
                    )}
                    <div className="flex-1">
                      {loadingMissingFiles ? (
                        <div>
                          <h3 className="font-medium text-blue-900 mb-2">
                            Checking Practice Clone Files...
                          </h3>
                          <p className="text-sm text-blue-800">
                            Verifying file existence and fixing any mismatched filenames...
                          </p>
                        </div>
                      ) : missingFiles.length > 0 ? (
                        <div>
                          <h3 className="font-medium text-yellow-900 mb-2">
                            Missing Practice Clone Files Detected
                          </h3>
                          <p className="text-sm text-yellow-800 mb-3">
                            {missingFiles.length} practice clone{missingFiles.length !== 1 ? 's' : ''} {missingFiles.length === 1 ? 'is' : 'are'} missing {missingFiles.length === 1 ? 'its' : 'their'} .ab1 file{missingFiles.length !== 1 ? 's' : ''}.
                          </p>

                          {/* Missing Files List */}
                          <div className="bg-white rounded border border-yellow-300 mb-4 max-h-48 overflow-y-auto">
                            {missingFiles.map(clone => (
                              <div key={clone.id} className="flex items-center justify-between p-3 border-b border-yellow-200 last:border-b-0">
                                <div>
                                  <div className="font-medium text-gray-900">{clone.cloneName}</div>
                                  <div className="text-sm text-gray-600">
                                    Expected: {clone.filename}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Original: {clone.originalName}
                                  </div>
                                  {clone.hasAnswers && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 mt-1">
                                      <CheckCircle size={12} className="mr-1" />
                                      Has Answers
                                    </span>
                                  )}
                                </div>
                                {clone.reason && (
                                  <div className="text-sm text-red-600">{clone.reason}</div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex space-x-3">
                            <button
                              onClick={() => setShowBulkUpload(true)}
                              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                            >
                              <Upload size={16} />
                              <span>Bulk Upload Files</span>
                            </button>
                            <button
                              onClick={checkMissingFiles}
                              disabled={loadingMissingFiles}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                            >
                              <RefreshCw size={16} className={loadingMissingFiles ? 'animate-spin' : ''} />
                              <span>Re-check Files</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h3 className="font-medium text-green-900 mb-2">
                            All Practice Clone Files Found ✓
                          </h3>
                          <p className="text-sm text-green-800">
                            All practice clones have their associated .ab1 files available.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Upload Modal */}
              {showBulkUpload && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Bulk Upload Practice Clone Files</h2>
                      <button
                        onClick={resetBulkUpload}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={uploadProgress?.status === 'uploading'}
                      >
                        <X size={24} />
                      </button>
                    </div>

                    {!uploadProgress && (
                      <>
                        {/* File Selection */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select .ab1 Files
                          </label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                            <p className="text-gray-600 mb-4">
                              Choose .ab1 files that correspond to your missing practice clones
                            </p>
                            <input
                              type="file"
                              multiple
                              accept=".ab1"
                              onChange={handleBulkFileSelect}
                              className="hidden"
                              id="bulk-file-input"
                            />
                            <label
                              htmlFor="bulk-file-input"
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                            >
                              Select Files
                            </label>
                          </div>
                        </div>

                        {/* File Matching */}
                        {bulkUploadFiles.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                              File Matching ({bulkUploadFiles.length} files selected)
                            </h3>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {bulkUploadFiles.map((file, index) => {
                                const matchStatus = getMatchStatus(file.name);

                                return (
                                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900 mb-2">{file.name}</div>

                                        {/* Match Status */}
                                        {matchStatus.type === 'manual' && (
                                          <div className="flex items-center space-x-2 mb-2">
                                            <Link className="text-blue-600" size={16} />
                                            <span className="text-sm text-blue-800">
                                              Manually matched to: <strong>{matchStatus.clone?.cloneName}</strong>
                                            </span>
                                            <button
                                              onClick={() => removeManualMatch(file.name)}
                                              className="text-red-600 hover:text-red-800"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        )}

                                        {matchStatus.type === 'auto' && (
                                          <div className="flex items-center space-x-2 mb-2">
                                            <CheckCircle className="text-green-600" size={16} />
                                            <span className="text-sm text-green-800">
                                              Auto-match suggested: <strong>{matchStatus.suggestion.cloneName}</strong> ({matchStatus.suggestion.similarity}% similarity)
                                            </span>
                                          </div>
                                        )}

                                        {matchStatus.type === 'unmatched' && (
                                          <div className="flex items-center space-x-2 mb-2">
                                            <AlertTriangle className="text-yellow-600" size={16} />
                                            <span className="text-sm text-yellow-800">No automatic match found</span>
                                          </div>
                                        )}

                                        {/* Manual Match Selector */}
                                        <div className="mt-2">
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Manual Match:
                                          </label>
                                          <select
                                            value={manualMatches[file.name] || ''}
                                            onChange={(e) => handleManualMatch(file.name, e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                          >
                                            <option value="">Select a practice clone...</option>
                                            {missingFiles.map(clone => (
                                              <option key={clone.id} value={clone.id}>
                                                {clone.cloneName} (expected: {clone.filename})
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Suggestions */}
                                        {suggestions[file.name]?.length > 0 && (
                                          <div className="mt-2">
                                            <div className="text-sm font-medium text-gray-700 mb-1">Suggestions:</div>
                                            <div className="space-y-1">
                                              {suggestions[file.name].slice(0, 3).map((suggestion, suggIndex) => (
                                                <button
                                                  key={suggIndex}
                                                  onClick={() => handleManualMatch(file.name, suggestion.id)}
                                                  className="block w-full text-left px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
                                                >
                                                  {suggestion.cloneName} ({suggestion.similarity}% match)
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Upload Button */}
                            <div className="mt-6 flex justify-between">
                              <div className="text-sm text-gray-600">
                                {bulkUploadFiles.filter(f => getMatchStatus(f.name).type !== 'unmatched').length} of {bulkUploadFiles.length} files have matches
                              </div>
                              <button
                                onClick={handleBulkUpload}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                              >
                                <Upload size={16} />
                                <span>Upload Files</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Upload Progress */}
                    {uploadProgress && (
                      <div className="space-y-4">
                        {uploadProgress.status === 'uploading' && (
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <RefreshCw className="animate-spin text-blue-600" size={20} />
                              <span className="font-medium text-gray-900">Uploading files...</span>
                            </div>
                            <p className="text-sm text-gray-600">
                              This may take a moment. Please don't close this window.
                            </p>
                          </div>
                        )}

                        {uploadProgress.status === 'completed' && uploadProgress.results && (
                          <div>
                            <div className="flex items-center space-x-2 mb-4">
                              <CheckCircle className="text-green-600" size={20} />
                              <span className="font-medium text-gray-900">Upload Completed!</span>
                            </div>

                            {/* Results Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="text-lg font-semibold text-green-900">
                                  {uploadProgress.results.uploaded?.length || 0}
                                </div>
                                <div className="text-sm text-green-700">Files Uploaded</div>
                              </div>
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="text-lg font-semibold text-yellow-900">
                                  {uploadProgress.results.unmatched?.length || 0}
                                </div>
                                <div className="text-sm text-yellow-700">Unmatched</div>
                              </div>
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="text-lg font-semibold text-red-900">
                                  {uploadProgress.results.errors?.length || 0}
                                </div>
                                <div className="text-sm text-red-700">Errors</div>
                              </div>
                            </div>

                            {/* Detailed Results */}
                            {uploadProgress.results.uploaded?.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-900 mb-2">Successfully Uploaded:</h4>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                                  {uploadProgress.results.uploaded.map((item, index) => (
                                    <div key={index} className="text-sm text-green-800">
                                      ✓ {item.filename} → {item.cloneName} ({item.matchType} match)
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {uploadProgress.results.unmatched?.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-900 mb-2">Unmatched Files:</h4>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                                  {uploadProgress.results.unmatched.map((item, index) => (
                                    <div key={index} className="text-sm text-yellow-800">
                                      ⚠ {item.filename} - {item.reason}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {uploadProgress.results.errors?.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                                  {uploadProgress.results.errors.map((item, index) => (
                                    <div key={index} className="text-sm text-red-800">
                                      ✗ {item.filename} - {item.error}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <button
                              onClick={resetBulkUpload}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        )}

                        {uploadProgress.status === 'error' && (
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <AlertTriangle className="text-red-600" size={20} />
                              <span className="font-medium text-gray-900">Upload Failed</span>
                            </div>
                            <p className="text-sm text-red-600 mb-4">{uploadProgress.error}</p>
                            <button
                              onClick={() => setUploadProgress(null)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              Try Again
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Clone Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Original File</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Upload Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {practiceClones.map(clone => (
                    <tr key={clone.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-purple-600">{clone.cloneName}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => downloadPracticeClone(clone.id, clone.originalName)}
                          className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to download file"
                        >
                          {clone.originalName}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {clone.description || 'No description'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${clone.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {clone.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(clone.uploadDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openPracticeAnswersModal(clone)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                            title="Manage correct answers for this practice clone"
                          >
                            Edit Answers
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => togglePracticeCloneStatus(clone.id, !clone.isActive)}
                            className={`text-sm px-2 py-1 rounded ${clone.isActive
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                              } transition-colors`}
                          >
                            {clone.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deletePracticeClone(clone.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Delete practice clone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredFiles.length === 0 && (
            <div className="text-center py-8">
              {uploadedFiles.length === 0 ? (
                <p className="text-gray-500">No files uploaded yet. Click "Upload New Files" to get started!</p>
              ) : (
                <p className="text-gray-500">No clones match your search criteria. Try adjusting your filters.</p>
              )}
            </div>
          )}

          {/* NEW: Pagination controls */}
          {itemsPerPage !== 'all' && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredFiles.length)} to {Math.min(currentPage * itemsPerPage, filteredFiles.length)} of {filteredFiles.length} clones
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm border rounded ${currentPage === pageNum
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {uploadedFiles.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Clone Status Definitions:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <p>• <span className="text-blue-600 font-medium">Being worked on by student</span> - Student is analyzing</p>
                  <p>• <span className="text-yellow-600 font-medium">Completed, waiting review</span> - Ready for instructor review</p>
                  <p>• <span className="text-orange-600 font-medium">Needs to be reanalyzed</span> - Instructor found issues</p>
                  <p>• <span className="text-purple-600 font-medium">Corrected, waiting review</span> - Student made corrections</p>
                  <p>• <span className="text-green-600 font-medium">Reviewed and Correct</span> - Final approval received</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Upload .ab1 Files</h3>
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

      {/* Practice Clone Upload Modal */}
      {showPracticeUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Upload Practice Clones</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select practice .ab1 files
                </label>
                <input
                  type="file"
                  multiple
                  accept=".ab1"
                  onChange={handlePracticeCloneUpload}
                  disabled={uploadingFiles}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-purple-800">
                  <p className="font-medium mb-2">Practice Clone Info:</p>
                  <ul className="space-y-1">
                    <li>• Practice clones are available to all students</li>
                    <li>• Students can complete analysis and get auto-feedback</li>
                    <li>• You can set correct answers for auto-grading</li>
                    <li>• Files can be activated/deactivated as needed</li>
                  </ul>
                </div>
              </div>
              {uploadingFiles && (
                <div className="text-center py-4">
                  <p className="text-indigo-600">Uploading practice clones...</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowPracticeUploadModal(false)}
                disabled={uploadingFiles}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Practice Clone Answers Modal */}
      <DirectorPracticeAnswers
        isOpen={showPracticeAnswersModal}
        onClose={() => {
          setShowPracticeAnswersModal(false);
          setSelectedPracticeClone(null);
        }}
        practiceClone={selectedPracticeClone}
      />
      <NCBISubmissionModal
        isOpen={showNCBISubmissionModal}
        onClose={() => {
          setShowNCBISubmissionModal(false);
          setSelectedForNCBI(new Set()); // Clear selection when modal closes
        }}
        selectedCount={selectedForNCBI.size}
        onSubmit={submitToNCBI}
        isSubmitting={ncbiSubmissionInProgress}
        defaultOrganism={programSettings?.organismName || ''}
        defaultLibraryName={programSettings?.libraryName || ''}
      />

      {/* File Replacement Modal */}
      {showReplaceFileModal && fileToReplace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Replace AB1 File</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">Current Clone Info:</p>
                  <div className="text-sm text-blue-900">
                    <p><strong>Clone Name:</strong> {fileToReplace.cloneName}</p>
                    <p><strong>Current File:</strong> {fileToReplace.originalName}</p>
                    {fileToReplace.assignedTo && (
                      <p><strong>Assigned to:</strong> {fileToReplace.assignedTo.name}</p>
                    )}
                  </div>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select new .ab1 file
                </label>
                <input
                  type="file"
                  accept=".ab1"
                  onChange={replaceFile}
                  disabled={replacingFile}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-2">Important:</p>
                  <ul className="space-y-1">
                    <li>• The new file will replace the current ab1 file</li>
                    <li>• Clone metadata (name, assignment, status) will be preserved</li>
                    <li>• Only .ab1 files are accepted</li>
                    <li>• This action cannot be undone</li>
                  </ul>
                </div>
              </div>
              {replacingFile && (
                <div className="text-center py-4">
                  <p className="text-indigo-600">Replacing file...</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReplaceFileModal(false);
                  setFileToReplace(null);
                }}
                disabled={replacingFile}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Confirmation Modal */}
      {showUnassignModal && fileToUnassign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Unassignment</h3>
            </div>
            <div className="p-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-orange-900">
                  <p className="font-medium mb-3">You are about to unassign:</p>
                  <div className="space-y-2 mb-3">
                    <p><strong>Clone:</strong> {fileToUnassign.cloneName}</p>
                    <p><strong>Student:</strong> {fileToUnassign.assignedTo?.name}</p>
                    <p><strong>School:</strong> {fileToUnassign.assignedTo?.school?.name || 'Unknown School'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Warning:</p>
                    <p>This will remove the clone from the student's assignments. They will no longer be able to access or work on this clone.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowUnassignModal(false);
                  setFileToUnassign(null);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnassign}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition duration-200"
              >
                Unassign Clone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && fileToAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Clone to Student</h3>
              <p className="text-sm text-gray-600 mt-1">
                Clone: <span className="font-medium text-indigo-600">{fileToAssign.cloneName}</span>
              </p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Search Box */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or school..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                  />
                  {studentSearchTerm && (
                    <button
                      onClick={() => setStudentSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {getFilteredStudents().length} student{getFilteredStudents().length !== 1 ? 's' : ''} found
                </p>
              </div>

              {/* Student List */}
              <div className="space-y-2">
                {getFilteredStudents().length > 0 ? (
                  getFilteredStudents().map(student => (
                    <button
                      key={student.id}
                      onClick={() => assignFile(fileToAssign.id, student.id)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{student.name}</p>
                          <p className="text-sm text-gray-600">{student.email}</p>
                          {student.school && (
                            <p className="text-sm text-gray-500 mt-1">
                              <span className="font-medium">School:</span> {student.school.name}
                            </p>
                          )}
                        </div>
                        <div className="text-green-600">
                          <Plus className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No students found matching "{studentSearchTerm}"</p>
                    <p className="text-sm mt-2">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setFileToAssign(null);
                  setStudentSearchTerm('');
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DirectorCloneLibrary;