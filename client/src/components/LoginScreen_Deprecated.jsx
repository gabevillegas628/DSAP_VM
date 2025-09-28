// Enhanced LoginScreen.jsx with User-Friendly Error Messages
import React, { useState, useEffect } from 'react';
import { FileText, Eye, EyeOff, Dna, Microscope, Atom, Mail, Info, X } from 'lucide-react';
import apiService from './apiService';
import TermsOfServiceModal from './TermsOfServiceModal';
const rutgersLogo = "/images/RSUNJ_H_RED_WHITE_RGB.png";
const waksmanLogo = "/images/wssp-banner-bldg.png";

const LoginScreen = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [schools, setSchools] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [programSettings, setProgramSettings] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTOSModal, setShowTOSModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [shouldCollectDemographics, setShouldCollectDemographics] = useState(false);
  const [demographics, setDemographics] = useState({
    academicYear: '',
    yearsInProgram: '',
    classesTaken: [], // Array for multi-select
    otherScienceCourses: '',
    // Optional fields
    age: '',
    gender: '',
    ethnicity: '',
    location: '',
    country: ''
  });

  // Check if demographics collection is enabled
  useEffect(() => {
    const checkDemographicsSettings = async () => {
      try {
        const response = await apiService.get('/settings/collect-demographics');
        setShouldCollectDemographics(response.collectDemographics);
      } catch (error) {
        console.error('Error checking demographics settings:', error);
        // Default to false if can't fetch
        setShouldCollectDemographics(false);
      }
    };

    checkDemographicsSettings();
  }, []);

  // Fetch schools for registration
  useEffect(() => {
    if (isRegistering) {
      fetchSchools();
    }
  }, [isRegistering]);

  // Fetch program settings for contact and project info
  useEffect(() => {
    fetchProgramSettings();
  }, []);

  const fetchSchools = async () => {
    try {
      const data = await apiService.get('/schools/public');
      setSchools(data);
    } catch (error) {
      console.error('Error fetching schools:', error);
    }
  };

  const fetchProgramSettings = async () => {
    try {
      const data = await apiService.get('/program-settings');
      setProgramSettings(data);
    } catch (error) {
      console.error('Error fetching program settings:', error);
    }
  };

  // Handle multi-select for classes taken
  const handleClassToggle = (className) => {
    setDemographics(prev => ({
      ...prev,
      classesTaken: prev.classesTaken.includes(className)
        ? prev.classesTaken.filter(c => c !== className)
        : [...prev.classesTaken, className]
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiService.post('/auth/login', { email, password });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      apiService.setToken(data.token);
      onLogin(data.user);
    } catch (error) {
      console.error('=== LOGIN ERROR DEBUG ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);

      let errorMessage = 'Login failed. Please check your credentials and try again.';

      // Handle specific login error cases with smart message detection
      if (error.message.includes('Invalid credentials')) {
        errorMessage = 'Incorrect email or password. Please double-check your credentials and try again.';
      } else if (error.message.includes('Account pending approval') || error.message.includes('pending approval')) {
        errorMessage = 'Your account is awaiting approval from your program director. Please check back later or contact support if this is taking longer than expected.';
      } else if (error.message.includes('Account access denied') || error.message.includes('access denied')) {
        errorMessage = 'Your account access has been denied. Please contact your administrator for assistance.';
      } else if (error.message.includes('insufficient permissions') || error.message.includes('Insufficient permissions')) {
        // This is likely a pending user trying to log in
        errorMessage = 'Your account is awaiting approval from your program director. Please check back later or contact support.';
      } else if (error.message.includes('forbidden') || error.message.includes('403')) {
        errorMessage = 'Access denied. Your account may be pending approval or you may not have the required permissions.';
      } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please check your email and password.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again in a moment.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Invalid login information. Please check your email and password.';
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.length < 100 && !error.message.includes('Request failed')) {
        // If it's already a user-friendly message from the server, use it
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');

    try {
      await apiService.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMessage('If an account exists with this email, you will receive reset instructions.');
      setForgotEmail('');
    } catch (error) {
      setForgotMessage('Error sending reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const registrationData = {
        email,
        password,
        name,
        schoolId: parseInt(schoolId)
      };

      // Include demographics if collection is enabled and data was provided
      if (shouldCollectDemographics) {
        // Parse location into city/state when submitting
        let cityState = { city: '', state: '' };
        if (demographics.location && demographics.location.trim()) {
          const parts = demographics.location.split(',').map(p => p.trim());
          cityState = {
            city: parts[0] || '',
            state: parts[1] || ''
          };
        }

        // Build demographics object with proper handling for each field type
        const cleanedDemographics = {};

        // Handle required academic questions
        if (demographics.academicYear) cleanedDemographics.academicYear = demographics.academicYear;
        if (demographics.yearsInProgram) cleanedDemographics.yearsInProgram = demographics.yearsInProgram;
        if (demographics.classesTaken && demographics.classesTaken.length > 0) {
          cleanedDemographics.classesTaken = demographics.classesTaken;
        }
        if (demographics.otherScienceCourses && demographics.otherScienceCourses.trim()) {
          cleanedDemographics.otherScienceCourses = demographics.otherScienceCourses.trim();
        }
        if (demographics.ethnicity) cleanedDemographics.ethnicity = demographics.ethnicity;

        // Handle optional fields
        if (demographics.age && demographics.age.trim()) {
          cleanedDemographics.age = parseInt(demographics.age);
        }
        if (demographics.gender) cleanedDemographics.gender = demographics.gender;
        if (cityState.city) cleanedDemographics.city = cityState.city;
        if (cityState.state) cleanedDemographics.state = cityState.state;
        if (demographics.country && demographics.country.trim()) {
          cleanedDemographics.country = demographics.country.trim();
        }

        // Only include demographics if we have at least some data
        if (Object.keys(cleanedDemographics).length > 0) {
          registrationData.demographics = cleanedDemographics;
        }
      }

      const data = await apiService.post('/auth/register-student', registrationData);

      // Check if user status is 'approved' for immediate login
      if (data.user && data.user.status === 'approved') {
        // Auto-login if registration was approved immediately
        if (data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          apiService.setToken(data.token);
          onLogin(data.user);
        } else {
          // If no token, show success and switch to login
          setSuccessMessage('Account created and approved! Please sign in with your credentials.');
          setIsRegistering(false);
          setPassword(''); // Clear password but keep email
          setName('');
          setSchoolId('');
          // Clear demographics
          setDemographics({
            academicYear: '',
            yearsInProgram: '',
            classesTaken: [],
            otherScienceCourses: '',
            ethnicity: '',
            age: '',
            gender: '',
            location: '',
            country: ''
          });
        }
      } else {
        // Registration pending approval (this is the normal case)
        setSuccessMessage('Registration submitted successfully! Please wait for director approval before signing in.');
        setIsRegistering(false);
        // Clear form
        setEmail('');
        setPassword('');
        setName('');
        setSchoolId('');
        // Clear demographics
        setDemographics({
          academicYear: '',
          yearsInProgram: '',
          classesTaken: [],
          otherScienceCourses: '',
          ethnicity: '',
          age: '',
          gender: '',
          location: '',
          country: ''
        });
      }
    } catch (error) {
      console.error('=== REGISTRATION ERROR DEBUG ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);

      let errorMessage = 'Registration failed. Please try again.';

      // Handle specific registration error cases
      if (error.message.includes('User already exists') || error.message.includes('email already exists')) {
        errorMessage = 'An account with this email already exists. Please try signing in instead.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Invalid registration information. Please check your details and try again.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again in a moment.';
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.length < 100 && !error.message.includes('Request failed')) {
        // If it's already a user-friendly message from the server, use it
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setSuccessMessage('');
    setEmail('');
    setPassword('');
    setName('');
    setSchoolId('');
  };

  const handleContactUs = () => {
    if (programSettings?.staffEmail) {
      window.location.href = `mailto:${programSettings.staffEmail}?subject=DSAP Support Request`;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* Professional Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {/* Subtle Scientific Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 opacity-8">
            <Dna className="w-20 h-20 text-blue-200/20 animate-pulse" style={{ animationDuration: '4s' }} />
          </div>
          <div className="absolute top-40 right-20 opacity-8">
            <Microscope className="w-16 h-16 text-slate-300/20" />
          </div>
          <div className="absolute bottom-32 left-20 opacity-8">
            <Atom className="w-14 h-14 text-cyan-200/20 animate-pulse" style={{ animationDuration: '6s' }} />
          </div>
          <div className="absolute bottom-20 right-32 opacity-8">
            <FileText className="w-16 h-16 text-blue-200/20" />
          </div>

          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-500/5 to-transparent"></div>
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-400/10 to-transparent"></div>
          <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-indigo-400/10 to-transparent"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-100 to-indigo-200 bg-clip-text text-transparent mb-3">
              Waksman Student Scholars Program
            </h1>
            {programSettings?.projectName && (
              <div className="text-white/80 text-lg font-medium z-20">
                {programSettings.projectName}
              </div>
            )}
            <div className="h-0.5 w-20 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full mx-auto mt-4"></div>
          </div>
          {/* Project Name in top right corner */}


          {/* Improved Error Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/95 backdrop-blur-sm border border-red-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-red-500 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-red-800 text-sm font-medium leading-relaxed">{error}</p>
                  {error.includes('pending approval') && programSettings?.staffEmail && (
                    <button
                      onClick={handleContactUs}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline transition-colors"
                    >
                      Contact Support
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Improved Success Messages */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50/95 backdrop-blur-sm border border-green-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-green-500 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1">
                  <p className="text-green-800 text-sm font-medium leading-relaxed">{successMessage}</p>
                  {successMessage.includes('pending approval') && programSettings?.staffEmail && (
                    <p className="mt-2 text-xs text-green-700">
                      Questions?
                      <button
                        onClick={handleContactUs}
                        className="ml-1 text-green-600 hover:text-green-800 underline transition-colors"
                      >
                        Contact Support
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-6">
            {isRegistering && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500"
                placeholder="Enter your email address"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500"
                  placeholder={isRegistering ? "Choose a password (minimum 6 characters)" : "Enter your password"}
                  minLength={isRegistering ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  School/Institution
                </label>
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900"
                >
                  <option value="">Select your school...</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isRegistering && shouldCollectDemographics && (
              <div className="space-y-4 p-4 bg-slate-50/50 rounded-lg border border-slate-300">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-medium text-slate-800 mb-1">
                    Demographic Information
                  </h3>
                  <p className="text-xs text-slate-600">
                    This information helps us improve the program
                  </p>
                </div>

                {/* Question 1: Academic Year */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    I am currently a:
                  </label>
                  <select
                    value={demographics.academicYear}
                    onChange={(e) => setDemographics(prev => ({ ...prev, academicYear: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900"
                  >
                    <option value="">Select...</option>
                    <option value="freshman">Freshman</option>
                    <option value="sophomore">Sophomore</option>
                    <option value="junior">Junior</option>
                    <option value="senior">Senior</option>
                    <option value="homeschooled">Homeschooled</option>
                  </select>
                </div>

                {/* Question 2: Years in Program */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    This is my ___ year participating in the program:
                  </label>
                  <select
                    value={demographics.yearsInProgram}
                    onChange={(e) => setDemographics(prev => ({ ...prev, yearsInProgram: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900"
                  >
                    <option value="">Select...</option>
                    <option value="first">First</option>
                    <option value="second">Second</option>
                    <option value="third">Third</option>
                    <option value="fourth">Fourth</option>
                  </select>
                </div>

                {/* Question 3: Classes Taken */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Which of the following classes have you taken? (Check all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-white/95 rounded-lg border border-slate-300">
                    {[
                      'Biology',
                      'Honors Biology',
                      'AP Biology',
                      'Chemistry',
                      'Honors Chemistry',
                      'AP Chemistry',
                      'Physics',
                      'Honors Physics',
                      'AP Physics',
                      'Calculus',
                      'Honors Calculus',
                      'AP Calculus'
                    ].map((className) => (
                      <label key={className} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={demographics.classesTaken.includes(className)}
                          onChange={() => handleClassToggle(className)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-gray-900">{className}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Question 4: Other Science Courses */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    What other Science course(s) are you taking this year?
                  </label>
                  <textarea
                    value={demographics.otherScienceCourses}
                    onChange={(e) => setDemographics(prev => ({ ...prev, otherScienceCourses: e.target.value }))}
                    placeholder="List any other science courses you're currently taking..."
                    rows="2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 resize-none"
                  />
                </div>

                {/* NEW Question 5: Ethnicity - MOVED TO MAIN SECTION */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Ethnicity:
                  </label>
                  <select
                    value={demographics.ethnicity}
                    onChange={(e) => setDemographics(prev => ({ ...prev, ethnicity: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900"
                  >
                    <option value="">Select...</option>
                    <option value="american-indian-alaska-native">American Indian or Alaska Native</option>
                    <option value="asian">Asian</option>
                    <option value="black-african-american">Black or African American</option>
                    <option value="native-hawaiian-pacific-islander">Native Hawaiian or Pacific Islander</option>
                    <option value="white">White</option>
                    <option value="hispanic-latino">Hispanic or Latino</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>

                {/* Optional: Collapsed section for additional demographics */}
                <details className="mt-4">
                  <summary className="text-sm text-slate-300 cursor-pointer hover:text-blue-300">
                    Additional Information (Optional)
                  </summary>
                  <div className="mt-3 space-y-4">
                    {/* Fixed grid layout with consistent styling */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-slate-200 mb-1">Age</label>
                        <input
                          type="number"
                          value={demographics.age}
                          onChange={(e) => setDemographics(prev => ({ ...prev, age: e.target.value }))}
                          min="13"
                          max="100"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 h-10"
                          placeholder="Age"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-200 mb-1">Gender</label>
                        <select
                          value={demographics.gender}
                          onChange={(e) => setDemographics(prev => ({ ...prev, gender: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 h-10"
                        >
                          <option value="">Select...</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="non-binary">Non-binary</option>
                          <option value="prefer-not-to-say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>

                    {/* Location on its own row for better spacing */}
                    <div>
                      <label className="block text-sm text-slate-200 mb-1">Location (City, State)</label>
                      <input
                        type="text"
                        value={demographics.location}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          location: e.target.value
                        }))}
                        placeholder="e.g., Chicago, IL"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/95 backdrop-blur-sm text-gray-900 h-10"
                      />
                    </div>
                  </div>
                </details>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg shadow-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isRegistering ? 'Creating Account...' : 'Signing In...'}</span>
                </div>
              ) : (
                isRegistering ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Switch Mode */}
          <div className="mt-6 text-center space-y-3">
            <button
              onClick={switchMode}
              className="text-slate-300 hover:text-blue-300 transition-colors duration-200 text-sm font-medium block"
            >
              {isRegistering
                ? "Already have an account? Sign in here"
                : "Need an account? Register here"}
            </button>

            {/* Forgot Password Link - only show on login mode */}
            {!isRegistering && (
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-slate-400 hover:text-blue-300 transition-colors duration-200 text-sm"
              >
                Forgot your password?
              </button>
            )}
          </div>

          {/* Contact and Project Info */}
          <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-center space-x-6">
            {programSettings?.staffEmail && (
              <button
                onClick={handleContactUs}
                className="flex items-center space-x-2 text-slate-400 hover:text-blue-300 transition-colors duration-200"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">Contact Support</span>
              </button>
            )}

            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center space-x-2 text-slate-400 hover:text-blue-300 transition-colors duration-200"
            >
              <Info className="w-4 h-4" />
              <span className="text-sm">About Project</span>
            </button>
            <button
              onClick={() => setShowTOSModal(true)}
              className="flex items-center space-x-2 text-slate-400 hover:text-blue-300 transition-colors duration-200"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm">Terms & Privacy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowForgotPassword(false)}></div>

          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotMessage('');
                    setForgotEmail('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-gray-600 text-sm mb-4">
                Enter your email address and we'll send you instructions to reset your password.
              </p>

              {forgotMessage && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                  {forgotMessage}
                </div>
              )}

              <form onSubmit={handleForgotPassword}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                    required
                    disabled={forgotLoading}
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotMessage('');
                      setForgotEmail('');
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Project Info Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowProjectModal(false)}></div>

          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {programSettings?.projectHeader || 'DNA Analysis Program'}
                </h3>
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {programSettings?.principalInvestigator && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Principal Investigator</h4>
                    <p className="mt-1 text-gray-900 font-medium">{programSettings.principalInvestigator}</p>
                  </div>
                )}

                {programSettings?.projectName && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Project Name</h4>
                    <p className="mt-1 text-gray-900">{programSettings.projectName}</p>
                  </div>
                )}

                {programSettings?.staffEmail && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Contact Email</h4>
                    <a
                      href={`mailto:${programSettings.staffEmail}`}
                      className="mt-1 text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                    >
                      {programSettings.staffEmail}
                    </a>
                  </div>
                )}

                {programSettings?.welcomeText && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Welcome</h4>
                    <p className="mt-1 text-gray-700 leading-relaxed">{programSettings.welcomeText}</p>
                  </div>
                )}

                {programSettings?.overview && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Overview</h4>
                    <p className="mt-1 text-gray-700 leading-relaxed">{programSettings.overview}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TOS Modal */}
      <TermsOfServiceModal
        isOpen={showTOSModal}
        onClose={() => setShowTOSModal(false)}
      />

      {/* University Branding Logos */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Rutgers Logo - Lower Left */}
        <div className="absolute bottom-4 left-4">
          <img
            src={rutgersLogo}
            alt="Rutgers University"
            className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity duration-300"
          />
        </div>

        {/* Waksman Logo - Lower Right - LARGER */}
        <div className="absolute bottom-4 right-4">
          <img
            src={waksmanLogo}
            alt="Waksman Institute"
            className="h-24 w-auto opacity-80 hover:opacity-100 transition-opacity duration-300"
          />
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;