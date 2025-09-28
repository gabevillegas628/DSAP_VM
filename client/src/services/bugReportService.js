// services/bugReportService.js
import apiService from './apiService';

// Capture recent console logs
const captureConsoleOutput = () => {
  const logs = [];
  const errors = [];
  
  // Get stored console logs if we've been capturing them
  if (window.bugReportLogs) {
    logs.push(...window.bugReportLogs);
  }
  
  if (window.bugReportErrors) {
    errors.push(...window.bugReportErrors);
  }
  
  return {
    recentLogs: logs.slice(-20), // Last 20 log entries
    recentErrors: errors.slice(-10), // Last 10 errors
    consoleLogCount: logs.length,
    errorCount: errors.length
  };
};

const submitBugReport = async (bugData) => {
  // Gather browser context
  const browserInfo = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    referrer: document.referrer,
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
    connectionType: navigator.connection?.effectiveType || 'unknown',
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled
  };

  // Capture console output
  const consoleOutput = captureConsoleOutput();

  const result = await apiService.post('/bug-reports/submit', {
    ...bugData,
    browserInfo,
    consoleOutput
  });

  return result;
};

// Initialize console capture when service loads
const initializeConsoleCapture = () => {
  if (typeof window === 'undefined') return;
  
  // Initialize storage arrays
  window.bugReportLogs = window.bugReportLogs || [];
  window.bugReportErrors = window.bugReportErrors || [];
  
  // Capture console errors
  const originalError = console.error;
  console.error = function(...args) {
    window.bugReportErrors.push({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
    });
    
    // Keep only last 50 errors
    if (window.bugReportErrors.length > 50) {
      window.bugReportErrors = window.bugReportErrors.slice(-50);
    }
    
    return originalError.apply(console, args);
  };

  // Capture console warnings
  const originalWarn = console.warn;
  console.warn = function(...args) {
    window.bugReportLogs.push({
      timestamp: new Date().toISOString(),
      type: 'warn',
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
    });
    
    // Keep only last 100 logs
    if (window.bugReportLogs.length > 100) {
      window.bugReportLogs = window.bugReportLogs.slice(-100);
    }
    
    return originalWarn.apply(console, args);
  };

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    window.bugReportErrors.push({
      timestamp: new Date().toISOString(),
      type: 'uncaught',
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack
    });
    
    if (window.bugReportErrors.length > 50) {
      window.bugReportErrors = window.bugReportErrors.slice(-50);
    }
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    window.bugReportErrors.push({
      timestamp: new Date().toISOString(),
      type: 'unhandled_promise',
      message: String(event.reason),
      stack: event.reason?.stack
    });
    
    if (window.bugReportErrors.length > 50) {
      window.bugReportErrors = window.bugReportErrors.slice(-50);
    }
  });
};

// Initialize when service loads
initializeConsoleCapture();

export { submitBugReport };