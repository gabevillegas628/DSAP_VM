import React, { useState, useEffect } from 'react';
import {
    FileText,
    CheckCircle,
    XCircle,
    MessageCircle,
    MessageSquare,
    Eye,
    Download,
    BarChart3,
    User,
    School,
    Clock,
    AlertTriangle,
    AlertCircle,
    Save,
    Send,
    Star,
    Award,
    ChevronDown,
    ChevronRight,
    ChevronUp
} from 'lucide-react';

import { CheckCircle2 } from 'lucide-react';
import ChromatogramViewer from './ChromatogramViewer';
import SequenceAlignmentModal from './SequenceAlignmentModal.jsx';
import { useDNAContext } from '../context/DNAContext';
import apiService from '../services/apiService';

// Add these imports after your existing imports
import {
    CLONE_STATUSES,
    getReviewStatus,
    REVIEW_ACTION_MAP,
    isValidStatusTransition,
    validateAndWarnStatus
} from '../statusConstraints.js';

const animationStyles = `
  .section-content {
    overflow: hidden;
    transition: max-height 0.6s ease-in-out, opacity 0.5s ease-in-out;
  }
  .section-content.expanded {
    max-height: 600px;
    opacity: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .section-content.collapsed {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
  }
  
  /* Custom scrollbar styling */
  .section-content.expanded::-webkit-scrollbar {
    width: 8px;
  }
  .section-content.expanded::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  .section-content.expanded::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  .section-content.expanded::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`;

