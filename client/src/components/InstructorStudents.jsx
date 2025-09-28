// components/InstructorStudents.jsx - Complete version with all functions
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Clock, CheckCircle, FileText, Eye, Search } from 'lucide-react';
import CloneReviewModal from './CloneReviewModal';
import { useDNAContext } from '../context/DNAContext';
import apiService from '../services/apiService';

// Debounce utility function
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

const InstructorStudents = () => {
    const { currentUser } = useDNAContext();
    const [allStudents, setAllStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Search functionality
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    // Table functionality
    const [studentSortConfig, setStudentSortConfig] = useState({ key: null, direction: 'asc' });

    // Expansion functionality
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [studentAssignments, setStudentAssignments] = useState({});
    const [loadingAssignments, setLoadingAssignments] = useState({});

    // Clone review modal
    const [selectedClone, setSelectedClone] = useState(null);
    const [showCloneModal, setShowCloneModal] = useState(false);

    // Debounced search
    const debouncedSetSearch = useCallback(
        debounce((query) => setDebouncedSearchQuery(query), 300),
        []
    );

    useEffect(() => {
        debouncedSetSearch(searchQuery);
    }, [searchQuery, debouncedSetSearch]);

    // Fetch students from instructor's school only
    const fetchStudents = async () => {
        if (!currentUser?.school?.id) {
            setError('No school assigned to instructor');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            console.log('=== INSTRUCTOR STUDENTS DEBUG ===');
            console.log('Current user:', currentUser.email);
            console.log('Instructor school ID:', currentUser.school.id);
            console.log('Instructor school name:', currentUser.school.name);

            // Use the same optimized endpoint as DirectorStudents
            const response = await apiService.get('/students/with-progress');
            console.log('✅ Got optimized students data:', response);

            // Filter to only students from instructor's school
            const allStudentsWithProgress = response.students || response; // Handle both response formats
            const schoolStudents = allStudentsWithProgress.filter(student =>
                student.school === currentUser.school.name
            );

            console.log('Filtered students for school:', schoolStudents.length);
            console.log('School students:', schoolStudents);

            // Enhance with additional data
            const enhancedStudents = await Promise.all(
                schoolStudents.map(async (student) => {
                    try {
                        // Get login count
                        const loginCount = await apiService.get(`/users/${student.id}/login-count`);

                        return {
                            ...student,
                            loginCount: loginCount?.count || 0,
                            completedAssignments: 0 // This would need to be calculated from research assignments
                        };
                    } catch (error) {
                        console.error('Error enhancing student data for', student.id, error);
                        return {
                            ...student,
                            loginCount: 0,
                            completedAssignments: 0
                        };
                    }
                })
            );

            setAllStudents(enhancedStudents);
            console.log('Enhanced school students loaded:', enhancedStudents.length);

        } catch (error) {
            console.error('Error fetching students:', error);
            setError('Failed to load students');
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        if (currentUser?.school?.id) {
            fetchStudents();
        }
    }, [currentUser]);

    // Memoized filtering and sorting (search only, no filters)
    const filteredAndSortedStudents = useMemo(() => {
        let studentsToSort = Array.isArray(allStudents) ? allStudents : [];

        // Apply search filter
        if (debouncedSearchQuery.trim()) {
            const query = debouncedSearchQuery.toLowerCase().trim();
            studentsToSort = studentsToSort.filter(student => {
                const name = student.name?.toLowerCase() || '';
                const email = student.email?.toLowerCase() || '';

                return name.includes(query) || email.includes(query);
            });
        }

        // Apply sorting
        if (!studentSortConfig.key) return studentsToSort;

        return [...studentsToSort].sort((a, b) => {
            let aVal = a[studentSortConfig.key];
            let bVal = b[studentSortConfig.key];

            // Handle practice progress average for sorting
            if (studentSortConfig.key === 'practiceProgress') {
                const aSum = a.practiceProgress?.reduce((sum, val) => sum + val, 0) || 0;
                const bSum = b.practiceProgress?.reduce((sum, val) => sum + val, 0) || 0;
                aVal = a.practiceProgress?.length > 0 ? aSum / a.practiceProgress.length : 0;
                bVal = b.practiceProgress?.length > 0 ? bSum / b.practiceProgress.length : 0;
            }

            if (aVal < bVal) return studentSortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return studentSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [allStudents, debouncedSearchQuery, studentSortConfig]);

    // Sort function
    const sortStudentTable = (key) => {
        let direction = 'asc';
        if (studentSortConfig.key === key && studentSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setStudentSortConfig({ key, direction });
    };

    // Assignment fetching function
    const fetchStudentAssignments = useCallback(async (studentId) => {
        if (studentAssignments[studentId]) {
            return;
        }

        setLoadingAssignments(prev => ({ ...prev, [studentId]: true }));

        try {
            // Get uploaded files (research clones) for this student
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

            setStudentAssignments(prev => ({
                ...prev,
                [studentId]: {
                    research: researchDetails,
                    practice: []
                }
            }));


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

    // Toggle function
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

    // Modal handlers
    const openCloneModal = (clone, student) => {
        setSelectedClone({ ...clone, student });
        setShowCloneModal(true);
    };

    const closeCloneModal = () => {
        setShowCloneModal(false);
        setSelectedClone(null);
    };

    // Early returns for edge cases
    if (!currentUser?.school?.id) {
        return (
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700">
                                    <strong>No school assigned.</strong> You need to be assigned to a school to view students.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 text-center">
                    <p className="text-gray-600">Loading students from {currentUser.school.name}...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Search */}
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Students from {currentUser.school.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Manage and track progress for students in your school
                            </p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mt-4 flex items-center space-x-4">
                        <div className="flex-1 max-w-md relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search students by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600">
                                {filteredAndSortedStudents.length} student{filteredAndSortedStudents.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Students Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {/* Expand Column */}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => sortStudentTable('name')}
                                        className="flex items-center space-x-1 hover:text-gray-700"
                                    >
                                        <span>Student</span>
                                        {studentSortConfig.key === 'name' && (
                                            <ChevronDown className={`w-4 h-4 ${studentSortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => sortStudentTable('loginCount')}
                                        className="flex items-center space-x-1 hover:text-gray-700"
                                    >
                                        <span>Logins</span>
                                        {studentSortConfig.key === 'loginCount' && (
                                            <ChevronDown className={`w-4 h-4 ${studentSortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => sortStudentTable('completedAssignments')}
                                        className="flex items-center space-x-1 hover:text-gray-700"
                                    >
                                        <span>Research Completed</span>
                                        {studentSortConfig.key === 'completedAssignments' && (
                                            <ChevronDown className={`w-4 h-4 ${studentSortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => sortStudentTable('createdAt')}
                                        className="flex items-center space-x-1 hover:text-gray-700"
                                    >
                                        <span>Joined</span>
                                        {studentSortConfig.key === 'createdAt' && (
                                            <ChevronDown className={`w-4 h-4 ${studentSortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => sortStudentTable('practiceProgress')}
                                        className="flex items-center space-x-1 hover:text-gray-700"
                                    >
                                        <span>Practice Progress</span>
                                        {studentSortConfig.key === 'practiceProgress' && (
                                            <ChevronDown className={`w-4 h-4 ${studentSortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />
                                        )}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndSortedStudents.map((student) => {
                                return (
                                    <React.Fragment key={student.id}>
                                        <tr className="hover:bg-gray-50">
                                            {/* Expand/Collapse Button */}
                                            <td className="px-6 py-4">
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

                                            {/* Student Info */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                                        <div className="text-sm text-gray-500">{student.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Login Count */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-900">{student.loginCount}</span>
                                            </td>

                                            {/* Research Completed */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {student.completedAssignments}/{student.researchAssignments?.length || 0}
                                                    </span>
                                                    {student.completedAssignments === student.researchAssignments?.length && student.researchAssignments?.length > 0 && (
                                                        <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                                                    )}
                                                </div>
                                            </td>

                                            {/* Joined Date */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(student.createdAt).toLocaleDateString()}
                                            </td>

                                            {/* Practice Progress */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {student.practiceCloneData?.map((practiceData, index) => {
                                                        const reviewScore = practiceData.reviewScore || 0;
                                                        const isPerfectScore = reviewScore === 100;
                                                        const progress = student.practiceProgress[index];

                                                        return (
                                                            <div key={practiceData.id} className="flex-shrink-0 min-w-[120px]">
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
                                                                            Score: <span className={isPerfectScore ? 'text-green-600 font-semibold' : 'text-gray-600'}>{reviewScore}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded Row Content */}
                                        {expandedRows.has(student.id) && (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-4 bg-gray-50">
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-gray-900">Research Assignments</h4>

                                                        {loadingAssignments[student.id] ? (
                                                            <div className="text-center py-4">
                                                                <Clock className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                                                                <p className="text-sm text-gray-500 mt-2">Loading assignments...</p>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                {studentAssignments[student.id]?.research?.map((assignment) => (
                                                                    <div key={assignment.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1">
                                                                                <h5 className="font-medium text-gray-900">{assignment.name}</h5>
                                                                                <p className="text-xs text-gray-500 mt-1">{assignment.filename}</p>
                                                                            </div>
                                                                            <div className="ml-2">
                                                                                <span className={`px-2 py-1 text-xs rounded-full ${assignment.status === 'completed' || assignment.status === 'reviewed_correct' ? 'bg-green-100 text-green-800' :
                                                                                    assignment.status === 'being_worked_on' ? 'bg-blue-100 text-blue-800' :
                                                                                        assignment.status === 'needs_reanalysis' ? 'bg-yellow-100 text-yellow-800' :
                                                                                            'bg-gray-100 text-gray-800'
                                                                                    }`}>
                                                                                    {assignment.status.replace('_', ' ')}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="text-sm text-gray-600 mb-3">
                                                                            Progress: {assignment.progress}%
                                                                            {assignment.reviewScore > 0 && (
                                                                                <span className="ml-2">• Score: {assignment.reviewScore}</span>
                                                                            )}
                                                                        </div>


                                                                        <button
                                                                            onClick={() => openCloneModal(assignment, student)}
                                                                            className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                                                                        >
                                                                            <Eye className="w-4 h-4 mr-1" />
                                                                            View Analysis
                                                                        </button>


                                                                    </div>
                                                                ))}

                                                                {(!studentAssignments[student.id]?.research || studentAssignments[student.id].research.length === 0) && (
                                                                    <div className="col-span-full text-center py-8 text-gray-500">
                                                                        No research assignments found for this student.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {filteredAndSortedStudents.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="text-gray-500">
                                            {searchQuery ? 'No students found matching your search.' : 'No students found in your school.'}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Clone Review Modal */}
            {showCloneModal && selectedClone && (
                <div style={{ zIndex: 9999, position: 'fixed', inset: 0 }}>
                    <CloneReviewModal
                        isOpen={showCloneModal}
                        onClose={closeCloneModal}
                        cloneId={selectedClone.id}
                        studentName={selectedClone.student.name}
                        studentId={selectedClone.student.id}
                        cloneType="regular"  // Since these are research clones from InstructorStudents
                    />
                </div>
            )}
        </div>
    );
};

export default InstructorStudents;