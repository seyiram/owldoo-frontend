import { create } from 'zustand';
import { apiService } from '../api/api';
import { tokenStorage } from '../utils/tokenStorage';

interface GoogleTokens {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
}

interface AuthState {
    isAuthenticated: boolean;
    lastChecked: number;
    checkInterval: number;
    isCheckingAuth: boolean;
    showingAuthCheck: boolean; // New flag to control UI indicators
    userName: string | null;
    error: string | null;
}

// Initialize auth on app load - done once when store is created
// We'll use a different approach than an event listener
const initializeAuth = () => {
    // This will be called after store creation
    if (typeof window !== 'undefined') {
        // Initialize from localStorage on first load
        const authTimestamp = localStorage.getItem('auth_timestamp');
        const authData = localStorage.getItem('auth_data');
        
        if (authTimestamp && authData) {
            try {
                const parsedData = JSON.parse(authData);
                const timestamp = parseInt(authTimestamp);
                const now = Date.now();
                
                // If data is not too old (less than 1 hour), use it
                if (now - timestamp < 60 * 60 * 1000) {
                    useAuthStore.setState({
                        isAuthenticated: true,
                        userName: parsedData.userName,
                        lastChecked: timestamp
                    });
                    console.log('Restored auth from local storage');
                    return;
                }
            } catch (e) {
                console.error('Failed to parse stored auth data');
            }
        }
        
        // Silently check auth status without showing UI indicator
        setTimeout(() => {
            const authStore = useAuthStore.getState();
            if (authStore && !authStore.isAuthenticated) {
                console.log('Silently checking auth on initial load');
                authStore.checkAuthStatus({ showIndicator: false });
            }
        }, 0);
    }
};

