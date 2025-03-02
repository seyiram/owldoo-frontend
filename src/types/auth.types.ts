export interface AuthState {
    isAuthenticated: boolean;
    isCheckingAuth: boolean;
    userName: string;
    lastChecked: number;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setIsCheckingAuth: (isCheckingAuth: boolean) => void;
    setUserName: (userName: string) => void;
    checkAuthStatus: () => Promise<void>;
    logout: () => Promise<void>;
}
