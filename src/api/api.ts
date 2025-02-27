import { API_BASE_URL, CALENDAR_ROUTES, CHAT_ROUTES } from "./api.config";
import { Event, Thread, ConflictResponse } from "../types/api.types";



class ApiService {
    private baseURL: string;
    private calendarAuthWindow: Window | null = null;

    constructor() {
        this.baseURL = API_BASE_URL || 'http://localhost:3000/api';

        // Listen for auth callback
        window.addEventListener('message', this.handleAuthMessage);
    }

    private handleAuthMessage = (event: MessageEvent) => {
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

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(options?.headers || {})
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers
            });

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
                throw new Error(errorData.error || 'An error occurred');
            }

            if (response.status === 204) {
                return {} as T;
            }

            return response.json();
        } catch (error) {
            if (error instanceof Error && error.message === 'AUTH_REQUIRED`q    ') {
                await this.initiateCalendarAuth();
                throw new Error('Calendar authentication required');
            }
            throw error;
        }
    }

    async initiateCalendarAuth(): Promise<{ url: string }> {
        try {
            // Close any existing auth window
            if (this.calendarAuthWindow && !this.calendarAuthWindow.closed) {
                this.calendarAuthWindow.close();
            }

            console.log("Requesting auth URL from:", `${this.baseURL}${CALENDAR_ROUTES.authUrl}`);

            const response = await fetch(`${this.baseURL}${CALENDAR_ROUTES.authUrl}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Check HTTP status
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Auth URL response error:", response.status, errorText);
                throw new Error(`Failed to get auth URL: ${response.status}`);
            }

            const data = await response.json();
            console.log("Auth URL received:", data.url);

            // Open auth window with specific features
            this.calendarAuthWindow = window.open(
                data.url,
                'CalendarAuth',
                'width=600,height=600,resizable=yes,scrollbars=yes,status=yes'
            );

            if (!this.calendarAuthWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }

           // Promise that resolves when auth is complete
        return new Promise((resolve, reject) => {
            // To increase timeout to 5 minutes (300000ms)
            const authTimeout = setTimeout(() => {
                // check auth status one more time
                this.checkCalendarAuth().then(isAuthenticated => {
                    if (isAuthenticated) {
                        console.log("Auth timeout reached but user is authenticated");
                        resolve(data);
                    } else {
                        console.error("Authentication timed out and user is not authenticated");
                        reject(new Error('Authentication timed out'));
                    }
                }).catch(err => {
                    console.error("Error checking auth status after timeout:", err);
                    reject(new Error('Authentication timed out'));
                });
            }, 300000); // 30 seconds for faster feedback

                const messageHandler = (event: MessageEvent) => {
                    console.log("Auth message received:", event.data);
                    // Accept messages from both the API domain and the frontend domain
                    const allowedOrigins = [window.location.origin, 'http://localhost:3000', 'http://localhost:5173'];
                    if (!allowedOrigins.includes(event.origin)) {
                        console.log("Ignoring message from different origin:", event.origin);
                        return;
                    }

                    if (event.data.type === 'CALENDAR_AUTH_SUCCESS') {
                        clearTimeout(authTimeout);
                        window.removeEventListener('message', messageHandler);
                        console.log("Auth success, storing tokens");
                        localStorage.setItem('googleCalendarTokens', JSON.stringify(event.data.tokens));
                        if (this.calendarAuthWindow) {
                            this.calendarAuthWindow.close();
                            this.calendarAuthWindow = null;
                        }
                        this.retryPendingRequests();
                        resolve(data);
                    } else if (event.data.type === 'CALENDAR_AUTH_ERROR') {
                        clearTimeout(authTimeout);
                        window.removeEventListener('message', messageHandler);
                        console.error("Auth error:", event.data.error);
                        if (this.calendarAuthWindow) {
                            this.calendarAuthWindow.close();
                            this.calendarAuthWindow = null;
                        }
                        reject(new Error(event.data.error || 'Authentication failed'));
                    }
                };

                window.addEventListener('message', messageHandler);
            });
        } catch (error) {
            console.error('Failed to initiate calendar auth:', error);
            throw error;
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
            const response = await fetch(`${this.baseURL}${CALENDAR_ROUTES.authStatus}`);
            const { isAuthenticated } = await response.json();
            return isAuthenticated;
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
        return this.request<Event>(`${CALENDAR_ROUTES.event}/${eventId}`);
    }

    async updateEvent(eventId: string, event: Partial<Event>) {
        return this.request<Event>(`${CALENDAR_ROUTES.event}/${eventId}`, {
            method: 'PUT',
            body: JSON.stringify(event)
        });
    }

    async deleteEvent(eventId: string) {
        return this.request(`${CALENDAR_ROUTES.event}/${eventId}`, {
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
            await fetch(`${this.baseURL}${CALENDAR_ROUTES.logout}`, {
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


}

export const apiService = new ApiService();