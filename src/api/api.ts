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
        if (event.data.type === 'CALENDAR_AUTH_SUCCESS') {
            if (this.calendarAuthWindow) {
                this.calendarAuthWindow.close();
                this.calendarAuthWindow = null;
            }
            // Retry any pending requests
            this.retryPendingRequests();
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
            if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
                await this.initiateCalendarAuth();
                throw new Error('Calendar authentication required');
            }
            throw error;
        }
    }

    async initiateCalendarAuth() {
        try {
            const response = await fetch(`${this.baseURL}${CALENDAR_ROUTES.authUrl}`);
            const data = await response.json();

            // Open auth window
            this.calendarAuthWindow = window.open(
                data.url,
                'CalendarAuth',
                'width=600,height=600'
            );
            return data;
        } catch (error) {
            console.error('Failed to initiate calendar auth:', error);
            throw new Error('Failed to authenticate with calendar');
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
}

export const apiService = new ApiService();