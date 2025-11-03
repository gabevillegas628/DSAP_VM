// useSessionCheck.js
// Place in: client/src/hooks/useSessionCheck.js

import { useEffect, useState } from 'react';

/**
 * Custom hook to check session validity and detect expired tokens
 * @param {Function} onSessionExpired - Callback when session expires
 */
export const useSessionCheck = (onSessionExpired) => {
  const [isSessionValid, setIsSessionValid] = useState(true);

  useEffect(() => {
    const checkTokenValidity = () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        return; // No token, user not logged in
      }

      try {
        // Decode the JWT token (without verification, just to read expiration)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        
        if (Date.now() >= expirationTime) {
          // Token has expired
          //console.log('Token expired, triggering session expiration');
          setIsSessionValid(false);
          if (onSessionExpired) {
            onSessionExpired();
          }
        }
      } catch (error) {
        console.error('Error decoding token:', error);
        // Invalid token format - treat as expired
        localStorage.removeItem('token');
        if (onSessionExpired) {
          onSessionExpired();
        }
      }
    };

    // Check token validity when:
    // 1. Component mounts
    checkTokenValidity();

    // 2. User returns to the tab (focus event)
    const handleFocus = () => {
      console.log('Tab focused, checking token validity');
      checkTokenValidity();
    };

    // 3. Page visibility changes (when tab becomes visible)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, checking token validity');
        checkTokenValidity();
      }
    };

    // 4. Periodically check (every 5 minutes) as a fallback
    const intervalId = setInterval(checkTokenValidity, 5 * 60 * 1000);

    // Add event listeners
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [onSessionExpired]);

  return { isSessionValid };
};

export default useSessionCheck;