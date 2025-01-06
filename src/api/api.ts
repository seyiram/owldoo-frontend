import { API_BASE_URL, CALENDAR_ROUTES, CHAT_ROUTES } from "./api.config";


// Types
interface Event {
    id?: string;
    summary: string;
    description?: string;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: string;
    attendees?: { email: string }[];
}

interface Thread {
    _id: string;
    messages: {
        sender: 'user' | 'bot';
        content: string;
        timestamp: string;
    }[];
    createdAt: string;
}

class ApiService {
    private baseURL: string;

    constructor() {
        this.baseURL = API_BASE_URL || 'http://localhost:3000/api';
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(options?.headers || {})
        };

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'An error occurred');
        }

        // For DELETE requests or other requests that might not return content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // Calendar endpoints
    async createEventFromText(command: string) {
        return this.request(CALENDAR_ROUTES.createFromText, {
            method: 'POST',
            body: JSON.stringify({ command })
        });
    }

    async createEvent(event: Event) {
        return this.request<Event>(CALENDAR_ROUTES.events, {
            method: 'POST',
            body: JSON.stringify(event)
        });
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

    async checkAvailability(startTime: Date, endTime: Date) {
        const params = new URLSearchParams({
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
        });

        return this.request<{ available: boolean }>(`${CALENDAR_ROUTES.availability}?${params}`);
    }

    async suggestAlternativeTime(startTime: Date, duration: number) {
        const params = new URLSearchParams({
            startTime: startTime.toISOString(),
            duration: duration.toString()
        });

        return this.request<{ suggestion: Date | null }>(`${CALENDAR_ROUTES.suggestTime}?${params}`);
    }

    // Chat endpoints
    async createThread(message: string) {
        return this.request<{ threadId: string; message: string }>(CHAT_ROUTES.createThread, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
    }

    async addMessage(threadId: string, message: string) {
        return this.request<{ message: string }>(CHAT_ROUTES.messages(threadId), {
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