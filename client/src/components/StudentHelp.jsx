import React, { useState, useEffect } from 'react';
import { Video, FileText, ExternalLink, HelpCircle, X, ChevronLeft, ChevronRight, Play, Download } from 'lucide-react';
import apiService from '../services/apiService';

const StudentHelp = ({ questionId, stepName, onClose, questionText }) => {
  const [masterHelpTopic, setMasterHelpTopic] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("both"); // "both" | "video" | "doc"

  useEffect(() => {
    if (questionId) {
      fetchMasterHelpTopic();
    } else if (stepName) {
      fetchMasterStepHelp();
    }
  }, [questionId, stepName]);

  const fetchMasterHelpTopic = async () => {
    try {
      setLoading(true);
      setError(null);
      const master = await apiService.get(`/master-help-topics/${questionId}`);
      setMasterHelpTopic(master);

      // Auto-select first topic if only one exists or multiple exist
      if (master?.helpTopics?.length > 0) {
        setSelectedTopic(master.helpTopics[0]);
        setSelectedTopicIndex(0);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching master help topic:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchMasterStepHelp = async () => {
    try {
      setLoading(true);
      setError(null);
      // Change this line to use the correct endpoint (singular, not plural)
      const master = await apiService.get(`/master-step-help/${stepName}`);
      setMasterHelpTopic(master);

      // Auto-select first topic if only one exists or multiple exist
      if (master?.stepHelps?.length > 0) {
        setSelectedTopic(master.stepHelps[0]);
        setSelectedTopicIndex(0);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching master step help:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const helpTopics = masterHelpTopic?.helpTopics || masterHelpTopic?.stepHelps || [];

  const selectTopic = (topic, index) => {
    setSelectedTopic(topic);
    setSelectedTopicIndex(index);
  };

  const getVideoEmbedUrl = (boxUrl) => {
    // Convert Box URL to embeddable format
    if (boxUrl.includes('box.com')) {
      // Extract file ID from Box URL and convert to embed format
      const fileIdMatch = boxUrl.match(/\/s\/([a-zA-Z0-9]+)/);
      if (fileIdMatch) {
        return `https://app.box.com/embed/s/${fileIdMatch[1]}`;
      }
      // Alternative Box URL format
      const fileIdMatch2 = boxUrl.match(/\/file\/(\d+)/);
      if (fileIdMatch2) {
        return `https://app.box.com/embed/preview/${fileIdMatch2[1]}`;
      }
    }
    // Return original URL if not a Box URL or if conversion fails
    return boxUrl;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading help content...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !masterHelpTopic || helpTopics.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md">
            <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Help Content Not Available</h2>
            <p className="text-gray-600 mb-4">
              {error || "No help content is available for this question or step."}
            </p>
            <button
              onClick={onClose}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Close Help Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show topic selector if no topic selected and multiple topics exist
  if (!selectedTopic && helpTopics.length > 1) {
    return (
      <div className="bg-white rounded-xl shadow-sm border flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{masterHelpTopic.title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {questionText ? `Question: ${questionText}` : `Step: ${stepName}`}
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                Choose from {helpTopics.length} available help topics
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Available Help Topics:</h3>
          <div className="grid gap-4">
            {helpTopics.map((topic, index) => (
              <button
                key={topic.id}
                onClick={() => selectTopic(topic, index)}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold group-hover:bg-indigo-200">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{topic.title}</h4>
                    {topic.description && (
                      <p className="text-sm text-gray-600 mb-2">{topic.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Video className="w-3 h-3" />
                        <span>Video available</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3" />
                        <span>Document available</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show the selected topic content
  const currentTopic = selectedTopic || helpTopics[0];
  const currentIndex = selectedTopicIndex;

  return (
    <div className="bg-white rounded-xl shadow-sm border flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            {helpTopics.length > 1 && (
              <button
                onClick={() => setSelectedTopic(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Back to topic list"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{currentTopic.title}</h2>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-gray-600">
                  {questionText ? `Question: ${questionText.substring(0, 60)}...` : `Step: ${stepName}`}
                </p>
                {helpTopics.length > 1 && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    Topic {currentIndex + 1} of {helpTopics.length}
                  </span>
                )}
              </div>
              {currentTopic.description && (
                <p className="text-sm text-gray-500 mt-1">{currentTopic.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
              title="Close help tab"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Topic Selection Buttons - Only show if multiple topics */}
        {helpTopics.length > 1 && (
          <div className="mt-4">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Topics:</span>
              <span className="text-xs text-gray-500">({helpTopics.length} available)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {helpTopics.map((topic, index) => (
                <button
                  key={topic.id}
                  onClick={() => selectTopic(topic, index)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${index === currentIndex
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700'
                    }`}
                  title={topic.description || topic.title}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${index === currentIndex
                      ? 'bg-white text-indigo-600'
                      : 'bg-gray-300 text-gray-600'
                      }`}>
                      {index + 1}
                    </span>
                    <span className="whitespace-nowrap">{topic.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* View Mode Selector */}
        <div className="flex items-center space-x-2 mt-4">
          <span className="text-sm text-gray-600">View:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("both")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "both"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Both
            </button>
            <button
              onClick={() => setViewMode("video")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "video"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Video className="w-4 h-4 inline mr-1" />
              Video
            </button>
            <button
              onClick={() => setViewMode("doc")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === "doc"
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Document
            </button>
          </div>
        </div>
      </div>

      {/* Content Area - Now takes remaining space */}
      <div className="flex-1 min-h-0">
        {viewMode === "both" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            {/* Video Panel */}
            <div className="border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Video className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">Help Video</h3>
                  </div>

                  <a href={currentTopic.videoBoxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in new tab</span>
                  </a>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden">
                  <iframe
                    src={getVideoEmbedUrl(currentTopic.videoBoxUrl)}
                    className="w-full h-full border-0"
                    allowFullScreen
                    title={`Help video: ${currentTopic.title}`}
                  />
                </div>
              </div>
            </div>

            {/* Document Panel */}
            <div className="flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <h3 className="font-medium text-gray-900">Help Document</h3>
                  </div>

                  <a href={currentTopic.helpDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden">
                  <iframe
                    src={`${currentTopic.helpDocumentUrl}#view=fit`}
                    className="w-full h-full border-0"
                    title={`Help document: ${currentTopic.title}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === "video" && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-gray-900">Help Video</h3>
                </div>

                <a href={currentTopic.videoBoxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in new tab</span>
                </a>
              </div>
            </div>
            <div className="flex-1 p-6">
              <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden">
                <iframe
                  src={getVideoEmbedUrl(currentTopic.videoBoxUrl)}
                  className="w-full h-full border-0"
                  allowFullScreen
                  title={`Help video: ${currentTopic.title}`}
                />
              </div>
            </div>
          </div>
        )}

        {viewMode === "doc" && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">Help Document</h3>
                </div>

                <a href={currentTopic.helpDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              </div>
            </div>
            <div className="flex-1 p-6">
              <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden">
                <iframe
                  src={`${currentTopic.helpDocumentUrl}#view=fit`}
                  className="w-full h-full border-0"
                  title={`Help document: ${currentTopic.title}`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHelp;