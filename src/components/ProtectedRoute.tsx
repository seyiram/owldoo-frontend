import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { tokenStorage } from '../utils/tokenStorage';
import { PropagateLoader } from 'react-spinners';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/'
}) => {
  const { isAuthenticated, isCheckingAuth, checkAuthStatus } = useAuthStore();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  // Skip auth check for the home route
  const isHomeRoute = location.pathname === '/';

  useEffect(() => {
    // Always reset state when component mounts
    setAuthCheckComplete(false);
    setAuthError(null);
    
    // Don't retry too many times to avoid infinite loops
    const MAX_RETRIES = 2;
    
    // Define auth check function
    const verifyAuth = async () => {
      if (isHomeRoute) {
        setAuthCheckComplete(true);
        return;
      }

      try {
        console.log(`Verifying authentication in ProtectedRoute (attempt ${retryCount + 1})`);
        
        // Check for auth cookies (fast pre-check)
        const hasCookie = document.cookie.includes('auth_session=true');
        console.log('Auth cookie present:', hasCookie);
        
        try {
          // First use direct server check
          const serverAuthStatus = await tokenStorage.checkAuthStatus();
          console.log('Server auth status result:', serverAuthStatus);
          
          if (serverAuthStatus) {
            // Update auth store to match server status
            await checkAuthStatus({ fetchProfile: true });
            setAuthCheckComplete(true);
            setAuthError(null);
            return;
          }
        } catch (serverCheckError) {
          console.error('Server auth check failed:', serverCheckError);
          // Continue to fallback checks, don't exit here
        }
        
        // If server check failed, try refreshing the token
        try {
          const refreshResult = await tokenStorage.refreshTokenIfNeeded();
          console.log('Token refresh result:', refreshResult);
          
          // After refresh, perform store check
          await checkAuthStatus();
          setAuthCheckComplete(true);
          setAuthError(null);
          return;
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError);
        }
        
        // All checks failed but we should still update the UI
        setAuthCheckComplete(true);
        setAuthError('Authentication check failed');
      } catch (error) {
        console.error('Auth verification error:', error);
        
        // If we haven't retried too many times, try again
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying auth check (${retryCount + 1}/${MAX_RETRIES})`);
          setRetryCount(prev => prev + 1);
          // Don't mark as complete yet, we'll retry
        } else {
          // Too many retries, give up
          setAuthCheckComplete(true);
          setAuthError('Authentication verification failed after multiple attempts');
        }
      }
    };

    // Execute auth check
    verifyAuth();
    
    // Cleanup function for when component unmounts
    return () => {
      // Any cleanup if needed
    };
  }, [checkAuthStatus, isHomeRoute, location.pathname, retryCount]);

  // Show loading while checking authentication
  if (!authCheckComplete || isCheckingAuth) {
    return (
      <div className="auth-loading" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh'
      }}>
        <PropagateLoader color="#9333ea" />
        <div style={{ marginTop: '20px' }}>
          {authError ? (
            <div className="auth-error">
              <p>Error: {authError}</p>
              <p>Trying to reconnect...</p>
            </div>
          ) : (
            'Checking authentication...'
          )}
        </div>
      </div>
    );
  }

  // Home route is always accessible
  if (isHomeRoute) {
    return <>{children}</>;
  }

  // For other routes, check if user is authenticated
  if (!isAuthenticated) {
    // Include the requested URL as state so login can redirect back
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;