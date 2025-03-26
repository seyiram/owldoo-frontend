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
    userName: string | null;
    error: string | null;
}

// Force check auth status on page load/refresh
const checkAuthOnLoad = () => {
    const authStore = useAuthStore.getState();
    if (authStore && !authStore.isAuthenticated) {
        console.log('Checking auth on page load/refresh');
        setTimeout(() => {
            authStore.checkAuthStatus();
        }, 0);
    }
};

// Add window load event listener
if (typeof window !== 'undefined') {
    window.addEventListener('load', checkAuthOnLoad);
}

export const useAuthStore = create<AuthState & {
    checkAuthStatus: (options?: { fetchProfile?: boolean }) => Promise<void>;
    handleTokenUpdate: (newTokens: GoogleTokens) => void;
    logout: () => Promise<void>;
}>((set, get) => ({
    isAuthenticated: false,
    lastChecked: 0,
    checkInterval: 5 * 60 * 1000, // 5 minutes
    isCheckingAuth: false,
    userName: null,
    error: null,

    checkAuthStatus: async (options = { fetchProfile: true }): Promise<void> => {
        const now = Date.now();
        const state = get();

        // Don't run concurrent checks
        if (state.isCheckingAuth) {
            console.log('Auth check already in progress, skipping');
            return;
        }

        // First check for cookie presence as a fast check
        const hasAuthCookie = document.cookie.includes('auth_session=true');
        if (state.isAuthenticated && hasAuthCookie && now - state.lastChecked < state.checkInterval) {
            // Return cached result if we have cookie + state + recent check
            console.log('Using cached auth status (cookie present and recent check)');
            return;
        }

        try {
            set({ isCheckingAuth: true });
            
            // First try direct server check which is most reliable
            try {
                const isAuthenticated = await tokenStorage.checkAuthStatus();
                console.log(`Direct server auth check result: ${isAuthenticated}`);
                
                if (isAuthenticated) {
                    if (options.fetchProfile) {
                        try {
                            const userProfile = await apiService.getUserProfile();
                            set({
                                isAuthenticated: true,
                                userName: userProfile.name,
                                lastChecked: now
                            });
                        } catch (profileError) {
                            console.error("Failed to fetch user profile:", profileError);
                            // Still mark as authenticated even if profile fetch fails
                            set({
                                isAuthenticated: true,
                                error: 'Authenticated but failed to fetch profile',
                                lastChecked: now
                            });
                        }
                    } else {
                        set({
                            isAuthenticated: true,
                            lastChecked: now
                        });
                    }
                    return;
                }
            } catch (serverCheckError) {
                console.error('Server auth check error:', serverCheckError);
                // Continue to fallback checks
            }
            
            // If auth cookie is present but server check failed, try to proceed anyway
            if (hasAuthCookie) {
                console.log('Auth cookie present despite server check failure, proceeding');
                if (options.fetchProfile) {
                    try {
                        const userProfile = await apiService.getUserProfile();
                        set({
                            isAuthenticated: true,
                            userName: userProfile.name,
                            lastChecked: now
                        });
                        return;
                    } catch (profileError) {
                        console.error("Failed to fetch profile with cookie present:", profileError);
                        // Still mark as authenticated to avoid login loops
                        set({
                            isAuthenticated: true,
                            error: 'Using cookie-based auth, profile fetch failed',
                            lastChecked: now
                        });
                        return;
                    }
                } else {
                    set({
                        isAuthenticated: true,
                        lastChecked: now
                    });
                    return;
                }
            }
            
            // If direct check fails, try token refresh as backup
            try {
                const refreshed = await tokenStorage.refreshTokenIfNeeded();
                console.log(`Token refresh result: ${refreshed}`);
                
                if (refreshed) {
                    // Try calendar auth check after token refresh
                    const authStatus = await apiService.checkCalendarAuth();
                    console.log(`Calendar auth check after refresh: ${authStatus}`);
                    
                    if (authStatus) {
                        if (options.fetchProfile) {
                            try {
                                const userProfile = await apiService.getUserProfile();
                                set({
                                    isAuthenticated: true,
                                    userName: userProfile.name,
                                    lastChecked: now
                                });
                            } catch (profileError) {
                                console.error("Failed to fetch profile after refresh:", profileError);
                                // Still consider authenticated
                                set({
                                    isAuthenticated: true,
                                    error: 'Authenticated via refresh but profile failed',
                                    lastChecked: now
                                });
                            }
                        } else {
                            set({
                                isAuthenticated: true,
                                lastChecked: now
                            });
                        }
                    } else {
                        set({
                            isAuthenticated: false,
                            userName: null,
                            lastChecked: now
                        });
                    }
                } else {
                    set({
                        isAuthenticated: false,
                        userName: null,
                        lastChecked: now
                    });
                }
            } catch (refreshError) {
                console.error('Token refresh error:', refreshError);
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
            set({ isCheckingAuth: false });
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
