// components/ClaimClonesModal.jsx
import React, { useState, useEffect } from 'react';
import {
    X,
    Search,
    Download,
    CheckCircle,
    Star,
    FileText,
    Clock,
    Filter
} from 'lucide-react';
import apiService from '../services/apiService';

const ClaimClonesModal = ({ isOpen, onClose, currentUser, onCloneClaimed }) => {
    const [loading, setLoading] = useState(false);
    const [unassignedClones, setUnassignedClones] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [claiming, setClaiming] = useState(null); // Track which clone is being claimed
    const [sortBy, setSortBy] = useState('name'); // 'name', 'date'


    const fetchUnassignedClones = async () => {
        try {
            setLoading(true);
            const clones = await apiService.get(`/students/${currentUser.id}/unassigned-clones`);
            setUnassignedClones(clones);
        } catch (error) {
            console.error('Error fetching unassigned clones:', error);
            alert('Failed to load available clones');
        } finally {
            setLoading(false);
        }
    };

    
    useEffect(() => {
        if (isOpen && currentUser) {
            fetchUnassignedClones();
        }
    }, [isOpen, currentUser, fetchUnassignedClones]);

    const handleClaimClone = async (cloneId, cloneName) => {
        try {
            setClaiming(cloneId);

            const response = await apiService.post(`/students/${currentUser.id}/claim-clone/${cloneId}`);

            if (response.success) {
                // Remove the claimed clone from the list
                setUnassignedClones(prev => prev.filter(clone => clone.id !== cloneId));

                // Call the callback to refresh the student's clone list
                if (onCloneClaimed) {
                    onCloneClaimed();
                }

                alert(`Successfully claimed "${cloneName}"! You can now start working on this research clone.`);

                // Close modal if no more clones available
                if (unassignedClones.length <= 1) {
                    onClose();
                }
            } else {
                alert('Failed to claim clone. Please try again.');
            }
        } catch (error) {
            console.error('Error claiming clone:', error);
            alert(error.response?.data?.error || 'Failed to claim clone. Please try again.');
        } finally {
            setClaiming(null);
        }
    };

    const getFilteredAndSortedClones = () => {
        let filtered = unassignedClones;

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(clone =>
                clone.cloneName.toLowerCase().includes(term) ||
                clone.description?.toLowerCase().includes(term)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(b.uploadDate) - new Date(a.uploadDate);
                case 'name':
                default:
                    return a.cloneName.localeCompare(b.cloneName);
            }
        });

        return filtered;
    };

    const filteredClones = getFilteredAndSortedClones();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                                <Star className="w-5 h-5 text-white" />
                            </div>
                            // In the header section, change the text:
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Claim Research Clones</h2>
                                <p className="text-sm text-gray-600">
                                    🎉 Congratulations! You've achieved perfect scores on all practice clones!
                                </p>
                            </div>

                            <div className="text-sm text-gray-600">
                                💡 <strong>Tip:</strong> Claiming a research clone assigns it to you for analysis work.
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search and Filter Controls */}
                    <div className="mt-4 flex items-center space-x-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search clone names..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center space-x-2">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="text-sm border border-gray-300 rounded px-3 py-2"
                            >
                                <option value="name">Sort by Name</option>
                                <option value="date">Sort by Upload Date</option>
                            </select>
                        </div>
                    </div>

                    {/* Results Count */}
                    <div className="mt-2 text-sm text-gray-600">
                        {filteredClones.length} available practice clone{filteredClones.length !== 1 ? 's' : ''}
                        {searchTerm && ` matching "${searchTerm}"`}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                                <p className="text-gray-600">Loading available clones...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            {filteredClones.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            {searchTerm ? 'No clones match your search' : 'No practice clones available'}
                                        </h3>
                                        <p className="text-gray-600">
                                            {searchTerm
                                                ? 'Try adjusting your search terms'
                                                : 'All available practice clones have been assigned. Great work!'
                                            }
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 space-y-3">
                                    {filteredClones.map(clone => (
                                        <div key={clone.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-blue-600" />
                                                    </div>

                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900">{clone.cloneName}</h4>
                                                        {clone.description && (
                                                            <p className="text-sm text-gray-600 mt-1">{clone.description}</p>
                                                        )}
                                                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                                            <div className="flex items-center space-x-1">
                                                                <Clock className="w-3 h-3" />
                                                                <span>Added {new Date(clone.uploadDate).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <Download className="w-3 h-3" />
                                                                <span>{clone.originalName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleClaimClone(clone.id, clone.cloneName)}
                                                    disabled={claiming === clone.id}
                                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 flex items-center space-x-2 font-medium shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
                                                >
                                                    {claiming === clone.id ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                            <span>Claiming...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="w-4 h-4" />
                                                            <span>Claim Clone</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            💡 <strong>Tip:</strong> Claiming a clone adds it to your "My Clones" list where you can begin analysis.
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClaimClonesModal;