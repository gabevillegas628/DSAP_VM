// StudentClones.jsx - Updated with claim clones feature
import React, { useState, useEffect, useCallback } from 'react';
import { getStatusConfig, CLONE_STATUSES } from '../statusConstraints';
import { Star, CheckCircle } from 'lucide-react';
import ClaimClonesModal from './ClaimClonesModal';
import { getDisplayFilename } from '../utils/fileUtils';
import apiService from '../services/apiService';

const StudentClones = ({
  allClones,
  loading,
  assignedFiles,
  practiceClones,
  openAnalysisTab,
  downloadFile,
  currentUser, // NEW PROP
  onClonesUpdated // NEW PROP
}) => {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [qualification, setQualification] = useState(null);
  const [checkingQualification, setCheckingQualification] = useState(false);

  const checkCloneQualification = useCallback(async () => {
    try {
      setCheckingQualification(true);
      const qualificationData = await apiService.get(`/students/${currentUser.id}/clone-qualification`);
      setQualification(qualificationData);
    } catch (error) {
      console.error('Error checking qualification:', error);
      setQualification(null);
    } finally {
      setCheckingQualification(false);
    }
  }, [currentUser.id]);

  // Check qualification when practice clones change
  useEffect(() => {
    if (currentUser && practiceClones.length > 0) {
      checkCloneQualification();
    }
  }, [currentUser, practiceClones, checkCloneQualification]);



  const handleCloneClaimed = () => {
    // Refresh the clone data when a new clone is claimed
    if (onClonesUpdated) {
      onClonesUpdated();
    }
    // Re-check qualification since they now have a new clone
    checkCloneQualification();
  };

  const getValidatedStatus = (clone) => {
    const status = clone.status || CLONE_STATUSES.AVAILABLE;
    //console.log(`Clone ${clone.cloneName} status: "${status}" (type: ${clone.type})`);
    return status;
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">My Clones</h3>
              <p className="text-sm text-gray-600 mt-1">Practice exercises and assigned research clones</p>
            </div>

            {/* Claim More Clones Button */}
            {qualification?.qualifies && (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">Perfect Scores Achieved!</span>
                  </div>
                  <p className="text-xs text-gray-500">All practice clones completed with 100% scores</p>
                </div>
                <button
                  onClick={() => setShowClaimModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Star className="w-5 h-5" />
                  <span>Claim More Clones</span>
                </button>
              </div>
            )}
          </div>

          {/* Qualification Status Display */}
          {qualification && !qualification.qualifies && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <Star className="w-3 h-3 text-blue-600" />
                </div>
                <div className="text-sm">
                  <span className="font-medium text-blue-800">Keep up the great work!</span>
                  <span className="text-blue-700 ml-2">
                    Achieve 100% scores on all practice clones to unlock additional clones to work on.
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                Progress: {qualification.perfectScoresCount}/{qualification.activeClonesCount} practice clones with perfect scores
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          {loading || checkingQualification ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading your assigned clones...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Clone Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Waveform File</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Progress</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allClones.map(clone => (
                      <tr key={clone.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold text-indigo-600">{clone.cloneName}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${clone.type === 'practice' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                            {clone.type === 'practice' ? 'Practice' : 'Assignment'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => downloadFile(clone)}
                            className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 transition-colors"
                            title={`Download ${getDisplayFilename(clone)}`}
                          >
                            {getDisplayFilename(clone)}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${clone.progress === 100 ? 'bg-green-600' :
                                  clone.progress > 0 ? 'bg-blue-600' : 'bg-gray-400'
                                  }`}
                                style={{ width: `${clone.progress || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 font-medium">{clone.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {(() => {
                            const validatedStatus = getValidatedStatus(clone);
                            const statusConfig = getStatusConfig(validatedStatus);
                            return (
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConfig.badgeColor}`}>
                                {validatedStatus}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                              onClick={() => openAnalysisTab(clone)}
                            >
                              Analyze
                            </button>
                            {(clone.progress > 0) && (
                              <button
                                className="text-green-600 hover:text-green-800 text-sm font-medium transition-colors"
                                onClick={() => openAnalysisTab(clone)}
                              >
                                View Results
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {allClones.length === 0 && (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No clones assigned yet</h3>
                  <p className="text-gray-500 text-sm">Check back later or contact your instructor for assignments!</p>
                </div>
              )}

              {assignedFiles.length === 0 && practiceClones.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Practice Clones Available</p>
                      <p className="text-blue-700">
                        Complete these practice exercises to familiarize yourself with DNA sequence analysis before working on your research assignments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {assignedFiles.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">Research Assignments Active</p>
                      <p className="text-green-700">
                        You have {assignedFiles.length} research clone{assignedFiles.length === 1 ? '' : 's'} assigned to you. Download the .ab1 files and begin your analysis using the recommended software.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Claim Clones Modal */}
      <ClaimClonesModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        currentUser={currentUser}
        onCloneClaimed={handleCloneClaimed}
      />
    </>
  );
};

export default StudentClones;