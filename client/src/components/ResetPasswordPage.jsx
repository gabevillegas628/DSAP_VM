// ResetPasswordPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle, Dna, Microscope, Atom, Shield } from 'lucide-react';
import apiService from './apiService';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation with friendlier messages
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields to continue.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The passwords you entered don\'t match. Please check both fields and try again.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Your password needs to be at least 6 characters long for security.');
      return;
    }

    // Optional: Add more password strength checks
    if (newPassword === newPassword.toLowerCase()) {
      setError('For better security, please include at least one uppercase letter in your password.');
      return;
    }

    setLoading(true);

    try {
      await apiService.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (error) {
      console.error('=== RESET PASSWORD ERROR DEBUG ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);

      let errorMessage = 'We encountered an issue resetting your password. Please try again.';

      // Handle specific error cases with user-friendly messages
      if (error.message.includes('Invalid or expired reset token')) {
        errorMessage = 'This password reset link has expired or is no longer valid. Please request a new password reset from the login page.';
      } else if (error.message.includes('expired')) {
        errorMessage = 'This password reset link has expired. Password reset links are only valid for 1 hour. Please request a new one from the login page.';
      } else if (error.message.includes('invalid') && error.message.includes('token')) {
        errorMessage = 'This password reset link is not valid. Please make sure you used the complete link from your email, or request a new password reset.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error occurred while resetting your password. Please try again in a moment.';
      } else if (error.message.includes('400')) {
        errorMessage = 'There was an issue with your password reset request. Please try again or request a new reset link.';
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to the server. Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The request timed out. Please check your connection and try again.';
      } else if (error.message.length < 100 && !error.message.includes('Request failed')) {
        // If it's already a user-friendly message from the server, use it
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Professional Background - Success Green Theme */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900">
          {/* Subtle Scientific Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-10 opacity-8">
              <CheckCircle className="w-20 h-20 text-green-200/20 animate-pulse" style={{ animationDuration: '3s' }} />
            </div>
            <div className="absolute bottom-32 left-20 opacity-8">
              <Shield className="w-16 h-16 text-emerald-200/20" />
            </div>
            <div className="absolute top-40 left-20 opacity-8">
              <Dna className="w-14 h-14 text-green-200/20" />
            </div>

            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-green-500/5 to-transparent"></div>
            <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-green-400/10 to-transparent"></div>
            <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent"></div>
          </div>
        </div>

        {/* Success Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-10">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-100 to-emerald-200 bg-clip-text text-transparent mb-3">
                Password Reset Complete
              </h1>
              <div className="h-0.5 w-20 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full mx-auto mt-4"></div>
            </div>

            <div className="bg-white/95 backdrop-blur-sm p-8 rounded-lg shadow-xl border border-white/20">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
                <p className="text-gray-600 mb-4">Your password has been updated successfully.</p>
                <p className="text-sm text-gray-500">Redirecting to login page...</p>

                <div className="mt-6">
                  <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Professional Background - Red/Orange Theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-red-900 to-orange-900">
        {/* Subtle Scientific Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 opacity-8">
            <Shield className="w-20 h-20 text-red-200/20 animate-pulse" style={{ animationDuration: '4s' }} />
          </div>
          <div className="absolute top-40 right-20 opacity-8">
            <Microscope className="w-16 h-16 text-orange-300/20" />
          </div>
          <div className="absolute bottom-32 left-20 opacity-8">
            <Atom className="w-14 h-14 text-red-200/20 animate-pulse" style={{ animationDuration: '6s' }} />
          </div>
          <div className="absolute bottom-20 right-32 opacity-8">
            <Dna className="w-16 h-16 text-orange-200/20" />
          </div>

          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-500/5 to-transparent"></div>
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-red-400/10 to-transparent"></div>
          <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-orange-400/10 to-transparent"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-100 to-orange-200 bg-clip-text text-transparent mb-3">
              Reset Your Password
            </h1>
            <p className="text-slate-300 font-medium text-lg">DNA Sequence Analysis Platform</p>
            <div className="h-0.5 w-20 bg-gradient-to-r from-red-400 to-orange-400 rounded-full mx-auto mt-4"></div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/95 backdrop-blur-sm border border-red-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-red-500 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center">
                  <AlertCircle className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-red-800 text-sm font-medium leading-relaxed">{error}</p>
                  {error.includes('expired') && (
                    <button
                      onClick={() => navigate('/')}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline transition-colors"
                    >
                      Go to Login Page
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500"
                  placeholder="Enter new password (minimum 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-600 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-medium rounded-lg shadow-lg hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Resetting Password...</span>
                </div>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-red-300 transition-colors duration-200 text-sm"
              disabled={loading}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;