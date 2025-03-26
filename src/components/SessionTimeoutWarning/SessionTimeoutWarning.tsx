import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { sessionManager } from '../../utils/sessionManager';

interface SessionTimeoutWarningProps {
  children: React.ReactNode;
}

/**
 * Component that wraps the application and handles session timeout warnings
 */
const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({ children }) => {
  const { logout } = useAuthStore();

  useEffect(() => {
    // Configure session manager
    Object.defineProperty(sessionManager, 'config', {
      value: {
        ...sessionManager.config,
        onTimeout: async () => {
          console.log('Session timed out due to inactivity');
          await logout();
          window.location.href = '/login?timeout=true';
        },
        onWarning: () => {
          // Show a warning dialog or notification
          const warningEvent = new CustomEvent('session-timeout-warning', {
            detail: { timeRemaining: 5 * 60 * 1000 }
          });
          window.dispatchEvent(warningEvent);
        }
      }
    });

    const handleSessionWarning = (event: CustomEvent) => {
      // You can implement a modal or toast notification here
      const timeRemaining = Math.floor(event.detail.timeRemaining / 60000);
      alert(`Your session will expire in ${timeRemaining} minutes due to inactivity. Please save your work.`);
    };

    window.addEventListener('session-timeout-warning', handleSessionWarning as EventListener);
    
    return () => {
      window.removeEventListener('session-timeout-warning', handleSessionWarning as EventListener);
      sessionManager.endSession();
    };
  }, [logout]);

  return <>{children}</>;
};

export default SessionTimeoutWarning;
