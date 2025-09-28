import React, { useState, useEffect, use } from 'react';
import { useProgramSettingsContext } from '../context/ProgramSettingsContext';
import { Plus, Edit2, Trash2, Save, X, MessageSquare, Download, Upload, Database, AlertCircle, CheckCircle, ChevronDown, ChevronRight, ProjectIcon, Users, Building, BookOpen, Settings, FlaskConical, User, Camera } from 'lucide-react';
import ExportModal from './ExportModal';
import ImportModal from './ImportModal';
import apiService from '../services/apiService';
import { useDNAContext } from '../context/DNAContext';
import WebcamCapture from './WebcamCapture';
import { validateProfilePicture } from '../utils/ProfilePictureValidator';

// Add this CSS for animations
const animationStyles = `
  .section-wrapper {
    display: grid;
    transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .section-wrapper.collapsed {
    grid-template-rows: 0fr;
  }
  .section-wrapper.expanded {
    grid-template-rows: 1fr;
  }
  .section-content {
    overflow: hidden;
    transition: opacity 0.3s ease;
  }
  .section-content.collapsed {
    opacity: 0;
  }
  .section-content.expanded {
    opacity: 1;
  }
  .chevron-icon {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .chevron-icon.expanded {
    transform: rotate(90deg);
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined' && !document.querySelector('#director-settings-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'director-settings-styles';
  styleSheet.textContent = animationStyles;
  document.head.appendChild(styleSheet);
}

// Project icon component
const ProjectIconComponent = () => (
  <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold">P</div>
);

// Collapsible Section Component
const CollapsibleSection = ({ sectionKey, title, description, icon: Icon, children, expandedSections, toggleSection }) => {
  const isExpanded = expandedSections[sectionKey];

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Icon className="text-indigo-600" size={20} />
          <div className="text-left">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
        </div>
        <ChevronRight
          className={`chevron-icon text-gray-400 ${isExpanded ? 'expanded' : ''}`}
          size={20}
        />
      </button>
      <div className={`section-wrapper ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className={`section-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
          <div className="px-6 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const DirectorSettings = () => {
  const [settings, setSettings] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [formData, setFormData] = useState({
    projectHeader: 'DNA Analysis Program',
    principalInvestigator: '',
    projectName: '',
    staffEmail: '',
    organismName: '',
    orfContactInformation: '',
    cloningVector: '',
    sequencePrimer: '',
    libraryName: '',
    restrictionEnzyme: '',
    description: '',
    welcomeText: '',
    overview: '',
    collectDemographics: false
  });
  const [directors, setDirectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [showWebcamCapture, setShowWebcamCapture] = useState(false);

  // Import/Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [lastImportResult, setLastImportResult] = useState(null);

  // Section visibility states
  const [expandedSections, setExpandedSections] = useState({
    projectInfo: false,
    commonFeedback: false,
    dataManagement: false,
    accountSettings: false
  });

  // Common Feedback states
  const [analysisQuestions, setAnalysisQuestions] = useState([]);
  const [commonFeedback, setCommonFeedback] = useState([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [newFeedback, setNewFeedback] = useState({
    questionId: '',
    title: '',
    text: ''
  });
  // Profile Picture states
  const { currentUser } = useDNAContext();
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  

  useEffect(() => {
    loadInitialData();
  }, []);


  // Profile picture upload handler with validation (no porn validation)
  const handleProfilePictureUpload = async (file) => {
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      setProfileMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ type: 'error', text: 'Image must be smaller than 5MB' });
      return;
    }


    setUploadingPicture(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const updatedUser = await apiService.uploadFiles(
        `/users/${currentUser.id}/profile-picture`,
        formData
      );

      setProfileMessage({ type: 'success', text: 'Profile picture updated successfully!' });
      // The context will handle the user update
    } catch (error) {
      setProfileMessage({ type: 'error', text: 'Failed to upload profile picture' });
    } finally {
      setUploadingPicture(false);
    }
  };

  // webcam capture handler
  const handleWebcamCapture = (file) => {
    if (file) {
      handleProfilePictureUpload(file);
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!currentUser) return;

    setUploadingPicture(true);
    try {
      await apiService.delete(`/users/${currentUser.id}/profile-picture`);
      setProfileMessage({ type: 'success', text: 'Profile picture removed successfully!' });
    } catch (error) {
      setProfileMessage({ type: 'error', text: 'Failed to remove profile picture' });
    } finally {
      setUploadingPicture(false);
    }
  };

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadProgramSettings(),
        loadDirectors(),
        loadAnalysisQuestions(),
        loadCommonFeedback()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setContextLoading(false);
    }
  };

  const loadProgramSettings = async () => {
    try {
      const response = await apiService.get('/program-settings');
      if (response) {
        setSettings(response);
        setFormData({
          projectHeader: response.projectHeader || 'DNA Analysis Program',
          principalInvestigator: response.principalInvestigator || '',
          projectName: response.projectName || '',
          staffEmail: response.staffEmail || '',
          organismName: response.organismName || '',
          orfContactInformation: response.orfContactInformation || '',
          cloningVector: response.cloningVector || '',
          sequencePrimer: response.sequencePrimer || '',
          libraryName: response.libraryName || '',
          restrictionEnzyme: response.restrictionEnzyme || '',
          description: response.description || '',
          welcomeText: response.welcomeText || '',
          overview: response.overview || '',
          collectDemographics: response.collectDemographics || false
        });
      }
    } catch (error) {
      console.error('Error loading program settings:', error);
    }
  };

  const loadDirectors = async () => {
    try {
      const response = await apiService.get('/directors');
      setDirectors(response);
    } catch (error) {
      console.error('Error loading directors:', error);
    }
  };

  const loadAnalysisQuestions = async () => {
    try {
      const response = await apiService.get('/analysis-questions');
      setAnalysisQuestions(response);
    } catch (error) {
      console.error('Error loading analysis questions:', error);
    }
  };

  const loadCommonFeedback = async () => {
    try {
      const response = await apiService.get('/common-feedback');
      setCommonFeedback(response);
    } catch (error) {
      console.error('Error loading common feedback:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiService.post('/program-settings', formData);
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('Error saving settings. Please try again.');
    }
    setLoading(false);
  };

  // Import/Export functions
  const handleImportComplete = (result) => {
    setLastImportResult(result);
    // Refresh data after successful import
    if (result.success) {
      loadAnalysisQuestions();
      loadCommonFeedback();
      loadProgramSettings();
      // Auto-hide the result after 10 seconds
      setTimeout(() => {
        setLastImportResult(null);
      }, 10000);
    }
    console.log('Import completed:', result);
  };

  // Toggle section visibility
  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Common Feedback functions
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();

    if (!newFeedback.questionId || !newFeedback.title || !newFeedback.text) {
      alert('Please fill in all fields');
      return;
    }

    try {
      if (editingFeedback) {
        await apiService.put(`/common-feedback/${editingFeedback.id}`, newFeedback);
      } else {
        await apiService.post('/common-feedback', newFeedback);
      }

      await loadCommonFeedback();
      setShowFeedbackForm(false);
      setEditingFeedback(null);
      setNewFeedback({ questionId: '', title: '', text: '' });
    } catch (error) {
      console.error('Error saving feedback:', error);
      alert('Error saving feedback');
    }
  };

  const editFeedback = (feedback) => {
    setEditingFeedback(feedback);
    setNewFeedback({
      questionId: feedback.questionId,
      title: feedback.title,
      text: feedback.text
    });
    setShowFeedbackForm(true);
  };

  const deleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback option?')) {
      return;
    }

    try {
      await apiService.delete(`/common-feedback/${feedbackId}`);
      await loadCommonFeedback();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Error deleting feedback');
    }
  };

  const cancelFeedbackForm = () => {
    setShowFeedbackForm(false);
    setEditingFeedback(null);
    setNewFeedback({ questionId: '', title: '', text: '' });
  };

  const getQuestionText = (questionId) => {
    const question = analysisQuestions.find(q => q.id === questionId);
    return question ? `[${question.step}] ${question.text}` : 'Unknown Question';
  };

  // Group feedback by question
  const groupedFeedback = commonFeedback.reduce((acc, feedback) => {
    if (!acc[feedback.questionId]) {
      acc[feedback.questionId] = [];
    }
    acc[feedback.questionId].push(feedback);
    return acc;
  }, {});

  if (contextLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Replace the return statement container in DirectorSettings.jsx
  return (
    <div className="w-full space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Program Settings</h2>
        <p className="text-gray-600">Configure your DNA Analysis Program settings and manage data.</p>
      </div>

      {/* Account Settings Section */}
      <CollapsibleSection
        sectionKey="accountSettings"
        title="Account Settings"
        description="Manage your personal account information"
        icon={User}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      >
        {/* Profile Picture Section */}
        <div className="space-y-6">
          {profileMessage.text && (
            <div className={`p-4 rounded-lg border ${profileMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
              }`}>
              <div className="flex items-center space-x-2">
                {profileMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{profileMessage.text}</span>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Camera className="w-4 h-4" />
              <span>Profile Picture</span>
            </h4>

            {currentUser && (
              <div className="flex items-center space-x-6">
                {/* Profile Picture Display */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                    {currentUser.profilePicture ? (
                      <img
                        src={currentUser.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  {uploadingPicture && (
                    <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>

                {/* Profile Picture Controls */}
                <div className="flex-1">
                  <div className="flex space-x-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleProfilePictureUpload(file);
                      }}
                      className="hidden"
                      id="director-profile-upload"
                    />
                    <label
                      htmlFor="director-profile-upload"
                      className="cursor-pointer px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 inline-block text-sm"
                    >
                      {uploadingPicture ? 'Uploading...' : (currentUser.profilePicture ? 'Change Picture' : 'Upload Picture')}
                    </label>
                    {/* webcam capture button */}
                    <button
                      onClick={() => setShowWebcamCapture(true)}
                      disabled={uploadingPicture}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 disabled:opacity-50 text-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                    {currentUser.profilePicture && (
                      <button
                        onClick={handleRemoveProfilePicture}
                        disabled={uploadingPicture}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 disabled:opacity-50 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    JPG, PNG, or GIF up to 5MB. Recommended: 400x400px
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Account Information Display */}
          {currentUser && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Account Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-2 font-medium">{currentUser.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-medium">{currentUser.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">Role:</span>
                  <span className="ml-2 font-medium capitalize">{currentUser.role}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2 font-medium capitalize text-green-600">{currentUser.status}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Project Information Section */}
      <CollapsibleSection
        sectionKey="projectInfo"
        title="Project Information"
        description="Configure basic project details and program information"
        icon={ProjectIconComponent}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      >
        {/* ... rest of the content stays the same ... */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Header
            </label>
            <input
              type="text"
              name="projectHeader"
              value={formData.projectHeader}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Principal Investigator
            </label>
            <input
              type="text"
              name="principalInvestigator"
              value={formData.principalInvestigator}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              name="projectName"
              value={formData.projectName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staff Email
            </label>
            <input
              type="email"
              name="staffEmail"
              value={formData.staffEmail}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organism Name
            </label>
            <input
              type="text"
              name="organismName"
              value={formData.organismName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ORF Contact Information
            </label>
            <input
              type="text"
              name="orfContactInformation"
              value={formData.orfContactInformation}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cloning Vector
            </label>
            <input
              type="text"
              name="cloningVector"
              value={formData.cloningVector}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sequence Primer
            </label>
            <input
              type="text"
              name="sequencePrimer"
              value={formData.sequencePrimer}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Library Name
            </label>
            <input
              type="text"
              name="libraryName"
              value={formData.libraryName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Restriction Enzyme
            </label>
            <input
              type="text"
              name="restrictionEnzyme"
              value={formData.restrictionEnzyme}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Welcome Text (Main heading on Login Screen)
          </label>
          <textarea
            name="welcomeText"
            value={formData.welcomeText}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Welcome message shown to students when they log in..."
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overview (Appears on Login Screen)
          </label>
          <textarea
            name="overview"
            value={formData.overview}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Program overview and instructions..."
          />
        </div>

        <div className="mt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="collectDemographics"
              checked={formData.collectDemographics}
              onChange={handleInputChange}
              className="mr-3 h-4 w-4 text-indigo-600 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              Collect demographic information from students during registration
            </span>
          </label>
        </div>
      </CollapsibleSection>

      {/* Common Feedback Section */}
      <CollapsibleSection
        sectionKey="commonFeedback"
        title="Common Feedback"
        description="Create reusable feedback templates for grading and reviewing student work"
        icon={MessageSquare}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      >
        <div className="mb-6">
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            <span>Add Feedback</span>
          </button>
        </div>

        {/* Feedback Form */}
        {showFeedbackForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Question
                </label>
                <select
                  value={newFeedback.questionId}
                  onChange={(e) => setNewFeedback({ ...newFeedback, questionId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select a question...</option>
                  {analysisQuestions.map(question => (
                    <option key={question.id} value={question.id}>
                      [{question.step}] {question.text}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback Title
                </label>
                <input
                  type="text"
                  value={newFeedback.title}
                  onChange={(e) => setNewFeedback({ ...newFeedback, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 'Missing units', 'Incomplete analysis'..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback Text
                </label>
                <textarea
                  value={newFeedback.text}
                  onChange={(e) => setNewFeedback({ ...newFeedback, text: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="The detailed feedback message to show to students..."
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Save size={16} />
                  <span>{editingFeedback ? 'Update' : 'Save'} Feedback</span>
                </button>
                <button
                  type="button"
                  onClick={cancelFeedbackForm}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  <X size={16} />
                  <span>Cancel</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Feedback List */}
        <div className="space-y-4">
          {Object.keys(groupedFeedback).length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No common feedback options created yet. Click "Add Feedback" to get started!
            </p>
          ) : (
            Object.entries(groupedFeedback).map(([questionId, feedbackItems]) => (
              <div key={questionId} className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">
                    {getQuestionText(questionId)}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {feedbackItems.length} feedback option{feedbackItems.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="divide-y divide-gray-200">
                  {feedbackItems.map(feedback => (
                    <div key={feedback.id} className="px-4 py-3 flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-1">
                          {feedback.title}
                        </h5>
                        <p className="text-gray-600 text-sm">
                          {feedback.text}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => editFeedback(feedback)}
                          className="text-indigo-600 hover:text-indigo-800 p-1"
                          title="Edit feedback"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteFeedback(feedback.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete feedback"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleSection>

      {/* Data Management Section - Updated for v2.0 */}
      <CollapsibleSection
        sectionKey="dataManagement"
        title="Data Management v2.0"
        description="Import and export program data with enhanced relationship preservation"
        icon={Database}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      >
        {/* Last Import Result */}
        {lastImportResult && (
          <div className={`p-4 rounded-lg border mb-6 ${lastImportResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
            }`}>
            <div className="flex items-start space-x-2">
              {lastImportResult.success ? (
                <CheckCircle className="text-green-600 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-red-600 mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <h4 className={`font-medium ${lastImportResult.success ? 'text-green-900' : 'text-red-900'}`}>
                  Import {lastImportResult.success ? 'Successful' : 'Failed'}
                </h4>
                <p className={`text-sm mt-1 ${lastImportResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {lastImportResult.message}
                </p>
                {lastImportResult.results && (
                  <div className="mt-2 text-sm">
                    {lastImportResult.results.imported && Object.keys(lastImportResult.results.imported).length > 0 && (
                      <div className="text-green-800">
                        <strong>Imported:</strong> {Object.values(lastImportResult.results.imported).join(', ')}
                      </div>
                    )}
                    {lastImportResult.results.updated && Object.keys(lastImportResult.results.updated).length > 0 && (
                      <div className="text-blue-800">
                        <strong>Updated:</strong> {Object.values(lastImportResult.results.updated).join(', ')}
                      </div>
                    )}
                    {lastImportResult.results.skipped && Object.keys(lastImportResult.results.skipped).length > 0 && (
                      <div className="text-yellow-800">
                        <strong>Skipped:</strong> {Object.values(lastImportResult.results.skipped).join(', ')}
                      </div>
                    )}
                    {lastImportResult.results.errors && lastImportResult.results.errors.length > 0 && (
                      <div className="text-red-800">
                        <strong>Errors:</strong> {lastImportResult.results.errors.length} issues occurred
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setLastImportResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Export/Import Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Download className="text-blue-600" size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Export Data v2.0</h4>
                <p className="text-sm text-gray-600">Create backups and share configurations</p>
              </div>
            </div>

            {/* Export Features */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="text-gray-500" size={16} />
                <span className="text-sm text-gray-700">Users & Demographics</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building className="text-gray-500" size={16} />
                <span className="text-sm text-gray-700">Schools & Configuration</span>
              </div>
              <div className="flex items-center space-x-2">
                <BookOpen className="text-gray-500" size={16} />
                <span className="text-sm text-gray-700">Educational Content</span>
              </div>
              <div className="flex items-center space-x-2">
                <FlaskConical className="text-gray-500" size={16} />
                <span className="text-sm text-gray-700">Practice Clones & Answers</span>
              </div>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={18} />
              <span>Export Program Data</span>
            </button>
          </div>

          {/* Import Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Upload className="text-green-600" size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Import Data v2.0</h4>
                <p className="text-sm text-gray-600">Load data from another instance</p>
              </div>
            </div>

            {/* Import Features */}
            <div className="space-y-2 mb-4 text-sm text-gray-600">
              <p>✓ Preserves question-help relationships</p>
              <p>✓ Maintains school assignments</p>
              <p>✓ Selective data import</p>
              <p>✓ Conflict resolution options</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-yellow-600 mt-0.5" size={14} />
                <p className="text-xs text-yellow-800">
                  <strong>Important:</strong> Consider exporting current data as a backup before importing.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowImportModal(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload size={18} />
              <span>Import Program Data</span>
            </button>
          </div>
        </div>

        {/* v2.0 Features Box */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-indigo-900 mb-2">✨ New in v2.0</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-indigo-800">
            <div>
              <strong>Enhanced Relationships:</strong>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Question-to-help topic links preserved</li>
                <li>• Common feedback associations maintained</li>
                <li>• Practice clone answers correctly linked</li>
              </ul>
            </div>
            <div>
              <strong>Smart Importing:</strong>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Automatic ID mapping and translation</li>
                <li>• School assignment preservation</li>
                <li>• Demographics included with students</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-gray-50 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-gray-900 mb-2">Best Practices</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>Regular Backups:</strong> Export your data regularly as a backup measure</li>
            <li>• <strong>Annual Setup:</strong> Use exports to quickly set up new academic year instances</li>
            <li>• <strong>Content Sharing:</strong> Share educational content (questions, help, practice clones) between institutions</li>
            <li>• <strong>Test First:</strong> Test imports in a development environment when possible</li>
            <li>• <strong>File Management:</strong> Practice clone .ab1 files need to be uploaded separately after import</li>
          </ul>
        </div>
      </CollapsibleSection>

      {/* Save Button */}
      <div className="flex items-center justify-between bg-white shadow rounded-lg p-6">
        <div>
          {saveStatus && (
            <p className={`text-sm ${saveStatus.includes('successfully')
              ? 'text-green-600'
              : 'text-red-600'
              }`}>
              {saveStatus}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />
      <WebcamCapture
        isOpen={showWebcamCapture}
        onClose={() => setShowWebcamCapture(false)}
        onCapture={handleWebcamCapture}
      />
    </div>
  );
};

export default DirectorSettings;