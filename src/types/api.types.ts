export interface Event {
    id: string;
    summary: string;
    description?: string;
    start: {
        dateTime: string;
        timeZone?: string;
    };
    end: {
        dateTime: string;
        timeZone?: string;
    };
    location?: string;
    attendees?: Array<{
        email: string;
        responseStatus?: string;
    }>;
}

export interface Thread {
    _id: string;
    messages: Array<{
        sender: string;
        content: string;
        timestamp: string;
    }>;
    createdAt: string;
}

export interface ConflictResponse {
    type: string;
    suggestion?: string;
    error?: string;
}

export interface Suggestion {
    id: string;
    type: string;
    title: string;
    description: string;
    action: {
        type: string;
        data: any;
    };
    status: 'pending' | 'accepted' | 'dismissed' | 'executed';
    relevance: number;
    expiresAt: string;
    createdAt: string;
}

export interface AgentTaskResponse {
    message: string;
    botResponse?: string;
    processDetails?: string;
    initialResponse?: string;
    error?: string;
    success?: boolean;
}