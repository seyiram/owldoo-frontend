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

// Initialize auth on app load
const initializeAuth = () => {
    if (typeof window !== 'undefined') {
        // Check for existing auth data
        const authTimestamp = localStorage.getItem('auth_timestamp');
        const authData = localStorage.getItem('auth_data');
        const hasAuthCookie = document.cookie.includes('auth_session=true');
        
        if (authTimestamp && authData) {
            try {
                const parsedData = JSON.parse(authData);
                const timestamp = parseInt(authTimestamp);
                const now = Date.now();
                
                // Trust cached data if fresh and cookie exists
                if (now - timestamp < 6 * 60 * 60 * 1000 && hasAuthCookie) {
                    useAuthStore.setState({
                        isAuthenticated: true,
                        userName: parsedData.userName,
                        lastChecked: timestamp
                    });
                    
                    // Verify in background without blocking UI
                    setTimeout(() => {
                        const authStore = useAuthStore.getState();
                        if (authStore) {
                            authStore.checkAuthStatus({ 
                                showIndicator: false,
                                fetchProfile: false
                            });
                        }
                    }, 2000);
                    
                    return;
                }
            } catch (e) {
                console.error('Failed to parse stored auth data');
            }
        }
        
        // Trust cookie if it exists
        if (hasAuthCookie) {
            useAuthStore.setState({
                isAuthenticated: true,
                userName: 'User',
                lastChecked: Date.now()
            });
            
            // Verify in background
            setTimeout(() => {
                const authStore = useAuthStore.getState();
                if (authStore) {
                    authStore.checkAuthStatus({ 
                        showIndicator: false,
                        fetchProfile: true
                    });
                }
            }, 1000);
            
            return;
        }
    }
};

export const useAuthStore = create<AuthState & {
    checkAuthStatus: (options?: { fetchProfile?: boolean, showIndicator?: boolean, forceCheck?: boolean }) => Promise<void>;
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

    checkAuthStatus: async (options = { fetchProfile: true, showIndicator: true, forceCheck: false }): Promise<void> => {
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

        // Use cache more aggressively for better performance
        // Only bypass cache if:
        // 1. forceCheck is true (explicit request to check regardless of cache) OR
        // 2. We're not authenticated but have a cookie (possible state mismatch) OR
        // 3. Cache is too old (beyond check interval)
        const useCache = !options.forceCheck &&
            state.isAuthenticated &&
            hasAuthCookie &&
            authTimestamp &&
            authData &&
            now - parseInt(authTimestamp) < state.checkInterval;

        if (useCache) {
            console.log('Using cached auth status (silent check)');
            return;
        }

        try {
            // Only show loading indicator if explicitly requested and not a background check
            set({
                isCheckingAuth: true,
                showingAuthCheck: options.showIndicator
            });

            console.log(`Auth check started (${options.showIndicator ? 'visible' : 'silent'})`);

            // Fast path: check cookie first
            if (hasAuthCookie && !options.forceCheck) {
                console.log('Auth cookie present, performing quick validation');

                // Get cached user info
                let userName = state.userName;
                if (!userName && authData) {
                    try {
                        const parsedData = JSON.parse(authData);
                        userName = parsedData.userName || 'User';
                    } catch (e) {
                        userName = 'User';
                    }
                }

                // For non-force checks with a cookie, we can be more optimistic
                // and just update the state while performing a background check
                set({
                    isAuthenticated: true,
                    userName: userName || 'User',
                    lastChecked: now
                });

                // If not forcing a check, we can return immediately
                // and let the server check run in the background
                if (!options.forceCheck) {
                    console.log('Quick auth success via cookie - continuing with background verification');

                    // Ensure we reset the checking state regardless of background check outcome
                    setTimeout(() => {
                        set({ isCheckingAuth: false, showingAuthCheck: false });
                    }, 0);

                    // Perform server check in the background without updating UI
                    tokenStorage.checkAuthStatus().catch(err => {
                        console.error('Background auth check error:', err);
                    });

                    return;
                }
            }

            // Standard path: perform full server check
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
                } else {
                    // Server says not authenticated, but check if cookie exists
                    if (hasAuthCookie) {
                        console.log('Server reports not authenticated but cookie exists - potential mismatch');

                        // If we have a cookie but server says not authenticated,
                        // this could be a temporary issue - try one more validation
                        try {
                            const secondCheck = await apiService.checkCalendarAuth();
                            if (secondCheck) {
                                console.log('Secondary auth check successful, using cookie-based auth');

                                let userName = state.userName || 'User';
                                // Update state but don't make any more API calls
                                set({
                                    isAuthenticated: true,
                                    userName,
                                    lastChecked: now
                                });
                                return;
                            }
                        } catch (secondCheckError) {
                            console.error('Secondary auth check failed:', secondCheckError);
                        }
                    }
                }
            } catch (serverCheckError) {
                console.error('Server auth check error:', serverCheckError);
                // Continue to fallback checks only if forcing a check
                if (!options.forceCheck) {
                    throw serverCheckError; // Re-throw to move to error handling
                }
            }

            // Fallback: try token refresh as a last resort
            try {
                const refreshed = await tokenStorage.refreshTokenIfNeeded();

                if (refreshed) {
                    console.log('Token refresh successful, checking auth status');
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
                        return;
                    }
                }

                // If we reach here, authentication has failed
                console.log('Authentication failed after all checks');

                // Clear any stored auth data
                localStorage.removeItem('auth_timestamp');
                localStorage.removeItem('auth_data');

                set({
                    isAuthenticated: false,
                    userName: null,
                    lastChecked: now
                });
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
            // Reset checking state
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
