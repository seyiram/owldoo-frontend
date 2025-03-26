/**
 * Session management utilities
 */
import { authApi } from '../api/authApi';

interface SessionConfig {
  inactivityTimeout: number; // milliseconds
  warningTime: number; // milliseconds before timeout to show warning
  checkInterval: number; // how often to check activity
  onTimeout: () => void;
  onWarning: () => void;
}

class SessionManager {
  private lastActivity: number = Date.now();
  private timeoutId: number | null = null;
  private warningId: number | null = null;
  private config: SessionConfig;
  private isActive: boolean = true;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = {
      inactivityTimeout: 30 * 60 * 1000, // 30 minutes default
      warningTime: 5 * 60 * 1000, // 5 minutes before timeout
      checkInterval: 60 * 1000, // Check every minute
      onTimeout: () => {
        console.log('Session timed out due to inactivity');
        window.location.href = '/login?timeout=true';
      },
      onWarning: () => {
        console.log('Session about to timeout');
      },
      ...config
    };

    this.setupActivityListeners();
    this.startActivityTimer();
  }

  private setupActivityListeners(): void {
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    
    const resetTimer = () => {
      this.recordActivity();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });
  }

  private recordActivity(): void {
    this.lastActivity = Date.now();
    
    // If we were inactive and now active again, ping the server
    if (!this.isActive) {
      this.isActive = true;
      this.checkServerSession();
    }
    
    // Clear any existing warning
    if (this.warningId) {
      window.clearTimeout(this.warningId);
      this.warningId = null;
    }
  }

  private startActivityTimer(): void {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = window.setTimeout(() => this.checkActivity(), this.config.checkInterval);
  }

  private checkActivity(): void {
    const now = Date.now();
    const inactiveTime = now - this.lastActivity;
    
    // If inactive for too long, timeout the session
    if (inactiveTime >= this.config.inactivityTimeout) {
      this.isActive = false;
      this.handleTimeout();
      return;
    }
    
    // If approaching timeout, show warning
    if (inactiveTime >= (this.config.inactivityTimeout - this.config.warningTime) && !this.warningId) {
      this.warningId = window.setTimeout(() => {
        this.config.onWarning();
      }, 0);
    }
    
    // Continue checking
    this.startActivityTimer();
  }

  private handleTimeout(): void {
    this.config.onTimeout();
  }

  public async checkServerSession(): Promise<boolean> {
    try {
      const response = await authApi.checkSession();
      return response.active === true;
    } catch (error) {
      console.error('Failed to check server session:', error);
      return false;
    }
  }

  public extendSession(): void {
    this.recordActivity();
    authApi.refreshToken().catch(err => {
      console.error('Failed to extend session:', err);
    });
  }

  public endSession(): void {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.warningId) {
      window.clearTimeout(this.warningId);
      this.warningId = null;
    }
  }
}

// Create and export a singleton instance
export const sessionManager = new SessionManager();

// Export the class for testing or custom instances
export default SessionManager;