export const useAuthStore = create<AuthState & {
    checkAuthStatus: (options?: { fetchProfile?: boolean, showIndicator?: boolean }) => Promise<void>;
    handleTokenUpdate: (newTokens: GoogleTokens) => void;
    logout: () => Promise<void>;
}>((set, get) => ({
    isAuthenticated: false,
    lastChecked: 0,
    checkInterval: 60 * 60 * 1000, // 1 hour - increased from 5 minutes
    isCheckingAuth: false,
    showingAuthCheck: false,
    userName: null,
    error: null,

    checkAuthStatus: async (options = { fetchProfile: true, showIndicator: true }): Promise<void> => {
        const now = Date.now();
        const state = get();

        // Don't run concurrent checks
        if (state.isCheckingAuth) {
            console.log('Auth check already in progress, skipping');
            return;
        }

        // Enhanced caching checks - use localStorage and cookies
        const hasAuthCookie = document.cookie.includes('auth_session=true');
        const authTimestamp = localStorage.getItem('auth_timestamp');
        const authData = localStorage.getItem('auth_data');
        
        // Use cache if all conditions are met:
        // 1. We're already authenticated in the store
        // 2. Auth cookie exists
        // 3. We have recent auth data in localStorage
        // 4. Last check was within our check interval
        if (state.isAuthenticated && 
            hasAuthCookie && 
            authTimestamp && 
            authData && 
            now - parseInt(authTimestamp) < state.checkInterval) {
            
            console.log('Using cached auth status (all conditions met)');
            return;
        }

        try {
            // Show indicator only if requested
            set({ 
                isCheckingAuth: true,
                showingAuthCheck: options.showIndicator
            });
            
            // Try direct server check first - the most reliable way
            try {
                const isAuthenticated = await tokenStorage.checkAuthStatus();
                
                if (isAuthenticated) {
                    let userData = { name: state.userName || 'User' };
                    
                    // Only fetch profile if needed and requested
                    if (options.fetchProfile && !state.userName) {
                        try {
                            userData = await apiService.getUserProfile();
                        } catch (profileError) {
                            console.error("Failed to fetch user profile:", profileError);
                            // Continue with default user data
                        }
                    }
                    
                    // Store auth status in localStorage for faster access on future loads
                    localStorage.setItem('auth_timestamp', now.toString());
                    localStorage.setItem('auth_data', JSON.stringify({ 
                        userName: userData.name
                    }));
                    
                    // Update state
                    set({
                        isAuthenticated: true,
                        userName: userData.name,
                        lastChecked: now
                    });
                    return;
                }
            } catch (serverCheckError) {
                console.error('Server auth check error:', serverCheckError);
                // Continue to fallback checks
            }
            
            // If auth cookie is present but server check failed, trust the cookie
            if (hasAuthCookie) {
                console.log('Auth cookie present, considering authenticated');
                
                let userName = state.userName || 'User';
                
                // Try to get profile data if needed
                if (options.fetchProfile && !state.userName) {
                    try {
                        const userProfile = await apiService.getUserProfile();
                        userName = userProfile.name;
                    } catch (profileError) {
                        console.error("Failed to fetch profile with cookie present:", profileError);
                    }
                }
                
                // Store this status for faster access
                localStorage.setItem('auth_timestamp', now.toString());
                localStorage.setItem('auth_data', JSON.stringify({ userName }));
                
                set({
                    isAuthenticated: true,
                    userName,
                    lastChecked: now
                });
                return;
            }
            
            // As a last resort, try token refresh
            try {
                const refreshed = await tokenStorage.refreshTokenIfNeeded();
                
                if (refreshed) {
                    const authStatus = await apiService.checkCalendarAuth();
                    
                    if (authStatus) {
                        let userName = state.userName || 'User';
                        
                        if (options.fetchProfile) {
                            try {
                                const userProfile = await apiService.getUserProfile();
                                userName = userProfile.name;
                            } catch (profileError) {
                                console.error("Failed to fetch profile after refresh:", profileError);
                            }
                        }
                        
                        // Store this status
                        localStorage.setItem('auth_timestamp', now.toString());
                        localStorage.setItem('auth_data', JSON.stringify({ userName }));
                        
                        set({
                            isAuthenticated: true,
                            userName,
                            lastChecked: now
                        });
                    } else {
                        // Clear any stored auth data
                        localStorage.removeItem('auth_timestamp');
                        localStorage.removeItem('auth_data');
                        
                        set({
                            isAuthenticated: false,
                            userName: null,
                            lastChecked: now
                        });
                    }
                } else {
                    // Clear any stored auth data
                    localStorage.removeItem('auth_timestamp');
                    localStorage.removeItem('auth_data');
                    
                    set({
                        isAuthenticated: false,
                        userName: null,
                        lastChecked: now
                    });
                }
            } catch (refreshError) {
                console.error('Token refresh error:', refreshError);
                
                // Clear any stored auth data
                localStorage.removeItem('auth_timestamp');
                localStorage.removeItem('auth_data');
                
                set({
                    isAuthenticated: false,
                    userName: null,
                    lastChecked: now
                });
            }
        } catch (error) {
            console.error('Auth check error:', error);
            set({
                isAuthenticated: false,
                error: 'Failed to check auth status',
                userName: null,
                lastChecked: now
            });
        } finally {
            set({ 
                isCheckingAuth: false,
                showingAuthCheck: false 
            });
        }
    },

    handleTokenUpdate: (newTokens: GoogleTokens) => {
        // Store tokens securely using tokenStorage
        tokenStorage.setTokens(newTokens);
        
        set({
            isAuthenticated: true,
            lastChecked: Date.now()
        });
    },

    logout: async () => {
        try {
            // Clear tokens from secure storage
            await tokenStorage.clearTokens();
            
            // Call logout API
            await apiService.logout();
            
            set({
                isAuthenticated: false,
                userName: null,
                error: null
            });
        } catch (error) {
            console.error('Logout error:', error);
            set({ error: 'Failed to logout' });
        }
    }
}));

// Call this once after store is created to initialize authentication state
initializeAuth();
