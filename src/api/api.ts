import {
    API_BASE_URL,
    AUTH_ROUTES,
    USER_ROUTES,
    CALENDAR_ROUTES,
    CHAT_ROUTES,
    CONVERSATION_ROUTES,
    AGENT_ROUTES,
    SCHEDULING_ROUTES,
    FEEDBACK_ROUTES
} from "./api.config";
import {
    Event,
    Thread,
    ConflictResponse,
    Suggestion,
    AgentTaskResponse,
    ConversationResponse,
    UserPreferencesResponse,
    SchedulingSuggestionResponse
} from "../types/api.types";
import { AgentStats, AgentTask, Insight } from "../types/agent.types";
import { useAuthStore } from '../store/useAuthStore';

interface RequestOptions extends RequestInit {
    headers?: HeadersInit;
}

class ApiService {
    private readonly API_BASE = import.meta.env.VITE_API_URL || '/api';
    private readonly CALENDAR_BASE = '/calendar'; // Keep calendar routes at root level
    private calendarAuthWindow: Window | null = null;

    constructor() {
        // Listen for auth callback
        window.addEventListener('message', this.handleAuthMessage);

        // Run a quick CORS test on startup
        this.testConnection().catch(err =>
            console.warn('Initial connection test failed, this may indicate CORS issues:', err)
        );
    }