// Add the styles to the document head
if (typeof document !== 'undefined' && !document.querySelector('#section-animation-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'section-animation-styles';
    styleSheet.textContent = animationStyles;
    document.head.appendChild(styleSheet);
}


const analysisSteps = [
    {
        id: 'clone-editing',
        name: 'Clone Editing',
        description: 'Quality check and sequence preparation',
        icon: '🔬',
        color: 'blue'
    },
    {
        id: 'blast',
        name: 'BLAST Analysis',
        description: 'Database search and identification',
        icon: '🎯',
        color: 'green'
    },
    {
        id: 'analysis-submission',
        name: 'Analysis & Submission',
        description: 'Final analysis and results',
        icon: '📊',
        color: 'purple'
    },
    {
        id: 'review',
        name: 'Review',
        description: 'Instructor feedback and corrections',
        icon: '✅',
        color: 'orange'
    }
];

const InstructorAnalysisReview = ({ onReviewCompleted }) => {
    const [submissions, setSubmissions] = useState([]);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('submitted');
    const [reviewData, setReviewData] = useState({});
    const [saving, setSaving] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [analysisQuestions, setAnalysisQuestions] = useState([]);
    const [expandedAnswers, setExpandedAnswers] = useState(new Set());
    const [expandedSections, setExpandedSections] = useState(new Set()); // Start with all sections closed
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [currentViewingSection, setCurrentViewingSection] = useState('blast');
    const [cloneTypeFilter, setCloneTypeFilter] = useState('all'); // 'all', 'practice', 'regular'
    const [commonFeedbackOptions, setCommonFeedbackOptions] = useState([]);
    const [practiceAnswers, setPracticeAnswers] = useState([]); // New state for practice answers
    const [showChromatogram, setShowChromatogram] = useState(false);
    const [chromatogramData, setChromatogramData] = useState(null);
    const [loadingChromatogram, setLoadingChromatogram] = useState(false);
    const [blastCache, setBlastCache] = useState({});
    const [loadingBlastResults, setLoadingBlastResults] = useState({});
    //const [selectedBlastProgram, setSelectedBlastProgram] = useState('blastn');
    //const [selectedSourceSequence, setSelectedSourceSequence] = useState('');
    //const [selectedDatabase, setSelectedDatabase] = useState('auto');
    const [blastParams, setBlastParams] = useState({}); // Store params per question ID
    const [showSequenceModal, setShowSequenceModal] = useState(false);
    const [selectedSequenceData, setSelectedSequenceData] = useState(null);
    const [sendingMessages, setSendingMessages] = useState(false);

    const { currentUser } = useDNAContext(); // ADD THIS LINE


    useEffect(() => {
        if (currentUser?.school?.id) {
            fetchSubmissions();
            fetchAnalysisQuestions();
        }
    }, [currentUser?.school?.id]); // Add dependency on school

    useEffect(() => {
        const loadCommonFeedback = async () => {
            try {
                const feedback = await apiService.get('/common-feedback');
                setCommonFeedbackOptions(feedback);
            } catch (error) {
                console.error('Error loading common feedback:', error);
            }
        };

        loadCommonFeedback();
    }, []);

    if (!currentUser?.school?.id) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
                    <div>
                        <h3 className="text-sm font-medium text-yellow-800">School Assignment Required</h3>
                        <p className="mt-2 text-sm text-yellow-700">
                            You need to be assigned to a school before you can review analyses.
                        </p>
                    </div>
                </div>
            </div>
        );
    }


    // Add these functions after your existing functions like submitReview, downloadFile, etc.

    // Add this helper function to extract edited sequence
    const getEditedSequenceFromAnswers = (answers, analysisQuestions) => {
        // Find the clone-editing step questions that are textareas or sequence types
        const editingQuestions = analysisQuestions.filter(q =>
            q.step === 'clone-editing' && (q.type === 'dna_sequence' || q.type === 'protein_sequence')
        );

        // Look for sequence-like content (likely the longest textarea with DNA characters)
        for (const question of editingQuestions) {
            const answer = answers[question.id];
            if (answer && typeof answer === 'string') {
                // Basic validation for DNA sequence (contains A, T, G, C)
                const cleanSequence = answer.replace(/\s/g, '').toUpperCase();
                if (/^[ATGCNRYSWKMBDHV\-]+$/.test(cleanSequence) && cleanSequence.length > 50) {
                    return cleanSequence;
                }
            }
        }
        return null;
    };

    const checkForExistingDiscussion = async (studentId, cloneId) => {
        try {
            const result = await apiService.get(`/messages/check-discussion/${studentId}/${cloneId}`);
            return result.exists;
        } catch (error) {
            console.error('Error checking for existing discussion:', error);
            return false; // Assume no discussion if check fails
        }
    };

    const createInitialFeedbackThread = async (submission) => {
        try {
            // Create an initial message to establish the thread (similar to MessageModal's approach)
            const initialMessage = {
                senderId: submission.assignedTo.id, // Send FROM the student (like MessageModal does)
                subject: `Review Feedback: ${submission.cloneName}`,
                content: `Review completed for ${submission.cloneName}. Individual question feedback follows below.`,
                cloneId: submission.id,
                cloneType: submission.type || 'regular',
                // Add context about the submission
                ...(submission.progress ? { cloneProgress: submission.progress } : {}),
                ...(submission.currentStep ? { currentStep: submission.currentStep } : {})
            };

            // Use the same endpoint that MessageModal uses for establishing threads
            // This will automatically create a group message to all directors
            await apiService.post('/messages/support', initialMessage);
            console.log('Initial feedback thread created successfully and sent to all directors');

            // Small delay to ensure the thread is established before sending individual messages
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error('Error creating initial feedback thread:', error);
            throw error;
        }
    };

    const sendQuestionCommentsAsMessages = async (submission, questionComments) => {
        if (!questionComments || questionComments.length === 0) return;

        // Filter to only send feedback that is marked as visible
        const visibleComments = questionComments.filter(comment =>
            comment.feedback &&
            comment.feedback.trim() !== '' &&
            comment.feedbackVisible === true
        );

        if (visibleComments.length === 0) {
            console.log('No visible feedback to send');
            return;
        }

        try {
            const discussion = await apiService.get(`/clone-discussions/${submission.assignedTo.id}/${submission.id}`);

            await apiService.post(`/clone-discussions/${discussion.id}/messages`, {
                senderId: currentUser.id,
                content: `🔍 **Review Feedback Completed** - Individual question feedback follows below:`,
                messageType: 'feedback'
            });

            for (const comment of visibleComments) {
                const question = analysisQuestions.find(q => q.id === comment.questionId);
                const questionIndex = analysisQuestions.findIndex(q => q.id === comment.questionId);
                const questionNumber = questionIndex >= 0 ? questionIndex + 1 : '?';
                const questionText = question ? question.text : `Question ${comment.questionId}`;

                const feedbackContent = `**Q${questionNumber} Feedback:** ${questionText.substring(0, 80)}${questionText.length > 80 ? '...' : ''}

📋 **Your Answer:** _Please see your analysis for details_

💬 **Instructor Feedback:** ${comment.feedback}`;

                await apiService.post(`/clone-discussions/${discussion.id}/messages`, {
                    senderId: currentUser.id,
                    content: feedbackContent,
                    messageType: 'feedback'
                });
            }
        } catch (error) {
            console.error('Error sending feedback to discussion:', error);
            throw error;
        }
    };

    const openSequenceAlignment = (question, answer) => {
        setSelectedSequenceData({
            studentSequence: answer,
            questionText: question.text,
            sequenceType: question.type
        });
        setShowSequenceModal(true);
    };

    // Add BLAST results fetching functions
    const getBlastResults = async (submission, questionId, sequence) => {
        const cacheKey = `${submission.id}_${questionId}`;

        // Check local state cache first
        if (blastCache[cacheKey]) {
            return blastCache[cacheKey];
        }

        // Check if already loading
        if (loadingBlastResults[cacheKey]) {
            return null;
        }

        setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: true }));

        try {
            const response = await apiService.post(`/blast-search/${submission.id}/${questionId}`, {
                sequence: sequence
            });

            setBlastCache(prev => ({ ...prev, [cacheKey]: response }));
            console.log('Fetched BLAST results for', cacheKey, response);
            return response;

        } catch (error) {
            console.error('BLAST search failed:', error);
            return null;
        } finally {
            setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
        }
    };

    const getAppropriateDatabase = (program, requestedDatabase) => {
        if (requestedDatabase && requestedDatabase !== 'auto') {
            return requestedDatabase;
        }

        switch (program.toLowerCase()) {
            case 'blastn':
                return 'nt';
            case 'blastx':
            case 'blastp':
            case 'tblastn':
                return 'ClusteredNR';
            case 'tblastx':
                return 'nt';
            default:
                return 'nt';
        }
    };

    // Helper function to get all textarea questions from Clone Editing and BLAST analysis sections
    const getSequenceSourceOptions = () => {
        return analysisQuestions.filter(q =>
            (q.type === 'dna_sequence' || q.type === 'protein_sequence') &&
            (q.step === 'clone-editing' || q.step === 'blast')
        ).map(q => ({
            id: q.id,
            label: `${q.step === 'clone-editing' ? 'Clone Editing' : 'BLAST'}: ${q.text.substring(0, 40)}...`
        }));
    };

    // Helper function to get sequence from selected question
    const getSequenceFromQuestion = (questionId, answers) => {
        const answer = answers[questionId];
        if (!answer || typeof answer !== 'string') return null;

        const cleanSequence = answer.replace(/\s/g, '').replace(/\*/g, '').toUpperCase();

        // Check for DNA sequence
        const isDNA = /^[ATGCNRYSWKMBDHV\-]+$/.test(cleanSequence);

        // Check for protein sequence (20 standard amino acids plus ambiguity codes)
        const isProtein = /^[ACDEFGHIKLMNPQRSTVWYXZ\-]+$/.test(cleanSequence);

        if ((isDNA || isProtein) && cleanSequence.length > 10) {
            return cleanSequence;
        }
        return null;
    };

    // REPLACE your generateCacheKey function with this browser-compatible version:
    const generateCacheKey = (questionId, sequence, program, database) => {
        if (!sequence) return null;

        // Simple hash function for browser (matches backend MD5 behavior)
        const simpleHash = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(16).substring(0, 12);
        };

        const sequenceHash = simpleHash(sequence);

        // Convert database to actual database name like backend does
        const actualDatabase = getAppropriateDatabase(program, database);

        return `${questionId}_${sequenceHash}_${program}_${actualDatabase}`;
    };

    // ADD these helper functions after your existing helper functions:
    const getBlastParamsForQuestion = (questionId) => {
        return blastParams[questionId] || {
            program: 'blastn',
            database: 'auto',
            sourceSequence: ''
        };
    };

    const updateBlastParam = (questionId, paramName, value) => {
        setBlastParams(prev => ({
            ...prev,
            [questionId]: {
                ...getBlastParamsForQuestion(questionId),
                [paramName]: value
            }
        }));
    };



    const getCachedBlastResults = async (submission, questionId) => {
        const questionParams = getBlastParamsForQuestion(questionId);
        const sequence = questionParams.sourceSequence ?
            getSequenceFromQuestion(questionParams.sourceSequence, submission.answers) : null;

        if (!sequence) {
            alert('Please select a source sequence first');
            return;
        }

        const cacheKey = generateCacheKey(questionId, sequence, questionParams.program, questionParams.database);

        setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: true }));

        try {
            // SEND REAL SEQUENCE AND PARAMETERS for polling
            const response = await apiService.post(`/blast-search/${submission.id}/${questionId}`, {
                sequence: sequence,  // Send actual sequence, not "dummy"
                program: questionParams.program,
                database: questionParams.database,
                forceRefresh: false
            });

            setBlastCache(prev => ({ ...prev, [cacheKey]: response }));
            return response;
        } catch (error) {
            console.error('Error getting cached results:', error);
        } finally {
            setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
        }
    };

    // REPLACE your runNewBlastSearch function:
    const runNewBlastSearch = async (submission, questionId, sequence) => {
        const questionParams = getBlastParamsForQuestion(questionId);
        const cacheKey = generateCacheKey(questionId, sequence, questionParams.program, questionParams.database);

        if (!sequence) {
            alert('Please select a source sequence first');
            return;
        }

        if (!cacheKey) {
            alert('Error generating cache key');
            return;
        }

        // CLEAR the cache entry immediately when forcing new search
        setBlastCache(prev => {
            const newCache = { ...prev };
            delete newCache[cacheKey]; // Remove any existing cached result
            return newCache;
        });

        // Set loading state
        setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: true }));

        let response;

        try {
            response = await apiService.post(`/blast-search/${submission.id}/${questionId}`, {
                sequence: sequence,
                program: questionParams.program,
                database: questionParams.database,
                forceRefresh: true
            });

            if (response.status === 'pending') {
                // Set pending status in cache
                setBlastCache(prev => ({
                    ...prev,
                    [cacheKey]: {
                        status: 'pending',
                        message: 'New BLAST search in progress...'
                    }
                }));
                pollForBlastResults(submission.id, questionId, cacheKey, questionParams.program, questionParams.database);
            } else if (response.status === 'completed') {
                // Immediate completion
                setBlastCache(prev => ({ ...prev, [cacheKey]: response }));
            }

            return response;
        } catch (error) {
            console.error('Error running new search:', error);
            setBlastCache(prev => ({
                ...prev,
                [cacheKey]: {
                    status: 'error',
                    error: error.message || 'BLAST search failed'
                }
            }));
        } finally {
            if (!response || response.status !== 'pending') {
                setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
            }
        }
    };

    // REPLACE your pollForBlastResults function:
    // REPLACE your pollForBlastResults function with this corrected version:
    const pollForBlastResults = async (fileId, questionId, cacheKey, program, database, maxAttempts = 150) => {
        let attempts = 0;

        const poll = async () => {
            attempts++;
            console.log(`Polling for BLAST results, attempt ${attempts}/${maxAttempts}`);

            try {
                // Get the actual sequence for polling
                const questionParams = getBlastParamsForQuestion(questionId);
                const sequence = questionParams.sourceSequence ?
                    getSequenceFromQuestion(questionParams.sourceSequence, selectedSubmission.answers) : null;

                if (!sequence) {
                    console.error('No sequence available for polling');
                    setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
                    return;
                }

                // Send real sequence and parameters for polling
                const response = await apiService.post(`/blast-search/${fileId}/${questionId}`, {
                    sequence: sequence,  // Send actual sequence
                    program: program,
                    database: database,
                    forceRefresh: false
                });

                if (response.status === 'completed') {
                    console.log('BLAST results completed!');
                    setBlastCache(prev => ({ ...prev, [cacheKey]: response }));
                    setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
                    return;
                } else if (response.status === 'error') {
                    console.log('BLAST search failed:', response.error);
                    setBlastCache(prev => ({ ...prev, [cacheKey]: response }));
                    setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
                    return;
                } else if (response.status === 'pending') {
                    if (attempts < maxAttempts) {
                        setTimeout(poll, 4000);
                    } else {
                        setBlastCache(prev => ({
                            ...prev,
                            [cacheKey]: {
                                status: 'error',
                                error: 'Search timeout - results took too long to complete'
                            }
                        }));
                        setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
                    }
                }
            } catch (error) {
                console.error('Error polling for BLAST results:', error);
                setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
            }
        };

        setTimeout(poll, 2000);
    };

    const renderRealBlastResults = (results) => {
        if (!results || !Array.isArray(results) || results.length === 0) {
            return (
                <tr>
                    <td colSpan="6" className="px-2 py-3 text-center text-gray-400 italic text-xs">
                        No BLAST results found
                    </td>
                </tr>
            );
        }

        return results.slice(0, 10).map((result, index) => (
            <tr key={index} className="hover:bg-blue-100">
                <td className="px-2 py-1 font-mono text-xs w-24">{result.accession || '-'}</td>
                <td className="px-2 py-1 text-xs w-auto min-w-48" title={result.definition || '-'}>
                    {result.definition || '-'}
                </td>
                <td className="px-2 py-1 text-xs italic w-20 truncate" title={result.organism || '-'}>
                    {result.organism || '-'}
                </td>
                <td className="px-2 py-1 font-mono text-xs w-16 text-center">{result.start || '-'}</td>
                <td className="px-2 py-1 font-mono text-xs w-16 text-center">{result.end || '-'}</td>
                <td className="px-2 py-1 font-mono text-xs w-20">{result.evalue || '-'}</td>
            </tr>
        ));
    };

    const smartBlastSearch = async (submission, questionId) => {
        const questionParams = getBlastParamsForQuestion(questionId);
        const sequence = questionParams.sourceSequence ?
            getSequenceFromQuestion(questionParams.sourceSequence, submission.answers) : null;

        if (!sequence) {
            alert('Please select a source sequence first');
            return;
        }

        const cacheKey = generateCacheKey(questionId, sequence, questionParams.program, questionParams.database);

        if (!sequence || !cacheKey) {
            alert('Please select a source sequence first');
            return;
        }

        setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: true }));

        let response;

        try {
            console.log(`=== SMART BLAST SEARCH (Question ${questionId}) ===`);
            console.log('Cache key:', cacheKey);
            console.log('Checking server cache with actual parameters...');

            // Check server cache with actual sequence and parameters
            response = await apiService.post(`/blast-search/${submission.id}/${questionId}`, {
                sequence: sequence,  // Send actual sequence, not "dummy"
                program: questionParams.program,
                database: questionParams.database,
                forceRefresh: false
            });

            if (response.status === 'completed') {
                console.log('Found completed results on server');
                setBlastCache(prev => ({ ...prev, [cacheKey]: response }));
                return response;
            } else if (response.status === 'no_results') {
                console.log('No cache found, running new search...');

                // Run new search with force refresh
                response = await apiService.post(`/blast-search/${submission.id}/${questionId}`, {
                    sequence: sequence,
                    program: questionParams.program,
                    database: questionParams.database,
                    forceRefresh: true
                });
            }

            // Handle pending or other responses
            setBlastCache(prev => ({ ...prev, [cacheKey]: response }));

            if (response.status === 'pending') {
                pollForBlastResults(submission.id, questionId, cacheKey, questionParams.program, questionParams.database);
            }

            return response;

        } catch (error) {
            console.error('Error in smart BLAST search:', error);
            setBlastCache(prev => ({
                ...prev,
                [cacheKey]: {
                    status: 'error',
                    error: error.message || 'BLAST search failed'
                }
            }));
        } finally {
            if (!response || response.status !== 'pending') {
                setLoadingBlastResults(prev => ({ ...prev, [cacheKey]: false }));
            }
        }
    };

    const handleChromatogramToggle = async () => {
        if (showChromatogram) {
            setShowChromatogram(false);
        } else {
            setShowChromatogram(true);
            if (!chromatogramData && !loadingChromatogram && selectedSubmission) {
                await loadChromatogramData();
            }
        }
    };

    const loadChromatogramData = async () => {
        if (chromatogramData || loadingChromatogram || !selectedSubmission) return;

        setLoadingChromatogram(true);

        try {
            let downloadEndpoint;

            if (selectedSubmission.type === 'assigned' || selectedSubmission.type === 'regular') {
                downloadEndpoint = `/uploaded-files/${selectedSubmission.id}/download`;
            } else if (selectedSubmission.type === 'practice') {
                downloadEndpoint = `/practice-clones/${selectedSubmission.practiceCloneId}/download`;
            } else {
                throw new Error('Unknown submission type');
            }

            // Use apiService.downloadBlob for blob downloads
            const blob = await apiService.downloadBlob(downloadEndpoint);

            if (blob.size === 0) {
                console.warn('Downloaded file is empty, using mock data');
                setChromatogramData('mock');
                return;
            }

            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            console.log('File data loaded, size:', uint8Array.length);

            if (uint8Array.length > 0) {
                setChromatogramData(uint8Array);
                console.log('Successfully set chromatogram data');
            } else {
                setChromatogramData('mock');
            }

        } catch (error) {
            console.error('Error loading chromatogram data:', error);
            setChromatogramData('mock');
        } finally {
            setLoadingChromatogram(false);
        }
    };

    const renderPracticeAnswerComparison = (question, studentAnswer) => {
        if (!selectedSubmission || selectedSubmission.type !== 'practice') {
            return null;
        }

        const practiceAnswer = getPracticeAnswerForQuestion(question.id);
        if (!practiceAnswer) {
            return (
                <div className="mt-2 p-2 bg-gray-50 rounded border-l-4 border-gray-300">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">No correct answer set by director</span>
                    </div>
                </div>
            );
        }

        const isCorrect = isStudentAnswerCorrect(question.id, studentAnswer);

        return (
            <div className={`mt-2 p-3 rounded border-l-4 ${isCorrect
                ? 'bg-green-50 border-green-400'
                : 'bg-red-50 border-red-400'
                }`}>
                <div className="flex items-start space-x-2">
                    {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                            <span className={`text-sm font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'
                                }`}>
                                {isCorrect ? 'Correct Answer' : 'Incorrect'}
                            </span>
                            {!isCorrect && (
                                question.type === 'blast' ? (
                                    <span className="text-xs text-gray-600">
                                        (Expected: See table below)
                                    </span>
                                ) : question.type === 'sequence_range' ? (
                                    <span className="text-xs text-gray-600">
                                        (Expected: See values below)
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-600">
                                        (Expected: "{practiceAnswer.correctAnswer}")
                                    </span>
                                )
                            )}
                        </div>

                        {!isCorrect && (
                            <div className="text-sm text-gray-700 mb-2">
                                <strong>Correct Answer:</strong>
                                {question.type === 'blast' ? (
                                    <div className="mt-2 overflow-x-auto">
                                        <table className="min-w-full text-xs border border-gray-300">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-2 py-1 border-b text-left">Accession</th>
                                                    <th className="px-2 py-1 border-b text-left">Definition</th>
                                                    <th className="px-2 py-1 border-b text-left">Organism</th>
                                                    <th className="px-2 py-1 border-b text-left">Start</th>
                                                    <th className="px-2 py-1 border-b text-left">End</th>
                                                    <th className="px-2 py-1 border-b text-left">E-value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {renderBlastAnswerRows(practiceAnswer.correctAnswer)}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : question.type === 'sequence_range' ? (
                                    <div className="mt-1 grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-xs text-gray-600">{question.options?.label1 || 'Begin'}:</span>
                                            <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-1">
                                                {practiceAnswer.correctAnswer.value1}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-600">{question.options?.label2 || 'End'}:</span>
                                            <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-1">
                                                {practiceAnswer.correctAnswer.value2}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                        {practiceAnswer.correctAnswer}
                                    </span>
                                )}
                            </div>
                        )}

                        {practiceAnswer.explanation && (
                            <div className="text-xs text-gray-600 bg-white/50 p-2 rounded">
                                <strong>Explanation:</strong> {practiceAnswer.explanation}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const getPracticeAnswerForQuestion = (questionId) => {
        return practiceAnswers.find(answer => answer.questionId === questionId);
    };

    const isStudentAnswerCorrect = (questionId, studentAnswer) => {
        const correctAnswer = getPracticeAnswerForQuestion(questionId);
        if (!correctAnswer) return null; // No correct answer set

        const question = analysisQuestions.find(q => q.id === questionId);

        // Handle blast questions separately
        if (question && question.type === 'blast') {
            if (typeof correctAnswer.correctAnswer !== 'object' || typeof studentAnswer !== 'object') {
                return false;
            }

            // Compare each field that has a correct answer
            const correctData = correctAnswer.correctAnswer;
            const studentData = studentAnswer;

            // Get all the field keys that have correct answers
            const correctKeys = Object.keys(correctData).filter(key =>
                correctData[key] && correctData[key].trim() !== ''
            );

            if (correctKeys.length === 0) return null; // No correct data to compare

            // Check if all non-empty correct fields match student answers
            return correctKeys.every(key => {
                const studentVal = (studentData[key] || '').trim().toLowerCase();
                const correctVal = correctData[key].trim().toLowerCase();
                return studentVal === correctVal;
            });
        }

        // Handle sequence_range questions separately
        if (question && question.type === 'sequence_range') {
            if (typeof correctAnswer.correctAnswer !== 'object' || typeof studentAnswer !== 'object') {
                return false;
            }

            const correctData = correctAnswer.correctAnswer;
            const studentData = studentAnswer;

            // Compare both value1 and value2
            const value1Match = (studentData.value1 || '').trim().toLowerCase() ===
                (correctData.value1 || '').trim().toLowerCase();
            const value2Match = (studentData.value2 || '').trim().toLowerCase() ===
                (correctData.value2 || '').trim().toLowerCase();

            return value1Match && value2Match;
        }

        // Handle regular questions
        const normalizedStudent = String(studentAnswer || '').trim().toLowerCase();
        const normalizedCorrect = String(correctAnswer.correctAnswer).trim().toLowerCase();

        return normalizedStudent === normalizedCorrect;
    };

    const fetchPracticeAnswers = async (practiceCloneId) => {
        try {
            const answers = await apiService.get(`/practice-clones/${practiceCloneId}/answers`);

            // Parse JSON strings back to objects for blast and sequence_range questions
            const parsedAnswers = answers.map(answer => {
                const question = analysisQuestions.find(q => q.id === answer.questionId);
                if (question && (question.type === 'blast' || question.type === 'sequence_range') && typeof answer.correctAnswer === 'string') {
                    try {
                        return {
                            ...answer,
                            correctAnswer: JSON.parse(answer.correctAnswer)
                        };
                    } catch (e) {
                        console.warn(`Failed to parse ${question.type} answer JSON:`, e);
                        return answer;
                    }
                }
                return answer;
            });

            setPracticeAnswers(parsedAnswers);
            console.log('Loaded practice answers:', parsedAnswers.length);
        } catch (error) {
            console.error('Error fetching practice answers:', error);
            setPracticeAnswers([]);
        }
    };

    const fetchAnalysisQuestions = async () => {
        try {
            const questions = await apiService.get('/analysis-questions');
            setAnalysisQuestions(questions);
        } catch (error) {
            console.error('Error fetching analysis questions:', error);
        }
    };

    const fetchSubmissions = async () => {
        try {
            setLoading(true);
            const schoolName = currentUser.school.name;

            console.log('=== OPTIMIZED INSTRUCTOR FETCH SUBMISSIONS ===');
            console.log('Instructor school name:', schoolName);
            console.log('Using backend school filtering for efficiency');

            // Use optimized backend endpoints with school filtering
            const [reviewReadyFiles, practiceSubmissions] = await Promise.all([
                apiService.get(`/uploaded-files?reviewReady=true&schoolName=${encodeURIComponent(schoolName)}`),
                apiService.get(`/practice-submissions?reviewReady=true&schoolName=${encodeURIComponent(schoolName)}`)
            ]);

            console.log('Backend-filtered regular submissions:', reviewReadyFiles.length);
            console.log('Backend-filtered practice submissions:', practiceSubmissions.length);

            // Minimal frontend processing since backend does the heavy lifting
            const processedRegularFiles = reviewReadyFiles.map(file => {
                console.log('Processing regular file:', file.id, 'for student:', file.assignedTo.name);

                let parsedAnalysis = {};
                try {
                    parsedAnalysis = JSON.parse(file.analysisData || '{}');
                } catch (e) {
                    console.error('Error parsing analysis data for file:', file.id, e);
                    // Continue with empty analysis rather than failing
                }

                return {
                    ...file,
                    type: 'regular',
                    answers: parsedAnalysis.answers || {},
                    currentStep: parsedAnalysis.currentStep || 'clone-editing',
                    submittedAt: parsedAnalysis.submittedAt || file.updatedAt,
                    reviewStatus: getReviewStatus(file.status),
                    lastReviewed: parsedAnalysis.lastReviewed,
                    reviewComments: parsedAnalysis.reviewComments || [],
                    reviewScore: parsedAnalysis.reviewScore
                };
            });

            const processedPracticeFiles = practiceSubmissions.map(submission => {
                console.log('Processing practice submission:', submission.id, 'for student:', submission.assignedTo.name);

                return {
                    id: submission.id,
                    type: 'practice',
                    cloneName: submission.cloneName,
                    filename: submission.filename,
                    originalName: submission.originalName,
                    assignedTo: submission.assignedTo,
                    answers: submission.answers || {},
                    currentStep: submission.currentStep,
                    progress: submission.progress,
                    status: submission.status,
                    practiceCloneId: submission.practiceCloneId,
                    submittedAt: submission.submittedAt,
                    reviewStatus: getReviewStatus(submission.status),
                    reviewComments: submission.reviewComments || [],
                    reviewScore: submission.reviewScore,
                    lastReviewed: submission.lastReviewed
                };
            });

            // Combine and filter out any submissions without valid review status
            const allSubmissions = [
                ...processedRegularFiles,
                ...processedPracticeFiles
            ].filter(submission => submission.reviewStatus !== null);

            console.log('=== FINAL SUBMISSION COUNTS ===');
            console.log('Regular submissions processed:', processedRegularFiles.length);
            console.log('Practice submissions processed:', processedPracticeFiles.length);
            console.log('Total submissions for review:', allSubmissions.length);
            console.log('Submissions by status:', {
                pending: allSubmissions.filter(s => s.reviewStatus === 'pending').length,
                resubmitted: allSubmissions.filter(s => s.reviewStatus === 'resubmitted').length
            });

            setSubmissions(allSubmissions);
            setLoading(false);

        } catch (error) {
            console.error('=== ERROR FETCHING OPTIMIZED SUBMISSIONS ===');
            console.error('Error details:', error);
            console.error('Error message:', error.message);

            // Fallback to non-optimized approach if backend doesn't support new parameters yet
            if (error.message.includes('400') || error.message.includes('schoolName')) {
                console.log('Backend optimization not available, falling back to client-side filtering...');
                await fetchSubmissionsFallback();
            } else {
                setLoading(false);
                // Could show user-friendly error message here
            }
        }
    };

    // Fallback function for when backend optimizations aren't implemented yet
    const fetchSubmissionsFallback = async () => {
        try {
            const schoolName = currentUser.school.name;

            console.log('=== FALLBACK: CLIENT-SIDE FILTERING ===');
            console.log('Fetching all submissions and filtering client-side');

            // Get all data without filters and do client-side filtering
            const [allUploadedFiles, allPracticeSubmissions] = await Promise.all([
                apiService.get('/uploaded-files'),
                apiService.get('/practice-submissions')
            ]);

            console.log('Total files from backend:', allUploadedFiles.length);
            console.log('Total practice submissions from backend:', allPracticeSubmissions.length);

            // Filter by school
            const schoolFiles = allUploadedFiles.filter(file =>
                file.assignedTo?.school?.name === schoolName
            );
            const schoolPracticeSubmissions = allPracticeSubmissions.filter(submission =>
                submission.assignedTo?.school?.name === schoolName
            );

            console.log('Files for our school:', schoolFiles.length);
            console.log('Practice submissions for our school:', schoolPracticeSubmissions.length);

            // Filter by review status
            const reviewReadyFiles = schoolFiles.filter(file => {
                const reviewStatus = getReviewStatus(file.status);
                const hasValidData = file.analysisData && file.assignedTo;
                console.log(`File ${file.id}: status=${file.status}, reviewStatus=${reviewStatus}, hasData=${hasValidData}`);
                return reviewStatus !== null && hasValidData;
            });

            const reviewReadyPractice = schoolPracticeSubmissions.filter(submission => {
                const reviewStatus = getReviewStatus(submission.status);
                console.log(`Practice ${submission.id}: status=${submission.status}, reviewStatus=${reviewStatus}`);
                return reviewStatus !== null;
            });

            console.log('Review-ready files:', reviewReadyFiles.length);
            console.log('Review-ready practice submissions:', reviewReadyPractice.length);

            // Process the filtered data (same logic as optimized version)
            const processedRegularFiles = reviewReadyFiles.map(file => {
                let parsedAnalysis = {};
                try {
                    parsedAnalysis = JSON.parse(file.analysisData || '{}');
                } catch (e) {
                    console.error('Error parsing analysis data for file:', file.id, e);
                }

                return {
                    ...file,
                    type: 'regular',
                    answers: parsedAnalysis.answers || {},
                    currentStep: parsedAnalysis.currentStep || 'clone-editing',
                    submittedAt: parsedAnalysis.submittedAt || file.updatedAt,
                    reviewStatus: getReviewStatus(file.status),
                    lastReviewed: parsedAnalysis.lastReviewed,
                    reviewComments: parsedAnalysis.reviewComments || [],
                    reviewScore: parsedAnalysis.reviewScore
                };
            });

            const processedPracticeFiles = reviewReadyPractice.map(submission => ({
                id: submission.id,
                type: 'practice',
                cloneName: submission.cloneName,
                filename: submission.filename,
                originalName: submission.originalName,
                assignedTo: submission.assignedTo,
                answers: submission.answers || {},
                currentStep: submission.currentStep,
                progress: submission.progress,
                status: submission.status,
                practiceCloneId: submission.practiceCloneId,
                submittedAt: submission.submittedAt,
                reviewStatus: getReviewStatus(submission.status),
                reviewComments: submission.reviewComments || [],
                reviewScore: submission.reviewScore,
                lastReviewed: submission.lastReviewed
            }));

            const allSubmissions = [...processedRegularFiles, ...processedPracticeFiles];

            console.log('Fallback processing complete:', allSubmissions.length, 'total submissions');
            setSubmissions(allSubmissions);
            setLoading(false);

        } catch (fallbackError) {
            console.error('Fallback fetch also failed:', fallbackError);
            setLoading(false);
            // Handle complete failure gracefully
            setSubmissions([]);
        }
    };


    const getFilteredAndSortedSubmissions = () => {
        let filtered = submissions;

        // Filter by review status
        if (filter !== 'all') {
            filtered = filtered.filter(sub => sub.reviewStatus === filter);
        }

        // Filter by clone type
        if (cloneTypeFilter !== 'all') {
            filtered = filtered.filter(sub => sub.type === cloneTypeFilter);
        }

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'student':
                    return a.assignedTo.name.localeCompare(b.assignedTo.name);
                case 'clone':
                    return a.cloneName.localeCompare(b.cloneName);
                case 'progress':
                    return b.progress - a.progress;
                case 'submitted':
                default:
                    return new Date(b.submittedAt) - new Date(a.submittedAt);
            }
        });
    };

    const selectSubmission = async (submission) => {
        setSelectedSubmission(submission);
        setShowChromatogram(false);
        setChromatogramData(null);
        setReviewData({
            score: submission.reviewScore || 0,
            status: submission.reviewStatus,
            comments: submission.reviewComments || [],
            overallFeedback: ''
        });

        // Reset expanded sections - start with all closed
        setExpandedSections(new Set());

        // If this is a practice clone, fetch the correct answers
        if (submission.type === 'practice') {
            console.log('Loading practice answers for submission:', submission);

            try {
                // Fetch the practice clone ID from the submission data
                if (submission.practiceCloneId) {
                    await fetchPracticeAnswers(submission.practiceCloneId);
                } else {
                    // Fallback: try to find the practice clone ID using apiService
                    const practiceClones = await apiService.get('/practice-clones');
                    const matchingClone = practiceClones.find(clone => clone.cloneName === submission.cloneName);

                    if (matchingClone) {
                        await fetchPracticeAnswers(matchingClone.id);
                    }
                }
            } catch (error) {
                console.error('Error loading practice answers:', error);
                setPracticeAnswers([]);
            }
        } else {
            // Clear practice answers for regular clones
            setPracticeAnswers([]);
        }
    };

    const toggleAnswerExpanded = (questionId) => {
        const newExpanded = new Set(expandedAnswers);
        if (newExpanded.has(questionId)) {
            newExpanded.delete(questionId);
        } else {
            newExpanded.add(questionId);
        }
        setExpandedAnswers(newExpanded);
    };

    const getCommonFeedbackForQuestion = (questionId) => {
        return commonFeedbackOptions.filter(feedback => feedback.questionId === questionId);
    };

    const selectCommonFeedback = (questionId, feedbackText) => {
        // Find the input field for this question and populate it with the feedback text
        const input = document.querySelector(`input[data-question-id="${questionId}"]`);
        if (input) {
            input.value = feedbackText;
            input.focus(); // Optional: focus the input so user knows it's populated
        }
    };

    const getQuestionText = (questionId) => {
        const question = analysisQuestions.find(q => q.id === questionId);
        return question ? question.text : 'Question not found';
    };

    const getQuestionType = (questionId) => {
        const question = analysisQuestions.find(q => q.id === questionId);
        return question ? question.type : 'unknown';
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    const addComment = (questionId, feedback, feedbackVisible = true) => {
        setReviewData(prev => {
            const filteredComments = prev.comments.filter(c => c.questionId !== questionId);

            return {
                ...prev,
                comments: [
                    ...filteredComments,
                    {
                        questionId,
                        feedback,  // renamed from "comment"
                        feedbackVisible,  // NEW
                        correctAnswer: '',  // NEW
                        isCorrect: null,  // NEW
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        });
    };

    const renderBlastAnswerRows = (answer) => {
        if (!answer || typeof answer !== 'object') {
            return (
                <tr>
                    <td colSpan="6" className="px-2 py-3 text-center text-gray-400 italic text-xs">
                        No BLAST data provided
                    </td>
                </tr>
            );
        }

        const rowIndices = new Set();
        Object.keys(answer).forEach(key => {
            const match = key.match(/_(\d+)$/);
            if (match) rowIndices.add(parseInt(match[1]));
        });

        const sortedIndices = Array.from(rowIndices).sort((a, b) => a - b);

        if (sortedIndices.length === 0) {
            return (
                <tr>
                    <td colSpan="6" className="px-2 py-3 text-center text-gray-400 italic text-xs">
                        No BLAST results entered
                    </td>
                </tr>
            );
        }

        return sortedIndices.map(index => (
            <tr key={index} className="hover:bg-gray-50">
                <td className="px-2 py-1 font-mono text-xs">{answer[`accession_${index}`] || '-'}</td>
                <td className="px-2 py-1 text-xs truncate max-w-32" title={answer[`definition_${index}`] || '-'}>
                    {answer[`definition_${index}`] || '-'}
                </td>
                <td className="px-2 py-1 text-xs italic">{answer[`organism_${index}`] || '-'}</td>
                <td className="px-2 py-1 font-mono text-xs">{answer[`start_${index}`] || '-'}</td>
                <td className="px-2 py-1 font-mono text-xs">{answer[`end_${index}`] || '-'}</td>
                <td className="px-2 py-1 font-mono text-xs">{answer[`evalue_${index}`] || '-'}</td>
            </tr>
        ));
    };

    const updateScore = (score) => {
        setReviewData(prev => ({ ...prev, score: Math.max(0, Math.min(100, score)) }));
    };

    const markQuestionAsCorrect = (questionId) => {
        setReviewData(prev => {
            const existingComment = prev.comments.find(c => c.questionId === questionId);
            const filteredComments = prev.comments.filter(c => c.questionId !== questionId);

            return {
                ...prev,
                comments: [
                    ...filteredComments,
                    {
                        questionId,
                        feedback: existingComment?.feedback || '',
                        feedbackVisible: existingComment?.feedbackVisible ?? true,
                        correctAnswer: existingComment?.correctAnswer || '',
                        isCorrect: true,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        });
    };

    const markQuestionAsIncorrect = (questionId) => {
        setReviewData(prev => {
            const existingComment = prev.comments.find(c => c.questionId === questionId);
            const filteredComments = prev.comments.filter(c => c.questionId !== questionId);

            return {
                ...prev,
                comments: [
                    ...filteredComments,
                    {
                        questionId,
                        feedback: existingComment?.feedback || '',
                        feedbackVisible: existingComment?.feedbackVisible ?? true,
                        correctAnswer: existingComment?.correctAnswer || '',
                        isCorrect: false,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        });
    };

    const updateFeedbackVisibility = (questionId, visible) => {
        setReviewData(prev => {
            const comment = prev.comments.find(c => c.questionId === questionId);
            if (!comment) return prev;

            return {
                ...prev,
                comments: prev.comments.map(c =>
                    c.questionId === questionId
                        ? { ...c, feedbackVisible: visible }
                        : c
                )
            };
        });
    };

    const updateCorrectAnswer = (questionId, correctAnswer) => {
        setReviewData(prev => {
            const existingComment = prev.comments.find(c => c.questionId === questionId);
            const filteredComments = prev.comments.filter(c => c.questionId !== questionId);

            return {
                ...prev,
                comments: [
                    ...filteredComments,
                    {
                        questionId,
                        feedback: existingComment?.feedback || '',
                        feedbackVisible: existingComment?.feedbackVisible ?? true,
                        correctAnswer,
                        isCorrect: existingComment?.isCorrect ?? null,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        });
    };

    const removeCorrectMarking = (questionId) => {
        setReviewData(prev => ({
            ...prev,
            comments: prev.comments.map(c =>
                c.questionId === questionId
                    ? { ...c, isCorrect: null }
                    : c
            )
        }));
    };

    const toggleQuestionCorrect = (questionId) => {
        const comment = reviewData.comments?.find(c => c.questionId === questionId);

        if (comment?.isCorrect === true) {
            removeCorrectMarking(questionId);
        } else {
            markQuestionAsCorrect(questionId);
        }
    };


    const autoAddPendingFeedback = () => {
        console.log('=== Auto-adding pending feedback from input fields ===');

        // Find all feedback input fields that have text
        const feedbackInputs = document.querySelectorAll('input[data-question-id]');

        feedbackInputs.forEach(input => {
            const questionId = input.getAttribute('data-question-id');
            const feedbackText = input.value.trim();

            if (feedbackText && questionId) {
                console.log(`Auto-adding feedback for question ${questionId}: "${feedbackText}"`);
                addComment(questionId, feedbackText);
                input.value = ''; // Clear the input after adding
            }
        });
    };

    const submitReview = async (newStatus) => {
        if (!selectedSubmission) return;

        // Auto-add any pending feedback from input fields before submitting
        autoAddPendingFeedback();

        // Small delay to ensure state updates are processed
        await new Promise(resolve => setTimeout(resolve, 300));

        setSaving(true);

        try {
            console.log('=== SUBMITTING REVIEW ===');
            console.log('Selected submission:', selectedSubmission);
            console.log('New status:', newStatus);
            console.log('Review data:', reviewData);

            const statusMap = {
                'approved': CLONE_STATUSES.REVIEWED_BY_TEACHER,  // Changed from REVIEWED_CORRECT
                'rejected': CLONE_STATUSES.NEEDS_REANALYSIS
            };

            // Validate status transition
            const newStatusValue = statusMap[newStatus];
            if (!isValidStatusTransition(selectedSubmission.status, newStatusValue)) {
                console.warn('Invalid status transition attempted:', selectedSubmission.status, '->', newStatusValue);
                alert('Invalid status transition. Please refresh and try again.');
                setSaving(false);
                return;
            }

            // Collect all comments
            const allComments = [
                ...(reviewData.comments || []),
                ...(reviewData.overallFeedback ? [{
                    id: Date.now(),
                    text: reviewData.overallFeedback,
                    timestamp: new Date().toISOString(),
                    type: 'overall'
                }] : [])
            ];

            let response;

            // Handle practice submissions
            if (selectedSubmission.type === 'practice') {
                console.log('Submitting practice review for submission ID:', selectedSubmission.id);

                const updateData = {
                    status: statusMap[newStatus],
                    reviewScore: reviewData.score,
                    reviewComments: allComments,
                    lastReviewed: new Date().toISOString(),
                    reviewedBy: 'Current Director'
                };

                console.log('===Practice review data to send:===', updateData);
                response = await apiService.put(`/practice-submissions/${selectedSubmission.id}/review`, updateData);

                console.log('===Practice review response:===', response);
            } else {
                // Handle regular submissions
                console.log('Submitting regular review for uploaded file ID:', selectedSubmission.id);

                const currentAnalysisData = JSON.parse(selectedSubmission.analysisData || '{}');

                const updatedAnalysisData = {
                    ...currentAnalysisData,
                    reviewScore: reviewData.score,
                    reviewComments: allComments,
                    lastReviewed: new Date().toISOString(),
                    reviewedBy: 'Current Director'
                };

                response = await apiService.put(`/uploaded-files/${selectedSubmission.id}`, {
                    status: statusMap[newStatus],
                    analysisData: JSON.stringify(updatedAnalysisData)
                });

                console.log('Regular review submitted successfully');
            }

            // Success handling
            setReviewData(prev => ({ ...prev, comments: allComments }));

            // Send question-specific comments as individual messages (excluding "Correct!" markers)
            const questionComments = allComments.filter(comment =>
                comment.questionId && comment.comment && comment.comment !== ''
            );

            if (questionComments.length > 0) {
                try {
                    await sendQuestionCommentsAsMessages(selectedSubmission, questionComments);

                    // Count how many were actually sent (excluding "Correct!" messages)
                    // In submitReview function, find this section and update:
                    const sentCount = questionComments.filter(c =>
                        c.feedback && c.feedback.trim() !== '' && c.feedbackVisible === true
                    ).length;
                    if (sentCount > 0) {
                        console.log(`Successfully sent ${sentCount} question feedback messages`);
                    }
                } catch (error) {
                    console.error('Error sending question feedback messages:', error);
                    // Don't fail the review if messages fail
                }
            }

            setSubmissions(prev => prev.filter(sub => sub.id !== selectedSubmission.id));
            setSelectedSubmission(null);
            setReviewData({});

            if (onReviewCompleted) onReviewCompleted();

            // Update the alert to show actual sent count
            // In submitReview function, find this section and update:
            const sentCount = questionComments.filter(c =>
                c.feedback && c.feedback.trim() !== '' && c.feedbackVisible === true
            ).length;
            alert(`Review submitted successfully! Status changed to: ${statusMap[newStatus]}${sentCount > 0 ? ` (${sentCount} feedback messages sent)` : ''}`);

        } catch (error) {
            console.error('=== ERROR SUBMITTING REVIEW ===');
            console.error('Error message:', error.message);
            console.error('Full error:', error);
            alert(`Error submitting review: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    // REPLACE your downloadFile function in DirectorAnalysisReview.jsx with this version:

    const downloadFile = async (submission) => {
        try {
            if (submission.type === 'practice') {
                // Practice clones don't have real files to download
                alert('Practice clones do not have downloadable .ab1 files. This is simulated data for training purposes.');
                return;
            }

            let downloadEndpoint;
            if (submission.type === 'assigned' || submission.type === 'regular') {
                downloadEndpoint = `/uploaded-files/${submission.id}/download`;
            } else {
                alert('Unknown file type');
                return;
            }

            console.log('Downloading from endpoint:', downloadEndpoint);

            // Use apiService.downloadBlob for file downloads
            const blob = await apiService.downloadBlob(downloadEndpoint);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = submission.filename || submission.originalName || `file_${submission.id}.ab1`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            console.log('File downloaded successfully');
        } catch (error) {
            console.error('Error downloading file:', error);
            alert(`Error downloading file: ${error.message}`);
        }
    };

    const sendFeedbackMessage = async () => {
        if (!feedbackText.trim() || !selectedSubmission) return;

        try {
            // Check if a discussion thread already exists (same as question feedback)
            const threadExists = await checkForExistingDiscussion(selectedSubmission.assignedTo.id, selectedSubmission.id);

            if (!threadExists) {
                console.log('No existing thread found for general feedback, creating initial feedback thread...');
                await createInitialFeedbackThread(selectedSubmission);
            }

            // Send the general feedback message (no questionId)
            await apiService.post('/messages/review-feedback', {
                reviewerId: 1, // Current director ID
                studentId: selectedSubmission.assignedTo.id,
                cloneId: selectedSubmission.id,
                subject: `Review Feedback: ${selectedSubmission.cloneName}`,
                content: feedbackText.trim(),
                reviewStatus: selectedSubmission.reviewStatus
            });

            console.log('General feedback message sent successfully');

            setShowFeedbackModal(false);
            setFeedbackText('');
            alert('Feedback message sent to student!');
        } catch (error) {
            console.error('Error sending feedback:', error);
            alert('Failed to send feedback message');
        }
    };

    const toggleSection = (sectionId) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId);
        } else {
            newExpanded.add(sectionId);
        }
        setExpandedSections(newExpanded);
    };

    const getSectionsWithAnswers = (answers) => {
        const sectionsWithAnswers = new Set();

        analysisQuestions.forEach(question => {
            if (answers[question.id] !== undefined && answers[question.id] !== '') {
                sectionsWithAnswers.add(question.step);
            }
        });

        return sectionsWithAnswers;
    };

    const getQuestionsForSection = (sectionId, answers) => {
        return analysisQuestions
            .filter(q => q.step === sectionId)
            .filter(q => answers[q.id] !== undefined && answers[q.id] !== '')
            .sort((a, b) => {
                // First sort by groupOrder (treating null/undefined as 0)
                const aGroupOrder = a.groupOrder || 0;
                const bGroupOrder = b.groupOrder || 0;

                if (aGroupOrder !== bGroupOrder) {
                    return aGroupOrder - bGroupOrder;
                }

                // Then sort by question order within the group
                return a.order - b.order;
            });
    };

    const getQuestionStatus = (question, submission) => {
        const correctComment = reviewData.comments?.find(c =>
            c.questionId === question.id && c.comment === 'Correct!'
        );
        if (correctComment) return 'correct';

        const hasComment = reviewData.comments?.find(c => c.questionId === question.id);
        if (hasComment && hasComment.comment !== 'Correct!') return 'incorrect';

        return 'pending';
    };

    const isQuestionCorrect = (questionId) => {
        const comment = reviewData.comments?.find(c => c.questionId === questionId);
        return comment?.isCorrect === true;
    };

    const getQuestionCommentData = (questionId) => {
        return reviewData.comments?.find(c => c.questionId === questionId) || {
            feedback: '',
            feedbackVisible: true,
            correctAnswer: '',
            isCorrect: null
        };
    };

    // CORRECTED renderAnswerContent function (remove the useEffect from inside)
    // In renderAnswerContent, replace the parameter logic:
    const renderAnswerContent = (question, answer) => {
        if (question.type === 'blast') {
            const isResearchClone = selectedSubmission && selectedSubmission.type === 'regular';

            if (isResearchClone) {
                // Get parameters specific to this question
                const questionParams = getBlastParamsForQuestion(question.id);
                const selectedSequence = questionParams.sourceSequence ?
                    getSequenceFromQuestion(questionParams.sourceSequence, selectedSubmission.answers) : null;

                const cacheKey = selectedSequence ?
                    generateCacheKey(question.id, selectedSequence, questionParams.program, questionParams.database) : null;

                const blastResults = cacheKey ? blastCache[cacheKey] : null;
                const isLoading = cacheKey ? loadingBlastResults[cacheKey] : false;

                // Debug logging
                console.log(`=== RENDER BLAST DEBUG (Question ${question.id}) ===`);
                console.log('Question params:', questionParams);
                console.log('Generated cache key:', cacheKey);
                console.log('Available cache keys:', Object.keys(blastCache));

                // Get available sequence sources
                const sequenceOptions = getSequenceSourceOptions();

                return (
                    <div className="space-y-4">
                        {/* Student's BLAST Results */}
                        <div>
                            <h6 className="text-sm font-medium text-gray-900 mb-2">Student's BLAST Results:</h6>
                            <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-gray-200">
                                        <tr>
                                            <th className="px-2 py-1 text-left font-medium text-gray-700">Accession</th>
                                            <th className="px-2 py-1 text-left font-medium text-gray-700">Definition</th>
                                            <th className="px-2 py-1 text-left font-medium text-gray-700">Organism</th>
                                            <th className="px-2 py-1 text-left font-medium text-gray-700">Start</th>
                                            <th className="px-2 py-1 text-left font-medium text-gray-700">End</th>
                                            <th className="px-2 py-1 text-left font-medium text-gray-700">E-value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {renderBlastAnswerRows(answer)}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* BLAST Search Controls */}
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <h6 className="text-sm font-medium text-gray-900 mb-3">BLAST Search Configuration</h6>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                {/* BLAST Program Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        BLAST Program:
                                    </label>
                                    <select
                                        value={questionParams.program}
                                        onChange={(e) => updateBlastParam(question.id, 'program', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="blastn">BLASTn (DNA vs DNA)</option>
                                        <option value="blastp">BLASTp (Protein vs Protein)</option>
                                        <option value="blastx">BLASTx (DNA vs Protein)</option>
                                    </select>
                                </div>

                                {/* Database Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Database:
                                    </label>
                                    <select
                                        value={questionParams.database}
                                        onChange={(e) => updateBlastParam(question.id, 'database', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="auto">Auto (recommended)</option>
                                        <option value="nt">core-nt (nucleotide)</option>
                                        <option value="nr">nr (protein - comprehensive)</option>
                                        <option value="ClusteredNR">ClusteredNR (protein - fast)</option>
                                    </select>
                                </div>

                                {/* Source Sequence Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Source Sequence:
                                    </label>
                                    <select
                                        value={questionParams.sourceSequence}
                                        onChange={(e) => updateBlastParam(question.id, 'sourceSequence', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">Select sequence source...</option>
                                        {sequenceOptions.map(option => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Buttons */}
                                {/* Replace the grid with 2 buttons with this 3-button grid */}
                                <div className="grid grid-cols-3 gap-2">
                                    {/* Get Cached Results Button */}
                                    <button
                                        onClick={() => {
                                            getCachedBlastResults(selectedSubmission, question.id);
                                        }}
                                        disabled={isLoading}
                                        className="px-2 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                Cache
                                            </>
                                        ) : (
                                            <>
                                                📋 Cache Only
                                            </>
                                        )}
                                    </button>

                                    {/* Smart Search Button */}
                                    <button
                                        onClick={() => {
                                            smartBlastSearch(selectedSubmission, question.id);
                                        }}
                                        disabled={isLoading}
                                        className="px-2 py-2 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                Smart
                                            </>
                                        ) : (
                                            <>
                                                🧠 Smart Search
                                            </>
                                        )}
                                    </button>

                                    {/* Run New Search Button */}
                                    <button
                                        onClick={() => {
                                            if (!selectedSequence) {
                                                alert('Please select a source sequence first');
                                                return;
                                            }
                                            runNewBlastSearch(selectedSubmission, question.id, selectedSequence);
                                        }}
                                        disabled={isLoading || !selectedSequence}
                                        className="px-2 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                New
                                            </>
                                        ) : (
                                            <>
                                                🔄 Force New
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Selected Sequence Preview */}
                            {selectedSequence && (
                                <div className="text-xs text-gray-600 bg-white rounded p-2 border">
                                    <strong>Selected sequence:</strong> {selectedSequence.substring(0, 80)}...
                                    <br />
                                    <strong>Length:</strong> {selectedSequence.length} bp
                                </div>
                            )}
                        </div>

                        {/* BLAST Results Display */}
                        <div>
                            <h6 className="text-sm font-medium text-gray-900 mb-2">
                                Director BLAST Results:
                            </h6>

                            {blastResults?.results ? (
                                <div className="bg-blue-50 rounded-lg p-3 overflow-x-auto border-2 border-blue-200">
                                    <table className="min-w-full text-xs border border-blue-300">
                                        <thead className="bg-blue-100">
                                            <tr>
                                                <th className="px-2 py-1 border-b text-left w-24">Accession</th>
                                                <th className="px-2 py-1 border-b text-left w-auto min-w-48">Definition</th>
                                                <th className="px-2 py-1 border-b text-left w-20">Organism</th>
                                                <th className="px-2 py-1 border-b text-left w-16">Start</th>
                                                <th className="px-2 py-1 border-b text-left w-16">End</th>
                                                <th className="px-2 py-1 border-b text-left w-20">E-value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderRealBlastResults(blastResults.results)}
                                        </tbody>
                                    </table>
                                    {blastResults.fromCache && (
                                        <div className="mt-2 text-xs text-green-600">
                                            Cached results from {new Date(blastResults.searchedAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            ) : blastResults?.status === 'error' ? (
                                <div className="bg-red-50 rounded-lg p-3 text-center border-2 border-red-200">
                                    <div className="text-sm text-red-600">
                                        ⚠️ BLAST search failed: {blastResults.error}
                                    </div>
                                </div>
                            ) : blastResults?.status === 'pending' || isLoading ? (
                                <div className="bg-yellow-50 rounded-lg p-6 text-center border-2 border-yellow-200">
                                    <div className="text-sm text-yellow-800">🔍 {blastResults?.message || 'Running BLAST search...'}</div>
                                    <div className="text-xs text-yellow-600 mt-1">This may take 10-30 seconds</div>
                                    <div className="w-8 h-8 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto mt-3"></div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-lg p-6 text-center border-2 border-gray-200">
                                    <div className="text-sm text-gray-600">
                                        No BLAST results available. Select sequence parameters and run a search.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            } else {
                // Original practice clone view remains unchanged
                return (
                    <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Accession</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Definition</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Organism</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">Start</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">End</th>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700">E-value</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {renderBlastAnswerRows(answer)}
                            </tbody>
                        </table>
                    </div>
                );
            }
        } else if (question.type === 'sequence_range') {
            const rangeAnswer = answer || { value1: '', value2: '' };
            const label1 = question.options?.label1 || 'Begin';
            const label2 = question.options?.label2 || 'End';

            return (
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-gray-600 mb-1">{label1}:</p>
                            <p className="text-sm text-gray-800 font-mono">{rangeAnswer.value1 || 'No answer'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-600 mb-1">{label2}:</p>
                            <p className="text-sm text-gray-800 font-mono">{rangeAnswer.value2 || 'No answer'}</p>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{answer}</p>
                    </div>

                    {/* Add Check Sequence button for DNA and Protein sequences */}
                    {(question.type === 'dna_sequence' || question.type === 'protein_sequence') && answer && (
                        <div className="flex justify-end">
                            <button
                                onClick={() => openSequenceAlignment(question, answer)}
                                className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Check Sequence</span>
                            </button>
                        </div>
                    )}
                </div>
            );
        }
    };

    const filteredSubmissions = getFilteredAndSortedSubmissions();

    const getCounts = () => {
        let filteredByType = submissions;

        // Apply clone type filter first
        if (cloneTypeFilter !== 'all') {
            filteredByType = submissions.filter(s => s.type === cloneTypeFilter);
        }

        return {
            pending: filteredByType.filter(s => s.reviewStatus === 'pending').length,
            resubmitted: filteredByType.filter(s => s.reviewStatus === 'resubmitted').length,
            all: filteredByType.length,
            practice: submissions.filter(s => s.type === 'practice').length,
            regular: submissions.filter(s => s.type === 'regular').length
        };
    };

    const counts = getCounts();

    if (loading) {
        return (
            <div className="min-h-96 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-sm border border-blue-200">
                <div className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-blue-600 font-medium">Loading submissions for review...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="h-[75vh] bg-gray-50 flex overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                {/* Collapsible Sidebar */}
                <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 flex flex-col overflow-hidden`}>
                    {/* Sidebar Header with Collapse Toggle */}
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                        {!sidebarCollapsed && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Review Queue</h3>
                                <p className="text-sm text-gray-600">{filteredSubmissions.length} submissions</p>
                            </div>
                        )}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
                        </button>
                    </div>

                    {/* Sidebar Content */}
                    <div className="flex-1 overflow-y-auto">
                        {sidebarCollapsed ? (
                            // Collapsed view - show avatars and status dots
                            <div className="p-2 space-y-3">
                                {filteredSubmissions.slice(0, 10).map(submission => (
                                    <div
                                        key={submission.id}
                                        onClick={() => selectSubmission(submission)}
                                        className={`relative w-12 h-12 rounded-full cursor-pointer transition-all ${selectedSubmission?.id === submission.id
                                            ? 'ring-2 ring-blue-500 ring-offset-2'
                                            : 'hover:ring-2 hover:ring-gray-300'
                                            }`}
                                    >
                                        {/* Student Avatar */}
                                        <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                            {submission.assignedTo.name.charAt(0)}
                                        </div>
                                        {/* Status Indicator */}
                                        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${submission.reviewStatus === 'pending' ? 'bg-yellow-500' :
                                            submission.reviewStatus === 'resubmitted' ? 'bg-orange-500' :
                                                submission.reviewStatus === 'teacher_reviewed' ? 'bg-green-500' :
                                                    'bg-gray-400'
                                            }`} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Expanded view - keep your existing submission list structure
                            <div className="p-4">
                                {/* Filters */}
                                <div className="mb-4">
                                    <div className="flex items-center space-x-2 mb-4">
                                        <select
                                            value={filter}
                                            onChange={(e) => setFilter(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                        >
                                            <option value="all">All Submissions</option>
                                            <option value="pending">Pending Review</option>
                                            <option value="resubmitted">Resubmitted</option>
                                            <option value="teacher_reviewed">Teacher Reviewed</option>
                                        </select>

                                        <select
                                            value={cloneTypeFilter}
                                            onChange={(e) => setCloneTypeFilter(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                        >
                                            <option value="all">All Types</option>
                                            <option value="regular">Regular Clones</option>
                                            <option value="practice">Practice Clones</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Submissions List */}
                                {filteredSubmissions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FileText className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h4 className="text-lg font-semibold text-gray-900 mb-2">No Submissions</h4>
                                        <p className="text-gray-500">
                                            {filter === 'pending' ? 'No submissions awaiting review' :
                                                filter === 'resubmitted' ? 'No resubmitted analyses waiting for review' :
                                                    'No submissions found'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredSubmissions.map(submission => (
                                            <div
                                                key={submission.id}
                                                onClick={() => selectSubmission(submission)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${selectedSubmission?.id === submission.id
                                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-semibold text-gray-900 text-sm truncate flex-1 mr-2">{submission.cloneName}</h4>
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${submission.reviewStatus === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                        submission.reviewStatus === 'resubmitted' ? 'bg-purple-100 text-purple-800' :
                                                            submission.reviewStatus === 'teacher_reviewed' ? 'bg-green-100 text-green-800' :
                                                                'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {submission.reviewStatus === 'pending' ? 'Pending' :
                                                            submission.reviewStatus === 'resubmitted' ? 'Resubmitted' :
                                                                submission.reviewStatus === 'teacher_reviewed' ? 'Teacher Reviewed' :
                                                                    'Unknown'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    <p className="truncate">{submission.assignedTo.name}</p>
                                                    <p>{submission.assignedTo.school?.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area - New Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Narrow Analysis Navigation (20%) */}
                    <div className="w-1/5 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
                        {selectedSubmission ? (
                            <>
                                {/* Student Info */}
                                <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                                            {selectedSubmission.assignedTo.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{selectedSubmission.assignedTo.name}</h3>
                                            <p className="text-sm text-gray-600">{selectedSubmission.cloneName}</p>
                                            <p className="text-xs text-gray-500">
                                                Submitted {new Date(selectedSubmission.submittedAt).toLocaleString(undefined, {
                                                    year: 'numeric',
                                                    month: 'numeric',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mt-3">
                                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                                            <span>Progress</span>
                                            <span>7/9 questions</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '78%' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Analysis Sections Navigation */}
                                <div className="flex-1 p-4 overflow-y-auto">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Analysis Sections</h4>
                                    <div className="space-y-1">
                                        {analysisSteps.map(step => {
                                            const questionsInSection = getQuestionsForSection(step.id, selectedSubmission.answers);
                                            const isCurrentSection = currentViewingSection === step.id;
                                            const colorClasses = {
                                                blue: 'border-blue-500 bg-blue-50',
                                                green: 'border-green-500 bg-green-50',
                                                purple: 'border-purple-500 bg-purple-50',
                                                orange: 'border-orange-500 bg-orange-50'
                                            };

                                            return (
                                                <button
                                                    key={step.id}
                                                    onClick={() => setCurrentViewingSection(step.id)}
                                                    className={`w-full p-2 rounded-lg text-left transition-all ${isCurrentSection
                                                        ? `border-2 ${colorClasses[step.color]}`
                                                        : 'border border-gray-200 bg-white hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <span className="font-medium text-sm">{step.name}</span>
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                ({questionsInSection.length} question{questionsInSection.length !== 1 ? 's' : ''})
                                                            </span>
                                                        </div>
                                                        {/* Status indicator */}
                                                        <div className={`w-4 h-4 rounded-full ${questionsInSection.every(q => getQuestionStatus(q, selectedSubmission) === 'correct')
                                                            ? 'bg-green-500'
                                                            : questionsInSection.some(q => getQuestionStatus(q, selectedSubmission) === 'incorrect')
                                                                ? 'bg-red-500'
                                                                : 'bg-yellow-500'
                                                            }`}>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Quick Review Actions */}
                                <div className="p-4 border-t border-gray-200 space-y-2 flex-shrink-0">
                                    Quick Actions:
                                    {selectedSubmission.type === 'practice' && (
                                        <button
                                            onClick={() => {
                                                setReviewData(prev => ({ ...prev, score: 100 }));
                                                submitReview('approved');
                                            }}
                                            disabled={saving}
                                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            <span>Mark PC Complete</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => submitReview('approved')}
                                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                    >
                                        ✓ Correct & Complete
                                    </button>
                                    <button
                                        onClick={() => submitReview('rejected')}
                                        className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                    >
                                        ✗ Needs Reanalysis
                                    </button>
                                    <button
                                        onClick={() => setShowFeedbackModal(true)}
                                        className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                                    >
                                        💬 Message
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-8 text-center">
                                <div>
                                    <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">Select a submission to review</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Large Review Panel (80%) */}
                    <div className="flex-1 bg-white flex flex-col overflow-hidden">
                        {selectedSubmission ? (
                            <>
                                {/* Review Panel Header */}
                                <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">

                                    {/* File Action Buttons Row */}
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => downloadFile(selectedSubmission)}
                                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span>Download .ab1</span>
                                            </button>

                                            <button
                                                onClick={handleChromatogramToggle}
                                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${showChromatogram
                                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                    }`}
                                            >
                                                <BarChart3 className="w-4 h-4" />
                                                <span>{showChromatogram ? 'Hide Chromatogram' : 'Show Chromatogram'}</span>
                                            </button>
                                        </div>
                                        {/* Chromatogram Section */}
                                        {showChromatogram && (
                                            <div className="mt-6 border-t border-gray-200 pt-6">
                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                                    <BarChart3 className="w-5 h-5 text-purple-600" />
                                                    <span>Chromatogram Viewer</span>
                                                </h3>

                                                {loadingChromatogram ? (
                                                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                                                        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                                        <p className="text-gray-600">Loading chromatogram data...</p>
                                                    </div>
                                                ) : chromatogramData ? (
                                                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                                        <ChromatogramViewer
                                                            fileData={chromatogramData}
                                                            fileName={selectedSubmission.filename || selectedSubmission.originalName || selectedSubmission.cloneName}
                                                            fileType={selectedSubmission.type}
                                                            onClose={() => setShowChromatogram(false)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                                                        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                                                        <p className="text-gray-600">No chromatogram data available</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Scrollable Content Area */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {/* Two-Column Questions Layout */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {getQuestionsForSection(currentViewingSection, selectedSubmission.answers).map((question, index) => {
                                            const commentData = getQuestionCommentData(question.id);
                                            const isMarkedCorrect = commentData.isCorrect === true;
                                            const isMarkedIncorrect = commentData.isCorrect === false;

                                            return (
                                                <div
                                                    key={question.id}
                                                    className={`border rounded-lg p-4 bg-white ${isMarkedCorrect ? 'border-green-500 bg-green-50' :
                                                            isMarkedIncorrect ? 'border-red-400 bg-red-50' :
                                                                'border-gray-200'
                                                        }`}
                                                >
                                                    {/* Question Header with Correct/Incorrect Buttons */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center space-x-2 flex-1">
                                                            <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                                                                Q{index + 1}
                                                            </span>
                                                            {isMarkedCorrect && (
                                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                            )}
                                                            {isMarkedIncorrect && (
                                                                <XCircle className="w-4 h-4 text-red-600" />
                                                            )}
                                                            <p className="font-medium text-sm text-gray-900">
                                                                {question.text}
                                                            </p>
                                                        </div>

                                                        {/* Correct/Incorrect Toggle Buttons */}
                                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                                            <button
                                                                onClick={() => markQuestionAsCorrect(question.id)}
                                                                className={`px-2 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${isMarkedCorrect
                                                                        ? 'bg-green-600 text-white'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                                                                    }`}
                                                            >
                                                                <CheckCircle className="w-3 h-3" />
                                                                <span>Correct</span>
                                                            </button>
                                                            <button
                                                                onClick={() => markQuestionAsIncorrect(question.id)}
                                                                className={`px-2 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${isMarkedIncorrect
                                                                        ? 'bg-red-600 text-white'
                                                                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                                                                    }`}
                                                            >
                                                                <XCircle className="w-3 h-3" />
                                                                <span>Incorrect</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Student Answer Display */}
                                                    <div className="mb-3">
                                                        <p className="text-sm font-medium text-gray-700 mb-2">Student Answer:</p>
                                                        <div className="bg-gray-50 p-3 rounded border text-sm">
                                                            {renderAnswerContent(question, selectedSubmission.answers[question.id])}
                                                        </div>

                                                        {/* Practice Answer Comparison */}
                                                        {selectedSubmission.type === 'practice' &&
                                                            renderPracticeAnswerComparison(question, selectedSubmission.answers[question.id])
                                                        }
                                                    </div>

                                                    {/* Feedback Section */}
                                                    <div className="space-y-3 border-t pt-3">
                                                        {/* Feedback Textarea with Common Feedback Dropdown */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-xs font-medium text-gray-700">
                                                                    Feedback for Student
                                                                </label>
                                                                {/* Common Feedback Dropdown */}
                                                                {getCommonFeedbackForQuestion(question.id).length > 0 && (
                                                                    <select
                                                                        onChange={(e) => {
                                                                            if (e.target.value) {
                                                                                const selectedOption = getCommonFeedbackForQuestion(question.id).find(
                                                                                    option => option.id === parseInt(e.target.value)
                                                                                );
                                                                                if (selectedOption) {
                                                                                    addComment(question.id, selectedOption.text, commentData.feedbackVisible);
                                                                                }
                                                                                e.target.value = ''; // Reset dropdown
                                                                            }
                                                                        }}
                                                                        className="text-xs border border-gray-300 rounded px-2 py-1"
                                                                    >
                                                                        <option value="">Quick Feedback...</option>
                                                                        {getCommonFeedbackForQuestion(question.id).map(option => (
                                                                            <option key={option.id} value={option.id}>
                                                                                {option.title}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </div>

                                                            <textarea
                                                                value={commentData.feedback}
                                                                onChange={(e) => addComment(question.id, e.target.value, commentData.feedbackVisible)}
                                                                placeholder="Add feedback for the student..."
                                                                rows={2}
                                                                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            />

                                                            {/* Visibility Checkbox */}
                                                            <div className="flex items-center space-x-2 mt-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`visible-${question.id}`}
                                                                    checked={commentData.feedbackVisible}
                                                                    onChange={(e) => updateFeedbackVisibility(question.id, e.target.checked)}
                                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                                />
                                                                <label htmlFor={`visible-${question.id}`} className="text-xs text-gray-700">
                                                                    Visible to student
                                                                </label>
                                                            </div>
                                                        </div>

                                                        {/* Correct Answer Field (Director-Only Reference) */}
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                                            <label className="text-xs font-medium text-yellow-900 mb-1 flex items-center space-x-1">
                                                                <Eye className="w-3 h-3" />
                                                                <span>Correct Answer (Director-Only Reference)</span>
                                                            </label>
                                                            <textarea
                                                                value={commentData.correctAnswer}
                                                                onChange={(e) => updateCorrectAnswer(question.id, e.target.value)}
                                                                placeholder="Enter the correct answer for reference (never shown to students)..."
                                                                rows={2}
                                                                className="w-full text-sm border border-yellow-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                                            />
                                                            <p className="text-xs text-yellow-700 mt-1">
                                                                ⚠️ This field is only visible to Directors/Instructors, never to students
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Show message if no questions in section */}
                                    {getQuestionsForSection(currentViewingSection, selectedSubmission.answers).length === 0 && (
                                        <div className="text-center py-12">
                                            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600">No questions in this section yet.</p>
                                        </div>
                                    )}

                                    {/* Chromatogram Section */}
                                    {showChromatogram && (
                                        <div className="mt-6 border-t border-gray-200 pt-6">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                                <BarChart3 className="w-5 h-5 text-purple-600" />
                                                <span>Chromatogram Viewer</span>
                                            </h3>

                                            {loadingChromatogram ? (
                                                <div className="bg-gray-50 rounded-lg p-8 text-center">
                                                    <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                                    <p className="text-gray-600">Loading chromatogram data...</p>
                                                </div>
                                            ) : chromatogramData ? (
                                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                                    <ChromatogramViewer
                                                        fileData={chromatogramData}
                                                        fileName={selectedSubmission.filename || selectedSubmission.originalName || selectedSubmission.cloneName}
                                                        fileType={selectedSubmission.type}
                                                        onClose={() => setShowChromatogram(false)}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="bg-gray-50 rounded-lg p-8 text-center">
                                                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                                                    <p className="text-gray-600">No chromatogram data available</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-center p-8">
                                <div>
                                    <Eye className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                                    <h4 className="text-xl font-bold text-gray-900 mb-3">Select a Submission to Review</h4>
                                    <p className="text-gray-600">Choose a submission from the list to start reviewing questions</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Enhanced Feedback Modal */}
            {showFeedbackModal && selectedSubmission && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
                            <h3 className="text-xl font-bold mb-2">
                                💬 Send Feedback Message
                            </h3>
                            <p className="text-green-100 opacity-90">
                                To: {selectedSubmission.assignedTo.name} • About: {selectedSubmission.cloneName}
                            </p>
                        </div>

                        <div className="p-6">
                            <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                rows={6}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none"
                                placeholder="Provide detailed, constructive feedback about the student's analysis. Be specific about what they did well and what areas need improvement..."
                            />
                            <p className="text-sm text-gray-500 mt-2">
                                {feedbackText.length}/1000 characters
                            </p>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
                            <button
                                onClick={() => {
                                    setShowFeedbackModal(false);
                                    setFeedbackText('');
                                }}
                                className="px-6 py-2 text-gray-600 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={sendFeedbackMessage}
                                disabled={!feedbackText.trim()}
                                className="px-8 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 flex items-center space-x-2 font-semibold shadow-lg"
                            >
                                <Send className="w-4 h-4" />
                                <span>Send Feedback</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sequence Alignment Modal */}
            {showSequenceModal && selectedSequenceData && (
                <SequenceAlignmentModal
                    isOpen={showSequenceModal}
                    onClose={() => {
                        setShowSequenceModal(false);
                        setSelectedSequenceData(null);
                    }}
                    studentSequence={selectedSequenceData.studentSequence}
                    questionText={selectedSequenceData.questionText}
                    sequenceType={selectedSequenceData.sequenceType}
                />
            )}
        </>
    );
};

export default InstructorAnalysisReview;