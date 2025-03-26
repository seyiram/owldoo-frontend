import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { PropagateLoader } from 'react-spinners';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/'
}) => {
  const { 
    isAuthenticated, 
    isCheckingAuth, 
    showingAuthCheck, 
    checkAuthStatus 
  } = useAuthStore();
  
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';

  // Perform a quick auth check ONLY if not authenticated
  // This is a single, lightweight check without multiple retries
  useEffect(() => {
    if (!isHomeRoute && !isAuthenticated && !isCheckingAuth) {
      // Use showIndicator: true only for auth-required routes
      checkAuthStatus({ fetchProfile: true, showIndicator: true });
    }
  }, [isHomeRoute, isAuthenticated, isCheckingAuth, checkAuthStatus]);

  // Only show loading when explicitly checking auth AND showing is enabled
  if (isCheckingAuth && showingAuthCheck) {
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
          Checking authentication...
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

  // User is authenticated, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;