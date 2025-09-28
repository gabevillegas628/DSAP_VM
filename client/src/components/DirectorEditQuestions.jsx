// components/DirectorEditQuestions.jsx - Updated to use apiService
import React, { useState, useEffect } from 'react';
import { Edit, Trash2, AlertCircle } from 'lucide-react';
import apiService from '../services/apiService';


const DirectorEditQuestions = () => {
  const [analysisQuestions, setAnalysisQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAnalysisQuestionForm, setShowAnalysisQuestionForm] = useState(false);
  const [editingAnalysisQuestion, setEditingAnalysisQuestion] = useState(null);
  const [newAnalysisQuestion, setNewAnalysisQuestion] = useState({
    step: 'clone-editing',
    text: '',
    type: 'yes_no',
    required: true,
    order: 1,
    conditionalLogic: null,
    options: [],
    blastResultsCount: 3,
    blastTitle: '',
    questionGroup: '',
    groupOrder: 0
  });

  // Fetch analysis questions from API
  useEffect(() => {
    fetchAnalysisQuestions();
  }, []);

  const fetchAnalysisQuestions = async () => {
    try {
      const data = await apiService.get('/analysis-questions');
      setAnalysisQuestions(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analysis questions:', error);
      setLoading(false);
    }
  };

  const addAnalysisQuestion = async () => {
    if (newAnalysisQuestion.text.trim()) {
      try {
        const questionData = {
          ...newAnalysisQuestion,
          options: newAnalysisQuestion.type === 'select' ? newAnalysisQuestion.options :
            newAnalysisQuestion.type === 'blast' ? {
              blastResultsCount: newAnalysisQuestion.blastResultsCount,
              blastTitle: newAnalysisQuestion.blastTitle
            } :
              newAnalysisQuestion.type === 'blast_comparison' ? {
                blastQuestion1Id: newAnalysisQuestion.options?.blastQuestion1Id,
                blastQuestion2Id: newAnalysisQuestion.options?.blastQuestion2Id
              } :
                newAnalysisQuestion.type === 'sequence_range' ? {
                  label1: newAnalysisQuestion.options?.label1 || 'Begin',
                  label2: newAnalysisQuestion.options?.label2 || 'End'
                } :
                  newAnalysisQuestion.type === 'sequence_display' ? {
                    sourceQuestionId: newAnalysisQuestion.options?.sourceQuestionId
                  } : undefined,
          questionGroup: newAnalysisQuestion.questionGroup || null,
          groupOrder: newAnalysisQuestion.groupOrder || 0
        };

        const question = await apiService.post('/analysis-questions', questionData);
        setAnalysisQuestions(prev => [...prev, question]);
        setShowAnalysisQuestionForm(false);
        setNewAnalysisQuestion({
          step: 'clone-editing',
          text: '',
          type: 'text',
          required: true,
          order: 1,
          conditionalLogic: null,
          options: [],
          blastResultsCount: 5,
          blastTitle: '',
          questionGroup: '',
          groupOrder: 0
        });
      } catch (error) {
        console.error('Error adding analysis question:', error);
      }
    }
  };

  const updateAnalysisQuestion = async (questionId, updates) => {
    try {
      const updateData = {
        ...updates,
        options: updates.type === 'select' ? updates.options :
          updates.type === 'blast' ? {
            blastResultsCount: updates.blastResultsCount,
            blastTitle: updates.blastTitle
          } :
            updates.type === 'blast_comparison' ? {
              blastQuestion1Id: updates.options?.blastQuestion1Id,
              blastQuestion2Id: updates.options?.blastQuestion2Id
            } :
              updates.type === 'sequence_range' ? {
                label1: updates.options?.label1 || 'Begin',
                label2: updates.options?.label2 || 'End'
              } :
                newAnalysisQuestion.type === 'sequence_display' ? {
                  sourceQuestionId: newAnalysisQuestion.options?.sourceQuestionId
                } : undefined
      };

      const updatedQuestion = await apiService.put(`/analysis-questions/${questionId}`, updateData);
      setAnalysisQuestions(prev => prev.map(q =>
        q.id === questionId ? updatedQuestion : q
      ));
      setEditingAnalysisQuestion(null);
    } catch (error) {
      console.error('Error updating analysis question:', error);
    }
  };

  const deleteAnalysisQuestion = async (questionId) => {
    // Check if other questions depend on this one
    const dependentQuestions = analysisQuestions.filter(q =>
      q.conditionalLogic?.showIf?.questionId === questionId
    );

    if (dependentQuestions.length > 0) {
      const dependentNames = dependentQuestions.map(q => `"${q.text}"`).join(', ');
      alert(`Cannot delete this question because the following questions depend on it:\n\n${dependentNames}\n\nPlease remove the conditional logic from these questions first.`);
      return;
    }

    if (window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      try {
        await apiService.delete(`/analysis-questions/${questionId}`);
        setAnalysisQuestions(prev => prev.filter(q => q.id !== questionId));
      } catch (error) {
        console.error('Error deleting analysis question:', error);
      }
    }
  };

  const editAnalysisQuestion = (question) => {
    setEditingAnalysisQuestion(question.id);

    let optionsToSet = {};
    if (question.type === 'blast_comparison' && question.options) {
      optionsToSet = {
        blastQuestion1Id: question.options.blastQuestion1Id,
        blastQuestion2Id: question.options.blastQuestion2Id
      };
    } else if (question.type === 'select') {
      optionsToSet = question.options || [];
    } else if (question.type === 'sequence_range' && question.options) {
      optionsToSet = {
        label1: question.options.label1 || '',
        label2: question.options.label2 || ''
      };
    } else {
      optionsToSet = {};
    }

    setNewAnalysisQuestion({
      step: question.step,
      text: question.text,
      type: question.type,
      required: question.required,
      order: question.order,
      conditionalLogic: question.conditionalLogic,
      options: optionsToSet,
      blastResultsCount: question.options?.blastResultsCount || 5,
      blastTitle: question.options?.blastTitle || '',
      questionGroup: question.questionGroup || '',
      groupOrder: question.groupOrder || 0
    });
    setShowAnalysisQuestionForm(true);
  };

  const saveEditedQuestion = async () => {
    if (newAnalysisQuestion.text.trim()) {
      await updateAnalysisQuestion(editingAnalysisQuestion, {
        ...newAnalysisQuestion,
        options: newAnalysisQuestion.type === 'select' ? newAnalysisQuestion.options :
          newAnalysisQuestion.type === 'blast' ? {
            blastResultsCount: newAnalysisQuestion.blastResultsCount,
            blastTitle: newAnalysisQuestion.blastTitle
          } :
            newAnalysisQuestion.type === 'blast_comparison' ? {
              blastQuestion1Id: newAnalysisQuestion.options?.blastQuestion1Id,
              blastQuestion2Id: newAnalysisQuestion.options?.blastQuestion2Id
            } :
              newAnalysisQuestion.type === 'sequence_range' ? {
                label1: newAnalysisQuestion.options?.label1 || 'Begin',
                label2: newAnalysisQuestion.options?.label2 || 'End'
              } : undefined,
        questionGroup: newAnalysisQuestion.questionGroup || null,
        groupOrder: newAnalysisQuestion.groupOrder || 0
      });
      setShowAnalysisQuestionForm(false);
      setNewAnalysisQuestion({
        step: 'clone-editing',
        text: '',
        type: 'yes_no',
        required: true,
        order: 1,
        conditionalLogic: null,
        options: [],
        blastResultsCount: 5,
        blastTitle: '',
        questionGroup: '',
        groupOrder: 0
      });
    }
  };

  const addOption = () => {
    setNewAnalysisQuestion(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const updateOption = (index, value) => {
    setNewAnalysisQuestion(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeOption = (index) => {
    setNewAnalysisQuestion(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const addConditionalLogic = () => {
    setNewAnalysisQuestion(prev => ({
      ...prev,
      conditionalLogic: {
        showIf: {
          questionId: '',
          answer: ''
        }
      }
    }));
  };

  const removeConditionalLogic = () => {
    setNewAnalysisQuestion(prev => ({
      ...prev,
      conditionalLogic: null
    }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 text-center">
          <p className="text-gray-600">Loading analysis questions...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Analysis Question Management</h3>
            <p className="text-sm text-gray-600 mt-1">Manage questions for the student analysis workflow</p>
          </div>
          <button
            onClick={() => setShowAnalysisQuestionForm(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200"
          >
            + Add Analysis Question
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {/* Add Question Form */}
            {showAnalysisQuestionForm && (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-indigo-900">
                    {editingAnalysisQuestion ? 'Edit Analysis Question' : 'Add New Analysis Question'}
                  </h4>
                  <div className="flex items-center space-x-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Step</label>
                        <select
                          value={newAnalysisQuestion.step}
                          onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, step: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="clone-editing">Clone Editing</option>
                          <option value="blast">BLAST Analysis</option>
                          <option value="analysis-submission">Analysis Submission</option>
                          <option value="review">Review</option>
                        </select>
                      </div>

                      {/* NEW: Question Group */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Group (optional)
                        </label>
                        <input
                          type="text"
                          value={newAnalysisQuestion.questionGroup}
                          onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, questionGroup: e.target.value }))}
                          placeholder="e.g., Quality Assessment, Results Analysis"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave blank for ungrouped questions
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Question Order</label>
                        <input
                          type="number"
                          value={newAnalysisQuestion.order}
                          onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, order: parseInt(e.target.value) }))}
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      {/* NEW: Group Order */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Group Order
                        </label>
                        <input
                          type="number"
                          value={newAnalysisQuestion.groupOrder}
                          onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, groupOrder: parseInt(e.target.value) }))}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Controls the order of groups within each step
                        </p>
                      </div>
                    </div>



                    <div className="flex items-center">
                      <label htmlFor="type-analysis" className="text-sm font-medium text-gray-700 mr-2">Type:</label>
                      <select
                        id="type-analysis"
                        value={newAnalysisQuestion.type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          setNewAnalysisQuestion({
                            ...newAnalysisQuestion,
                            type: newType,
                            options: newType === 'blast_comparison' ? {} : []
                          });
                        }} className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="yes_no">Yes/No</option>
                        <option value="text">Text</option>
                        <option value="sequence_range">Sequence Range</option>
                        <option value="textarea">Long Text</option>
                        <option value="dna_sequence">DNA Sequence</option>
                        <option value="protein_sequence">Protein Sequence</option>
                        <option value="number">Number</option>
                        <option value="select">Multiple Choice</option>
                        <option value="blast">BLAST Results</option>
                        <option value="blast_comparison">BLAST Table Comparison</option>
                        <option value="sequence_display">Sequence Display</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <label htmlFor="order-analysis" className="text-sm font-medium text-gray-700 mr-2">Order:</label>
                      <input
                        type="number"
                        id="order-analysis"
                        min="1"
                        value={newAnalysisQuestion.order}
                        onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, order: parseInt(e.target.value) || 1 })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="required-analysis"
                        checked={newAnalysisQuestion.required}
                        onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, required: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="required-analysis" className="ml-2 block text-sm text-gray-900">
                        Required question
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                    <textarea
                      value={newAnalysisQuestion.text}
                      onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows="3"
                      placeholder="Enter your question..."
                    />
                  </div>

                  {newAnalysisQuestion.type === 'blast' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">BLAST Table Title</label>
                        <input
                          type="text"
                          value={newAnalysisQuestion.blastTitle}
                          onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, blastTitle: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="e.g., Top BLAST Results"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Number of Results</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={newAnalysisQuestion.blastResultsCount}
                          onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, blastResultsCount: parseInt(e.target.value) || 3 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {newAnalysisQuestion.type === 'sequence_range' && (
                    <div className="space-y-4 border-t pt-4">
                      <h5 className="font-medium text-gray-700">Sequence Range Configuration</h5>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            First Field Label
                          </label>
                          <input
                            type="text"
                            value={newAnalysisQuestion.options?.label1 || ''}
                            onChange={(e) => setNewAnalysisQuestion({
                              ...newAnalysisQuestion,
                              options: {
                                ...newAnalysisQuestion.options,
                                label1: e.target.value
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., Start Position, Title 1"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Second Field Label
                          </label>
                          <input
                            type="text"
                            value={newAnalysisQuestion.options?.label2 || ''}
                            onChange={(e) => setNewAnalysisQuestion({
                              ...newAnalysisQuestion,
                              options: {
                                ...newAnalysisQuestion.options,
                                label2: e.target.value
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., End Position, Title 2"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {newAnalysisQuestion.type === 'select' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">Answer Options</label>
                        <button
                          type="button"
                          onClick={addOption}
                          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition duration-200"
                        >
                          + Add Option
                        </button>
                      </div>
                      {newAnalysisQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder={`Option ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="text-red-600 hover:text-red-800 p-2"
                            title="Remove option"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {newAnalysisQuestion.options.length === 0 && (
                        <p className="text-sm text-gray-500 italic">Click "Add Option" to create multiple choice answers</p>
                      )}
                    </div>
                  )}

                  {/* BLAST Comparison Configuration */}
                  {newAnalysisQuestion.type === 'blast_comparison' && (
                    <div className="space-y-4 border-t pt-4">
                      <h5 className="font-medium text-gray-700">BLAST Comparison Configuration</h5>

                      {/* Debug info */}
                      <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                        Debug: options = {JSON.stringify(newAnalysisQuestion.options)}<br />
                        blastQuestion1Id = {newAnalysisQuestion.options?.blastQuestion1Id}<br />
                        blastQuestion2Id = {newAnalysisQuestion.options?.blastQuestion2Id}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First BLAST Question
                          </label>
                          <select
                            value={newAnalysisQuestion.options?.blastQuestion1Id || ''}
                            onChange={(e) => {
                              console.log('First BLAST dropdown changed:', e.target.value);
                              console.log('Current options before change:', newAnalysisQuestion.options);

                              setNewAnalysisQuestion({
                                ...newAnalysisQuestion,
                                options: {
                                  ...newAnalysisQuestion.options,
                                  blastQuestion1Id: e.target.value || null
                                }
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          >
                            <option value="">Select a BLAST question...</option>
                            {analysisQuestions
                              .filter(q => q.type === 'blast')
                              .map(q => (
                                <option key={q.id} value={q.id}>
                                  {q.text.length > 50 ? `${q.text.substring(0, 50)}...` : q.text}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Second BLAST Question
                          </label>
                          <select
                            value={newAnalysisQuestion.options?.blastQuestion2Id || ''}
                            onChange={(e) => setNewAnalysisQuestion({
                              ...newAnalysisQuestion,
                              options: {
                                ...newAnalysisQuestion.options,
                                blastQuestion2Id: e.target.value || null
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          >
                            <option value="">Select a BLAST question...</option>
                            {analysisQuestions
                              .filter(q => q.type === 'blast' && q.id !== newAnalysisQuestion.options?.blastQuestion1Id)
                              .map(q => (
                                <option key={q.id} value={q.id}>
                                  {q.text.length > 50 ? `${q.text.substring(0, 50)}...` : q.text}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {newAnalysisQuestion.options?.blastQuestion1Id && newAnalysisQuestion.options?.blastQuestion2Id && (
                        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                          ✓ Comparison will show results from these two BLAST questions side by side
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sequence Display Configuration */}
                  {newAnalysisQuestion.type === 'sequence_display' && (
                    <div className="space-y-4 border-t pt-4">
                      <h5 className="font-medium text-gray-700">Sequence Display Configuration</h5>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Source Sequence Question
                        </label>
                        <select
                          value={newAnalysisQuestion.options?.sourceQuestionId || ''}
                          onChange={(e) => setNewAnalysisQuestion({
                            ...newAnalysisQuestion,
                            options: {
                              ...newAnalysisQuestion.options,
                              sourceQuestionId: e.target.value || null
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                          <option value="">Select a sequence question...</option>
                          {analysisQuestions
                            .filter(q => q.type === 'dna_sequence' || q.type === 'protein_sequence')
                            .map(q => (
                              <option key={q.id} value={q.id}>
                                {q.text.length > 50 ? `${q.text.substring(0, 50)}...` : q.text}
                              </option>
                            ))}
                        </select>
                      </div>

                      {newAnalysisQuestion.options?.sourceQuestionId && (
                        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                          ✓ Will display sequence from the selected question for highlighting
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conditional Logic Section */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Conditional Logic (Optional)</label>
                      {!newAnalysisQuestion.conditionalLogic ? (
                        <button
                          type="button"
                          onClick={addConditionalLogic}
                          className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded transition duration-200"
                        >
                          + Add Condition
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={removeConditionalLogic}
                          className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition duration-200"
                        >
                          Remove Condition
                        </button>
                      )}
                    </div>

                    {newAnalysisQuestion.conditionalLogic && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                        <p className="text-sm text-yellow-700 font-medium">
                          This question will only show if another question has a specific answer
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Depends on Question</label>
                            <select
                              value={newAnalysisQuestion.conditionalLogic.showIf.questionId}
                              onChange={(e) => setNewAnalysisQuestion({
                                ...newAnalysisQuestion,
                                conditionalLogic: {
                                  ...newAnalysisQuestion.conditionalLogic,
                                  showIf: {
                                    ...newAnalysisQuestion.conditionalLogic.showIf,
                                    questionId: e.target.value
                                  }
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            >
                              <option value="">Select a question...</option>
                              {analysisQuestions
                                .filter(q => q.id !== editingAnalysisQuestion)
                                .map(question => (
                                  <option key={question.id} value={question.id}>
                                    {question.text.substring(0, 50)}{question.text.length > 50 ? '...' : ''}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">When Answer Is</label>
                            <input
                              type="text"
                              value={newAnalysisQuestion.conditionalLogic.showIf.answer}
                              onChange={(e) => setNewAnalysisQuestion({
                                ...newAnalysisQuestion,
                                conditionalLogic: {
                                  ...newAnalysisQuestion.conditionalLogic,
                                  showIf: {
                                    ...newAnalysisQuestion.conditionalLogic.showIf,
                                    answer: e.target.value
                                  }
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                              placeholder="e.g., yes, no, specific option"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-indigo-200">
                  <button
                    onClick={() => {
                      setShowAnalysisQuestionForm(false);
                      setEditingAnalysisQuestion(null);
                      setNewAnalysisQuestion({
                        step: 'clone-editing',
                        text: '',
                        type: 'yes_no',
                        required: true,
                        order: 1,
                        conditionalLogic: null,
                        options: [],
                        blastResultsCount: 3,
                        blastTitle: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingAnalysisQuestion ? saveEditedQuestion : addAnalysisQuestion}
                    disabled={!newAnalysisQuestion.text.trim()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {editingAnalysisQuestion ? 'Update Question' : 'Add Question'}
                  </button>
                </div>
              </div>
            )}

            {/* Existing Questions by Step grouped by question group*/}
            {['clone-editing', 'blast', 'analysis-submission', 'review'].map(step => {
              // Group questions by questionGroup within this step
              const stepQuestions = analysisQuestions.filter(q => q.step === step);
              const groupedQuestions = stepQuestions.reduce((groups, question) => {
                const group = question.questionGroup || 'Ungrouped';
                if (!groups[group]) groups[group] = [];
                groups[group].push(question);
                return groups;
              }, {});

              return (
                <div key={step} className="border border-gray-200 rounded-lg">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900 capitalize">
                      {step.replace('-', ' ')} Questions
                    </h4>
                  </div>
                  <div className="p-4">
                    {Object.entries(groupedQuestions).map(([groupName, questions]) => (
                      <div key={groupName} className="mb-6 last:mb-0">
                        <h5 className="text-lg font-bold text-indigo-800 mb-4 flex items-center">
                          {groupName !== 'Ungrouped' && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                              Group
                            </span>
                          )}
                          {groupName}
                        </h5>
                        <div className="space-y-3 pl-8 border-l-8 border-indigo-200">
                          {questions
                            .sort((a, b) => a.order - b.order)
                            .map(question => (
                              <div key={question.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{question.text}</p>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{question.type}</span>
                                    {question.required && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Required</span>}
                                    {question.conditionalLogic && (
                                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                        Conditional
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500">Order: {question.order}</span>
                                    {question.questionGroup && (
                                      <span className="text-xs text-gray-500">Group Order: {question.groupOrder}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex space-x-2 ml-4">
                                  <button
                                    onClick={() => editAnalysisQuestion(question)}
                                    className="text-indigo-600 hover:text-indigo-800"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteAnalysisQuestion(question.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default DirectorEditQuestions;