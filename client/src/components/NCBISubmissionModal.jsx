import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';

const NCBISubmissionModal = ({ 
  isOpen, 
  onClose, 
  selectedCount, 
  onSubmit,
  isSubmitting 
}) => {
  const [formData, setFormData] = useState({
    submitterName: '',
    submitterEmail: '',
    submitterInstitution: '',
    organism: '',
    isolationSource: '',
    collectionDate: '',
    country: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Submit to NCBI GenBank</h3>
            <p className="text-sm text-gray-600 mt-1">
              Submitting {selectedCount} clone{selectedCount !== 1 ? 's' : ''} to NCBI
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Before submitting to NCBI:</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Ensure all sequences are properly reviewed and approved</li>
                  <li>Verify organism and source information is accurate</li>
                  <li>Submissions cannot be easily undone</li>
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
                  Name *
                </label>
                <input
                  type="text"
                  name="submitterName"
                  value={formData.submitterName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.submitterName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.submitterName && (
                  <p className="text-red-600 text-sm mt-1">{errors.submitterName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="submitterEmail"
                  value={formData.submitterEmail}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.submitterEmail ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.submitterEmail && (
                  <p className="text-red-600 text-sm mt-1">{errors.submitterEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institution *
                </label>
                <input
                  type="text"
                  name="submitterInstitution"
                  value={formData.submitterInstitution}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.submitterInstitution ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.submitterInstitution && (
                  <p className="text-red-600 text-sm mt-1">{errors.submitterInstitution}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sequence Information */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Sequence Information</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organism *
                </label>
                <input
                  type="text"
                  name="organism"
                  value={formData.organism}
                  onChange={handleChange}
                  placeholder="e.g., Escherichia coli"
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.organism ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.organism && (
                  <p className="text-red-600 text-sm mt-1">{errors.organism}</p>
                )}
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
                    Country
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
              onClick={onClose}
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
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Submit to NCBI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NCBISubmissionModal;