    // Test method to check if basic CORS is working
    async testConnection(): Promise<boolean> {
        try {
            console.log('Testing connection to backend...');
            const response = await fetch('/health', {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Connection test failed with status:', response.status);
                return false;
            }

            const data = await response.json();
            console.log('Backend connection successful:', data);
            return true;
        } catch (error) {
            console.error('Connection test failed with error:', error);
            return false;
        }
    }

    private handleAuthMessage = (event: MessageEvent) => {
        // Only process messages with a type field that matches our auth flow
        if (!event.data || !event.data.type ||
            !['CALENDAR_AUTH_SUCCESS', 'CALENDAR_AUTH_ERROR'].includes(event.data.type)) {
            return;
        }

        console.log("Auth message received:", event.data);

        // Accept messages from both the API domain and the frontend domain
        const allowedOrigins = [window.location.origin, 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'];
        if (!allowedOrigins.includes(event.origin)) {
            console.log("Ignoring message from different origin:", event.origin);
            return;
        }

        if (event.data.type === 'CALENDAR_AUTH_SUCCESS') {
            console.log("Auth success in handleAuthMessage, storing tokens");
            localStorage.setItem('googleCalendarTokens', JSON.stringify(event.data.tokens));
            // Don't attempt to close the window here since it will close itself
            this.calendarAuthWindow = null;
            // Retry any pending requests
            this.retryPendingRequests();
        } else if (event.data.type === 'CALENDAR_AUTH_ERROR') {
            console.error("Auth error in handleAuthMessage:", event.data.error);
            // Don't attempt to close the window here since it will close itself
            this.calendarAuthWindow = null;
        }
    };

    private pendingRequests: (() => Promise<any>)[] = [];

    // Track auth check to prevent recursive calls
    private isCheckingAuth = false;
    private lastAuthCheck = 0;
    private AUTH_CHECK_COOLDOWN = 5000; // 5 seconds

    private async getAuthHeaders(): Promise<Headers> {
        const now = Date.now();

        // Only check auth if not already checking and not checked recently
        if (!this.isCheckingAuth && now - this.lastAuthCheck > this.AUTH_CHECK_COOLDOWN) {
            try {
                this.isCheckingAuth = true;
                await useAuthStore.getState().checkAuthStatus();
                this.lastAuthCheck = Date.now();
            } catch (error) {
                console.error('Auth check failed in getAuthHeaders:', error);
            } finally {
                this.isCheckingAuth = false;
            }
        }

        return new Headers({
            'Content-Type': 'application/json',
            // No Authorization header needed using Google's OAuth
        });
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<T> {
        const headers = await this.getAuthHeaders();

        try {
            const response = await fetch(`${this.API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    ...Object.fromEntries(headers),
                    ...options?.headers 
                },
                credentials: 'include' // Important for OAuth cookies
            });

            if (response.status === 401) {
                // Check if we've triggered auth recently to avoid loops
                const now = Date.now();
                if (now - this.lastAuthCheck > this.AUTH_CHECK_COOLDOWN) {
                    this.lastAuthCheck = now;
                    // Trigger re-authentication, but don't await to avoid blocking
                    useAuthStore.getState().checkAuthStatus().catch(e => {
                        console.error('Auth check failed in response handler:', e);
                    });
                }
                throw new Error('Authentication required');
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            return response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // refresh token endpoint
    async refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }> {
        return this.makeRequest('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        });
    }

    private async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        await this.refreshTokenIfNeeded();

        const isAuthEndpoint = endpoint.includes('/auth');
        const isCalendarEndpoint = endpoint.includes('/calendar') || endpoint.includes('/events');
        
        // Only do the calendar token check for calendar-specific operations
        if (!isAuthEndpoint && isCalendarEndpoint) {
            const isTokenValid = this.hasValidToken();

            if (!isTokenValid) {
                console.log('Auth required for calendar operation, checking auth status first');
                
                // Check if we're actually authenticated with the server first
                try {
                    const authCheck = await fetch('/api/auth/status', {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (authCheck.ok) {
                        const authData = await authCheck.json();
                        if (authData.isAuthenticated) {
                            console.log('Server reports authenticated, proceeding with request');
                            // We're authenticated, proceed with the request
                        } else {
                            // We need to authenticate
                            console.log('Server reports not authenticated, initiating auth');
                            const retryRequest = () => this.request<T>(endpoint, options);
                            this.pendingRequests.push(retryRequest);
                            await this.initiateCalendarAuth();
                            throw new Error('Calendar authentication required');
                        }
                    } else {
                        // Server error, fall back to token check
                        const retryRequest = () => this.request<T>(endpoint, options);
                        this.pendingRequests.push(retryRequest);
                        await this.initiateCalendarAuth();
                        throw new Error('Calendar authentication required');
                    }
                } catch (authCheckError) {
                    console.error('Error checking auth status:', authCheckError);
                    // Auth check failed, fall back to initiating auth
                    const retryRequest = () => this.request<T>(endpoint, options);
                    this.pendingRequests.push(retryRequest);
                    await this.initiateCalendarAuth();
                    throw new Error('Calendar authentication required');
                }
            }
        }

        const headers = await this.getAuthHeaders();

        console.log(`Making request to ${endpoint} with options:`, options);

        // Enhanced request configuration for better CORS handling
        const response = await fetch(`${this.API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options?.headers ?? {},
                ...Object.fromEntries(headers)
            },
            credentials: 'include',
            mode: 'cors'
        });

        console.log(`Response status: ${response.status}`);

        if (response.status === 401 && response.headers.get('X-Calendar-Auth-Required')) {
            // Store the request to retry later (but limit to prevent loops)
            const requestKey = `${endpoint}-${JSON.stringify(options || {})}`;
            const existingRequests = this.pendingRequests.filter(r =>
                r.toString().includes(requestKey)).length;

            // Only queue this request if we don't have too many of the same one
            if (existingRequests < 2) {
                const retryRequest = () => this.request<T>(endpoint, options);
                this.pendingRequests.push(retryRequest);

                // Check if we've triggered auth recently to avoid loops
                const now = Date.now();
                if (now - this.lastAuthCheck > this.AUTH_CHECK_COOLDOWN) {
                    this.lastAuthCheck = now;
                    // Trigger calendar auth but don't wait for it to complete
                    this.initiateCalendarAuth().catch(e => {
                        console.error('Failed to initiate auth:', e);
                    });
                }
            }

            throw new Error('Calendar authentication required');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Request to ${endpoint} failed with status ${response.status}:`, errorData);
            throw new Error(errorData.error || 'An error occurred');
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }


    // Method to check token validity - uses both localStorage and cookie check
    private hasValidToken(): boolean {
        // First check for auth cookie which indicates general authentication
        const hasAuthCookie = document.cookie.includes('auth_session=true');
        
        // If we have the auth cookie, it is valid as we're using the same auth for both
        if (hasAuthCookie) {
            return true;
        }
        
        // Fallback to localStorage check for backward compatibility
        const tokensJson = localStorage.getItem('googleCalendarTokens');
        if (!tokensJson) return false;

        try {
            const tokens = JSON.parse(tokensJson);
            // Check if token exists and isn't expired
            return tokens && tokens.access_token && (!tokens.expiry_date || tokens.expiry_date > Date.now());
        } catch {
            return false;
        }
    }

    async initiateCalendarAuth(): Promise<void> {
        try {
            // Including mode and credentials explicitly for CORS
            const response = await fetch(`${this.CALENDAR_BASE}/auth/url`, {
                method: 'GET',
                credentials: 'include',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Auth URL response error details:', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: errorText
                });
                throw new Error(`Failed to get auth URL: ${response.status} ${response.statusText}`);
            }

            const { url } = await response.json();
            console.log('Successfully received auth URL:', url);

            // Close any existing auth window
            if (this.calendarAuthWindow && !this.calendarAuthWindow.closed) {
                this.calendarAuthWindow.close();
            }

            // Open the auth window
            this.calendarAuthWindow = window.open(url, 'googleAuth', 'width=500,height=600');

            if (!this.calendarAuthWindow) {
                throw new Error('Failed to open authentication window - popup may have been blocked');
            }
        } catch (error) {
            console.error('Auth URL response error:', error);
            throw new Error(`Failed to get auth URL: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async retryPendingRequests() {
        const requests = [...this.pendingRequests];
        this.pendingRequests = [];

        for (const request of requests) {
            try {
                await request();
            } catch (error) {
                console.error('Failed to retry request:', error);
            }
        }
    }

    async checkCalendarAuth(): Promise<boolean> {
        // First try the regular API auth status endpoint
        try {
            console.log('Checking regular auth status first');
            const authResponse = await fetch('/api/auth/status', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (authResponse.ok) {
                const authData = await authResponse.json();
                console.log('Regular auth check response:', authData);
                
                if (authData.isAuthenticated) {
                    console.log('Authenticated via regular auth endpoint');
                    return true;
                }
            }
        } catch (authError) {
            console.error('Regular auth check failed:', authError);
            // Continue to calendar auth
        }
        
        // Next check for auth cookie
        const hasAuthCookie = document.cookie.includes('auth_session=true');
        if (hasAuthCookie) {
            console.log('Found auth cookie, assuming authenticated');
            return true;
        }

        // Fallback to calendar-specific auth check
        try {
            console.log('Checking calendar auth status with backend...');
            // More explicit fetch configuration for CORS
            const response = await fetch(`${this.CALENDAR_BASE}/auth/status`, {
                method: 'GET',
                credentials: 'include',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Calendar auth check error details:', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: errorText
                });
                throw new Error(`Calendar auth check failed: ${response.status} ${response.statusText}`);
            }

            // Try to parse response as JSON with error handling
            try {
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    console.error('Expected JSON response from calendar auth check but got:', contentType);
                    const textResponse = await response.text();
                    console.error('Non-JSON calendar auth response:', textResponse);
                    return false;
                }
                
                const data = await response.json();
                console.log('Calendar auth check response:', data);
                
                return data.isAuthenticated === true;
            } catch (parseError) {
                console.error('Error parsing calendar auth response as JSON:', parseError);
                return false;
            }
        } catch (error) {
            console.error('Failed to check calendar auth status:', error);
            // Already checked cookies, so return false
            return false;
        }
    }

    async getUserProfile() {
        try {
            // First check if we have a valid auth session before trying to get profile
            const authStatus = await fetch('/api/auth/status', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            // If we have auth status, extract user information directly
            if (authStatus.ok) {
                const data = await authStatus.json();
                if (data.isAuthenticated && data.user) {
                    console.log('Using user profile from auth status');
                    return data.user;
                }
            }
            
            // Fallback to calendar profile if auth status doesn't have user info
            console.log('Falling back to calendar API for user profile');
            return this.request<{ name: string; email: string | null }>(CALENDAR_ROUTES.userProfile, {
                method: 'GET'
            });
        } catch (error) {
            console.error('Error getting user profile:', error);
            // Return a default user profile to prevent auth loops
            return { name: 'User', email: null };
        }
    }

    private async refreshTokenIfNeeded(): Promise<boolean> {
        const tokensJson = localStorage.getItem('googleCalendarTokens');
        if (!tokensJson) return false;

        try {
            const tokens = JSON.parse(tokensJson);
            if (!tokens.refresh_token) return false;

            // Check if token is expired or about to expire (within 5 minutes)
            if (tokens.expiry_date && tokens.expiry_date < Date.now() + 5 * 60 * 1000) {
                console.log('Token expired or about to expire, refreshing...');

                // Refresh the token
                const newTokens = await this.refreshToken(tokens.refresh_token);

                // Save the new tokens
                localStorage.setItem('googleCalendarTokens', JSON.stringify({
                    access_token: newTokens.accessToken,
                    refresh_token: newTokens.refreshToken || tokens.refresh_token,
                    expiry_date: Date.now() + newTokens.expiresIn * 1000
                }));

                return true;
            }

            return true; // Token is valid
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        }
    }


    // Calendar endpoints
    async executeCalendarCommand(command: string) {
        try {
            const response = await this.request<{
                status: number;
                response: {
                    error?: string;
                    suggestion?: Date;
                    confirmation?: string;
                    event?: any;
                }
            }>(CALENDAR_ROUTES.command, {
                method: 'POST',
                body: JSON.stringify({ command })
            });

            if (response.status === 409) {
                throw {
                    type: 'CALENDAR_CONFLICT',
                    error: response.response.error,
                    suggestion: response.response.suggestion
                };
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    async getEvents(startDate?: Date, endDate?: Date) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<Event[]>(`${CALENDAR_ROUTES.events}${query}`);
    }

    async getEvent(eventId: string) {
        return this.request<Event>(CALENDAR_ROUTES.event(eventId));
    }

    async updateEvent(eventId: string, event: Partial<Event>) {
        return this.request<Event>(CALENDAR_ROUTES.event(eventId), {
            method: 'PUT',
            body: JSON.stringify(event)
        });
    }

    async deleteEvent(eventId: string) {
        return this.request(CALENDAR_ROUTES.event(eventId), {
            method: 'DELETE'
        });
    }


    // Chat endpoints
    async createThread(message: string) {
        return this.request<{ threadId: string; message: string }>(CHAT_ROUTES.createThread, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    async addMessage(threadId: string, message: string) {
        return this.request<{ message: string; calendarError?: { type: string; suggestion?: string; error?: string } }>(CHAT_ROUTES.messages(threadId), {
            method: 'POST',
            body: JSON.stringify({ threadId, message })
        });
    }

    async getThreads() {
        return this.request<Thread[]>(CHAT_ROUTES.threads);
    }

    async getThread(threadId: string) {
        return this.request<Thread>(CHAT_ROUTES.thread(threadId));
    }

    async logout(): Promise<void> {
        try {
            // Call backend logout endpoint
            await fetch(`${this.API_BASE}${AUTH_ROUTES.logout}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Important for cookies
            });

            // Clear local storage tokens
            localStorage.removeItem('googleCalendarTokens');
            localStorage.removeItem('token');

            // Also clear cookies on client side for redundancy
            document.cookie = 'auth_session=; Max-Age=0; path=/; domain=' + window.location.hostname;
            document.cookie = 'auth_timestamp=; Max-Age=0; path=/; domain=' + window.location.hostname;

            // Reset auth state
            this.calendarAuthWindow = null;
            this.pendingRequests = [];

            console.log('Logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error);

            // Even if server logout fails, clear local data
            localStorage.removeItem('googleCalendarTokens');
            localStorage.removeItem('token');
            document.cookie = 'auth_session=; Max-Age=0; path=/; domain=' + window.location.hostname;
            document.cookie = 'auth_timestamp=; Max-Age=0; path=/; domain=' + window.location.hostname;

            throw error;
        }
    }

    // User-related methods
    async getUserPreferences(): Promise<any> {
        return this.request<any>(USER_ROUTES.preferences);
    }

    async updateUserPreferences(preferences: any): Promise<any> {
        return this.request<any>(USER_ROUTES.preferences, {
            method: 'PUT',
            body: JSON.stringify(preferences)
        });
    }

    async getWorkingHours(): Promise<any> {
        return this.request<any>(USER_ROUTES.workingHours);
    }

    async updateWorkingHours(workingHours: any): Promise<any> {
        return this.request<any>(USER_ROUTES.workingHours, {
            method: 'PUT',
            body: JSON.stringify(workingHours)
        });
    }

    async getMeetingPreferences(): Promise<any> {
        return this.request<any>(USER_ROUTES.meetingPreferences);
    }

    async updateMeetingPreferences(preferences: any): Promise<any> {
        return this.request<any>(USER_ROUTES.meetingPreferences, {
            method: 'PUT',
            body: JSON.stringify(preferences)
        });
    }

    /** Agent endpoints */

    async getAgentStats(): Promise<AgentStats> {
        return this.request<AgentStats>(AGENT_ROUTES.stats);
    }

    async getAgentTasks(): Promise<AgentTask[]> {
        return this.request<AgentTask[]>(AGENT_ROUTES.tasks);
    }

    async getAgentInsights(): Promise<Insight[]> {
        return this.request<Insight[]>(AGENT_ROUTES.insights);
    }

    async getSuggestions(): Promise<Suggestion[]> {
        return this.request<Suggestion[]>(AGENT_ROUTES.suggestions);
    }

    async updateSuggestion(suggestionId: string, action: 'accept' | 'dismiss'): Promise<void> {
        return this.request(AGENT_ROUTES.suggestion(suggestionId), {
            method: 'PUT',
            body: JSON.stringify({ action })
        });
    }

    async queueAgentTask(task: string, priority?: number, metadata?: any): Promise<ReadableStream> {
        const response = await fetch(`${this.API_BASE}${AGENT_ROUTES.tasks}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream', // Request a streaming response
                ...(localStorage.getItem('token') && {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                })
            },
            body: JSON.stringify({ task, priority, metadata }),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to queue task');
        }

        if (!response.body) {
            throw new Error('No response body received');
        }

        return response.body;
    }

    async provideFeedback(responseId: string, feedback: {
        rating: number;
        wasHelpful: boolean;
        comments?: string;
        corrections?: string;
    }): Promise<void> {
        return this.request(`${AGENT_ROUTES.insights}/feedback/${responseId}`, {
            method: 'POST',
            body: JSON.stringify(feedback)
        });
    }

    /* Conversation API methods */
    async getConversations(): Promise<ConversationResponse[]> {
        return this.request<ConversationResponse[]>(CONVERSATION_ROUTES.conversations);
    }

    async getConversation(conversationId: string): Promise<ConversationResponse> {
        return this.request<ConversationResponse>(CONVERSATION_ROUTES.conversation(conversationId));
    }

    async getConversationByThread(threadId: string): Promise<ConversationResponse> {
        console.log(`Requesting conversation for thread ID: ${threadId} at path: ${CONVERSATION_ROUTES.byThread(threadId)}`);
        return this.request<ConversationResponse>(CONVERSATION_ROUTES.byThread(threadId));
    }

    async sendConversationMessage(message: string): Promise<any> {
        return this.request<any>(CONVERSATION_ROUTES.message, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    async streamConversationResponse(message: string): Promise<ReadableStream> {
        const response = await fetch(`${this.API_BASE}${CONVERSATION_ROUTES.stream}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('token') && {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                })
            },
            body: JSON.stringify({ message }),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to stream conversation');
        }

        if (!response.body) {
            throw new Error('No response body received');
        }

        return response.body;
    }

    async updateConversationAction(
        conversationId: string,
        actionData: {
            type: string;
            status: string;
            metadata: Record<string, any>;
        }
    ): Promise<ConversationResponse> {
        return this.request<ConversationResponse>(
            CONVERSATION_ROUTES.actions(conversationId),
            {
                method: 'POST',
                body: JSON.stringify(actionData)
            }
        );
    }

    /* Scheduling API methods */
    async getSchedulingPreferences(): Promise<UserPreferencesResponse> {
        return this.request<UserPreferencesResponse>(SCHEDULING_ROUTES.preferences);
    }

    async updateSchedulingPreferences(preferences: Partial<UserPreferencesResponse>): Promise<UserPreferencesResponse> {
        return this.request<UserPreferencesResponse>(
            SCHEDULING_ROUTES.preferences,
            {
                method: 'PUT',
                body: JSON.stringify(preferences)
            }
        );
    }

    async getSchedulingSuggestions(): Promise<SchedulingSuggestionResponse[]> {
        return this.request<SchedulingSuggestionResponse[]>(SCHEDULING_ROUTES.suggestions);
    }

    async applySchedulingSuggestion(suggestionId: string): Promise<void> {
        return this.request(
            SCHEDULING_ROUTES.suggestion(suggestionId),
            {
                method: 'POST',
                body: JSON.stringify({ action: 'apply' })
            }
        );
    }

    async dismissSchedulingSuggestion(suggestionId: string): Promise<void> {
        return this.request(
            SCHEDULING_ROUTES.suggestion(suggestionId),
            {
                method: 'POST',
                body: JSON.stringify({ action: 'dismiss' })
            }
        );
    }

    async provideSchedulingFeedback(feedback: {
        suggestionId: string;
        accepted: boolean;
        helpful: boolean;
        rating?: number;
        comments?: string;
    }): Promise<void> {
        return this.request(
            SCHEDULING_ROUTES.feedback,
            {
                method: 'POST',
                body: JSON.stringify(feedback)
            }
        );
    }

    async getFocusTimeRecommendations(date?: string): Promise<any[]> {
        const queryParams = date ? `?date=${date}` : '';
        return this.request<any[]>(`${SCHEDULING_ROUTES.focusTime}${queryParams}`);
    }

    async getProductivityPatterns(): Promise<any> {
        return this.request<any>(SCHEDULING_ROUTES.productivityPatterns);
    }

    async getSchedulingOptimizations(): Promise<any[]> {
        return this.request<any[]>(SCHEDULING_ROUTES.optimizations);
    }

    /* Feedback API methods */
    async submitFeedback(feedback: {
        type: string;
        content: string;
        rating?: number;
        source?: string;
    }): Promise<void> {
        return this.request(FEEDBACK_ROUTES.submit, {
            method: 'POST',
            body: JSON.stringify(feedback)
        });
    }

    async getFeedbackStats(): Promise<any> {
        return this.request<any>(FEEDBACK_ROUTES.stats);
    }

    /* Advanced NLP and Agent methods */
    async analyzeUserInput(input: string, context?: any): Promise<any> {
        return this.request('/agent/analyze', {
            method: 'POST',
            body: JSON.stringify({ input, context })
        });
    }

    async generateResponse(query: any): Promise<any> {
        return this.request('/agent/respond', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    }

    async extractSchedulingParameters(input: string, context?: any): Promise<any> {
        return this.request('/agent/extract', {
            method: 'POST',
            body: JSON.stringify({ input, context })
        });
    }

    async executeTask(task: {
        description: string;
        type: string;
        parameters?: Record<string, any>;
        priority?: number;
        deadline?: Date;
    }): Promise<any> {
        return this.request('/agent/execute', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    }

    async generateClarification(query: string, ambiguities: string[]): Promise<any> {
        return this.request('/agent/clarify', {
            method: 'POST',
            body: JSON.stringify({ query, ambiguities })
        });
    }


    async getAgentMemoryStats(): Promise<any> {
        return this.request('/agent/memory-stats');
    }
}

export const apiService = new ApiService();