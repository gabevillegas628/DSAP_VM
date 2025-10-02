import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download } from 'lucide-react';
import apiService from '../services/apiService';

const NCBISubmissionModal = ({
  isOpen,
  onClose,
  selectedCount,
  onSubmit,
  isSubmitting,
  defaultOrganism = '',
  defaultLibraryName = ''
}) => {
  const [formData, setFormData] = useState({
    submitterName: '',
    submitterEmail: '',
    submitterInstitution: '',
    city: '',
    state: '',
    country: 'USA',
    postalCode: '',
    organism: defaultOrganism,
    isolationSource: '',
    collectionDate: '',
    libraryName: defaultLibraryName,
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [submissionResult, setSubmissionResult] = useState(null);

  // Update organism and library when defaults change
  useEffect(() => {
    if (defaultOrganism) {
      setFormData(prev => ({ ...prev, organism: defaultOrganism }));
    }
  }, [defaultOrganism]);

  useEffect(() => {
    if (defaultLibraryName) {
      setFormData(prev => ({ ...prev, libraryName: defaultLibraryName }));
    }
  }, [defaultLibraryName]);

  // Reset result when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSubmissionResult(null);
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.submitterName.trim()) {
      newErrors.submitterName = 'Submitter name is required';
    }
    if (!formData.submitterEmail.trim()) {
      newErrors.submitterEmail = 'Submitter email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.submitterEmail)) {
      newErrors.submitterEmail = 'Email is invalid';
    }
    if (!formData.submitterInstitution.trim()) {
      newErrors.submitterInstitution = 'Institution is required';
    }
    if (!formData.organism.trim()) {
      newErrors.organism = 'Organism is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      const result = await onSubmit(formData);
      setSubmissionResult(result);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDownloadSqn = async () => {
    if (!submissionResult?.sqnFilename) return;

    try {
      const blob = await apiService.downloadBlob(`/ncbi/download/${submissionResult.sqnFilename}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = submissionResult.sqnFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download submission file');
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Reset form after a delay to avoid visual flash
      setTimeout(() => {
        setFormData({
          submitterName: '',
          submitterEmail: '',
          submitterInstitution: '',
          city: '',
          state: '',
          country: 'USA',
          postalCode: '',
          organism: defaultOrganism,
          isolationSource: '',
          collectionDate: '',
          libraryName: defaultLibraryName,
          notes: ''
        });
        setErrors({});
        setSubmissionResult(null);
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Submit to NCBI GenBank</h3>
            <p className="text-sm text-gray-600 mt-1">
              {submissionResult ?
                'Submission Results' :
                `Submitting ${selectedCount} clone${selectedCount !== 1 ? 's' : ''} to NCBI`
              }
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {submissionResult ? (
          // Results View
          <div className="p-6 space-y-6">
            {submissionResult.success ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-900">Submission File Generated Successfully</h4>
                      <p className="text-sm text-green-800 mt-1">
                        {submissionResult.message}
                      </p>
                      {submissionResult.successful?.length > 0 && (
                        <p className="text-sm text-green-800 mt-2">
                          Successfully processed {submissionResult.successful.length} sequence(s)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Validation Warnings */}
                {submissionResult.validation?.warnings?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-900">Validation Warnings</h4>
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {submissionResult.validation.warnings.map((warning, idx) => (
                            <p key={idx} className="text-sm text-yellow-800">
                              • {warning}
                            </p>
                          ))}
                        </div>
                        <p className="text-sm text-yellow-800 mt-2">
                          These warnings may not prevent submission but should be reviewed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Download Section */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-900 mb-2">Next Steps</h4>
                  <ol className="text-sm text-indigo-800 space-y-2 mb-4">
                    <li>1. Download the generated .sqn file below</li>
                    <li>2. Review the file and validation warnings if any</li>
                    <li>3. Submit the .sqn file to NCBI via their Submission Portal</li>
                    <li>4. NCBI will email you with accession numbers once processed</li>
                  </ol>
                  <button
                    onClick={handleDownloadSqn}
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Submission File (.sqn)</span>
                  </button>
                </div>

                {/* Failed Sequences */}
                {submissionResult.failed?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-900">Failed Sequences</h4>
                        <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                          {submissionResult.failed.map((fail, idx) => (
                            <div key={idx} className="text-sm text-red-800">
                              <p className="font-medium">{fail.filename}</p>
                              <p className="text-xs">{fail.error}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              // Error View
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900">Submission Failed</h4>
                      <p className="text-sm text-red-800 mt-1">
                        {submissionResult.error || 'An unknown error occurred'}
                      </p>
                      {submissionResult.details && (
                        <p className="text-xs text-red-700 mt-2 font-mono">
                          {submissionResult.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Validation Errors */}
                {submissionResult.validation?.errors?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-900 mb-2">Validation Errors</h4>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {submissionResult.validation.errors.map((error, idx) => (
                        <p key={idx} className="text-sm text-red-800">
                          • {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed Sequences */}
                {submissionResult.failed?.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-semibold text-orange-900 mb-2">Failed Sequences</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {submissionResult.failed.map((fail, idx) => (
                        <div key={idx} className="text-sm text-orange-800">
                          <p className="font-medium">{fail.filename}</p>
                          <p className="text-xs">{fail.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setSubmissionResult(null)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Try Again
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          // Form View
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Before submitting to NCBI:</p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Ensure all sequences have been properly reviewed and approved</li>
                    <li>Verify organism and source information is accurate</li>
                    <li>Sequences must contain only A, T, G, C (no N or ambiguous nucleotides)</li>
                    <li>This will generate a .sqn file for submission via NCBI's portal</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submitter Information */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Submitter Information</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="submitterName"
                    value={formData.submitterName}
                    onChange={handleChange}
                    placeholder="First Last"
                    className={`w-full px-3 py-2 border rounded-lg ${errors.submitterName ? 'border-red-300' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                  />
                  {errors.submitterName && (
                    <p className="text-red-600 text-sm mt-1">{errors.submitterName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="submitterEmail"
                    value={formData.submitterEmail}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg ${errors.submitterEmail ? 'border-red-300' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                  />
                  {errors.submitterEmail && (
                    <p className="text-red-600 text-sm mt-1">{errors.submitterEmail}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Institution <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="submitterInstitution"
                    value={formData.submitterInstitution}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg ${errors.submitterInstitution ? 'border-red-300' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                  />
                  {errors.submitterInstitution && (
                    <p className="text-red-600 text-sm mt-1">{errors.submitterInstitution}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="e.g., CA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sequence Information */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Sequence Information</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organism <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="organism"
                    value={formData.organism}
                    onChange={handleChange}
                    placeholder="e.g., Escherichia coli"
                    className={`w-full px-3 py-2 border rounded-lg ${errors.organism ? 'border-red-300' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                  />
                  {errors.organism && (
                    <p className="text-red-600 text-sm mt-1">{errors.organism}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clone Library Name
                  </label>
                  <input
                    type="text"
                    name="libraryName"
                    value={formData.libraryName}
                    onChange={handleChange}
                    placeholder="e.g., E. coli genomic library 2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Isolation Source
                  </label>
                  <input
                    type="text"
                    name="isolationSource"
                    value={formData.isolationSource}
                    onChange={handleChange}
                    placeholder="e.g., soil, water, clinical sample"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Collection Date
                    </label>
                    <input
                      type="date"
                      name="collectionDate"
                      value={formData.collectionDate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country of Origin
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="e.g., USA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Generate Submission File</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default NCBISubmissionModal;