import { create } from 'zustand';
import { AuthState } from '../types/auth.types';
import { apiService } from '../api/api';

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
    isCheckingAuth: false,
    userName: localStorage.getItem('userName') || '',
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
        try {
            set({ isCheckingAuth: true });
            const status = await apiService.checkCalendarAuth();
            
            if (status) {
                const profile = await apiService.getUserProfile();
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userName', profile.name);
                set({ 
                    isAuthenticated: true,
                    userName: profile.name
                });
            } else {
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('userName');
                set({ 
                    isAuthenticated: false,
                    userName: ''
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
