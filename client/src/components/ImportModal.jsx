import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, Check, FileText, Users, Building, FlaskConical, Settings, HelpCircle, MessageSquare, BookOpen } from 'lucide-react';
import apiService from '../services/apiService';

const ImportModal = ({ isOpen, onClose, onImportComplete }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [importData, setImportData] = useState({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState('');
    const [conflictResolution, setConflictResolution] = useState('skip'); // 'skip', 'overwrite'
    const fileInputRef = useRef(null);

    const resetModal = () => {
        setSelectedFile(null);
        setFilePreview(null);
        setImportData({});
        setImportStatus('');
        setConflictResolution('skip');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            setImportStatus('Please select a valid JSON export file.');
            return;
        }

        setSelectedFile(file);
        setIsAnalyzing(true);
        setImportStatus('Analyzing file...');

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate export format
            if (!data.exportInfo || !data.exportInfo.version) {
                throw new Error('Invalid export file format');
            }

            // Check if it's the new v2.0 format
            if (data.exportInfo.version !== '2.0') {
                throw new Error(`Unsupported export version: ${data.exportInfo.version}. Please use exports from version 2.0 or later.`);
            }

            setFilePreview(data);

            // Initialize import selections based on available data
            const initialImportData = {};

            // Users
            if (data.users?.directors?.length > 0) initialImportData.directors = true;
            if (data.users?.instructors?.length > 0) initialImportData.instructors = true;
            if (data.users?.students?.length > 0) initialImportData.students = true;

            // Configuration
            if (data.schools?.length > 0) initialImportData.schools = true;
            if (data.programSettings) initialImportData.programSettings = true;

            // Educational Content
            if (data.analysisContent?.questions?.length > 0) initialImportData.analysisQuestions = true;
            if (data.analysisContent?.masterHelpTopics?.length > 0) initialImportData.helpTopics = true;
            if (data.analysisContent?.masterStepHelps?.length > 0) initialImportData.stepHelp = true;
            if (data.analysisContent?.commonFeedback?.length > 0) initialImportData.commonFeedback = true;
            if (data.practiceClones?.clones?.length > 0) initialImportData.practiceClones = true;

            setImportData(initialImportData);
            setImportStatus('');

        } catch (error) {
            console.error('Error analyzing file:', error);
            setImportStatus(`Error reading file: ${error.message}`);
            setSelectedFile(null);
            setFilePreview(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImportChange = (key, value) => {
        setImportData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleImport = async () => {
        setIsImporting(true);
        setImportStatus('Importing data...');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('options', JSON.stringify({
                ...importData,
                conflictResolution
            }));

            // Use the v2 import endpoint
            const result = await apiService.uploadFiles('/import-v2', formData);

            setImportStatus(`Import completed successfully!`);

            setTimeout(() => {
                onImportComplete?.(result);
                onClose();
                resetModal();
            }, 2000);

        } catch (error) {
            console.error('Import error:', error);
            setImportStatus(`Import failed: ${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    const getDataTypeIcon = (type) => {
        switch (type) {
            case 'directors':
            case 'instructors':
            case 'students':
            case 'users': return <Users className="text-blue-600" size={16} />;
            case 'schools': return <Building className="text-green-600" size={16} />;
            case 'practiceClones': return <FlaskConical className="text-purple-600" size={16} />;
            case 'analysisQuestions': return <HelpCircle className="text-orange-600" size={16} />;
            case 'helpTopics':
            case 'stepHelp': return <BookOpen className="text-indigo-600" size={16} />;
            case 'commonFeedback': return <MessageSquare className="text-teal-600" size={16} />;
            case 'programSettings': return <Settings className="text-gray-600" size={16} />;
            default: return <FileText className="text-gray-600" size={16} />;
        }
    };

    const getDataTypeLabel = (type) => {
        switch (type) {
            case 'directors': return 'Directors';
            case 'instructors': return 'Instructors';
            case 'students': return 'Students (with demographics)';
            case 'schools': return 'Schools';
            case 'practiceClones': return 'Practice Clones & Answers';
            case 'analysisQuestions': return 'Analysis Questions';
            case 'masterHelpTopics': return 'Master Help Topics';
            case 'masterStepHelps': return 'Master Step Help';
            case 'helpTopics': return 'Help Topics (Legacy)'; // For backwards compatibility
            case 'stepHelp': return 'Step Help (Legacy)'; // For backwards compatibility
            case 'commonFeedback': return 'Common Feedback';
            case 'programSettings': return 'Program Settings';
            default: return type;
        }
    };

    const getDataTypeCount = (type) => {
        if (!filePreview) return 0;

        switch (type) {
            case 'directors': return filePreview.users?.directors?.length || 0;
            case 'instructors': return filePreview.users?.instructors?.length || 0;
            case 'students': return filePreview.users?.students?.length || 0;
            case 'schools': return filePreview.schools?.length || 0;
            case 'practiceClones':
                const clones = filePreview.practiceClones?.clones?.length || 0;
                const answers = filePreview.practiceClones?.answers?.length || 0;
                return clones > 0 ? `${clones} clones, ${answers} answers` : 0;
            case 'analysisQuestions': return filePreview.analysisContent?.questions?.length || 0;
            case 'helpTopics':
                const masterHelpTopics = filePreview.analysisContent?.masterHelpTopics?.length || 0;
                if (masterHelpTopics > 0) {
                    const totalChildren = filePreview.analysisContent.masterHelpTopics
                        .reduce((sum, master) => sum + (master.helpTopics?.length || 0), 0);
                    return `${masterHelpTopics} masters, ${totalChildren} children`;
                }
                return 0;
            case 'stepHelp':
                const masterStepHelps = filePreview.analysisContent?.masterStepHelps?.length || 0;
                if (masterStepHelps > 0) {
                    const totalChildren = filePreview.analysisContent.masterStepHelps
                        .reduce((sum, master) => sum + (master.stepHelps?.length || 0), 0);
                    return `${masterStepHelps} masters, ${totalChildren} children`;
                }
                return 0;
            case 'commonFeedback': return filePreview.analysisContent?.commonFeedback?.length || 0;
            case 'programSettings': return filePreview.programSettings ? 1 : 0;
            default: return 0;
        }
    };

    const hasDataSelected = Object.values(importData).some(value => value);

    const renderDataSection = (title, icon, items) => {
        const availableItems = items.filter(item => {
            const count = getDataTypeCount(item.key);
            return count && count !== 0;
        });
        if (availableItems.length === 0) return null;

        return (
            <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2 mb-3">
                    {icon}
                    <h4 className="font-medium text-gray-900">{title}</h4>
                </div>
                <div className="space-y-2 ml-6">
                    {availableItems.map(item => (
                        <div key={item.key} className="flex items-center justify-between">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={importData[item.key] || false}
                                    onChange={(e) => handleImportChange(item.key, e.target.checked)}
                                    className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                    disabled={isImporting}
                                />
                                <span className="text-sm text-gray-700">{item.label}</span>
                            </label>
                            <span className="text-sm text-gray-500">
                                ({getDataTypeCount(item.key)})
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Import Program Data v2.0</h2>
                    <button
                        onClick={() => { onClose(); resetModal(); }}
                        disabled={isImporting}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {!selectedFile ? (
                    /* File Selection */
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm">
                            Select a DNA Analysis Program export file (v2.0) to import data from another instance.
                        </p>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                            <p className="text-gray-600 mb-4">
                                Choose an export file (.json) to import
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={isAnalyzing}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isAnalyzing}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Select File'}
                            </button>
                        </div>

                        {importStatus && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                                <AlertCircle className="text-red-600 mt-0.5" size={16} />
                                <p className="text-red-800 text-sm">{importStatus}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Import Configuration */
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Import Configuration</h3>
                                <p className="text-sm text-gray-500">Select which data types to import</p>
                            </div>
                            <button
                                onClick={() => { resetModal(); }}
                                disabled={isImporting}
                                className="text-sm text-indigo-600 hover:text-indigo-700"
                            >
                                Choose Different File
                            </button>
                        </div>

                        {/* Export Info */}
                        {filePreview?.exportInfo && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-medium text-blue-900 mb-2">Export Information</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                                    <div>Version: {filePreview.exportInfo.version}</div>
                                    <div>Date: {new Date(filePreview.exportInfo.timestamp).toLocaleDateString()}</div>
                                    <div>Source: {filePreview.exportInfo.source || 'Unknown'}</div>
                                    <div>By: {filePreview.exportInfo.exportedBy || 'Unknown'}</div>
                                </div>
                            </div>
                        )}

                        {/* Data Selection */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">Select Data to Import</h4>

                            {/* Users Section */}
                            {renderDataSection(
                                'Users',
                                <Users className="text-blue-600" size={20} />,
                                [
                                    { key: 'directors', label: 'Directors' },
                                    { key: 'instructors', label: 'Instructors' },
                                    { key: 'students', label: 'Students (with demographics)' }
                                ]
                            )}

                            {/* Configuration Section */}
                            {renderDataSection(
                                'Configuration',
                                <Settings className="text-green-600" size={20} />,
                                [
                                    { key: 'schools', label: 'Schools' },
                                    { key: 'programSettings', label: 'Program Settings' }
                                ]
                            )}

                            {/* Educational Content Section */}
                            {renderDataSection(
                                'Educational Content',
                                <BookOpen className="text-purple-600" size={20} />,
                                [
                                    { key: 'analysisQuestions', label: 'Analysis Questions' },
                                    { key: 'helpTopics', label: 'Master Help Topics & Children' },
                                    { key: 'stepHelp', label: 'Master Step Help & Children' },
                                    { key: 'commonFeedback', label: 'Common Feedback' },
                                    { key: 'practiceClones', label: 'Practice Clones & Answers' }
                                ]
                            )}
                        </div>

                        {/* Conflict Resolution */}
                        <div className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 mb-3">Conflict Resolution</h4>
                            <p className="text-sm text-gray-600 mb-3">
                                How should existing data be handled?
                            </p>
                            <div className="space-y-2">
                                <label className="flex items-start">
                                    <input
                                        type="radio"
                                        name="conflictResolution"
                                        value="skip"
                                        checked={conflictResolution === 'skip'}
                                        onChange={(e) => setConflictResolution(e.target.value)}
                                        className="mr-3 h-4 w-4 text-indigo-600"
                                        disabled={isImporting}
                                    />
                                    <div>
                                        <span className="font-medium">Skip existing data</span>
                                        <p className="text-sm text-gray-500">Import only new items, leave existing unchanged</p>
                                    </div>
                                </label>
                                <label className="flex items-start">
                                    <input
                                        type="radio"
                                        name="conflictResolution"
                                        value="overwrite"
                                        checked={conflictResolution === 'overwrite'}
                                        onChange={(e) => setConflictResolution(e.target.value)}
                                        className="mr-3 h-4 w-4 text-indigo-600"
                                        disabled={isImporting}
                                    />
                                    <div>
                                        <span className="font-medium">Overwrite existing data</span>
                                        <p className="text-sm text-gray-500">Update existing items with imported data</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Information Box */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                                <AlertCircle className="text-yellow-600 mt-0.5" size={16} />
                                <div className="text-sm text-yellow-800">
                                    <p className="font-medium mb-1">Import Notes:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li>• Imported users will have default passwords (defaultpassword123)</li>
                                        <li>• Practice clones require manual upload of .ab1 files</li>
                                        <li>• Relationships between questions and help content are preserved</li>
                                        <li>• School assignments are maintained where possible</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between pt-4 border-t border-gray-200">
                            <button
                                onClick={() => { onClose(); resetModal(); }}
                                disabled={isImporting}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!hasDataSelected || isImporting}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                            >
                                {isImporting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Importing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} />
                                        <span>Import Data</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Status Messages */}
                        {importStatus && (
                            <div className={`p-3 rounded-lg border flex items-start space-x-2 ${importStatus.includes('successfully') || importStatus.includes('completed')
                                ? 'bg-green-50 border-green-200'
                                : importStatus.includes('failed') || importStatus.includes('Error')
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-blue-50 border-blue-200'
                                }`}>
                                {importStatus.includes('successfully') || importStatus.includes('completed') ? (
                                    <Check className="text-green-600 mt-0.5" size={16} />
                                ) : importStatus.includes('failed') || importStatus.includes('Error') ? (
                                    <AlertCircle className="text-red-600 mt-0.5" size={16} />
                                ) : (
                                    <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                                )}
                                <p className={`text-sm ${importStatus.includes('successfully') || importStatus.includes('completed')
                                    ? 'text-green-800'
                                    : importStatus.includes('failed') || importStatus.includes('Error')
                                        ? 'text-red-800'
                                        : 'text-blue-800'
                                    }`}>
                                    {importStatus}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportModal;