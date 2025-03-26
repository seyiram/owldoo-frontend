/**
 * Authentication API service
 */
import { apiService } from './api';
import { getCSRFToken, initCSRFProtection, addCSRFToHeaders } from '../utils/csrfUtils';
import { tokenStorage } from '../utils/tokenStorage';

// Initialize CSRF protection when this module is imported
initCSRFProtection().catch(err => {
  console.error('Failed to initialize CSRF protection:', err);
});

// Create a specialized API client for auth operations
const createAuthClient = () => {
  const baseUrl = process.env.REACT_APP_API_URL || '/api';
  
  return {
    async get(endpoint: string, options = {}) {
      // Skip token refresh for status endpoint to avoid loops
      if (endpoint !== '/auth/status') {
        await tokenStorage.refreshTokenIfNeeded();
      }
      
      const url = `${baseUrl}${endpoint}`;
      console.log(`Auth client GET request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: addCSRFToHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        ...options,
      });
      
      // Check content type to help debug JSON parsing issues
      const contentType = response.headers.get('content-type');
      console.log(`Response content type: ${contentType}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Auth API error (${response.status}):`, errorText);
        throw new Error(`Auth API error: ${response.status}`);
      }
      
      // Handle empty response
      if (response.status === 204) {
        return {}; 
      }
      
      try {
        return await response.json();
      } catch (error) {
        console.error('Error parsing JSON response:', error);
        console.error('Response text:', await response.clone().text());
        throw new Error('Failed to parse response as JSON');
      }
    },
    
    async post(endpoint: string, data = {}, options = {}) {
      // For non-login endpoints, ensure token is refreshed
      // Skip for refresh and auth-related endpoints to avoid loops
      if (endpoint !== '/auth/login' && 
          endpoint !== '/auth/google' && 
          endpoint !== '/auth/refresh' &&
          endpoint !== '/auth/refresh-token') {
        await tokenStorage.refreshTokenIfNeeded();
      }
      
      const url = `${baseUrl}${endpoint}`;
      console.log(`Auth client POST request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: addCSRFToHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        body: JSON.stringify(data),
        ...options,
      });
      
      // Check content type to help debug JSON parsing issues
      const contentType = response.headers.get('content-type');
      console.log(`Response content type: ${contentType}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Auth API error (${response.status}):`, errorText);
        throw new Error(`Auth API error: ${response.status}`);
      }
      
      // Handle empty response
      if (response.status === 204) {
        return {}; 
      }
      
      try {
        return await response.json();
      } catch (error) {
        console.error('Error parsing JSON response:', error);
        console.error('Response text:', await response.clone().text());
        throw new Error('Failed to parse response as JSON');
      }
    }
  };
};

const authClient = createAuthClient();

export const authApi = {
  /**
   * Login with Google OAuth
   */
  loginWithGoogle: async (code: string) => {
    return authClient.post('/auth/google', { code });
  },
  
  /**
   * Set secure HTTP-only cookies
   */
  setAuthCookies: async (tokens: { access_token: string; refresh_token: string }) => {
    return authClient.post('/auth/set-cookies', tokens);
  },
  
  /**
   * Clear auth cookies
   */
  clearAuthCookies: async () => {
    return authClient.post('/auth/clear-cookies', {});
  },
  
  /**
   * Validate current authentication
   */
  validateAuth: async () => {
    return authClient.get('/auth/validate');
  },
  
  /**
   * Refresh CSRF token
   */
  refreshCSRFToken: async () => {
    return authClient.get('/auth/csrf-token');
  },
  
  /**
   * Refresh access token
   */
  refreshToken: async () => {
    return authClient.post('/auth/refresh');
  },
  
  /**
   * Check session status
   */
  checkSession: async () => {
    return authClient.get('/auth/status');
  }
};
