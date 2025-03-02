import { create } from 'zustand';
import { AuthState } from '../types/auth.types';
import { apiService } from '../api/api';

export const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
    isCheckingAuth: false,
    userName: localStorage.getItem('userName') || '',
    lastChecked: 0, // Add this new state
    setIsAuthenticated: (isAuthenticated) => {
        localStorage.setItem('isAuthenticated', String(isAuthenticated));
        set({ isAuthenticated });
    },
    setIsCheckingAuth: (isCheckingAuth) => set({ isCheckingAuth }),
    setUserName: (userName) => {
        localStorage.setItem('userName', userName);
        set({ userName });
    },
    checkAuthStatus: async () => {
        const state = get();
        const now = Date.now();
        
        // Don't check if already checking or if checked recently (within 5 seconds)
        if (state.isCheckingAuth || (state.lastChecked && now - state.lastChecked < 5000)) {
            console.log('Skipping auth check: already checking or checked recently');
            return;
        }

        try {
            console.log('Starting auth check');
            set({ isCheckingAuth: true });
            const status = await apiService.checkCalendarAuth();
            console.log('Auth check status:', status);
            
            if (status) {
                const profile = await apiService.getUserProfile();
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userName', profile.name);
                localStorage.setItem('lastChecked', now.toString());
                set({ 
                    isAuthenticated: true,
                    userName: profile.name,
                    lastChecked: now
                });
            } else {
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('userName');
                set({ 
                    isAuthenticated: false,
                    userName: '',
                    lastChecked: now
                });
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userName');
            set({ isAuthenticated: false, userName: '' });
        } finally {
            set({ isCheckingAuth: false });
        }
    },
    logout: async () => {
        try {
            await apiService.logout();
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userName');
            set({ 
                isAuthenticated: false,
                userName: ''
            });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}));
