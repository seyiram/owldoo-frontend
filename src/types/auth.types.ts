export interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    isCheckingAuth: boolean;
    userName: string;
    lastChecked: number;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setIsCheckingAuth: (isCheckingAuth: boolean) => void;
    setUserName: (userName: string) => void;
    checkAuthStatus: (forceCheck?: boolean) => Promise<boolean>;
    handleTokenUpdate: (newTokens: GoogleTokens) => void;
    logout: () => Promise<void>;
}
