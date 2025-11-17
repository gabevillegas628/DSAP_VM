// components/DirectorPracticeAnswers.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

import apiService from '../services/apiService';

const DirectorPracticeAnswers = ({ isOpen, onClose, practiceClone }) => {
  const [analysisQuestions, setAnalysisQuestions] = useState([]);
  const [practiceAnswers, setPracticeAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set());

  useEffect(() => {
    if (isOpen && practiceClone) {
      loadData();
    }
  }, [isOpen, practiceClone]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load analysis questions
      const questions = await apiService.get('/analysis-questions');

      // Filter out non-answer question types
      const answerableQuestions = questions.filter(question =>
        !['text_header', 'section_divider', 'info_text', 'blast_comparison', 'sequence_display'].includes(question.type)
      );

      // Load existing practice answers
      const existingAnswers = await apiService.get(`/practice-clones/${practiceClone.id}/answers`);

      // Parse JSON strings back to objects for blast and sequence_range questions
      const parsedAnswers = existingAnswers.map(answer => {
        const question = answerableQuestions.find(q => q.id === answer.questionId);
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

      setAnalysisQuestions(answerableQuestions);
      setPracticeAnswers(parsedAnswers);

      console.log('Loaded questions:', questions.length);
      console.log('Loaded existing answers:', parsedAnswers.length);

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load questions and answers');
    } finally {
      setLoading(false);
    }
  };

  const getAnswerForQuestion = (questionId) => {
    return practiceAnswers.find(answer => answer.questionId === questionId) || {
      questionId,
      correctAnswer: '',
      explanation: ''
    };
  };

  const updateAnswer = (questionId, field, value) => {
    setPracticeAnswers(prev => {
      const existing = prev.find(answer => answer.questionId === questionId);
      if (existing) {
        return prev.map(answer =>
          answer.questionId === questionId
            ? { ...answer, [field]: value }
            : answer
        );
      } else {
        return [...prev, { questionId, correctAnswer: '', explanation: '', [field]: value }];
      }
    });
  };

  // Renamed function to handle both blast and sequence_range answer updates (originally UpdateBlastAnswer)
  const updateObjectAnswer = (questionId, fieldKey, value) => {
    setPracticeAnswers(prev => {
      const existing = prev.find(answer => answer.questionId === questionId);
      if (existing) {
        return prev.map(answer =>
          answer.questionId === questionId
            ? {
              ...answer,
              correctAnswer: {
                ...(typeof answer.correctAnswer === 'object' ? answer.correctAnswer : {}),
                [fieldKey]: value,
                // Clear value1 and value2 when isNA is checked
                ...(fieldKey === 'isNA' && value ? { value1: '', value2: '' } : {})
              }
            }
            : answer
        );
      } else {
        return [...prev, {
          questionId,
          correctAnswer: { [fieldKey]: value },
          explanation: ''
        }];
      }
    });
  };

  const saveAnswers = async () => {
    try {
      setSaving(true);

      // Prepare answers for saving - convert blast and sequence_range answers to JSON strings
      const answersToSave = practiceAnswers.map(answer => {
        const question = analysisQuestions.find(q => q.id === answer.questionId);
        if (question && (question.type === 'blast' || question.type === 'sequence_range') && typeof answer.correctAnswer === 'object') {
          return {
            ...answer,
            correctAnswer: JSON.stringify(answer.correctAnswer)
          };
        }
        return answer;
      }).filter(answer => {
        // Only save answers that have content
        if (!answer.correctAnswer) return false;

        const question = analysisQuestions.find(q => q.id === answer.questionId);

        if (question && question.type === 'sequence_range') {
          // For sequence_range, check if N/A is selected or at least one field has content
          if (typeof answer.correctAnswer === 'string') {
            try {
              const parsed = JSON.parse(answer.correctAnswer);
              return parsed.isNA || (parsed.value1 && parsed.value1.trim()) || (parsed.value2 && parsed.value2.trim());
            } catch (e) {
              return false;
            }
          } else if (typeof answer.correctAnswer === 'object') {
            return answer.correctAnswer.isNA ||
              (answer.correctAnswer.value1 && answer.correctAnswer.value1.trim()) ||
              (answer.correctAnswer.value2 && answer.correctAnswer.value2.trim());
          }
          return false;
        } else if (question && question.type === 'blast') {
          // For blast questions, assume if it's an object or non-empty string it has content
          return typeof answer.correctAnswer === 'string' ? answer.correctAnswer.trim() : true;
        } else {
          // For regular string answers
          return typeof answer.correctAnswer === 'string' ? answer.correctAnswer.trim() : !!answer.correctAnswer;
        }
      });

      console.log('Saving answers:', answersToSave.length);

      await apiService.post(`/practice-clones/${practiceClone.id}/answers`, {
        answers: answersToSave
      });

      alert('Answers saved successfully!');
    } catch (error) {
      console.error('Error saving answers:', error);
      alert('Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getQuestionsBySection = () => {
    const sections = {};
    analysisQuestions.forEach(question => {
      if (!sections[question.step]) {
        sections[question.step] = [];
      }
      sections[question.step].push(question);
    });

    // Sort questions within each section by order
    Object.keys(sections).forEach(sectionKey => {
      sections[sectionKey].sort((a, b) => a.order - b.order);
    });

    return sections;
  };

  const getSectionTitle = (step) => {
    const titles = {
      'clone-editing': 'Clone Editing & Quality Check',
      'blast': 'BLAST Analysis',
      'analysis-submission': 'Final Analysis',
      'review': 'Review Questions'
    };
    return titles[step] || step;
  };

  if (!isOpen) return null;

  const questionsBySection = getQuestionsBySection();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manage Practice Answers</h2>
            <p className="text-gray-600 mt-1">
              Set correct answers for: <span className="font-medium text-purple-600">{practiceClone?.cloneName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading questions...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Instructions:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• Enter the correct answer for each question you want to auto-grade</li>
                      <li>• Add optional explanations to help students learn from mistakes</li>
                      <li>• Leave questions blank if you don't want them auto-graded</li>
                      <li>• Students will see "Correct!" or your explanation as feedback</li>
                    </ul>
                  </div>
                </div>
              </div>

              {Object.keys(questionsBySection).reverse().map(sectionKey => {
                const questions = questionsBySection[sectionKey];
                const isExpanded = expandedSections.has(sectionKey);

                return (
                  <div key={sectionKey} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-medium text-gray-900">
                          {getSectionTitle(sectionKey)}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({questions.length} question{questions.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {questions.filter(q => getAnswerForQuestion(q.id).correctAnswer).length} answered
                        </span>
                        <div className="text-gray-400">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      </div>
                    </button>

                    {/* Section Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 bg-white">
                        {questions.map(question => {
                          const currentAnswer = getAnswerForQuestion(question.id);

                          return (
                            <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="mb-3">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-medium text-gray-900 flex-1">
                                    {question.text}
                                  </h4>
                                  {currentAnswer.correctAnswer && (
                                    <CheckCircle className="w-5 h-5 text-green-600 ml-2 mt-0.5" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Question ID: {question.id} | Type: {question.type}
                                </p>
                              </div>

                              <div className="space-y-3">
                                {question.type === 'blast' ? (
                                  // Blast question answer interface
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Correct BLAST Results
                                      </label>
                                      {question.options?.blastTitle && (
                                        <h6 className="text-sm font-medium text-gray-900 mb-2">{question.options.blastTitle}</h6>
                                      )}
                                      <div className="overflow-x-auto border border-gray-300 rounded-md">
                                        <table className="min-w-full">
                                          <thead className="bg-gray-50">
                                            <tr>
                                              <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Accession
                                              </th>
                                              <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Definition
                                              </th>
                                              <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Organism
                                              </th>
                                              <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                Start
                                              </th>
                                              <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                End
                                              </th>
                                              <th className="px-3 py-2 border-b border-gray-300 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                E-value
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Array.from({ length: question.options?.blastResultsCount || 5 }, (_, index) => {
                                              const blastAnswer = typeof currentAnswer.correctAnswer === 'object' ? currentAnswer.correctAnswer : {};
                                              return (
                                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                  <td className="px-3 py-2 border-b border-gray-200">
                                                    <input
                                                      type="text"
                                                      value={blastAnswer[`accession_${index}`] || ''}
                                                      onChange={(e) => updateObjectAnswer(question.id, `accession_${index}`, e.target.value)}
                                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="Accession"
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2 border-b border-gray-200">
                                                    <input
                                                      type="text"
                                                      value={blastAnswer[`definition_${index}`] || ''}
                                                      onChange={(e) => updateObjectAnswer(question.id, `definition_${index}`, e.target.value)}
                                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="Definition"
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2 border-b border-gray-200">
                                                    <input
                                                      type="text"
                                                      value={blastAnswer[`organism_${index}`] || ''}
                                                      onChange={(e) => updateObjectAnswer(question.id, `organism_${index}`, e.target.value)}
                                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="Organism"
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2 border-b border-gray-200">
                                                    <input
                                                      type="text"
                                                      value={blastAnswer[`start_${index}`] || ''}
                                                      onChange={(e) => updateObjectAnswer(question.id, `start_${index}`, e.target.value)}
                                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="Start"
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2 border-b border-gray-200">
                                                    <input
                                                      type="text"
                                                      value={blastAnswer[`end_${index}`] || ''}
                                                      onChange={(e) => updateObjectAnswer(question.id, `end_${index}`, e.target.value)}
                                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="End"
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2 border-b border-gray-200">
                                                    <input
                                                      type="text"
                                                      value={blastAnswer[`evalue_${index}`] || ''}
                                                      onChange={(e) => updateObjectAnswer(question.id, `evalue_${index}`, e.target.value)}
                                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                      placeholder="E-value"
                                                    />
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Enter the correct values for each BLAST result row. Students will see these as the expected answers.
                                      </p>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Explanation (Optional)
                                      </label>
                                      <textarea
                                        value={currentAnswer.explanation || ''}
                                        onChange={(e) => updateAnswer(question.id, 'explanation', e.target.value)}
                                        placeholder="Optional explanation to show when student gets it wrong..."
                                        rows="2"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                ) : question.type === 'sequence_range' ? (
                                  // Sequence range question answer interface
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Correct Range Values
                                      </label>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">
                                            {question.options?.label1 || 'Begin'}
                                          </label>
                                          <input
                                            type="text"
                                            value={(typeof currentAnswer.correctAnswer === 'object' ?
                                              currentAnswer.correctAnswer.value1 : '') || ''}
                                            onChange={(e) => updateObjectAnswer(question.id, 'value1', e.target.value)}
                                            placeholder="Enter start value..."
                                            disabled={typeof currentAnswer.correctAnswer === 'object' && currentAnswer.correctAnswer.isNA}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-600 mb-1">
                                            {question.options?.label2 || 'End'}
                                          </label>
                                          <input
                                            type="text"
                                            value={(typeof currentAnswer.correctAnswer === 'object' ?
                                              currentAnswer.correctAnswer.value2 : '') || ''}
                                            onChange={(e) => updateObjectAnswer(question.id, 'value2', e.target.value)}
                                            placeholder="Enter end value..."
                                            disabled={typeof currentAnswer.correctAnswer === 'object' && currentAnswer.correctAnswer.isNA}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {question.options?.allowNA && (
                                      <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={(typeof currentAnswer.correctAnswer === 'object' && currentAnswer.correctAnswer.isNA) || false}
                                          onChange={(e) => updateObjectAnswer(question.id, 'isNA', e.target.checked)}
                                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">N/A (Not Applicable)</span>
                                      </label>
                                    )}

                                    <div className="bg-blue-50 p-3 rounded-md">
                                      <p className="text-sm text-blue-800">
                                        Students will see these as the expected range values.
                                      </p>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Explanation (Optional)
                                      </label>
                                      <textarea
                                        value={currentAnswer.explanation || ''}
                                        onChange={(e) => updateAnswer(question.id, 'explanation', e.target.value)}
                                        placeholder="Optional explanation to show when student gets it wrong..."
                                        rows="2"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  // Regular question answer interface  
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Correct Answer
                                      </label>
                                      <input
                                        type="text"
                                        value={currentAnswer.correctAnswer || ''}
                                        onChange={(e) => updateAnswer(question.id, 'correctAnswer', e.target.value)}
                                        placeholder="Enter the correct answer..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Explanation (Optional)
                                      </label>
                                      <textarea
                                        value={currentAnswer.explanation || ''}
                                        onChange={(e) => updateAnswer(question.id, 'explanation', e.target.value)}
                                        placeholder="Optional explanation to show when student gets it wrong..."
                                        rows="2"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={saveAnswers}
            disabled={saving || loading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Answers'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectorPracticeAnswers;