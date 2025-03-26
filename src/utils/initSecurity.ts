/**
 * Initialize security features for the application
 */
import { initCSRFProtection } from './csrfUtils';
import { sessionManager } from './sessionManager';

/**
 * Initialize security features for the application
 * This should be called early in the application lifecycle
 */
export const initSecurity = async (): Promise<void> => {
  // Initialize CSRF protection
  await initCSRFProtection();
  
  // Reset any existing session timers
  sessionManager.endSession();
  
  // Session timeout configuration is now handled by the SessionTimeoutWarning component
};
