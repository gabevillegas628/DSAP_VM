import React, { useState, useEffect } from 'react';
import { Download, X, AlertCircle, Check, Users, Building, FlaskConical, Settings, HelpCircle, MessageSquare, BookOpen } from 'lucide-react';
import apiService from '../services/apiService';

const ExportModal = ({ isOpen, onClose }) => {
    const [exportData, setExportData] = useState({
        // Users
        directors: false,
        instructors: false,
        students: false,

        // Configuration
        schools: false,
        programSettings: false,

        // Educational Content
        practiceClones: false,
        analysisQuestions: false,
        commonFeedback: false,
        helpTopics: false,
        stepHelp: false,

        // Options
        createDefaultDirector: false
    });

    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState('');
    const [counts, setCounts] = useState({
        users: { directors: 0, instructors: 0, students: 0 },
        content: {
            schools: 0,
            analysisQuestions: 0,
            helpTopics: 0,
            stepHelp: 0,
            commonFeedback: 0,
            practiceClones: 0,
            practiceAnswers: 0,
            programSettings: 0
        }
    });

    // Fetch counts when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchCounts();
        }
    }, [isOpen]);

    const fetchCounts = async () => {
        try {
            const data = await apiService.get('/export/counts');
            setCounts(data);
        } catch (error) {
            console.error('Error fetching counts:', error);
        }
    };

    const handleExportChange = (key, value) => {
        setExportData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // In ExportModal.jsx, replace the handleExport function with this:
    const handleExport = async () => {
        setIsExporting(true);
        setExportStatus('Preparing export...');

        try {
            // Use apiService.downloadExport which should hit /export-v2
            const blob = await apiService.downloadExport(exportData);

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            link.download = `dna-analysis-export-v2-${timestamp}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setExportStatus('Export completed successfully!');
            setTimeout(() => {
                onClose();
                setExportStatus('');
                setIsExporting(false);
            }, 2000);

        } catch (error) {
            console.error('Export error:', error);
            setExportStatus(`Export failed: ${error.message}`);
            setIsExporting(false);
        }
    };

    const hasDataSelected = Object.entries(exportData)
        .filter(([key]) => key !== 'createDefaultDirector')
        .some(([, value]) => value);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Export Program Data v2.0</h2>
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <p className="text-gray-600 text-sm">
                        Select the data you want to export. This will create a file that can be imported into other instances of the DNA Analysis Program.
                    </p>

                    {/* Users Section */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <Users className="text-blue-600" size={20} />
                            <h3 className="font-medium text-gray-900">Users</h3>
                        </div>
                        <div className="space-y-2 ml-6">
                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.directors}
                                        onChange={(e) => handleExportChange('directors', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Directors</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.users.directors})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.instructors}
                                        onChange={(e) => handleExportChange('instructors', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Instructors</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.users.instructors})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.students}
                                        onChange={(e) => handleExportChange('students', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Students (with demographics)</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.users.students})</span>
                            </label>
                        </div>
                    </div>

                    {/* Configuration Section */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <Settings className="text-green-600" size={20} />
                            <h3 className="font-medium text-gray-900">Configuration</h3>
                        </div>
                        <div className="space-y-2 ml-6">
                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.schools}
                                        onChange={(e) => handleExportChange('schools', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Schools</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.schools})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.programSettings}
                                        onChange={(e) => handleExportChange('programSettings', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Program Settings</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.programSettings})</span>
                            </label>
                        </div>
                    </div>

                    {/* Educational Content Section */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <BookOpen className="text-purple-600" size={20} />
                            <h3 className="font-medium text-gray-900">Educational Content</h3>
                        </div>
                        <div className="space-y-2 ml-6">
                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.analysisQuestions}
                                        onChange={(e) => handleExportChange('analysisQuestions', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Analysis Questions</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.analysisQuestions})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.helpTopics}
                                        onChange={(e) => handleExportChange('helpTopics', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Master Help Topics & Children</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.helpTopics})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.stepHelp}
                                        onChange={(e) => handleExportChange('stepHelp', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Master Step Help & Children</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.stepHelp})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.stepHelp}
                                        onChange={(e) => handleExportChange('stepHelp', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Step Help (workflow guides)</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.stepHelp})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.commonFeedback}
                                        onChange={(e) => handleExportChange('commonFeedback', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Common Feedback</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.commonFeedback})</span>
                            </label>

                            <label className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={exportData.practiceClones}
                                        onChange={(e) => handleExportChange('practiceClones', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                        disabled={isExporting}
                                    />
                                    <span>Practice Clones (metadata only)</span>
                                </div>
                                <span className="text-sm text-gray-500">({counts.content.practiceClones} clones, {counts.content.practiceAnswers} answers)</span>
                            </label>
                        </div>
                    </div>

                    {/* Default Director Option */}
                    {exportData.directors && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <label className="flex items-start">
                                <input
                                    type="checkbox"
                                    checked={exportData.createDefaultDirector}
                                    onChange={(e) => handleExportChange('createDefaultDirector', e.target.checked)}
                                    className="mr-3 mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                    disabled={isExporting}
                                />
                                <div>
                                    <span className="font-medium">Create default director in target system</span>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Creates a default director account (director@example.com/password123) if no directors exist after import
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Information Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                            <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                            <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">Export Notes:</p>
                                <ul className="space-y-1 text-xs">
                                    <li>• User passwords are excluded for security</li>
                                    <li>• Practice clones export metadata only (re-upload .ab1 files separately)</li>
                                    <li>• Help topics and feedback maintain question relationships</li>
                                    <li>• Demographics are included only with student exports</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between pt-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            disabled={isExporting}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={!hasDataSelected || isExporting}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                            {isExporting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    <span>Exporting...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>Export Data</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Status Messages */}
                    {exportStatus && (
                        <div className={`p-3 rounded-lg border flex items-start space-x-2 ${exportStatus.includes('successfully') || exportStatus.includes('completed')
                            ? 'bg-green-50 border-green-200'
                            : exportStatus.includes('failed') || exportStatus.includes('Error')
                                ? 'bg-red-50 border-red-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                            {exportStatus.includes('successfully') || exportStatus.includes('completed') ? (
                                <Check className="text-green-600 mt-0.5" size={16} />
                            ) : exportStatus.includes('failed') || exportStatus.includes('Error') ? (
                                <AlertCircle className="text-red-600 mt-0.5" size={16} />
                            ) : (
                                <AlertCircle className="text-blue-600 mt-0.5" size={16} />
                            )}
                            <p className={`text-sm ${exportStatus.includes('successfully') || exportStatus.includes('completed')
                                ? 'text-green-800'
                                : exportStatus.includes('failed') || exportStatus.includes('Error')
                                    ? 'text-red-800'
                                    : 'text-blue-800'
                                }`}>
                                {exportStatus}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExportModal;