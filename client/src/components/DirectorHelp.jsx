// components/DirectorHelp.jsx
import React, { useState, useEffect } from 'react';
import {
    Edit,
    Trash2,
    Plus,
    HelpCircle,
    ExternalLink,
    Video,
    FileText,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    X,
    Settings,
    List
} from 'lucide-react';
import apiService from '../services/apiService';

const DirectorHelp = () => {
    const [masterHelpTopics, setMasterHelpTopics] = useState([]);
    const [masterStepHelps, setMasterStepHelps] = useState([]);
    const [analysisQuestions, setAnalysisQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [showMasterForm, setShowMasterForm] = useState(false);
    const [showChildForm, setShowChildForm] = useState(false);
    const [showStepMasterForm, setShowStepMasterForm] = useState(false);
    const [showStepChildForm, setShowStepChildForm] = useState(false);

    // Editing states
    const [editingMaster, setEditingMaster] = useState(null);
    const [editingChild, setEditingChild] = useState(null);
    const [editingStepMaster, setEditingStepMaster] = useState(null);
    const [editingStepChild, setEditingStepChild] = useState(null);

    // UI states
    const [expandedSteps, setExpandedSteps] = useState(new Set(['clone-editing']));
    const [expandedMasters, setExpandedMasters] = useState(new Set());
    const [expandedStepMasters, setExpandedStepMasters] = useState(new Set());

    // Form data
    const [masterFormData, setMasterFormData] = useState({
        analysisQuestionId: '',
        title: ''
    });

    const [childFormData, setChildFormData] = useState({
        masterHelpTopicId: '',
        title: '',
        description: '',
        videoBoxUrl: '',
        helpDocumentUrl: '',
        order: 0
    });

    const [stepMasterFormData, setStepMasterFormData] = useState({
        step: '',
        title: '',
        description: ''
    });

    const [stepChildFormData, setStepChildFormData] = useState({
        masterStepHelpId: '',
        title: '',
        description: '',
        videoBoxUrl: '',
        helpDocumentUrl: '',
        order: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [questions, masterTopics, masterSteps] = await Promise.all([
                apiService.get('/analysis-questions'),
                apiService.get('/master-help-topics'),
                apiService.get('/master-step-helps')
            ]);
            setAnalysisQuestions(questions);
            setMasterHelpTopics(masterTopics);
            setMasterStepHelps(masterSteps);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    // Master Help Topic functions
    const handleMasterSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingMaster) {
                const updated = await apiService.put(`/master-help-topics/${editingMaster.id}`, masterFormData);
                setMasterHelpTopics(prev => prev.map(master =>
                    master.id === editingMaster.id ? updated : master
                ));
            } else {
                const newMaster = await apiService.post('/master-help-topics', masterFormData);
                setMasterHelpTopics(prev => [newMaster, ...prev]);
            }
            resetMasterForm();
        } catch (error) {
            console.error('Error saving master help topic:', error);
            alert('Error saving master help topic. Please try again.');
        }
    };

    const handleChildSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingChild) {
                const updated = await apiService.put(`/help-topics/${editingChild.id}`, childFormData);
                // Update the master's children array
                setMasterHelpTopics(prev => prev.map(master => {
                    if (master.id === updated.masterHelpTopicId) {
                        return {
                            ...master,
                            helpTopics: master.helpTopics.map(child =>
                                child.id === updated.id ? updated : child
                            )
                        };
                    }
                    return master;
                }));
            } else {
                const newChild = await apiService.post('/help-topics', childFormData);
                // Add to the master's children array
                setMasterHelpTopics(prev => prev.map(master => {
                    if (master.id === newChild.masterHelpTopicId) {
                        return {
                            ...master,
                            helpTopics: [...(master.helpTopics || []), newChild]
                        };
                    }
                    return master;
                }));
            }
            resetChildForm();
        } catch (error) {
            console.error('Error saving help topic:', error);
            alert('Error saving help topic. Please try again.');
        }
    };

    // Step Help functions (similar pattern)
    const handleStepMasterSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStepMaster) {
                const updated = await apiService.put(`/master-step-helps/${editingStepMaster.id}`, stepMasterFormData);
                setMasterStepHelps(prev => prev.map(master =>
                    master.id === editingStepMaster.id ? updated : master
                ));
            } else {
                const newMaster = await apiService.post('/master-step-helps', stepMasterFormData);
                setMasterStepHelps(prev => [newMaster, ...prev]);
            }
            resetStepMasterForm();
        } catch (error) {
            console.error('Error saving master step help:', error);
            alert('Error saving master step help. Please try again.');
        }
    };

    const handleStepChildSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStepChild) {
                const updated = await apiService.put(`/step-helps/${editingStepChild.id}`, stepChildFormData);
                setMasterStepHelps(prev => prev.map(master => {
                    if (master.id === updated.masterStepHelpId) {
                        return {
                            ...master,
                            stepHelps: master.stepHelps.map(child =>
                                child.id === updated.id ? updated : child
                            )
                        };
                    }
                    return master;
                }));
            } else {
                const newChild = await apiService.post('/step-helps', stepChildFormData);
                setMasterStepHelps(prev => prev.map(master => {
                    if (master.id === newChild.masterStepHelpId) {
                        return {
                            ...master,
                            stepHelps: [...(master.stepHelps || []), newChild]
                        };
                    }
                    return master;
                }));
            }
            resetStepChildForm();
        } catch (error) {
            console.error('Error saving step help:', error);
            alert('Error saving step help. Please try again.');
        }
    };

    // Reset form functions
    const resetMasterForm = () => {
        setShowMasterForm(false);
        setEditingMaster(null);
        setMasterFormData({ analysisQuestionId: '', title: '' });
    };

    const resetChildForm = () => {
        setShowChildForm(false);
        setEditingChild(null);
        setChildFormData({
            masterHelpTopicId: '',
            title: '',
            description: '',
            videoBoxUrl: '',
            helpDocumentUrl: '',
            order: 0
        });
    };

    const resetStepMasterForm = () => {
        setShowStepMasterForm(false);
        setEditingStepMaster(null);
        setStepMasterFormData({ step: '', title: '', description: '' });
    };

    const resetStepChildForm = () => {
        setShowStepChildForm(false);
        setEditingStepChild(null);
        setStepChildFormData({
            masterStepHelpId: '',
            title: '',
            description: '',
            videoBoxUrl: '',
            helpDocumentUrl: '',
            order: 0
        });
    };

    // Delete functions
    const deleteMasterHelpTopic = async (masterId) => {
        if (!window.confirm('This will delete the master help topic and all its child topics. Continue?')) return;
        try {
            await apiService.delete(`/master-help-topics/${masterId}`);
            setMasterHelpTopics(prev => prev.filter(master => master.id !== masterId));
        } catch (error) {
            console.error('Error deleting master help topic:', error);
            alert('Error deleting master help topic. Please try again.');
        }
    };

    const deleteChildHelpTopic = async (childId, masterId) => {
        if (!window.confirm('Delete this help topic?')) return;
        try {
            await apiService.delete(`/help-topics/${childId}`);
            setMasterHelpTopics(prev => prev.map(master => {
                if (master.id === masterId) {
                    return {
                        ...master,
                        helpTopics: master.helpTopics.filter(child => child.id !== childId)
                    };
                }
                return master;
            }));
        } catch (error) {
            console.error('Error deleting help topic:', error);
            alert('Error deleting help topic. Please try again.');
        }
    };

    // Utility functions
    const getQuestionsForStep = (step) => {
        return analysisQuestions
            .filter(q => q.step === step)
            .sort((a, b) => a.order - b.order);
    };

    const getMasterForQuestion = (questionId) => {
        return masterHelpTopics.find(master => master.analysisQuestionId === questionId);
    };

    const getMasterForStep = (step) => {
        return masterStepHelps.find(master => master.step === step);
    };

    const toggleStep = (step) => {
        const newExpanded = new Set(expandedSteps);
        if (newExpanded.has(step)) {
            newExpanded.delete(step);
        } else {
            newExpanded.add(step);
        }
        setExpandedSteps(newExpanded);
    };

    const toggleMaster = (masterId) => {
        const newExpanded = new Set(expandedMasters);
        if (newExpanded.has(masterId)) {
            newExpanded.delete(masterId);
        } else {
            newExpanded.add(masterId);
        }
        setExpandedMasters(newExpanded);
    };

    const toggleStepMaster = (masterId) => {
        const newExpanded = new Set(expandedStepMasters);
        if (newExpanded.has(masterId)) {
            newExpanded.delete(masterId);
        } else {
            newExpanded.add(masterId);
        }
        setExpandedStepMasters(newExpanded);
    };

    const getStepDisplayName = (step) => {
        const stepNames = {
            'clone-editing': 'Clone Editing & Quality Check',
            'blast': 'BLAST Analysis',
            'analysis-submission': 'Final Analysis & Submission',
            'review': 'Review & Feedback'
        };
        return stepNames[step] || step;
    };

    const getAvailableQuestions = () => {
        return analysisQuestions.filter(question =>
            !masterHelpTopics.some(master => master.analysisQuestionId === question.id)
        );
    };

    const getAvailableSteps = () => {
        const allSteps = ['clone-editing', 'blast', 'analysis-submission', 'review'];
        return allSteps.filter(step =>
            !masterStepHelps.some(master => master.step === step)
        );
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading help topics...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Master Help Topic Form Modal */}
            {showMasterForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {editingMaster ? 'Edit Master Help Topic' : 'Create Master Help Topic'}
                            </h3>
                            <button onClick={resetMasterForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleMasterSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Question
                                </label>
                                <select
                                    value={masterFormData.analysisQuestionId}
                                    onChange={(e) => setMasterFormData(prev => ({
                                        ...prev,
                                        analysisQuestionId: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                    disabled={editingMaster} // Can't change question when editing
                                >
                                    <option value="">Select a question</option>
                                    {(editingMaster ? analysisQuestions : getAvailableQuestions()).map(question => (
                                        <option key={question.id} value={question.id}>
                                            {question.text.substring(0, 50)}...
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Master Topic Title
                                </label>
                                <input
                                    type="text"
                                    value={masterFormData.title}
                                    onChange={(e) => setMasterFormData(prev => ({
                                        ...prev,
                                        title: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g., BLAST Analysis Help"
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={resetMasterForm}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    {editingMaster ? 'Update Master Topic' : 'Create Master Topic'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Child Help Topic Form Modal */}
            {showChildForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {editingChild ? 'Edit Help Topic' : 'Add Help Topic'}
                            </h3>
                            <button onClick={resetChildForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleChildSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={childFormData.title}
                                    onChange={(e) => setChildFormData(prev => ({
                                        ...prev,
                                        title: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g., Basic BLAST Search"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={childFormData.description}
                                    onChange={(e) => setChildFormData(prev => ({
                                        ...prev,
                                        description: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows="2"
                                    placeholder="Brief description of what this help topic covers"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Video URL
                                </label>
                                <input
                                    type="url"
                                    value={childFormData.videoBoxUrl}
                                    onChange={(e) => setChildFormData(prev => ({
                                        ...prev,
                                        videoBoxUrl: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Document URL
                                </label>
                                <input
                                    type="url"
                                    value={childFormData.helpDocumentUrl}
                                    onChange={(e) => setChildFormData(prev => ({
                                        ...prev,
                                        helpDocumentUrl: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Order
                                </label>
                                <input
                                    type="number"
                                    value={childFormData.order}
                                    onChange={(e) => setChildFormData(prev => ({
                                        ...prev,
                                        order: parseInt(e.target.value) || 0
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    min="0"
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={resetChildForm}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                                >
                                    {editingChild ? 'Update Topic' : 'Add Topic'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Step Master Help Form Modal */}
            {showStepMasterForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {editingStepMaster ? 'Edit Master Step Help' : 'Create Master Step Help'}
                            </h3>
                            <button onClick={resetStepMasterForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleStepMasterSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Step
                                </label>
                                <select
                                    value={stepMasterFormData.step}
                                    onChange={(e) => setStepMasterFormData(prev => ({
                                        ...prev,
                                        step: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                    disabled={editingStepMaster} // Can't change step when editing
                                >
                                    <option value="">Select a step</option>
                                    {(editingStepMaster ?
                                        ['clone-editing', 'blast', 'analysis-submission', 'review'] :
                                        getAvailableSteps()
                                    ).map(step => (
                                        <option key={step} value={step}>
                                            {getStepDisplayName(step)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Master Title
                                </label>
                                <input
                                    type="text"
                                    value={stepMasterFormData.title}
                                    onChange={(e) => setStepMasterFormData(prev => ({
                                        ...prev,
                                        title: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="e.g., Clone Editing Background Help"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={stepMasterFormData.description}
                                    onChange={(e) => setStepMasterFormData(prev => ({
                                        ...prev,
                                        description: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    rows="3"
                                    placeholder="Description of what this step help covers"
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={resetStepMasterForm}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                                >
                                    {editingStepMaster ? 'Update Master' : 'Create Master'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Step Child Help Form Modal */}
            {showStepChildForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-semibold">
                                {editingStepChild ? 'Edit Step Help Topic' : 'Add Step Help Topic'}
                            </h3>
                            <button onClick={resetStepChildForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleStepChildSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={stepChildFormData.title}
                                    onChange={(e) => setStepChildFormData(prev => ({
                                        ...prev,
                                        title: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="e.g., Understanding Chromatograms"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={stepChildFormData.description}
                                    onChange={(e) => setStepChildFormData(prev => ({
                                        ...prev,
                                        description: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    rows="2"
                                    placeholder="Brief description of what this help topic covers"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Video URL
                                </label>
                                <input
                                    type="url"
                                    value={stepChildFormData.videoBoxUrl}
                                    onChange={(e) => setStepChildFormData(prev => ({
                                        ...prev,
                                        videoBoxUrl: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Document URL
                                </label>
                                <input
                                    type="url"
                                    value={stepChildFormData.helpDocumentUrl}
                                    onChange={(e) => setStepChildFormData(prev => ({
                                        ...prev,
                                        helpDocumentUrl: e.target.value
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Order
                                </label>
                                <input
                                    type="number"
                                    value={stepChildFormData.order}
                                    onChange={(e) => setStepChildFormData(prev => ({
                                        ...prev,
                                        order: parseInt(e.target.value) || 0
                                    }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    min="0"
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={resetStepChildForm}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                                >
                                    {editingStepChild ? 'Update Topic' : 'Add Topic'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Help Topic Management</h3>
                        <p className="text-sm text-gray-600 mt-1">Create and organize help content for analysis questions and steps</p>
                    </div>
                    <button
                        onClick={() => setShowMasterForm(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200 flex items-center space-x-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Master Help Topic</span>
                    </button>
                </div>

                <div className="p-6">
                    {/* Help Topics by Analysis Step */}
                    <div className="space-y-4">
                        {['clone-editing', 'blast', 'analysis-submission', 'review'].map(step => {
                            const stepQuestions = getQuestionsForStep(step);
                            const isExpanded = expandedSteps.has(step);

                            return (
                                <div key={step} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Step Header */}
                                    <button
                                        onClick={() => toggleStep(step)}
                                        className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="text-left">
                                                <h4 className="font-medium text-gray-900">{getStepDisplayName(step)}</h4>
                                                <p className="text-sm text-gray-500">
                                                    {stepQuestions.length} questions, {stepQuestions.filter(q => getMasterForQuestion(q.id)).length} with help masters
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded ?
                                            <ChevronDown className="w-5 h-5 text-gray-400" /> :
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        }
                                    </button>

                                    {/* Step Content */}
                                    {isExpanded && (
                                        <div className="p-4 bg-white border-t border-gray-200">
                                            {stepQuestions.length === 0 ? (
                                                <p className="text-gray-500 text-center py-4">No questions found for this step</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {stepQuestions.map(question => {
                                                        const master = getMasterForQuestion(question.id);

                                                        return (
                                                            <div key={question.id} className="border border-gray-200 rounded-lg">
                                                                <div className="p-4">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex-1">
                                                                            <p className="text-sm text-gray-900 font-medium">
                                                                                {question.text}
                                                                            </p>
                                                                            {master ? (
                                                                                <div className="mt-2">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="flex items-center space-x-2">
                                                                                            <HelpCircle className="w-4 h-4 text-green-600" />
                                                                                            <span className="text-sm text-green-600 font-medium">
                                                                                                {master.title}
                                                                                            </span>
                                                                                            <span className="text-xs text-gray-500">
                                                                                                ({master.helpTopics?.length || 0} topics)
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center space-x-2">
                                                                                            <button
                                                                                                onClick={() => toggleMaster(master.id)}
                                                                                                className="text-gray-400 hover:text-gray-600"
                                                                                            >
                                                                                                {expandedMasters.has(master.id) ?
                                                                                                    <ChevronDown className="w-4 h-4" /> :
                                                                                                    <ChevronRight className="w-4 h-4" />
                                                                                                }
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setEditingMaster(master);
                                                                                                    setMasterFormData({
                                                                                                        analysisQuestionId: master.analysisQuestionId,
                                                                                                        title: master.title
                                                                                                    });
                                                                                                    setShowMasterForm(true);
                                                                                                }}
                                                                                                className="text-gray-400 hover:text-indigo-600"
                                                                                            >
                                                                                                <Edit className="w-4 h-4" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => deleteMasterHelpTopic(master.id)}
                                                                                                className="text-gray-400 hover:text-red-600"
                                                                                            >
                                                                                                <Trash2 className="w-4 h-4" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Expanded Master Content */}
                                                                                    {expandedMasters.has(master.id) && (
                                                                                        <div className="mt-3 pl-6 border-l-2 border-gray-100">
                                                                                            <div className="flex items-center justify-between mb-3">
                                                                                                <h5 className="text-sm font-medium text-gray-700">Help Topics</h5>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setChildFormData(prev => ({
                                                                                                            ...prev,
                                                                                                            masterHelpTopicId: master.id
                                                                                                        }));
                                                                                                        setShowChildForm(true);
                                                                                                    }}
                                                                                                    className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200"
                                                                                                >
                                                                                                    <Plus className="w-3 h-3 inline mr-1" />
                                                                                                    Add Topic
                                                                                                </button>
                                                                                            </div>

                                                                                            {master.helpTopics?.length ? (
                                                                                                <div className="space-y-2">
                                                                                                    {master.helpTopics.map((child, index) => (
                                                                                                        <div key={child.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                                                                            <div className="flex items-center space-x-2">
                                                                                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                                                                                                    {index + 1}
                                                                                                                </span>
                                                                                                                <span className="text-sm">{child.title}</span>
                                                                                                                {child.description && (
                                                                                                                    <span className="text-xs text-gray-500">
                                                                                                                        - {child.description}
                                                                                                                    </span>
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <div className="flex items-center space-x-1">
                                                                                                                <a
                                                                                                                    href={child.videoBoxUrl}
                                                                                                                    target="_blank"
                                                                                                                    rel="noopener noreferrer"
                                                                                                                    className="text-gray-400 hover:text-blue-600"
                                                                                                                >
                                                                                                                    <Video className="w-3 h-3" />
                                                                                                                </a>
                                                                                                                <a
                                                                                                                    href={child.helpDocumentUrl}
                                                                                                                    target="_blank"
                                                                                                                    rel="noopener noreferrer"
                                                                                                                    className="text-gray-400 hover:text-green-600"
                                                                                                                >
                                                                                                                    <FileText className="w-3 h-3" />
                                                                                                                </a>
                                                                                                                <button
                                                                                                                    onClick={() => {
                                                                                                                        setEditingChild(child);
                                                                                                                        setChildFormData(child);
                                                                                                                        setShowChildForm(true);
                                                                                                                    }}
                                                                                                                    className="text-gray-400 hover:text-indigo-600"
                                                                                                                >
                                                                                                                    <Edit className="w-3 h-3" />
                                                                                                                </button>
                                                                                                                <button
                                                                                                                    onClick={() => deleteChildHelpTopic(child.id, master.id)}
                                                                                                                    className="text-gray-400 hover:text-red-600"
                                                                                                                >
                                                                                                                    <Trash2 className="w-3 h-3" />
                                                                                                                </button>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <p className="text-xs text-gray-500 text-center py-4">
                                                                                                    No help topics yet. Click "Add Topic" to create one.
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="mt-2 flex items-center justify-between">
                                                                                    <span className="text-sm text-gray-500">No help available</span>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setMasterFormData(prev => ({
                                                                                                ...prev,
                                                                                                analysisQuestionId: question.id
                                                                                            }));
                                                                                            setShowMasterForm(true);
                                                                                        }}
                                                                                        className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200"
                                                                                    >
                                                                                        Create Help
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Background Help Section */}
            <div className="bg-white rounded-xl shadow-sm border mt-6">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Background Help Topics</h3>
                        <p className="text-sm text-gray-600 mt-1">Create step-level help content that applies to all questions in a step</p>
                    </div>
                    <button
                        onClick={() => setShowStepMasterForm(true)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition duration-200 flex items-center space-x-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Step Help Master</span>
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {['clone-editing', 'blast', 'analysis-submission', 'review'].map(step => {
                            const master = getMasterForStep(step);
                            return (
                                <div key={step} className={`border rounded-lg p-4 ${master ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium text-gray-900">{getStepDisplayName(step)}</h4>
                                        {master ? (
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                                                    {master.stepHelps?.length || 0} topics
                                                </span>
                                                <button
                                                    onClick={() => toggleStepMaster(master.id)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    {expandedStepMasters.has(master.id) ?
                                                        <ChevronDown className="w-4 h-4" /> :
                                                        <List className="w-4 h-4" />
                                                    }
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingStepMaster(master);
                                                        setStepMasterFormData(master);
                                                        setShowStepMasterForm(true);
                                                    }}
                                                    className="text-gray-400 hover:text-purple-600"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setStepMasterFormData(prev => ({
                                                        ...prev,
                                                        step: step
                                                    }));
                                                    setShowStepMasterForm(true);
                                                }}
                                                className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded hover:bg-purple-200"
                                            >
                                                Create Help
                                            </button>
                                        )}
                                    </div>

                                    {master && (
                                        <>
                                            <p className="text-sm text-gray-600 mb-2">{master.title}</p>
                                            {master.description && (
                                                <p className="text-xs text-gray-500 mb-2">{master.description}</p>
                                            )}

                                            {/* Expanded Step Master Content */}
                                            {expandedStepMasters.has(master.id) && (
                                                <div className="mt-3 pt-3 border-t border-purple-200">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h5 className="text-sm font-medium text-gray-700">Step Help Topics</h5>
                                                        <button
                                                            onClick={() => {
                                                                setStepChildFormData(prev => ({
                                                                    ...prev,
                                                                    masterStepHelpId: master.id
                                                                }));
                                                                setShowStepChildForm(true);
                                                            }}
                                                            className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded hover:bg-purple-200"
                                                        >
                                                            <Plus className="w-3 h-3 inline mr-1" />
                                                            Add
                                                        </button>
                                                    </div>

                                                    {master.stepHelps?.length ? (
                                                        <div className="space-y-1">
                                                            {master.stepHelps.map((child, index) => (
                                                                <div key={child.id} className="flex items-center justify-between text-xs p-2 bg-white rounded">
                                                                    <span>{index + 1}. {child.title}</span>
                                                                    <div className="flex items-center space-x-1">
                                                                        <a href={child.videoBoxUrl} target="_blank" rel="noopener noreferrer">
                                                                            <Video className="w-3 h-3 text-blue-500" />
                                                                        </a>
                                                                        <a href={child.helpDocumentUrl} target="_blank" rel="noopener noreferrer">
                                                                            <FileText className="w-3 h-3 text-green-500" />
                                                                        </a>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingStepChild(child);
                                                                                setStepChildFormData(child);
                                                                                setShowStepChildForm(true);
                                                                            }}
                                                                            className="text-gray-400 hover:text-purple-600"
                                                                        >
                                                                            <Edit className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 text-center py-2">No topics yet</p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-white rounded-xl shadow-sm border mt-6">
                <div className="p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Help Coverage Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {['clone-editing', 'blast', 'analysis-submission', 'review'].map(step => {
                            const stepQuestions = getQuestionsForStep(step);
                            const helpCount = stepQuestions.filter(q => getMasterForQuestion(q.id)).length;
                            const coverage = stepQuestions.length > 0 ? Math.round((helpCount / stepQuestions.length) * 100) : 0;
                            const stepMaster = getMasterForStep(step);

                            return (
                                <div key={step} className="text-center p-4 bg-gray-50 rounded-lg">
                                    <div className="text-2xl font-bold text-gray-900">{coverage}%</div>
                                    <div className="text-sm text-gray-600">{getStepDisplayName(step)}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {helpCount} of {stepQuestions.length} questions
                                    </div>
                                    {stepMaster && (
                                        <div className="text-xs text-purple-600 mt-1">
                                            + {stepMaster.stepHelps?.length || 0} step topics
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DirectorHelp;