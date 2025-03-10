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
    private readonly API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    private readonly CALENDAR_BASE = `http://localhost:3000/calendar`; // Keep calendar routes at root level
    private calendarAuthWindow: Window | null = null;

    constructor() {
        // Listen for auth callback
        window.addEventListener('message', this.handleAuthMessage);
    }

    private handleAuthMessage = (event: MessageEvent) => {
        // Only process messages with a type field that matches our auth flow
        if (!event.data || !event.data.type ||
            !['CALENDAR_AUTH_SUCCESS', 'CALENDAR_AUTH_ERROR'].includes(event.data.type)) {
            return;
        }

        console.log("Auth message received:", event.data);

        // Accept messages from both the API domain and the frontend domain
        const allowedOrigins = [window.location.origin, 'http://localhost:3000', 'http://localhost:5173'];
        if (!allowedOrigins.includes(event.origin)) {
            console.log("Ignoring message from different origin:", event.origin);
            return;
        }

        if (event.data.type === 'CALENDAR_AUTH_SUCCESS') {
            console.log("Auth success in handleAuthMessage, storing tokens");
            localStorage.setItem('googleCalendarTokens', JSON.stringify(event.data.tokens));
            if (this.calendarAuthWindow) {
                this.calendarAuthWindow.close();
                this.calendarAuthWindow = null;
            }
            // Retry any pending requests
            this.retryPendingRequests();
        } else if (event.data.type === 'CALENDAR_AUTH_ERROR') {
            console.error("Auth error in handleAuthMessage:", event.data.error);
            if (this.calendarAuthWindow) {
                this.calendarAuthWindow.close();
                this.calendarAuthWindow = null;
            }
        }
    };

    private pendingRequests: (() => Promise<any>)[] = [];

    private async getAuthHeaders(): Promise<Headers> {
        // Instead of getting access token, just check auth status
        const isAuthenticated = await useAuthStore.getState().checkAuthStatus();

        return new Headers({
            'Content-Type': 'application/json',
            // No Authorization header needed since we're using Google's OAuth
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
                    ...options?.headers // Use optional chaining here
                },
                credentials: 'include' // Important for OAuth cookies
            });

            if (response.status === 401) {
                // Trigger re-authentication
                await useAuthStore.getState().checkAuthStatus();
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

    // Add refresh token endpoint
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
        const headers = await this.getAuthHeaders();

        console.log(`Making request to ${endpoint} with options:`, options);

        const response = await fetch(`${this.API_BASE}${endpoint}`, {
            ...options,
            headers: {
                ...options?.headers ?? {},
                ...Object.fromEntries(headers)
            },
            credentials: 'include'
        });

        console.log(`Response status: ${response.status}`);

        if (response.status === 401 && response.headers.get('X-Calendar-Auth-Required')) {
            // Store the request to retry later
            const retryRequest = () => this.request<T>(endpoint, options);
            this.pendingRequests.push(retryRequest);

            // Trigger calendar auth
            await this.initiateCalendarAuth();
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

    async initiateCalendarAuth(): Promise<void> {
        try {
            const response = await fetch(`${this.CALENDAR_BASE}/auth/url`);
            if (!response.ok) throw new Error(`Failed to get auth URL: ${response.status}`);
            const { url } = await response.json();
            
            // Open the auth window
            window.open(url, 'googleAuth', 'width=500,height=600');
        } catch (error) {
            console.error('Auth URL response error:', error);
            throw new Error(`Failed to get auth URL: ${error instanceof Error ? error.message : error}`);
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
        try {
            const response = await fetch(`${this.CALENDAR_BASE}/auth/status`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Auth check failed');
            const data = await response.json();
            return data.isAuthenticated;
        } catch (error) {
            console.error('Failed to check calendar auth status:', error);
            return false;
        }
    }

    async getUserProfile() {
        return this.request<{ name: string; email: string | null }>(CALENDAR_ROUTES.userProfile, {
            method: 'GET'
        });
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
            await fetch(`${this.API_BASE}${AUTH_ROUTES.logout}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Clear local storage tokens
            localStorage.removeItem('googleCalendarTokens');
            localStorage.removeItem('token');

            // Reset auth state
            this.calendarAuthWindow = null;
            this.pendingRequests = [];

            console.log('Logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error);
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