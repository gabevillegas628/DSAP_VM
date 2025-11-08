// Enhanced LoginScreen.jsx with Overlapping Card Design
import React, { useState, useEffect } from 'react';
import { FileText, Eye, EyeOff, Mail, Info, X } from 'lucide-react';
import apiService from './apiService';
import TermsOfServiceModal from './TermsOfServiceModal';
const rutgersLogo = "/images/RSUNJ_H_RED_WHITE_RGB.png";
const waksmanLogo = "/images/wssp-banner-bldg.png";

const LoginScreen = ({ onLogin }) => {
    // ... (all your existing state and useEffect hooks remain the same) ...
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
        classesTaken: [],
        otherScienceCourses: '',
        gender: '',
        ethnicity: '',
        location: '',
        country: ''
    });
    const [platformStats, setPlatformStats] = useState({
        schools: 0,
        students: 0,
        ncbiSubmissions: 0
    });

    // ... (all your existing useEffect hooks and functions remain exactly the same) ...

    // Check if demographics collection is enabled
    useEffect(() => {
        const checkDemographicsSettings = async () => {
            try {
                const response = await apiService.get('/settings/collect-demographics');
                setShouldCollectDemographics(response.collectDemographics);
            } catch (error) {
                console.error('Error checking demographics settings:', error);
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

    // Fetch platform stats for dynamic display
    useEffect(() => {
        const fetchPlatformStats = async () => {
            try {
                const stats = await apiService.get('/platform-stats');
                setPlatformStats(stats);
            } catch (error) {
                console.error('Error fetching platform stats:', error);
            }
        };

        fetchPlatformStats();
    }, []);

    const fetchProgramSettings = async () => {
        try {
            const data = await apiService.get('/program-settings');
            setProgramSettings(data);
        } catch (error) {
            console.error('Error fetching program settings:', error);
        }
    };

    // ... (keep all your existing handler functions exactly as they are) ...
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

        try {
            const registrationData = {
                name,
                email,
                password,
                schoolId
            };

            if (shouldCollectDemographics) {
                const cleanedDemographics = {};

                if (demographics.academicYear && demographics.academicYear.trim()) {
                    cleanedDemographics.academicYear = demographics.academicYear.trim();
                }
                if (demographics.yearsInProgram && demographics.yearsInProgram.trim()) {
                    cleanedDemographics.yearsInProgram = demographics.yearsInProgram.trim();
                }
                if (demographics.classesTaken && demographics.classesTaken.length > 0) {
                    cleanedDemographics.classesTaken = demographics.classesTaken;
                }
                if (demographics.otherScienceCourses && demographics.otherScienceCourses.trim()) {
                    cleanedDemographics.otherScienceCourses = demographics.otherScienceCourses.trim();
                }
                if (demographics.gender && demographics.gender.trim()) {
                    cleanedDemographics.gender = demographics.gender.trim();
                }
                if (demographics.ethnicity && demographics.ethnicity.trim()) {
                    cleanedDemographics.ethnicity = demographics.ethnicity.trim();
                }

                let location = '';
                let state = '';
                let parsedCountry = '';

                if (demographics.location && demographics.location.trim()) {
                    const locationParts = demographics.location.trim().split(',').map(part => part.trim());
                    if (locationParts.length >= 3) {
                        location = locationParts[0];        // Springfield
                        state = locationParts[1];          // IL  
                        parsedCountry = locationParts[2];  // USA
                    } else if (locationParts.length >= 2) {
                        location = locationParts[0];       // Springfield
                        state = locationParts[1];         // IL
                    } else {
                        location = locationParts[0];
                    }
                }

                if (location) cleanedDemographics.location = location;
                if (state) cleanedDemographics.state = state;

                // Use parsed country from location, or fall back to separate country field
                if (parsedCountry) {
                    cleanedDemographics.country = parsedCountry;
                } else if (demographics.country && demographics.country.trim()) {
                    cleanedDemographics.country = demographics.country.trim();
                }
            }

            const data = await apiService.post('/auth/register-student', registrationData);

            if (data.user && data.user.status === 'approved') {
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    apiService.setToken(data.token);
                    onLogin(data.user);
                } else {
                    setSuccessMessage('Account created and approved! Please sign in with your credentials.');
                    setIsRegistering(false);
                    setPassword('');
                    setName('');
                    setSchoolId('');
                    setDemographics({
                        academicYear: '',
                        yearsInProgram: '',
                        classesTaken: [],
                        otherScienceCourses: '',
                        ethnicity: '',
                        gender: '',
                        location: '',
                        country: ''
                    });
                }
            } else {
                setSuccessMessage('Registration submitted successfully! Please wait for director approval before signing in.');
                setIsRegistering(false);
                setEmail('');
                setPassword('');
                setName('');
                setSchoolId('');
                setDemographics({
                    academicYear: '',
                    yearsInProgram: '',
                    classesTaken: [],
                    otherScienceCourses: '',
                    ethnicity: '',
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 relative overflow-hidden">
            {/* Digital Square Pattern - Top Left */}
            <div className="absolute top-6 left-6 z-10 opacity-25">
                <svg width="50%" height="180" viewBox="0 0 600 180" className="w-1/2">
                    <defs>
                        {/* Fade gradient */}
                        <linearGradient id="squareFade" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 1 }} />
                            <stop offset="70%" style={{ stopColor: 'white', stopOpacity: 1 }} />
                            <stop offset="90%" style={{ stopColor: 'white', stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
                        </linearGradient>

                        <mask id="squareMask">
                            <rect width="100%" height="100%" fill="url(#squareFade)" />
                        </mask>
                    </defs>

                    <g mask="url(#squareMask)">
                        {/* Large squares */}
                        <rect x="20" y="30" width="25" height="25" fill="#1e40af" opacity="0.8" />
                        <rect x="120" y="20" width="30" height="30" fill="#3b82f6" opacity="0.6" />
                        <rect x="250" y="40" width="20" height="20" fill="#60a5fa" opacity="0.9" />
                        <rect x="350" y="25" width="28" height="28" fill="#1e40af" opacity="0.5" />
                        <rect x="480" y="35" width="22" height="22" fill="#3b82f6" opacity="0.7" />

                        {/* Medium squares */}
                        <rect x="80" y="60" width="15" height="15" fill="#60a5fa" opacity="0.7" />
                        <rect x="180" y="70" width="18" height="18" fill="#1e40af" opacity="0.6" />
                        <rect x="280" y="80" width="16" height="16" fill="#3b82f6" opacity="0.8" />
                        <rect x="380" y="65" width="12" height="12" fill="#60a5fa" opacity="0.5" />
                        <rect x="450" y="75" width="14" height="14" fill="#1e40af" opacity="0.7" />
                        <rect x="520" y="60" width="16" height="16" fill="#3b82f6" opacity="0.6" />

                        {/* Small squares */}
                        <rect x="50" y="100" width="8" height="8" fill="#3b82f6" opacity="0.6" />
                        <rect x="90" y="110" width="10" height="10" fill="#1e40af" opacity="0.8" />
                        <rect x="140" y="95" width="6" height="6" fill="#60a5fa" opacity="0.7" />
                        <rect x="200" y="105" width="9" height="9" fill="#3b82f6" opacity="0.5" />
                        <rect x="260" y="115" width="7" height="7" fill="#1e40af" opacity="0.9" />
                        <rect x="320" y="100" width="11" height="11" fill="#60a5fa" opacity="0.6" />
                        <rect x="400" y="110" width="8" height="8" fill="#3b82f6" opacity="0.7" />
                        <rect x="460" y="105" width="6" height="6" fill="#1e40af" opacity="0.4" />
                        <rect x="510" y="95" width="9" height="9" fill="#60a5fa" opacity="0.8" />

                        {/* Bottom row */}
                        <rect x="30" y="140" width="12" height="12" fill="#60a5fa" opacity="0.6" />
                        <rect x="100" y="135" width="20" height="20" fill="#1e40af" opacity="0.7" />
                        <rect x="170" y="145" width="14" height="14" fill="#3b82f6" opacity="0.5" />
                        <rect x="240" y="130" width="16" height="16" fill="#60a5fa" opacity="0.8" />
                        <rect x="310" y="140" width="10" height="10" fill="#1e40af" opacity="0.6" />
                        <rect x="370" y="135" width="18" height="18" fill="#3b82f6" opacity="0.7" />
                        <rect x="440" y="145" width="12" height="12" fill="#60a5fa" opacity="0.5" />
                        <rect x="500" y="140" width="15" height="15" fill="#1e40af" opacity="0.6" />

                        {/* Some outline-only squares for variety */}
                        <rect x="60" y="50" width="12" height="12" fill="none" stroke="#1e40af" strokeWidth="2" opacity="0.6" />
                        <rect x="220" y="25" width="15" height="15" fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.7" />
                        <rect x="420" y="50" width="10" height="10" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.5" />
                        <rect x="300" y="15" width="18" height="18" fill="none" stroke="#1e40af" strokeWidth="2" opacity="0.6" />
                        <rect x="150" y="125" width="14" height="14" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5" />

                        {/* Tiny accent squares */}
                        <rect x="75" y="25" width="4" height="4" fill="#60a5fa" opacity="0.8" />
                        <rect x="195" y="55" width="5" height="5" fill="#1e40af" opacity="0.6" />
                        <rect x="335" y="85" width="4" height="4" fill="#3b82f6" opacity="0.7" />
                        <rect x="475" y="15" width="3" height="3" fill="#60a5fa" opacity="0.9" />
                        <rect x="125" y="160" width="5" height="5" fill="#1e40af" opacity="0.5" />
                        <rect x="275" y="165" width="4" height="4" fill="#3b82f6" opacity="0.6" />
                    </g>
                </svg>
            </div>
            {/* Project Name Swoosh - Top Right Corner */}
            {/* Project Name - Curved Tab */}
            {programSettings?.projectName && (
                <div className="absolute top-0 right-0 z-20">
                    <div className="relative">
                        <div className="bg-blue-700 px-8 py-4 rounded-bl-3xl shadow-lg">
                            <div className="text-white font-semibold text-sm tracking-wide">
                                <p className="text-2xl font-bold mb-6 leading-tight">{programSettings.projectName}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Background Information Panel - Takes up ~70% */}
            <div className="absolute inset-0">
                <div className="w-full h-full bg-blue-800 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 via-blue-900 to-blue-800"></div>
                        {/* Subtle white fade in bottom-right corner for logo - radial for organic shape */}
                        <div className="absolute bottom-0 right-0 w-full h-full pointer-events-none" style={{
                            background: 'radial-gradient(ellipse 800px 500px at bottom right, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.05) 40%, transparent 70%)'
                        }}></div>
                        <svg className="absolute bottom-0 left-0 w-full h-64" viewBox="0 0 1200 320" preserveAspectRatio="none">
                            <path d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,149.3C960,160,1056,160,1152,149.3L1200,139L1200,320L1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" fill="rgba(59, 130, 246, 0.1)"></path>
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col justify-center h-full px-16 py-16 text-white max-w-3xl">


                        {/* Main content */}
                        <div className="mb-8">
                            <h2 className="text-5xl font-bold mb-6 leading-tight">
                                {programSettings?.welcomeText || "Welcome to the Waksman Institute Summer Experience (WISE)"}
                            </h2>
                            <div className="w-20 h-1 bg-blue-400 rounded mb-8"></div>
                            <p className="text-xl text-blue-100 mb-10 leading-relaxed max-w-2xl">
                                {programSettings?.overview || "The research project for the WISE focuses on the genomic analysis of the duckweed Landoltia punctata, and how the genes in this organism compare to other species."}
                            </p>
                        </div>

                        {/* Features - now with dynamic stats */}
                        <div className="space-y-6 text-blue-200">
                            <div className="flex items-center space-x-4">
                                <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0"></div>
                                <span className="text-lg">{platformStats.schools} participating schools</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0"></div>
                                <span className="text-lg">{platformStats.students} student researchers</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0"></div>
                                <span className="text-lg">
                                    {platformStats.ncbiSubmissions > 0
                                        ? `${platformStats.ncbiSubmissions}+ sequences submitted to NCBI`
                                        : "Building a research database for NCBI submission is underway!"
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlapping Login Card - fixed positioning, center-based growth */}
            <div className="absolute inset-0 flex items-center justify-end pr-32 z-20 pointer-events-none">
                <div className="flex justify-center items-center pointer-events-auto">
                    {/* Error Messages */}
                    {error && (
                        <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 w-full max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
                            <div className="flex items-start space-x-3">
                                <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
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

                    {/* Success Messages */}
                    {successMessage && (
                        <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 w-full max-w-md p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg">
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

                    {/* Login Form Card */}
                    <div className={`bg-white rounded-2xl shadow-2xl border border-blue-200 overflow-hidden backdrop-blur-sm transition-all duration-500 ease-in-out transform-gpu origin-center ${isRegistering && shouldCollectDemographics
                        ? 'w-[60rem] h-[85vh] overflow-y-auto'           // Registration WITH demographics
                        : isRegistering
                            ? 'w-[32rem] h-[40rem]'                      // Registration WITHOUT demographics  
                            : 'w-[28rem] h-[32rem]'                      // Sign in only
                        }`}>
                        <div className="bg-blue-800 px-6 py-5">
                            <h2 className="text-2xl font-bold text-white text-center">
                                {isRegistering ? 'Create Account' : 'Sign In'}
                            </h2>
                        </div>

                        <div className="p-8">
                            {/* Form */}
                            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">
                                {isRegistering && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
                                        placeholder="Enter your email address"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
                                            placeholder={isRegistering ? "Choose a password (minimum 6 characters)" : "Enter your password"}
                                            minLength={isRegistering ? 6 : undefined}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {isRegistering && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            School/Institution
                                        </label>
                                        <select
                                            value={schoolId}
                                            onChange={(e) => setSchoolId(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
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

                                {/* Demographics Section (if enabled) */}
                                {isRegistering && shouldCollectDemographics && (
                                    <div className="mt-4 pt-4 border-t border-gray-200 animate-in slide-in-from-top duration-300">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Information (Optional)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Left Column */}
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Academic Year</label>
                                                    <select
                                                        value={demographics.academicYear}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, academicYear: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="freshman">Freshman</option>
                                                        <option value="sophomore">Sophomore</option>
                                                        <option value="junior">Junior</option>
                                                        <option value="senior">Senior</option>
                                                        <option value="homeschooled">Homeschooled</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Years in Program</label>
                                                    <select
                                                        value={demographics.yearsInProgram}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, yearsInProgram: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="first">First</option>
                                                        <option value="second">Second</option>
                                                        <option value="third">Third</option>
                                                        <option value="fourth">Fourth</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Classes Taken</label>
                                                    <div className="grid grid-cols-1 gap-1 text-sm max-h-24 overflow-y-auto border border-gray-300 rounded-lg p-2">
                                                        {[
                                                            'Biology', 'Honors Biology', 'AP Biology',
                                                            'Chemistry', 'Honors Chemistry', 'AP Chemistry',
                                                            'Physics', 'Honors Physics', 'AP Physics',
                                                            'Calculus', 'Honors Calculus', 'AP Calculus'
                                                        ].map(className => (
                                                            <label key={className} className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={demographics.classesTaken.includes(className)}
                                                                    onChange={() => handleClassToggle(className)}
                                                                    className="h-3 w-3 text-blue-600 rounded"
                                                                />
                                                                <span className="text-gray-900 text-xs">{className}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                                                    <select
                                                        value={demographics.gender}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, gender: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Non-binary">Non-binary</option>
                                                        <option value="Prefer not to say">Prefer not to say</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Right Column */}
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Other Science Courses</label>
                                                    <textarea
                                                        value={demographics.otherScienceCourses}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, otherScienceCourses: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm resize-none"
                                                        placeholder="List any other relevant science courses..."
                                                        rows="2"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Ethnicity</label>
                                                    <select
                                                        value={demographics.ethnicity}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, ethnicity: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
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

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Location (City, State)</label>
                                                    <input
                                                        type="text"
                                                        value={demographics.location}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, location: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                                                        placeholder="e.g., New York, NY"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                                                    <input
                                                        type="text"
                                                        value={demographics.country}
                                                        onChange={(e) => setDemographics(prev => ({ ...prev, country: e.target.value }))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                                                        placeholder="e.g., United States"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-800 text-white py-4 px-6 rounded-lg hover:bg-blue-900 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>{isRegistering ? 'Creating Account...' : 'Signing In...'}</span>
                                        </div>
                                    ) : (
                                        isRegistering ? 'Create Account' : 'Sign In'
                                    )}
                                </button>
                            </form>

                            {/* Switch Mode & Links */}
                            <div className="mt-8 text-center space-y-4">
                                <button
                                    onClick={switchMode}
                                    className="text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium"
                                >
                                    {isRegistering
                                        ? "Already have an account? Sign in here"
                                        : "Need an account? Register here"}
                                </button>

                                {!isRegistering && (
                                    <button
                                        onClick={() => setShowForgotPassword(true)}
                                        className="block w-full text-gray-500 hover:text-blue-600 transition-colors text-sm"
                                    >
                                        Forgot your password?
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="px-6 py-4 border-b border-gray-200 bg-blue-800">
                            <h3 className="text-lg font-semibold text-white">Reset Password</h3>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <input
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    placeholder="Enter your email address"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                {forgotMessage && (
                                    <p className="text-sm text-blue-600">{forgotMessage}</p>
                                )}
                                <div className="flex space-x-2">
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                                    >
                                        {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(false)}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Modal */}
            {showProjectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-blue-800">
                            <h3 className="text-lg font-semibold text-white">About This Project</h3>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="space-y-4">
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
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

            {/* Combined Footer - Logo and Links */}
            <div className="absolute bottom-6 left-6 right-6 z-10">
                <div className="flex justify-between items-end">
                    {/* Left side - Logo and Links */}
                    <div className="flex items-end gap-6">
                        <img
                            src={rutgersLogo}
                            alt="Rutgers University"
                            className="h-12 w-auto opacity-60"
                        />
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/80">
                            {programSettings?.aboutText && (
                                <button
                                    onClick={() => setShowProjectModal(true)}
                                    className="text-blue-200 hover:text-white underline"
                                >
                                    About This Project
                                </button>
                            )}
                            <button
                                onClick={() => setShowTOSModal(true)}
                                className="text-blue-200 hover:text-white underline"
                            >
                                Terms of Service
                            </button>
                            {programSettings?.staffEmail && (
                                <button
                                    onClick={handleContactUs}
                                    className="text-blue-200 hover:text-white underline"
                                >
                                    Contact Support
                                </button>
                            )}
                            <span>© 2025 Wildtype Technologies, LLC</span>
                            <span>•</span>
                            <span>DSAP v0.9(β)</span>
                        </div>
                    </div>

                    {/* Right side - Waksman Logo */}
                    <img
                        src={waksmanLogo}
                        alt="Waksman Institute"
                        className="h-20 w-auto"
                    />
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;