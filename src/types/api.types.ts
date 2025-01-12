export interface Event {
    id?: string;
    summary: string;
    description?: string;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: string;
    attendees?: { email: string }[];
}

export interface Thread {
    _id: string;
    messages: {
        sender: 'user' | 'bot';
        content: string;
        timestamp: string;
    }[];
    createdAt: string;
}

export interface ConflictResponse {
    error: string;
    conflicts?: Event[];
    suggestion?: string;
    originalRequest?: any;
}