// components/DirectorEditQuestions.jsx - Updated to use apiService
import React, { useState, useEffect, useRef } from 'react';
import { Edit, Trash2, AlertCircle, Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered, GripVertical } from 'lucide-react';
import apiService from '../services/apiService';

// Rich Text Editor Component
const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);
  const isInitialMount = useRef(true);

  // Only set innerHTML on initial mount or when value changes externally
  useEffect(() => {
    if (editorRef.current && isInitialMount.current) {
      editorRef.current.innerHTML = value || '';
      isInitialMount.current = false;
    }
  }, []);

  // Update innerHTML only when opening a different question to edit
  useEffect(() => {
    if (editorRef.current && !isInitialMount.current) {
      // Only update if the content is significantly different (prevents cursor jump during typing)
      const currentContent = editorRef.current.innerHTML;
      if (value !== currentContent && document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLettered = () => {
    // Create a lettered list
    document.execCommand('insertOrderedList', false, null);
    // Get the newly created list and add the custom class
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      let node = selection.getRangeAt(0).startContainer;
      // Walk up to find the <ol> element
      while (node && node.nodeName !== 'OL') {
        node = node.parentNode;
        if (node === editorRef.current) break;
      }
      if (node && node.nodeName === 'OL') {
        node.className = 'lettered-list';
      }
    }
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e) => {
    // Handle Tab and Shift+Tab for list indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        execCommand('outdent');
      } else {
        execCommand('indent');
      }
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex items-center space-x-1 p-2 bg-gray-50 border-b border-gray-300">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-gray-200 rounded transition"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-gray-200 rounded transition"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-2 hover:bg-gray-200 rounded transition"
          title="Underline"
        >
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-gray-200 rounded transition"
          title="Bullet List (Tab to indent)"
        >
          <List className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 hover:bg-gray-200 rounded transition"
          title="Numbered List (Tab to indent)"
        >
          <ListOrdered className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={insertLettered}
          className="p-2 hover:bg-gray-200 rounded transition font-semibold text-sm"
          title="Lettered List (Tab to indent)"
        >
          A)
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={insertLink}
          className="p-2 hover:bg-gray-200 rounded transition"
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="p-3 min-h-[200px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ wordBreak: 'break-word' }}
        suppressContentEditableWarning={true}
      />
      <style>{`
        div[contenteditable] a {
          color: #2563eb;
          text-decoration: underline;
        }
        div[contenteditable] a:hover {
          color: #1d4ed8;
        }
        div[contenteditable] ul {
          list-style-type: disc;
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        div[contenteditable] ol {
          list-style-type: decimal;
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        div[contenteditable] ol ol {
          list-style-type: lower-alpha;
          margin-left: 2.5rem;
        }
        div[contenteditable] ol ol ol {
          list-style-type: lower-roman;
          margin-left: 2.5rem;
        }
        div[contenteditable] ul ul {
          list-style-type: circle;
          margin-left: 2.5rem;
        }
        div[contenteditable] ul ul ul {
          list-style-type: square;
          margin-left: 2.5rem;
        }
        div[contenteditable] ol.lettered-list {
          list-style: none;
          counter-reset: lettered-counter;
        }
        div[contenteditable] ol.lettered-list > li {
          counter-increment: lettered-counter;
        }
        div[contenteditable] ol.lettered-list > li::before {
          content: counter(lettered-counter, upper-alpha) ") ";
          font-weight: normal;
        }
        div[contenteditable] ol.lettered-list ol {
          list-style-type: lower-roman;
          margin-left: 2.5rem;
        }
        div[contenteditable] ol.lettered-list ol li::before {
          content: none;
        }
        div[contenteditable] ol.lettered-list ol ol {
          list-style-type: square;
          margin-left: 2.5rem;
        }
        div[contenteditable] li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
};

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
    groupOrder: 999
  });

  // Drag and drop state
  const [draggedQuestion, setDraggedQuestion] = useState(null);
  const [dragOverQuestion, setDragOverQuestion] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'before' or 'after'

  // Group management state
  const [managingGroupsForStep, setManagingGroupsForStep] = useState(null);

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
          questionGroup: ''
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
              blastQuestion2Id: updates.options?.blastQuestion2Id,
              table1Title: updates.options?.table1Title,
              table2Title: updates.options?.table2Title
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
    // If already editing this question, close the edit form
    if (editingAnalysisQuestion === question.id) {
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
        blastTitle: '',
        questionGroup: ''
      });
      return;
    }

    setEditingAnalysisQuestion(question.id);

    let optionsToSet = {};
    if (question.type === 'blast_comparison' && question.options) {
      optionsToSet = {
        blastQuestion1Id: question.options.blastQuestion1Id,
        blastQuestion2Id: question.options.blastQuestion2Id,
        table1Title: question.options.table1Title || '',
        table2Title: question.options.table2Title || ''
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
      groupOrder: question.groupOrder || 999
    });
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
              blastQuestion2Id: newAnalysisQuestion.options?.blastQuestion2Id,
              table1Title: newAnalysisQuestion.options?.table1Title,
              table2Title: newAnalysisQuestion.options?.table2Title
            } :
              newAnalysisQuestion.type === 'sequence_range' ? {
                label1: newAnalysisQuestion.options?.label1 || 'Begin',
                label2: newAnalysisQuestion.options?.label2 || 'End'
              } : undefined,
        questionGroup: newAnalysisQuestion.questionGroup || null,
        
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
        questionGroup: ''
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

  // Drag and drop handlers
  const handleDragStart = (e, question) => {
    setDraggedQuestion(question);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, question) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedQuestion && draggedQuestion.id !== question.id && draggedQuestion.step === question.step) {
      // Calculate if hovering over top or bottom half
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = e.clientY < midpoint ? 'before' : 'after';
      
      setDragOverQuestion(question);
      setDropPosition(position);
    }
  };

  const handleDragLeave = () => {
    setDragOverQuestion(null);
    setDropPosition(null);
  };

  const handleDrop = async (e, targetQuestion) => {
    e.preventDefault();
    
    if (!draggedQuestion || draggedQuestion.id === targetQuestion.id || draggedQuestion.step !== targetQuestion.step) {
      setDraggedQuestion(null);
      setDragOverQuestion(null);
      setDropPosition(null);
      return;
    }

    // Check if dragging to a different group
    const draggedGroup = draggedQuestion.questionGroup || 'Ungrouped';
    const targetGroup = targetQuestion.questionGroup || 'Ungrouped';
    const isDifferentGroup = draggedGroup !== targetGroup;

    // Get all questions in this step, sorted by order
    const stepQuestions = analysisQuestions
      .filter(q => q.step === draggedQuestion.step)
      .sort((a, b) => a.order - b.order);

    // Find indices
    const draggedIndex = stepQuestions.findIndex(q => q.id === draggedQuestion.id);
    let targetIndex = stepQuestions.findIndex(q => q.id === targetQuestion.id);
    
    // Adjust target index based on drop position
    // If dropping 'after', increment the target index
    if (dropPosition === 'after') {
      targetIndex++;
    }
    
    // If dragging from before to after the same position, adjust
    if (draggedIndex < targetIndex) {
      targetIndex--;
    }

    // Reorder the questions
    const reordered = [...stepQuestions];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update order values - preserve all question data
    const updates = reordered.map((q, index) => {
      const update = {
        ...q,  // Keep all existing question data
        order: index + 1  // Just update the order
      };
      
      // If dragging to a different group, update the questionGroup and groupOrder
      if (isDifferentGroup && q.id === draggedQuestion.id) {
        update.questionGroup = targetQuestion.questionGroup || '';
        update.groupOrder = targetQuestion.groupOrder || 999;
      }
      
      return update;
    });

    try {
      // Update all affected questions with complete data to preserve conditionalLogic and other fields
      await Promise.all(
        updates.map(update =>
          apiService.put(`/analysis-questions/${update.id}`, update)
        )
      );

      // Refresh the questions list
      await fetchAnalysisQuestions();
    } catch (error) {
      console.error('Error reordering questions:', error);
    }

    setDraggedQuestion(null);
    setDragOverQuestion(null);
    setDropPosition(null);
  };

  // Group management functions
  const getGroupsForStep = (step) => {
    const stepQuestions = analysisQuestions.filter(q => q.step === step);
    const groupsMap = new Map();
    
    stepQuestions.forEach(q => {
      const groupName = q.questionGroup || 'Ungrouped';
      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, {
          name: groupName,
          order: q.groupOrder || 999, // Default high number for groups without order
          questionCount: 0
        });
      }
      groupsMap.get(groupName).questionCount++;
    });
    
    return Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
  };

  const updateGroupOrder = async (step, groupName, newOrder) => {
    try {
      // Find all questions in this group
      const questionsToUpdate = analysisQuestions.filter(
        q => q.step === step && (q.questionGroup || 'Ungrouped') === groupName
      );

      // Update groupOrder for all questions in this group
      await Promise.all(
        questionsToUpdate.map(q =>
          apiService.put(`/analysis-questions/${q.id}`, { groupOrder: newOrder })
        )
      );

      // Refresh questions list
      await fetchAnalysisQuestions();
    } catch (error) {
      console.error('Error updating group order:', error);
      alert('Failed to update group order');
    }
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
                <h4 className="text-lg font-semibold text-indigo-900 mb-4">
                  {editingAnalysisQuestion ? 'Edit Analysis Question' : 'Add New Analysis Question'}
                </h4>

                {/* Top row: Step, Group, Order, Type, Required */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Step */}
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

                    {/* Question Group */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question Group
                      </label>
                      <input
                        type="text"
                        value={newAnalysisQuestion.questionGroup}
                        onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, questionGroup: e.target.value }))}
                        placeholder="e.g., Quality Assessment"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    {/* Order */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                      <input
                        type="number"
                        value={newAnalysisQuestion.order}
                        onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, order: parseInt(e.target.value) }))}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select
                        value={newAnalysisQuestion.type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          setNewAnalysisQuestion({
                            ...newAnalysisQuestion,
                            type: newType,
                            options: newType === 'blast_comparison' ? {} : []
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="yes_no">Yes/No - Binary choice question</option>
                        <option value="text">Text - Short text answer</option>
                        <option value="sequence_range">Sequence Range - Select a range in a sequence</option>
                        <option value="textarea">Long Text - Extended text response</option>
                        <option value="dna_sequence">DNA Sequence - DNA sequence input</option>
                        <option value="protein_sequence">Protein Sequence - Protein sequence input</option>
                        <option value="number">Number - Numeric answer</option>
                        <option value="select">Multiple Choice - Select from options</option>
                        <option value="blast">BLAST Results - Student enters BLAST search results</option>
                        <option value="blast_comparison">BLAST Table Comparison - Compare two BLAST result tables</option>
                        <option value="sequence_display">Sequence Display - Display sequence from another question</option>
                        <option value="text_header">Text Header - Display-only text with formatting (no answer required)</option>
                      </select>
                    </div>

                    {/* Required */}
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer pt-7">
                        <input
                          type="checkbox"
                          checked={newAnalysisQuestion.required}
                          onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, required: e.target.checked })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">Required</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Helper text for Question Group */}
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank for ungrouped questions. Use "Manage Groups" to set group display order.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                    <RichTextEditor
                      value={newAnalysisQuestion.text}
                      onChange={(html) => setNewAnalysisQuestion({ ...newAnalysisQuestion, text: html })}
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
                            First Table Title (Optional)
                          </label>
                          <input
                            type="text"
                            value={newAnalysisQuestion.options?.table1Title || ''}
                            onChange={(e) => {
                              setNewAnalysisQuestion({
                                ...newAnalysisQuestion,
                                options: {
                                  ...newAnalysisQuestion.options,
                                  table1Title: e.target.value
                                }
                              });
                            }}
                            placeholder="Leave blank to use source question text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm mb-2"
                          />
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
                            Second Table Title (Optional)
                          </label>
                          <input
                            type="text"
                            value={newAnalysisQuestion.options?.table2Title || ''}
                            onChange={(e) => {
                              setNewAnalysisQuestion({
                                ...newAnalysisQuestion,
                                options: {
                                  ...newAnalysisQuestion.options,
                                  table2Title: e.target.value
                                }
                              });
                            }}
                            placeholder="Leave blank to use source question text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm mb-2"
                          />
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
                          ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Comparison will show results from these two BLAST questions side by side
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
                          ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Will display sequence from the selected question for highlighting
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
                if (!groups[group]) {
                  groups[group] = {
                    questions: [],
                    order: question.groupOrder || 999 // Use groupOrder from any question in the group
                  };
                }
                groups[group].questions.push(question);
                return groups;
              }, {});

              // Sort groups by their order
              const sortedGroups = Object.entries(groupedQuestions).sort((a, b) => a[1].order - b[1].order);

              return (
                <div key={step} className="border border-gray-200 rounded-lg">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <h4 className="font-medium text-gray-900 capitalize">
                      {step.replace('-', ' ')} Questions
                    </h4>
                    {stepQuestions.length > 0 && (
                      <button
                        onClick={() => setManagingGroupsForStep(step)}
                        className="text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg transition duration-200 flex items-center gap-2"
                      >
                        <GripVertical className="w-4 h-4" />
                        Manage Groups
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    {sortedGroups.map(([groupName, groupData]) => (
                      <div key={groupName} className="mb-6 last:mb-0">
                        <h5 className="text-lg font-bold text-indigo-800 mb-4 flex items-center">
                          {groupName !== 'Ungrouped' && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                              Group
                            </span>
                          )}
                          {groupName}
                          {groupName !== 'Ungrouped' && (
                            <span className="ml-2 text-xs text-gray-500 font-normal">
                              (Order: {groupData.order})
                            </span>
                          )}
                        </h5>
                        <div className="space-y-3 pl-8 border-l-8 border-indigo-200">
                          {groupData.questions
                            .sort((a, b) => a.order - b.order)
                            .map(question => (
                              <div key={question.id} className="relative">
                                {/* Drop indicator line - shows before */}
                                {dragOverQuestion?.id === question.id && dropPosition === 'before' && (
                                  <div className="absolute -top-1.5 left-0 right-0 h-1 bg-indigo-500 rounded-full z-10 shadow-lg">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full"></div>
                                  </div>
                                )}
                                
                                <div 
                                  draggable="true"
                                  onDragStart={(e) => handleDragStart(e, question)}
                                  onDragOver={(e) => handleDragOver(e, question)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, question)}
                                  className={`flex items-center p-3 bg-white border-2 rounded transition-all ${
                                    dragOverQuestion?.id === question.id 
                                      ? 'border-indigo-300' 
                                      : 'border-gray-200'
                                  } ${draggedQuestion?.id === question.id ? 'opacity-50' : ''}`}
                                >
                                  <div className="mr-3 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: question.text }} />
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{question.type}</span>
                                      {question.required && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Required</span>}
                                      {question.conditionalLogic && (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                          Conditional
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-500">Order: {question.order}</span>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2 ml-4">
                                    <button
                                      onClick={() => editAnalysisQuestion(question)}
                                      className={`${editingAnalysisQuestion === question.id ? 'text-indigo-800 bg-indigo-100' : 'text-indigo-600'} hover:text-indigo-800 p-1 rounded`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteAnalysisQuestion(question.id)}
                                      className="text-red-600 hover:text-red-800 p-1 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Inline Edit Form */}
                                {editingAnalysisQuestion === question.id && (
                                  <div className="mt-2 ml-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg p-4">
                                    <h5 className="text-sm font-semibold text-indigo-900 mb-3">Edit Question</h5>
                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                                        <RichTextEditor
                                          value={newAnalysisQuestion.text}
                                          onChange={(html) => setNewAnalysisQuestion({ ...newAnalysisQuestion, text: html })}
                                        />
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">Step</label>
                                          <select
                                            value={newAnalysisQuestion.step}
                                            onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, step: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                          >
                                            <option value="clone-editing">Clone Editing</option>
                                            <option value="blast">BLAST</option>
                                            <option value="analysis-submission">Analysis Submission</option>
                                            <option value="review">Review</option>
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                                          <select
                                            value={newAnalysisQuestion.type}
                                            onChange={(e) => {
                                              const newType = e.target.value;
                                              setNewAnalysisQuestion({
                                                ...newAnalysisQuestion,
                                                type: newType,
                                                options: newType === 'blast_comparison' ? {} : []
                                              });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                          >
                                            <option value="yes_no">Yes/No - Binary choice question</option>
                                            <option value="text">Text - Short text answer</option>
                                            <option value="textarea">Long Text - Extended text response</option>
                                            <option value="dna_sequence">DNA Sequence - DNA sequence input</option>
                                            <option value="protein_sequence">Protein Sequence - Protein sequence input</option>
                                            <option value="number">Number - Numeric answer</option>
                                            <option value="sequence_range">Sequence Range - Select a range in a sequence</option>
                                            <option value="select">Multiple Choice - Select from options</option>
                                            <option value="blast">BLAST Results - Student enters BLAST search results</option>
                                            <option value="blast_comparison">BLAST Table Comparison - Compare two BLAST result tables</option>
                                            <option value="sequence_display">Sequence Display - Display sequence from another question</option>
                                            <option value="text_header">Text Header - Display-only text with formatting (no answer required)</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Question Group */}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          Question Group (optional)
                                        </label>
                                        <input
                                          type="text"
                                          value={newAnalysisQuestion.questionGroup}
                                          onChange={(e) => setNewAnalysisQuestion(prev => ({ ...prev, questionGroup: e.target.value }))}
                                          placeholder="e.g., Quality Assessment, Results Analysis"
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          Leave blank for ungrouped questions. Use "Manage Groups" to set display order.
                                        </p>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                                          <input
                                            type="number"
                                            value={newAnalysisQuestion.order}
                                            onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, order: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                          />
                                        </div>

                                        <div className="flex items-center">
                                          <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={newAnalysisQuestion.required}
                                              onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, required: e.target.checked })}
                                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Required</span>
                                          </label>
                                        </div>
                                      </div>

                                      {/* Type-Specific Options */}
                                      {newAnalysisQuestion.type === 'blast' && (
                                        <div className="space-y-3 border-t pt-3">
                                          <h6 className="text-sm font-medium text-gray-700">BLAST Configuration</h6>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">BLAST Table Title</label>
                                            <input
                                              type="text"
                                              value={newAnalysisQuestion.blastTitle}
                                              onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, blastTitle: e.target.value })}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                              placeholder="e.g., Top BLAST Results"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Number of Results</label>
                                            <input
                                              type="number"
                                              min="1"
                                              max="20"
                                              value={newAnalysisQuestion.blastResultsCount}
                                              onChange={(e) => setNewAnalysisQuestion({ ...newAnalysisQuestion, blastResultsCount: parseInt(e.target.value) || 3 })}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {newAnalysisQuestion.type === 'sequence_range' && (
                                        <div className="space-y-3 border-t pt-3">
                                          <h6 className="text-sm font-medium text-gray-700">Sequence Range Configuration</h6>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">First Field Label</label>
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
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="e.g., Start Position"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">Second Field Label</label>
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
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="e.g., End Position"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {newAnalysisQuestion.type === 'select' && (
                                        <div className="space-y-2 border-t pt-3">
                                          <div className="flex items-center justify-between">
                                            <h6 className="text-sm font-medium text-gray-700">Answer Options</h6>
                                            <button
                                              type="button"
                                              onClick={addOption}
                                              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
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
                                                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder={`Option ${index + 1}`}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => removeOption(index)}
                                                className="text-red-600 hover:text-red-800 p-1"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {newAnalysisQuestion.type === 'blast_comparison' && (
                                        <div className="space-y-3 border-t pt-3">
                                          <h6 className="text-sm font-medium text-gray-700">BLAST Comparison Configuration</h6>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">First Table Title (Optional)</label>
                                              <input
                                                type="text"
                                                value={newAnalysisQuestion.options?.table1Title || ''}
                                                onChange={(e) => setNewAnalysisQuestion({
                                                  ...newAnalysisQuestion,
                                                  options: {
                                                    ...newAnalysisQuestion.options,
                                                    table1Title: e.target.value
                                                  }
                                                })}
                                                placeholder="Leave blank to use source question text"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                                              />
                                              <label className="block text-xs font-medium text-gray-600 mb-1">First BLAST Question</label>
                                              <select
                                                value={newAnalysisQuestion.options?.blastQuestion1Id || ''}
                                                onChange={(e) => setNewAnalysisQuestion({
                                                  ...newAnalysisQuestion,
                                                  options: {
                                                    ...newAnalysisQuestion.options,
                                                    blastQuestion1Id: e.target.value || null
                                                  }
                                                })}
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                              >
                                                <option value="">Select a BLAST question...</option>
                                                {analysisQuestions
                                                  .filter(q => q.type === 'blast' && q.id !== editingAnalysisQuestion)
                                                  .map(q => (
                                                    <option key={q.id} value={q.id}>
                                                      {q.text.length > 40 ? `${q.text.substring(0, 40)}...` : q.text}
                                                    </option>
                                                  ))}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">Second Table Title (Optional)</label>
                                              <input
                                                type="text"
                                                value={newAnalysisQuestion.options?.table2Title || ''}
                                                onChange={(e) => setNewAnalysisQuestion({
                                                  ...newAnalysisQuestion,
                                                  options: {
                                                    ...newAnalysisQuestion.options,
                                                    table2Title: e.target.value
                                                  }
                                                })}
                                                placeholder="Leave blank to use source question text"
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                                              />
                                              <label className="block text-xs font-medium text-gray-600 mb-1">Second BLAST Question</label>
                                              <select
                                                value={newAnalysisQuestion.options?.blastQuestion2Id || ''}
                                                onChange={(e) => setNewAnalysisQuestion({
                                                  ...newAnalysisQuestion,
                                                  options: {
                                                    ...newAnalysisQuestion.options,
                                                    blastQuestion2Id: e.target.value || null
                                                  }
                                                })}
                                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                              >
                                                <option value="">Select a BLAST question...</option>
                                                {analysisQuestions
                                                  .filter(q => q.type === 'blast' && q.id !== newAnalysisQuestion.options?.blastQuestion1Id && q.id !== editingAnalysisQuestion)
                                                  .map(q => (
                                                    <option key={q.id} value={q.id}>
                                                      {q.text.length > 40 ? `${q.text.substring(0, 40)}...` : q.text}
                                                    </option>
                                                  ))}
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {newAnalysisQuestion.type === 'sequence_display' && (
                                        <div className="space-y-3 border-t pt-3">
                                          <h6 className="text-sm font-medium text-gray-700">Sequence Display Configuration</h6>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Source Sequence Question</label>
                                            <select
                                              value={newAnalysisQuestion.options?.sourceQuestionId || ''}
                                              onChange={(e) => setNewAnalysisQuestion({
                                                ...newAnalysisQuestion,
                                                options: {
                                                  ...newAnalysisQuestion.options,
                                                  sourceQuestionId: e.target.value || null
                                                }
                                              })}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                              <option value="">Select a sequence question...</option>
                                              {analysisQuestions
                                                .filter(q => (q.type === 'dna_sequence' || q.type === 'protein_sequence') && q.id !== editingAnalysisQuestion)
                                                .map(q => (
                                                  <option key={q.id} value={q.id}>
                                                    {q.text.length > 40 ? `${q.text.substring(0, 40)}...` : q.text}
                                                  </option>
                                                ))}
                                            </select>
                                          </div>
                                        </div>
                                      )}

                                      {/* Conditional Logic Section */}
                                      <div className="border-t pt-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium text-gray-700">Conditional Logic (Optional)</label>
                                          {!newAnalysisQuestion.conditionalLogic ? (
                                            <button
                                              type="button"
                                              onClick={addConditionalLogic}
                                              className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2 py-1 rounded"
                                            >
                                              + Add Condition
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={removeConditionalLogic}
                                              className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded"
                                            >
                                              Remove Condition
                                            </button>
                                          )}
                                        </div>

                                        {newAnalysisQuestion.conditionalLogic && (
                                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                                            <p className="text-xs text-yellow-700 font-medium">
                                              This question will only show if another question has a specific answer
                                            </p>

                                            <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Depends on Question</label>
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
                                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                >
                                                  <option value="">Select a question...</option>
                                                  {analysisQuestions
                                                    .filter(q => q.id !== editingAnalysisQuestion)
                                                    .map(q => (
                                                      <option key={q.id} value={q.id}>
                                                        {q.text.substring(0, 40)}{q.text.length > 40 ? '...' : ''}
                                                      </option>
                                                    ))}
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">When Answer Is</label>
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
                                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                  placeholder="e.g., yes, no"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex justify-end space-x-2 pt-3 border-t border-indigo-200">
                                        <button
                                          onClick={() => {
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
                                              blastTitle: '',
                                              questionGroup: ''
                                            });
                                          }}
                                          className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={saveEditedQuestion}
                                          disabled={!newAnalysisQuestion.text.trim()}
                                          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300"
                                        >
                                          Save Changes
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Drop indicator line - shows after */}
                                {dragOverQuestion?.id === question.id && dropPosition === 'after' && (
                                  <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-indigo-500 rounded-full z-10 shadow-lg">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full"></div>
                                  </div>
                                )}
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

      {/* Group Management Modal */}
      {managingGroupsForStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Manage Groups - {managingGroupsForStep.replace('-', ' ').charAt(0).toUpperCase() + managingGroupsForStep.replace('-', ' ').slice(1)}
                </h3>
                <button
                  onClick={() => setManagingGroupsForStep(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  Ãƒâ€”
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Set the display order for each group. Lower numbers appear first.
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {getGroupsForStep(managingGroupsForStep).map((group) => (
                  <div key={group.name} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {group.name !== 'Ungrouped' && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                              Group
                            </span>
                          )}
                          <h4 className="font-semibold text-gray-900">{group.name}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {group.questionCount} question{group.questionCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Order:</label>
                        <input
                          type="number"
                          min="1"
                          value={group.order === 999 ? '' : group.order}
                          onChange={(e) => {
                            const newOrder = parseInt(e.target.value) || 999;
                            updateGroupOrder(managingGroupsForStep, group.name, newOrder);
                          }}
                          placeholder="999"
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {getGroupsForStep(managingGroupsForStep).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No groups in this step yet. Add questions with group names to create groups.
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setManagingGroupsForStep(null)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DirectorEditQuestions;