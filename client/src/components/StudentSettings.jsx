// components/StudentSettings.jsx - Updated to use apiService
import React, { useState } from 'react';
import { Eye, EyeOff, Save, User, Lock, AlertCircle, CheckCircle, Camera } from 'lucide-react';
import apiService from '../services/apiService'; // Updated to use apiService
import ProfilePicture from './ProfilePicture';
import WebcamCapture from './WebcamCapture';
import { validateProfilePicture } from '../utils/ProfilePictureValidator';

const StudentSettings = ({ currentUser, onUserUpdate }) => {
    const [formData, setFormData] = useState({
        name: currentUser?.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasChanges, setHasChanges] = useState(false);
    const [profilePictureFile, setProfilePictureFile] = useState(null);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [showWebcamCapture, setShowWebcamCapture] = useState(false);

    // Track if form has been modified
    React.useEffect(() => {
        const nameChanged = formData.name !== currentUser?.name;
        const passwordFieldsFilledOut = formData.currentPassword || formData.newPassword || formData.confirmPassword;
        setHasChanges(nameChanged || passwordFieldsFilledOut);
    }, [formData, currentUser?.name]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear any existing messages when user starts typing
        if (message.text) {
            setMessage({ type: '', text: '' });
        }
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    // webcam capture handler
    const handleWebcamCapture = (file) => {
        if (file) {
            handleProfilePictureUpload(file);
        }
    };

    const validateForm = () => {
        // Check if name is empty
        if (!formData.name.trim()) {
            setMessage({ type: 'error', text: 'Name cannot be empty' });
            return false;
        }

        // If any password field is filled, validate password change logic
        const hasPasswordData = formData.currentPassword || formData.newPassword || formData.confirmPassword;

        if (hasPasswordData) {
            if (!formData.currentPassword) {
                setMessage({ type: 'error', text: 'Current password is required to change password' });
                return false;
            }

            if (!formData.newPassword) {
                setMessage({ type: 'error', text: 'New password is required' });
                return false;
            }

            if (formData.newPassword.length < 6) {
                setMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
                return false;
            }

            if (formData.newPassword !== formData.confirmPassword) {
                setMessage({ type: 'error', text: 'New passwords do not match' });
                return false;
            }

            if (formData.currentPassword === formData.newPassword) {
                setMessage({ type: 'error', text: 'New password must be different from current password' });
                return false;
            }
        }

        return true;
    };


    const handleProfilePictureUpload = async (file) => {
        if (!file) return;

        const validation = await validateProfilePicture(file);

        if (!validation.isValid) {
            setMessage({ type: 'error', text: validation.error });
            return;
        }

        setUploadingPicture(true);
        try {
            const formData = new FormData();
            formData.append('profilePicture', file);

            const updatedUser = await apiService.uploadFiles(
                `/users/${currentUser.id}/profile-picture`,
                formData
            );

            onUserUpdate(updatedUser);
            setMessage({ type: 'success', text: 'Profile picture updated successfully!' });
        } catch (error) {
            console.error('Profile picture upload error:', error);
            setMessage({ type: 'error', text: `Failed to upload: ${error.message}` });
        } finally {
            setUploadingPicture(false);
        }
    };

    const handleRemoveProfilePicture = async () => {
        try {
            const updatedUser = await apiService.delete(`/users/${currentUser.id}/profile-picture`);
            onUserUpdate(updatedUser);
            setMessage({ type: 'success', text: 'Profile picture removed successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to remove profile picture' });
        }
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Prepare data for self-update endpoint
            const selfUpdateData = {
                name: formData.name.trim()
            };

            // Include password fields if changing password
            if (formData.newPassword) {
                selfUpdateData.currentPassword = formData.currentPassword;
                selfUpdateData.password = formData.newPassword;
            }

            console.log('=== FRONTEND SAVE DEBUG ===');
            console.log('Sending to self-update endpoint:', {
                ...selfUpdateData,
                password: selfUpdateData.password ? '[HIDDEN]' : undefined,
                currentPassword: selfUpdateData.currentPassword ? '[HIDDEN]' : undefined
            });

            // ✅ UPDATED: Use apiService instead of direct fetch
            const updatedUser = await apiService.put(
                `/users/${currentUser.id}/self-update`,
                selfUpdateData
            );

            console.log('Updated user received:', updatedUser);

            // Update parent component with new user data
            try {
                if (onUserUpdate) {
                    console.log('Calling onUserUpdate with:', updatedUser);
                    onUserUpdate(updatedUser);
                }
            } catch (callbackError) {
                console.error('Error in onUserUpdate callback:', callbackError);
                // Don't let callback errors prevent showing success message
            }

            // Clear password fields
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }));

            setMessage({
                type: 'success',
                text: formData.newPassword
                    ? 'Name and password updated successfully!'
                    : 'Name updated successfully!'
            });

        } catch (error) {
            console.error('Error saving settings:', error);

            // Handle specific error cases
            if (error.message && error.message.includes('Current password is incorrect')) {
                setMessage({ type: 'error', text: 'Current password is incorrect' });
            } else if (error.message && error.message.includes('400')) {
                setMessage({ type: 'error', text: 'Please check that all fields are filled out correctly' });
            } else {
                setMessage({ type: 'error', text: 'Failed to update settings. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFormData({
            name: currentUser?.name || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
        setMessage({ type: '', text: '' });
    };

    if (!currentUser) {
        return (
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Loading user information...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Settings</h3>

                {/* Success/Error Messages */}
                {message.text && (
                    <div className={`p-4 rounded-lg border mb-6 ${message.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        <div className="flex items-center space-x-2">
                            {message.type === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                            ) : (
                                <AlertCircle className="w-4 h-4" />
                            )}
                            <span className="text-sm font-medium">{message.text}</span>
                        </div>
                    </div>
                )}

                {/* Current Account Info */}
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Current Account Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">Email:</span>
                            <span className="ml-2 font-medium">{currentUser?.email}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Role:</span>
                            <span className="ml-2 font-medium capitalize">{currentUser?.role}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">School:</span>
                            <span className="ml-2 font-medium">{currentUser?.school?.name || 'Not assigned'}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Status:</span>
                            <span className="ml-2 font-medium capitalize text-green-600">{currentUser?.status}</span>
                        </div>
                    </div>
                </div>

                {/* Profile Picture Upload */}
                <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Profile Picture</h4>
                    <div className="flex items-center space-x-4">
                        <ProfilePicture
                            src={currentUser?.profilePicture}
                            name={currentUser?.name}
                            size="xl"
                        />
                        <div className="space-y-2">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) handleProfilePictureUpload(file);
                                }}
                                className="hidden"
                                id="profile-picture-upload"
                            />
                            <label
                                htmlFor="profile-picture-upload"
                                className="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-200 inline-block text-sm"
                            >
                                {uploadingPicture ? 'Uploading...' : 'Upload Picture'}
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
                            {currentUser?.profilePicture && (
                                <button
                                    onClick={handleRemoveProfilePicture}
                                    className="block text-red-600 text-sm hover:text-red-800"
                                >
                                    Remove Picture
                                </button>
                            )}
                        </div>
                    </div>
                </div>


                <div className="space-y-6">
                    {/* Name Section */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center space-x-2">
                            <User className="w-4 h-4" />
                            <span>Personal Information</span>
                        </h4>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Enter your full name"
                            />
                        </div>
                    </div>

                    {/* Password Section */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center space-x-2">
                            <Lock className="w-4 h-4" />
                            <span>Change Password</span>
                        </h4>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.current ? 'text' : 'password'}
                                        value={formData.currentPassword}
                                        onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter your current password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility('current')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        value={formData.newPassword}
                                        onChange={(e) => handleInputChange('newPassword', e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter your new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility('new')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Confirm your new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility('confirm')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>Note:</strong> Leave password fields empty if you don't want to change your password.
                                    Only your name will be updated.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-8">
                    <div className="text-sm text-gray-500">
                        {hasChanges && (
                            <span className="flex items-center space-x-1 text-orange-600">
                                <AlertCircle className="w-4 h-4" />
                                <span>You have unsaved changes</span>
                            </span>
                        )}
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={handleReset}
                            disabled={!hasChanges || loading}
                            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Reset
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            <Save className="w-4 h-4" />
                            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                    </div>
                </div>
            </div>
            <WebcamCapture
                isOpen={showWebcamCapture}
                onClose={() => setShowWebcamCapture(false)}
                onCapture={handleWebcamCapture}
            />
        </div>
    );
};

export default StudentSettings;