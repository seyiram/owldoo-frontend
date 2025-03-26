/**
 * Secure token storage utility
 * Uses HTTP-only cookies for sensitive tokens and both cookies and localStorage for non-sensitive data
 */

interface TokenStorage {
  setTokens(tokens: {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  }): void;
  getTokens(): {
    access_token: string | null;
    refresh_token: string | null;
    expiry_date: number | null;
  };
  clearTokens(): void;
}

// For access token and refresh token, we'll use HTTP-only cookies via API
// For non-sensitive data like expiry, we use both cookies and localStorage for redundancy
export const tokenStorage: TokenStorage = {
  setTokens(tokens) {
    // Store expiry date in localStorage AND a regular cookie for redundancy
    localStorage.setItem('auth_expiry', tokens.expiry_date.toString());
    document.cookie = `auth_expiry_backup=${tokens.expiry_date}; path=/; max-age=${60*60*24*30}`; // 30-day expiry
    
    // Send tokens to backend to set as HTTP-only cookies
    return fetch('/api/auth/set-cookies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date, // Also send expiry date to backend
      }),
      credentials: 'include', // Important for cookies
    });
  },
  
  getTokens() {
    // Try to get expiry from multiple sources for redundancy
    const localExpiry = localStorage.getItem('auth_expiry');
    
    // Also try to get from cookie if localStorage is empty
    let cookieExpiry = null;
    if (!localExpiry) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth_expiry_backup' && value) {
          cookieExpiry = value;
          // Restore to localStorage if found in cookie
          localStorage.setItem('auth_expiry', value);
          break;
        }
      }
    }
    
    const expiry = localExpiry || cookieExpiry;
    
    // For tokens, we'll return null as they should be in HTTP-only cookies
    // and automatically sent with requests
    return {
      access_token: null, // Stored in HTTP-only cookie
      refresh_token: null, // Stored in HTTP-only cookie
      expiry_date: expiry ? parseInt(expiry, 10) : null,
    };
  },
  
  isTokenExpired(): boolean {
    // If we don't have an expiry stored, check with the server instead of assuming expired
    const tokensData = this.getTokens();
    if (!tokensData.expiry_date) {
      // We'll check with the server in refreshTokenIfNeeded
      return true;
    }
    
    // Add a 5-minute buffer to ensure we refresh before actual expiration
    return Date.now() >= (tokensData.expiry_date - 5 * 60 * 1000);
  },
  
  async refreshTokenIfNeeded(): Promise<boolean> {
    // If we have no expiry data or it's expired, always check with the server
    const shouldRefresh = this.isTokenExpired();
    
    if (shouldRefresh) {
      try {
        const url = '/api/auth/refresh';
        console.log(`Refreshing token at: ${url}`);
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        
        if (response.ok) {
          try {
            // First check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              console.error('Expected JSON response but got:', contentType);
              const textResponse = await response.text();
              console.error('Non-JSON response:', textResponse);
              return false;
            }
            
            const data = await response.json();
            console.log('Token refresh response:', data);
            
            if (data.expiry_date) {
              // Update both localStorage and cookie
              localStorage.setItem('auth_expiry', data.expiry_date.toString());
              document.cookie = `auth_expiry_backup=${data.expiry_date}; path=/; max-age=${60*60*24*30}`;
              return true;
            }
          } catch (parseError) {
            console.error('Error parsing response as JSON:', parseError);
            return false;
          }
        } else {
          console.error('Refresh token request failed with status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
        }
        return false;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return false;
      }
    }
    return true; // Token is still valid
  },
  
  // Get auth status directly from server
  async checkAuthStatus(): Promise<boolean> {
    try {
      const url = '/api/auth/status';
      console.log(`Checking auth status at: ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        try {
          // First check if response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.error('Expected JSON response but got:', contentType);
            const textResponse = await response.text();
            console.error('Non-JSON response:', textResponse);
            return false;
          }
          
          const data = await response.json();
          console.log('Auth status response:', data);
          
          if (data.isAuthenticated && data.expiry_date) {
            // Update expiry information from server
            localStorage.setItem('auth_expiry', data.expiry_date.toString());
            document.cookie = `auth_expiry_backup=${data.expiry_date}; path=/; max-age=${60*60*24*30}`;
          }
          return data.isAuthenticated === true;
        } catch (parseError) {
          console.error('Error parsing auth status response as JSON:', parseError);
          // Try to get text response for debugging
          try {
            const textResponse = await response.clone().text();
            console.error('Response text:', textResponse);
          } catch (e) {
            console.error('Could not get response text:', e);
          }
          return false;
        }
      } else {
        console.error('Auth status check failed with status:', response.status);
        try {
          const errorText = await response.text();
          console.error('Error response:', errorText);
        } catch (e) {
          console.error('Could not get error response text:', e);
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to check auth status:', error);
      return false;
    }
  },
  
  clearTokens() {
    // Clear localStorage
    localStorage.removeItem('auth_expiry');
    
    // Clear cookies
    document.cookie = 'auth_expiry_backup=; path=/; max-age=0';
    
    // Clear HTTP-only cookies via API
    return fetch('/api/auth/clear-cookies', {
      method: 'POST',
      credentials: 'include',
    });
  }
};
