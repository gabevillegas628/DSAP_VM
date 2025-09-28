import React, { useState, useEffect } from 'react';
import { X, FileText, Loader } from 'lucide-react';

const TermsOfServiceModal = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('terms');
  const [content, setContent] = useState({
    terms: '',
    privacy: '',
    licenses: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !content.terms) {
      loadContent();
    }
  }, [isOpen, content.terms]);

  const loadContent = async () => {
    setLoading(true);

    try {
      // Import the text files
      const tosModule = await import('../TOS.txt');
      const privacyModule = await import('../Privacy.txt');
      const licensesModule = await import('../Licenses.txt');

      // Fetch the actual content
      const [tosResponse, privacyResponse, licensesResponse] = await Promise.all([
        fetch(tosModule.default),
        fetch(privacyModule.default),
        fetch(licensesModule.default)
      ]);

      const [tosText, privacyText, licensesText] = await Promise.all([
        tosResponse.text(),
        privacyResponse.text(),
        licensesResponse.text()
      ]);

      setContent({
        terms: tosText,
        privacy: privacyText,
        licenses: licensesText
      });
    } catch (err) {
      console.error('Error loading content:', err);
      // Fallback content if files can't be loaded
      setContent({
        terms: 'Terms of Service content could not be loaded. Please contact your administrator.',
        privacy: 'Privacy Policy content could not be loaded. Please contact your administrator.',
        licenses: 'License information could not be loaded. Please contact your administrator.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const sections = {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    licenses: 'Open Source Licenses'
  };

  const formatContent = (text) => {
    if (!text) return null;

    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        return <div key={index} className="h-4" />;
      }

      // Headers (lines that are all caps or start with numbers)
      if (/^\d+\./.test(trimmedLine) || (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3)) {
        return (
          <div key={index} className="font-semibold text-gray-800 mt-6 mb-3 text-lg">
            {trimmedLine}
          </div>
        );
      }

      // Bullet points
      if (trimmedLine.startsWith('-')) {
        return (
          <div key={index} className="ml-6 text-gray-700 mb-2 flex">
            <span className="mr-2">•</span>
            <span>{trimmedLine.substring(1).trim()}</span>
          </div>
        );
      }

      // Regular content
      return (
        <div key={index} className="text-gray-700 leading-relaxed mb-3">
          {trimmedLine}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] md:mx-0 mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Legal Information</h3>
                <p className="text-sm text-gray-600">Waksman Student Scholars Program</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {Object.entries(sections).map(([key, title]) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors duration-200 ${activeSection === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading content...</span>
            </div>
          ) : (
            <div className="prose max-w-none">
              {formatContent(content[activeSection])}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;