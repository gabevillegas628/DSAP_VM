// components/DirectorStudents.jsx - Enhanced with Filters and Perfect Score Styling
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Clock, CheckCircle, FileText, Eye, Search, ChevronLeft } from 'lucide-react';
import CloneReviewModal from './CloneReviewModal';
import apiService from '../services/apiService';

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// CSV export utility
const exportToCSV = (data, filename) => {
  if (!data.length) {
    alert('No student data to export');
    return;
  }

  // Define CSV headers
  const headers = [
    'Student Name',
    'Email',
    'School',
    'Instructor',
    'Login Count',
    'Creation Date',
    'Research Clones Assigned',
    'Research Clones Completed',
    'Practice Assignments Completed',
    'Academic Year',
    'Years in Program',
    'Classes Taken',
    'Age',
    'Gender',
    'Ethnicity',
    'City',
    'State',
    'Country'
  ];

  // Convert data to CSV format
  const csvContent = [
    headers.join(','),
    ...data.map(student => [
      `"${student.name || ''}"`,
      `"${student.email || ''}"`,
      `"${student.school || ''}"`,
      `"${student.instructor || ''}"`,
      student.loginCount || 0,
      student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '',
      student.researchAssignments?.length || 0,
      student.researchAssignments?.filter(a => a.status === 'completed').length || 0,
      student.completedAssignments || 0,
      `"${student.demographics?.academicYear || ''}"`,
      `"${student.demographics?.yearsInProgram || ''}"`,
      `"${student.demographics?.classesTaken ? JSON.parse(student.demographics.classesTaken).join('; ') : ''}"`,
      student.demographics?.age || '',
      `"${student.demographics?.gender || ''}"`,
      `"${student.demographics?.ethnicity || ''}"`,
      `"${student.demographics?.city || ''}"`,
      `"${student.demographics?.state || ''}"`,
      `"${student.demographics?.country || ''}"`,
    ].join(','))
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const DirectorStudents = () => {
  // Core state
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [studentSortConfig, setStudentSortConfig] = useState({ key: 'lastName', direction: 'asc' });

  // NEW: Filter state
  const [filters, setFilters] = useState({
    school: '',
    instructor: ''
  });
  //const [uniqueSchools, setUniqueSchools] = useState([]);
  //const [uniqueInstructors, setUniqueInstructors] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 50;

  // Expandable rows state (optimized)
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [studentAssignments, setStudentAssignments] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState({});

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedCloneForReview, setSelectedCloneForReview] = useState(null);
  const [reviewStudentName, setReviewStudentName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedCloneType, setSelectedCloneType] = useState('regular');

  // memoized filter states
  const [schoolExpanded, setSchoolExpanded] = useState(false);
  const [instructorExpanded, setInstructorExpanded] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [instructorSearch, setInstructorSearch] = useState('');

  // Debounced search effect
  useEffect(() => {
    const debouncedUpdate = debounce((query) => {
      setDebouncedSearchQuery(query);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    debouncedUpdate(searchQuery);

    return () => clearTimeout(debouncedUpdate);
  }, [searchQuery]);

  // SUPER OPTIMIZED: Single API call fetching
  useEffect(() => {
    fetchStudentsWithProgress();
  }, []);

  // NEW: Extract unique schools and instructors for filter dropdowns - FIXED
  const uniqueSchools = useMemo(() => {
    if (!Array.isArray(allStudents) || allStudents.length === 0) return [];
    return [...new Set(allStudents.map(s => s.school).filter(Boolean))].sort();
  }, [allStudents]);

  const uniqueInstructors = useMemo(() => {
    if (!Array.isArray(allStudents) || allStudents.length === 0) return [];
    return [...new Set(allStudents.map(s => s.instructor).filter(Boolean))].sort();
  }, [allStudents]);


  const filteredSchoolsForDisplay = useMemo(() => {
    if (!schoolSearch) return uniqueSchools;
    return uniqueSchools.filter(school =>
      school.toLowerCase().includes(schoolSearch.toLowerCase())
    );
  }, [uniqueSchools, schoolSearch]);

  const filteredInstructorsForDisplay = useMemo(() => {
    if (!instructorSearch) return uniqueInstructors;
    return uniqueInstructors.filter(instructor =>
      instructor.toLowerCase().includes(instructorSearch.toLowerCase())
    );
  }, [uniqueInstructors, instructorSearch]);

  // Handle CSV export
  // Handle CSV export
  const handleExportCSV = async () => {
    try {
      // Show loading state
      const button = document.querySelector('[data-export-button]');
      if (button) {
        button.disabled = true;
        button.textContent = 'Generating Report...';
      }

      // Fetch complete export data
      console.log('Fetching complete student export data...');
      const response = await apiService.get('/students/export-data');
      const completeStudentData = response;

      if (!Array.isArray(completeStudentData) || completeStudentData.length === 0) {
        alert('No student data available for export');
        return;
      }

      // Apply same filters as current view
      let studentsToExport = completeStudentData;

      // Apply search filter
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase().trim();
        studentsToExport = studentsToExport.filter(student => {
          const name = student.name?.toLowerCase() || '';
          const email = student.email?.toLowerCase() || '';
          const school = student.school?.toLowerCase() || '';
          const instructor = student.instructor?.toLowerCase() || '';

          return name.includes(query) ||
            email.includes(query) ||
            school.includes(query) ||
            instructor.includes(query);
        });
      }

      // Apply school filter
      if (filters.school) {
        studentsToExport = studentsToExport.filter(student => student.school === filters.school);
      }

      // Apply instructor filter  
      if (filters.instructor) {
        studentsToExport = studentsToExport.filter(student => student.instructor === filters.instructor);
      }

      if (studentsToExport.length === 0) {
        alert('No students match the current filters.');
        return;
      }

      // Generate filename with current date and filters
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `student-report-${timestamp}`;

      if (filters.school && filters.school !== '') {
        filename += `-${filters.school.replace(/[^a-zA-Z0-9]/g, '-')}`;
      }
      if (filters.instructor && filters.instructor !== '') {
        filename += `-${filters.instructor.replace(/[^a-zA-Z0-9]/g, '-')}`;
      }

      filename += '.csv';

      console.log(`Exporting ${studentsToExport.length} students to ${filename}`);
      exportToCSV(studentsToExport, filename);

    } catch (error) {
      console.error('Error generating export:', error);
      alert('Failed to generate student report. Please try again.');
    } finally {
      // Reset button state
      const button = document.querySelector('[data-export-button]');
      if (button) {
        button.disabled = false;
        button.textContent = 'Generate Student Report';
      }
    }
  };


  const fetchStudentsWithProgress = async () => {
    try {
      setLoading(true);
      setError('');

      //console.log('=== USING OPTIMIZED STUDENTS ENDPOINT (3 DB queries total) ===');

      const response = await apiService.get('/students/with-progress');
      //console.log('✅ Optimized endpoint response:', response);

      // Handle the correct response format: { students: [...], metadata: {...} }
      const studentsWithProgress = response.students;

      if (!Array.isArray(studentsWithProgress)) {
        throw new Error('Invalid students array in response');
      }

      //console.log(`✅ Loaded ${studentsWithProgress.length} students with only 3 database queries`);
      if (response.metadata) {
        //console.log('📊 Metadata:', response.metadata);
      }

      setAllStudents(studentsWithProgress);

    } catch (error) {
      console.error('❌ Optimized endpoint failed:', error);
      setError(`Failed to load students: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Separate function to fetch practice progress (non-blocking)
  const fetchPracticeProgressForAllStudents = async (students, practiceClones) => {
    try {
      const updatedStudents = await Promise.all(
        students.map(async (student) => {
          const practiceProgress = [];
          const practiceCloneData = [];

          // Fetch progress for each practice clone
          for (const clone of practiceClones) {
            try {
              const progressData = await apiService.get(`/practice-clones/${clone.id}/progress/${student.id}`);
              practiceProgress.push(progressData.progress || 0);
              practiceCloneData.push({
                id: clone.id,
                name: clone.cloneName,
                progress: progressData.progress || 0
              });
            } catch (error) {
              // If no progress, use 0
              practiceProgress.push(0);
              practiceCloneData.push({
                id: clone.id,
                name: clone.cloneName,
                progress: 0
              });
            }
          }

          return {
            ...student,
            practiceProgress,
            practiceCloneData
          };
        })
      );

      //console.log('✅ Updated all students with practice progress');
      setAllStudents(updatedStudents);
    } catch (error) {
      console.log('⚠️ Failed to fetch practice progress, keeping basic data:', error);
    }
  };

  // ENHANCED: Memoized filtering and sorting with new filters
  // ENHANCED: Memoized filtering and sorting with new filters - FIXED
  const filteredAndSortedStudents = useMemo(() => {
    // Ensure we always start with an array
    let studentsToSort = Array.isArray(allStudents) ? allStudents : [];

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      studentsToSort = studentsToSort.filter(student => {
        const name = student.name?.toLowerCase() || '';
        const email = student.email?.toLowerCase() || '';
        const school = student.school?.toLowerCase() || '';
        const instructor = student.instructor?.toLowerCase() || '';

        return name.includes(query) ||
          email.includes(query) ||
          school.includes(query) ||
          instructor.includes(query);
      });
    }

    // Apply school filter
    if (filters.school) {
      studentsToSort = studentsToSort.filter(student => student.school === filters.school);
    }

    // Apply instructor filter  
    if (filters.instructor) {
      studentsToSort = studentsToSort.filter(student => student.instructor === filters.instructor);
    }

    // Apply sorting - ALWAYS sort (remove the early return)
    return [...studentsToSort].sort((a, b) => {
      let aVal, bVal;

      // Handle different sort keys
      if (studentSortConfig.key === 'lastName') {
        // Extract last name from full name
        const aNameParts = (a.name || '').trim().split(' ');
        const bNameParts = (b.name || '').trim().split(' ');
        aVal = aNameParts[aNameParts.length - 1].toLowerCase();
        bVal = bNameParts[bNameParts.length - 1].toLowerCase();
      } else if (studentSortConfig.key === 'practiceProgress') {
        // Handle practice progress average for sorting
        const aSum = a.practiceProgress.reduce((sum, val) => sum + val, 0);
        const bSum = b.practiceProgress.reduce((sum, val) => sum + val, 0);
        aVal = a.practiceProgress.length > 0 ? aSum / a.practiceProgress.length : 0;
        bVal = b.practiceProgress.length > 0 ? bSum / b.practiceProgress.length : 0;
      } else {
        // Default to the property value
        aVal = a[studentSortConfig.key];
        bVal = b[studentSortConfig.key];
      }

      if (aVal < bVal) return studentSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return studentSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allStudents, debouncedSearchQuery, studentSortConfig, filters]);

  // FIXED: Pagination logic with proper array validation
  const totalPages = Math.ceil(filteredAndSortedStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    // Ensure we have an array before calling slice
    if (!Array.isArray(filteredAndSortedStudents)) {
      return [];
    }

    const start = (currentPage - 1) * STUDENTS_PER_PAGE;
    return filteredAndSortedStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredAndSortedStudents, currentPage]);

  // ENHANCED: Memoized assignment fetching with practice scores
  const fetchStudentAssignments = useCallback(async (studentId) => {
    // Don't refetch if already loaded
    if (studentAssignments[studentId]) {
      return;
    }

    setLoadingAssignments(prev => ({ ...prev, [studentId]: true }));

    try {
      // Get uploaded files (research clones)
      const allUploadedFiles = await apiService.get('/uploaded-files');
      const studentAssignedFiles = allUploadedFiles.filter(file =>
        file.assignedTo?.id === studentId
      );

      const researchDetails = studentAssignedFiles.map(file => ({
        id: file.id,
        name: file.cloneName || file.filename,
        filename: file.originalName || file.filename,
        progress: file.progress || 0,
        status: file.status,
        lastUpdated: file.lastUpdated,
        reviewScore: file.reviewScore || 0,
        type: 'research'
      }));

      // IMPORTANT: Also fetch practice progress with scores
      try {
        const practiceProgress = await apiService.get(`/practice-submissions?userId=${studentId}`);
        const practiceDetails = practiceProgress.map(progress => ({
          id: progress.id,
          name: progress.cloneName,
          progress: progress.progress || 0,
          status: progress.status,
          reviewScore: progress.reviewScore || 0,
          type: 'practice'
        }));

        setStudentAssignments(prev => ({
          ...prev,
          [studentId]: {
            research: researchDetails,
            practice: practiceDetails
          }
        }));
      } catch (practiceError) {
        //console.log('No practice submissions found for student');
        setStudentAssignments(prev => ({
          ...prev,
          [studentId]: {
            research: researchDetails,
            practice: []
          }
        }));
      }

      //console.log(`Found assignments for student ${studentId}`);

    } catch (error) {
      console.error('Error fetching student assignments:', error);
      setStudentAssignments(prev => ({
        ...prev,
        [studentId]: { research: [], practice: [] }
      }));
    } finally {
      setLoadingAssignments(prev => ({ ...prev, [studentId]: false }));
    }
  }, [studentAssignments]);

  // OPTIMIZATION: Memoized toggle function
  const toggleRowExpansion = useCallback((studentId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
        fetchStudentAssignments(studentId);
      }
      return newSet;
    });
  }, [fetchStudentAssignments]);

  // OPTIMIZATION: Memoized sort function
  const sortStudentTable = useCallback((key) => {
    setStudentSortConfig(prev => {
      let direction = 'asc';
      if (prev.key === key && prev.direction === 'asc') {
        direction = 'desc';
      }
      return { key, direction };
    });
  }, []);

  // Modal handlers
  const openReviewModal = (cloneId, cloneType, studentName, studentId) => {
    setSelectedCloneForReview(cloneId);
    setSelectedCloneType(cloneType);
    setReviewStudentName(studentName);
    setSelectedStudentId(studentId);
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedCloneForReview(null);
    setSelectedCloneType('regular');
    setReviewStudentName('');
    setSelectedStudentId(null);
  };

  const getSortIcon = (columnKey) => {
    if (studentSortConfig.key !== columnKey) {
      return <ChevronDown className="w-4 h-4 text-gray-400" />;
    }
    return studentSortConfig.direction === 'asc' ?
      <ChevronDown className="w-4 h-4 text-indigo-600" /> :
      <ChevronDown className="w-4 h-4 text-indigo-600 transform rotate-180" />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading students and their progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchStudentsWithProgress}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Student Management</h2>
              <p className="text-sm text-gray-600">
                Monitor student progress and review submissions
              </p>
            </div>
            <div className="text-sm text-gray-600">
              {filteredAndSortedStudents.length} of {allStudents.length} students
            </div>
          </div>

          {/* Single Row Layout: Search, Filters, Clear Button, Export Button */}
          <div className="flex items-center gap-4 mb-6">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search students, emails, schools, or instructors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* School Filter */}
            <div className="w-48 relative">
              <button
                onClick={() => setSchoolExpanded(!schoolExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <span className={filters.school ? 'text-gray-900' : 'text-gray-500'}>
                  {filters.school || 'All Schools'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${schoolExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* School Dropdown Options */}
              {schoolExpanded && (
                <div className="absolute top-full left-0 w-64 border rounded-lg bg-white shadow-lg z-50 mt-1">
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search schools..."
                        value={schoolSearch}
                        onChange={(e) => setSchoolSearch(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded pl-10 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <button
                      onClick={() => {
                        setFilters(prev => ({ ...prev, school: '' }));
                        setSchoolSearch('');
                        setSchoolExpanded(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${!filters.school ? 'bg-indigo-50 text-indigo-800 font-medium border-l-4 border-indigo-500' : ''}`}
                    >
                      All Schools
                    </button>
                    {filteredSchoolsForDisplay.map(school => (
                      <button
                        key={school}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, school }));
                          setSchoolSearch('');
                          setSchoolExpanded(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${filters.school === school ? 'bg-indigo-50 text-indigo-800 font-medium border-l-4 border-indigo-500' : ''}`}
                      >
                        {school}
                      </button>
                    ))}
                    {filteredSchoolsForDisplay.length === 0 && schoolSearch && (
                      <div className="px-4 py-2 text-sm text-gray-500 italic">No schools found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Instructor Filter */}
            <div className="w-48 relative">
              <button
                onClick={() => setInstructorExpanded(!instructorExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <span className={filters.instructor ? 'text-gray-900' : 'text-gray-500'}>
                  {filters.instructor || 'All Instructors'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${instructorExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Instructor Dropdown Options */}
              {instructorExpanded && (
                <div className="absolute top-full left-0 w-64 border rounded-lg bg-white shadow-lg z-50 mt-1">
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search instructors..."
                        value={instructorSearch}
                        onChange={(e) => setInstructorSearch(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded pl-10 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <button
                      onClick={() => {
                        setFilters(prev => ({ ...prev, instructor: '' }));
                        setInstructorSearch('');
                        setInstructorExpanded(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${!filters.instructor ? 'bg-indigo-50 text-indigo-800 font-medium border-l-4 border-indigo-500' : ''}`}
                    >
                      All Instructors
                    </button>
                    {filteredInstructorsForDisplay.map(instructor => (
                      <button
                        key={instructor}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, instructor }));
                          setInstructorSearch('');
                          setInstructorExpanded(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${filters.instructor === instructor ? 'bg-indigo-50 text-indigo-800 font-medium border-l-4 border-indigo-500' : ''}`}
                      >
                        {instructor}
                      </button>
                    ))}
                    {filteredInstructorsForDisplay.length === 0 && instructorSearch && (
                      <div className="px-4 py-2 text-sm text-gray-500 italic">No instructors found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Filters Button */}
            {(filters.school || filters.instructor) && (
              <button
                onClick={() => {
                  setFilters({ school: '', instructor: '' });
                  setSchoolSearch('');
                  setInstructorSearch('');
                  setSchoolExpanded(false);
                  setInstructorExpanded(false);
                  setSearchQuery('');
                }}
                className="whitespace-nowrap text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}

            {/* Spacer to push export button to the right */}
            <div className="flex-1"></div>

            {/* Export Button */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                {filteredAndSortedStudents.length} student{filteredAndSortedStudents.length !== 1 ? 's' : ''}
                {(filters.school || filters.instructor || debouncedSearchQuery) && ' (filtered)'}
              </span>
              <button
                onClick={handleExportCSV}
                data-export-button
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200 whitespace-nowrap"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate Student Report
              </button>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th
                  className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortStudentTable('lastName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Student</span>
                    {getSortIcon('lastName')}
                  </div>
                </th>
                <th
                  className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortStudentTable('school')}
                >
                  <div className="flex items-center space-x-1">
                    <span>School</span>
                    {getSortIcon('school')}
                  </div>
                </th>
                <th
                  className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortStudentTable('instructor')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Instructor</span>
                    {getSortIcon('instructor')}
                  </div>
                </th>
                <th
                  className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortStudentTable('practiceProgress')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Practice Progress</span>
                    {getSortIcon('practiceProgress')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedStudents.map((student) => (
                <React.Fragment key={student.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleRowExpansion(student.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label={`${expandedRows.has(student.id) ? 'Collapse' : 'Expand'} details for ${student.name}`}
                      >
                        {expandedRows.has(student.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {student.school}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className={student.instructor === 'Unassigned' ? 'text-yellow-600 font-medium' : ''}>
                        {student.instructor}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {/* ENHANCED: Progress Bars with Perfect Score Styling - HORIZONTAL LAYOUT */}
                      <div className="flex flex-wrap gap-2"> {/* Changed from space-y-2 to horizontal flex */}
                        {student.practiceCloneData.map((practiceData, index) => {
                          // Use reviewScore directly from the optimized endpoint data
                          const reviewScore = practiceData.reviewScore || 0;
                          const isPerfectScore = reviewScore === 100;
                          const progress = student.practiceProgress[index];

                          return (
                            <div key={practiceData.id} className="flex-shrink-0 min-w-[120px]"> {/* Fixed width for consistency */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-medium text-gray-700 truncate" title={practiceData.name}>
                                    {practiceData.name.length > 8 ? practiceData.name.substring(0, 8) + '...' : practiceData.name}
                                  </span>
                                  <div className="flex items-center space-x-1">
                                    <span className={`text-xs ${isPerfectScore ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>
                                      {progress}%
                                    </span>
                                    {isPerfectScore && (
                                      <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded-full font-medium">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className={`w-full rounded-full h-2 ${isPerfectScore ? 'bg-green-200' : 'bg-gray-200'}`}>
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${isPerfectScore
                                      ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-sm'
                                      : 'bg-blue-500'
                                      }`}
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                                {reviewScore > 0 && (
                                  <div className="text-xs text-gray-500">
                                    Score: <span className={isPerfectScore ? 'text-green-600 font-semibold' : ''}>{reviewScore}/100</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {student.practiceCloneData.length === 0 && (
                          <span className="text-xs text-gray-500">No practice clones available</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row Content */}
                  {expandedRows.has(student.id) && (
                    <tr>
                      <td colSpan={5} className="py-4 px-6 bg-gray-50">
                        {loadingAssignments[student.id] ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">Loading assignments...</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">Student Details & Assignments</h4>

                            {/* Research Assignments */}
                            {studentAssignments[student.id]?.research?.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 mb-2">Research Clone Assignments</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {studentAssignments[student.id].research.map((assignment) => (
                                    <div key={assignment.id} className="border rounded-lg p-3 bg-white">
                                      <div className="flex justify-between items-start mb-2">
                                        <h6 className="font-medium text-gray-900 text-sm">{assignment.name}</h6>
                                        <button
                                          onClick={() => openReviewModal(assignment.id, 'regular', student.name, student.id)}
                                          className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                          title="Review submission"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-gray-600">
                                          <span>Progress: {assignment.progress}%</span>
                                          <span className={`px-2 py-1 rounded text-xs ${assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            assignment.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                            {assignment.status}
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${assignment.progress}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* No assignments message */}
                            {(!studentAssignments[student.id]?.research?.length) && (
                              <div className="text-center py-4">
                                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600">No research assignments found for this student</p>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * STUDENTS_PER_PAGE) + 1} to {Math.min(currentPage * STUDENTS_PER_PAGE, filteredAndSortedStudents.length)} of {filteredAndSortedStudents.length} students
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded ${pageNum === currentPage
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-4 h-4 transform rotate-[-90deg]" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <CloneReviewModal
        isOpen={reviewModalOpen}
        onClose={closeReviewModal}
        cloneId={selectedCloneForReview}
        cloneType={selectedCloneType}
        studentName={reviewStudentName}
        studentId={selectedStudentId}
      />
    </div>
  );
};

export default DirectorStudents;