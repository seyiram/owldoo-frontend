/**
 * CSRF protection utilities
 */

// Get the CSRF token from meta tag
export const getCSRFToken = (): string => {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag?.getAttribute('content') || '';
};

// Set a CSRF token in the document
export const setCSRFToken = (token: string): void => {
  let metaTag = document.querySelector('meta[name="csrf-token"]');
  
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute('name', 'csrf-token');
    document.head.appendChild(metaTag);
  }
  
  metaTag.setAttribute('content', token);
};

// Initialize CSRF protection
export const initCSRFProtection = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.csrfToken) {
        setCSRFToken(data.csrfToken);
        return true;
      }
    }
    console.warn('Failed to get CSRF token: Server returned an invalid response');
    return false;
  } catch (error) {
    console.error('Failed to initialize CSRF protection:', error);
    return false;
  }
};

// Refresh CSRF token
export const refreshCSRFToken = async (): Promise<boolean> => {
  return initCSRFProtection();
};

// Add CSRF token to headers
export const addCSRFToHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
  return {
    ...headers,
    'X-CSRF-Token': getCSRFToken(),
  };
};
