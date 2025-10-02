// components/CloneReviewModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Eye,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Save,
  Clock,
  User,
  FileText
} from 'lucide-react';

import apiService from '../services/apiService';

const CloneReviewModal = ({ isOpen, onClose, cloneId, studentName, cloneType = 'regular', studentId }) => {
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [analysisQuestions, setAnalysisQuestions] = useState([]);
  const [reviewData, setReviewData] = useState({
    score: 0,
    comments: [],
    overallFeedback: ''
  });
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState(new Set());
  const [saving, setSaving] = useState(false);



  const fetchCloneData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching clone data for ID:', cloneId, 'Type:', cloneType);

      let fileData = null;

      if (cloneType === 'practice') {
        // For practice clones, we need to get the UserPracticeProgress
        const progressData = await apiService.get(`/practice-clones/${cloneId}/progress/${studentId}`);

        // Also get the practice clone info
        const practiceClones = await apiService.get('/practice-clones');
        const practiceClone = practiceClones.find(pc => pc.id === parseInt(cloneId));

        if (!practiceClone) {
          throw new Error(`Practice clone with ID ${cloneId} not found`);
        }

        // Create a structure similar to regular clones
        fileData = {
          id: cloneId,
          cloneName: practiceClone.cloneName,
          originalName: practiceClone.originalName,
          progress: progressData.progress || 0,
          status: progressData.status || 'Available',
          analysisData: JSON.stringify({
            answers: progressData.answers || {},
            currentStep: progressData.currentStep || 'clone-editing',
            reviewComments: progressData.reviewComments || [],
            reviewScore: progressData.reviewScore || 0,
            submittedAt: progressData.submittedAt,
            lastReviewed: progressData.lastReviewed
          }),
          type: 'practice'
        };

      } else {
        // Regular clone logic (existing)
        const allFiles = await apiService.get('/uploaded-files');
        fileData = allFiles.find(file => file.id === parseInt(cloneId));

        if (!fileData) {
          throw new Error(`File with ID ${cloneId} not found`);
        }

        fileData.type = 'regular';
      }

      console.log('🎯 Found file data:', fileData);

      // Parse analysis data
      let parsedAnalysis = {};
      try {
        if (fileData.analysisData) {
          parsedAnalysis = JSON.parse(fileData.analysisData);
          console.log('📊 Parsed analysis data:', parsedAnalysis);
        }
      } catch (e) {
        console.error('⚠️ Error parsing analysis data:', e);
      }

      const enrichedSubmission = {
        ...fileData,
        answers: parsedAnalysis.answers || {},
        currentStep: parsedAnalysis.currentStep || 'clone-editing',
        submittedAt: parsedAnalysis.submittedAt || fileData.updatedAt,
        lastReviewed: parsedAnalysis.lastReviewed,
        reviewComments: parsedAnalysis.reviewComments || [],
        reviewScore: parsedAnalysis.reviewScore || 0
      };

      console.log('🎯 Final submission object:', enrichedSubmission);

      setSubmission(enrichedSubmission);
      setReviewData({
        score: enrichedSubmission.reviewScore || 0,
        comments: enrichedSubmission.reviewComments || [],
        overallFeedback: ''
      });

    } catch (error) {
      console.error('⚠️ Error fetching clone data:', error);

      setSubmission({
        id: cloneId,
        cloneName: 'Error loading data',
        progress: 0,
        status: 'Error',
        answers: {},
        analysisData: null,
        type: cloneType
      });
    } finally {
      setLoading(false);
    }
  }, [cloneId, cloneType, studentId]);

  // Fetch clone data and analysis questions when modal opens
  useEffect(() => {
    if (isOpen && cloneId) {
      fetchCloneData();
      fetchAnalysisQuestions();
    }
  }, [isOpen, cloneId, fetchCloneData]);

  const fetchAnalysisQuestions = async () => {
    try {
      console.log('🔍 Fetching analysis questions...');
      const questions = await apiService.get('/analysis-questions');
      console.log('📋 Analysis questions loaded:', questions.length, 'questions');
      console.log('📋 Questions:', questions);
      setAnalysisQuestions(questions);
    } catch (error) {
      console.error('⚠️ Error fetching analysis questions:', error);
    }
  };

  const getQuestionText = (questionId) => {
    const question = analysisQuestions.find(q => q.id === questionId);
    return question ? question.text : 'Question not found';
  };

  const getSectionsWithAnswers = (answers) => {
    const sectionsWithAnswers = new Set();
    analysisQuestions.forEach(question => {
      if (answers[question.id] !== undefined && answers[question.id] !== '') {
        sectionsWithAnswers.add(question.step);
      }
    });
    const reversedSectionsWithAnswers = new Set(Array.from(sectionsWithAnswers).reverse());
    return reversedSectionsWithAnswers;
    //return sectionsWithAnswers;
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

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };


  const addQuestionComment = (questionId, comment) => {
    if (!comment.trim()) return;

    const newComment = {
      id: Date.now(),
      questionId: questionId,
      feedback: comment.trim(),  // renamed from "comment"
      feedbackVisible: true,  // NEW - default to visible
      correctAnswer: '',  // NEW - empty by default
      isCorrect: null,  // NEW - not marked correct/incorrect yet
      timestamp: new Date().toISOString()
    };

    setReviewData(prev => ({
      ...prev,
      comments: [...prev.comments, newComment]
    }));
  };

  const markQuestionAsCorrect = (questionId) => {
    const correctComment = {
      id: Date.now(),
      questionId: questionId,
      feedback: '',  // No feedback text for correct answers
      feedbackVisible: true,
      correctAnswer: '',
      isCorrect: true,  // NEW - proper boolean instead of type: 'correct'
      timestamp: new Date().toISOString()
    };

    // Remove any existing comments for this question, then add correct comment
    setReviewData(prev => ({
      ...prev,
      comments: [
        ...prev.comments.filter(c => c.questionId !== questionId),
        correctComment
      ]
    }));
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

  const renderAnswerContent = (question, answer) => {
    if (question.type === 'blast') {
      return (
        <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 border-b border-gray-300 text-left font-medium text-gray-700">Accession</th>
                <th className="px-2 py-1 border-b border-gray-300 text-left font-medium text-gray-700">Definition</th>
                <th className="px-2 py-1 border-b border-gray-300 text-left font-medium text-gray-700">Organism</th>
                <th className="px-2 py-1 border-b border-gray-300 text-left font-medium text-gray-700">Start</th>
                <th className="px-2 py-1 border-b border-gray-300 text-left font-medium text-gray-700">End</th>
                <th className="px-2 py-1 border-b border-gray-300 text-left font-medium text-gray-700">E-value</th>
              </tr>
            </thead>
            <tbody>
              {renderBlastAnswerRows(answer)}
            </tbody>
          </table>
        </div>
      );
    }

    if (question.type === 'sequence') {
      return (
        <div className="bg-gray-50 rounded-lg p-3">
          <pre className="font-mono text-xs whitespace-pre-wrap break-words">
            {answer}
          </pre>
        </div>
      );
    }

    // Add this case to renderAnswer() in CloneReviewModal.jsx
    if (question.type === 'sequence_range') {
      const rangeAnswer = answer || { value1: '', value2: '' };
      const label1 = question.options?.label1 || 'Begin';
      const label2 = question.options?.label2 || 'End';

      return (
        <div className="bg-white border rounded-lg p-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">{label1}:</p>
              <p className="text-sm text-gray-800">{rangeAnswer.value1 || 'No answer'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">{label2}:</p>
              <p className="text-sm text-gray-800">{rangeAnswer.value2 || 'No answer'}</p>
            </div>
          </div>
        </div>
      );
    }

    // Default text answer
    return (
      <div className="bg-white border rounded-lg p-3">
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{answer}</p>
      </div>
    );
  };

  const saveReview = async () => {
    if (!submission) return;

    setSaving(true);
    try {
      if (submission.type === 'practice') {
        // For practice clones, save to UserPracticeProgress
        await apiService.put(`/practice-clones/${cloneId}/progress/${studentId}`, {
          progress: submission.progress,
          answers: submission.answers,
          currentStep: submission.currentStep,
          reviewComments: reviewData.comments,
          reviewScore: reviewData.score,
          lastReviewed: new Date().toISOString()
        });

      } else {
        // Regular clone logic (existing)
        const updatedAnalysisData = {
          ...JSON.parse(submission.analysisData || '{}'),
          reviewComments: reviewData.comments,
          reviewScore: reviewData.score,
          lastReviewed: new Date().toISOString()
        };

        await apiService.put(`/uploaded-files/${submission.id}/progress`, {
          progress: submission.progress,
          answers: submission.answers,
          currentStep: submission.currentStep,
          reviewComments: reviewData.comments,
          reviewScore: reviewData.score,
          lastReviewed: new Date().toISOString(),
          analysisData: JSON.stringify(updatedAnalysisData)
        });
      }

      alert('Review saved successfully!');
      // Optionally refresh the data
      await fetchCloneData();

    } catch (error) {
      console.error('Error saving review:', error);
      alert('Failed to save review: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const sectionsWithAnswers = submission ? getSectionsWithAnswers(submission.answers) : new Set();
  const sectionNames = {
    'clone-editing': 'Clone Editing & Quality',
    'sequence-analysis': 'Sequence Analysis',
    'blast-search': 'BLAST Search & Results',
    'analysis-results': 'Analysis & Results',
    'final-review': 'Final Review & Conclusions'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Review Analysis</h2>
                <p className="text-sm text-gray-600">
                  {studentName} • {submission?.cloneName || 'Loading...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Info Bar */}
          {submission && (
            <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>Progress: {submission.progress}%</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileText className="w-4 h-4" />
                <span>Status: {submission.status}</span>
              </div>
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" />
                <span>Score: {reviewData.score}/100</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading analysis data...</p>
              </div>
            </div>
          ) : submission ? (
            <div className="h-full overflow-y-auto p-6">


              {/* Analysis Sections */}
              <div className="space-y-4">
                {sectionsWithAnswers.size === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-600 mb-2">No Analysis Data Found</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      This student hasn't started working on this analysis yet, or the data isn't saved properly.
                    </p>
                    <div className="text-xs text-gray-400">
                      <p>Possible reasons:</p>
                      <ul className="mt-1 space-y-1">
                        <li>• Student hasn't begun analysis</li>
                        <li>• No analysis questions configured</li>
                        <li>• Analysis data not saved to database</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  Array.from(sectionsWithAnswers).map(sectionId => {
                    const questions = getQuestionsForSection(sectionId, submission.answers);
                    if (questions.length === 0) return null;

                    return (
                      <div key={sectionId} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(sectionId)}
                          className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {expandedSections.has(sectionId) ?
                              <ChevronDown className="w-5 h-5 text-gray-600" /> :
                              <ChevronRight className="w-5 h-5 text-gray-600" />
                            }
                            <h3 className="text-lg font-semibold text-gray-900">
                              {sectionNames[sectionId] || sectionId}
                            </h3>
                          </div>
                          <span className="text-sm text-gray-500">
                            {questions.length} question{questions.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Section Content */}
                        {expandedSections.has(sectionId) && (
                          <div className="p-4 space-y-4 border-t border-gray-200">
                            {questions.map((question, index) => {
                              const answer = submission.answers[question.id];
                              const questionComments = reviewData.comments.filter(c => c.questionId === question.id);
                              const isMarkedCorrect = questionComments.some(c => c.isCorrect === true);

                              return (
                                <div
                                  key={question.id}
                                  className={`border rounded-lg p-4 ${isMarkedCorrect ? 'border-green-400 bg-green-50' : 'border-gray-200'
                                    }`}
                                >
                                  {/* Question Header */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-start space-x-3 flex-1">
                                      <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded flex-shrink-0">
                                        Q{index + 1}
                                      </span>
                                      {isMarkedCorrect && (
                                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                      )}
                                      <p className="font-medium text-sm text-gray-900">
                                        {getQuestionText(question.id)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => markQuestionAsCorrect(question.id)}
                                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center space-x-1 flex-shrink-0"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      <span>Mark Correct</span>
                                    </button>
                                  </div>

                                  {/* Answer Display */}
                                  <div className="mb-3">
                                    {renderAnswerContent(question, answer)}
                                  </div>

                                  {/* Existing Comments */}
                                  {questionComments.length > 0 && (
                                    <div className="mb-3 space-y-1">
                                      {questionComments.map(comment => (
                                        <div
                                          key={comment.id}
                                          className={`text-xs px-2 py-1 rounded ${comment.isCorrect === true
                                              ? 'bg-green-100 text-green-800'
                                              : comment.isCorrect === false
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}
                                        >
                                          {comment.isCorrect === true ? '✓ Correct' :
                                            comment.isCorrect === false ? '✗ Needs Improvement' :
                                              comment.feedback}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Add Comment Input */}
                                  <div className="flex space-x-2">
                                    <input
                                      type="text"
                                      placeholder="Add feedback comment..."
                                      className="flex-1 text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                          addQuestionComment(question.id, e.target.value);
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        const input = e.target.parentElement.querySelector('input');
                                        if (input.value.trim()) {
                                          addQuestionComment(question.id, input.value);
                                          input.value = '';
                                        }
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No analysis data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {submission && (
          <div className="p-6 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Score:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={reviewData.score}
                    onChange={(e) => setReviewData(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
                    className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                  />
                  <span className="text-sm text-gray-500">/100</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={saveReview}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Review</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloneReviewModal;