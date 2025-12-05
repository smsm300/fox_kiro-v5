import { useEffect, useRef, useCallback } from 'react';

interface UseAutoLogoutOptions {
  onLogout: () => void;
  inactivityTimeout?: number; // in milliseconds (default: 30 minutes)
  enabled?: boolean; // default: true - only run when user is authenticated
}

const HIDDEN_TIME_KEY = 'fox_erp_hidden_time';

export const useAutoLogout = ({
  onLogout,
  inactivityTimeout = 30 * 60 * 1000, // 30 minutes default
  enabled = true
}: UseAutoLogoutOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isInitializedRef = useRef(false);

  // Reset inactivity timer
  const resetTimer = useCallback(() => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      console.log('Auto logout due to inactivity');
      onLogout();
    }, inactivityTimeout);
  }, [inactivityTimeout, onLogout, enabled]);

  // Initialize - clear any stale data from previous sessions
  useEffect(() => {
    if (enabled && !isInitializedRef.current) {
      // Clear any stale hidden time from previous session
      sessionStorage.removeItem(HIDDEN_TIME_KEY);
      isInitializedRef.current = true;
    }
  }, [enabled]);

  // Track user activity
  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Initialize timer with a small delay to avoid immediate triggers
    const initTimeout = setTimeout(() => {
      resetTimer();
    }, 1000);

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearTimeout(initTimeout);
    };
  }, [resetTimer, enabled]);

  // Visibility change detection (tab switching)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - store the time
        sessionStorage.setItem(HIDDEN_TIME_KEY, Date.now().toString());
      } else {
        // Tab is visible again - check how long it was hidden
        const hiddenTime = sessionStorage.getItem(HIDDEN_TIME_KEY);
        if (hiddenTime) {
          const elapsed = Date.now() - parseInt(hiddenTime);
          // Only logout if hidden for longer than timeout AND it was actually hidden (not just page load)
          if (elapsed > inactivityTimeout && elapsed < 24 * 60 * 60 * 1000) { // Max 24 hours to avoid stale data
            console.log('Auto logout: Tab was hidden too long');
            onLogout();
          } else {
            // Reset timer if still within timeout
            resetTimer();
          }
          sessionStorage.removeItem(HIDDEN_TIME_KEY);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [inactivityTimeout, onLogout, resetTimer, enabled]);

  return { resetTimer };
};
