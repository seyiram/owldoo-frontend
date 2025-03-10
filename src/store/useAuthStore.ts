import { create } from 'zustand';
import { apiService } from '../api/api';

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface AuthState {
  isAuthenticated: boolean;
  lastChecked: number;
  tokens: GoogleTokens | null;
  checkInterval: number;
  isCheckingAuth: boolean;
  userName: string | null;
  error: string | null;
}

export const useAuthStore = create<AuthState & {
  checkAuthStatus: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  handleTokenUpdate: (newTokens: GoogleTokens) => void;
  logout: () => Promise<void>;
}>((set, get) => ({
  isAuthenticated: false,
  lastChecked: 0,
  tokens: null,
  checkInterval: 5 * 60 * 1000, // 5 minutes
  isCheckingAuth: false,
  userName: null,
  error: null,

  checkAuthStatus: async () => {
    const now = Date.now();
    const state = get();

    // Return cached result if checked recently
    if (state.isAuthenticated && 
        state.tokens && 
        now - state.lastChecked < state.checkInterval && 
        now < state.tokens.expiry_date) {
      return;
    }

    try {
      set({ isCheckingAuth: true });
      const isAuth = await apiService.checkCalendarAuth();
      
      if (isAuth) {
        const userProfile = await apiService.getUserProfile();
        set({ 
          isAuthenticated: true,
          userName: userProfile.name,
          lastChecked: now 
        });
      } else {
        set({ isAuthenticated: false, userName: null });
      }
    } catch (error) {
      set({ 
        isAuthenticated: false,
        error: 'Failed to check auth status',
        userName: null 
      });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  checkAuth: async () => {
    const state = get();
    const now = Date.now();

    // Return cached result if checked recently
    if (state.isAuthenticated && now - state.lastChecked < state.checkInterval) {
      return true;
    }

    try {
      const isAuth = await apiService.checkCalendarAuth();
      set({ 
        isAuthenticated: isAuth,
        lastChecked: now 
      });
      return isAuth;
    } catch (error) {
      set({ isAuthenticated: false });
      return false;
    }
  },

  handleTokenUpdate: (newTokens: GoogleTokens) => {
    set({ 
      tokens: newTokens,
      isAuthenticated: true,
      lastChecked: Date.now() 
    });
  },

  logout: async () => {
    try {
      await apiService.logout();
      set({
        isAuthenticated: false,
        tokens: null,
        userName: null,
        error: null
      });
    } catch (error) {
      set({ error: 'Failed to logout' });
    }
  }
}));
