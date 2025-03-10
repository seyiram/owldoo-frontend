export interface Event {
    id: string;
    summary: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string; // For all-day events
        timeZone?: string;
    };
    end: {
        dateTime?: string;
        date?: string; // For all-day events
        timeZone?: string;
    };
    location?: string;
    attendees?: Array<{
        email: string;
        responseStatus?: string;
    }>;
    meetingType?: string; // Added for ML scheduling
    bufferBefore?: number; // In minutes
    bufferAfter?: number;  // In minutes
    // New fields for our edge case handling
    isAllDay?: boolean;
    isMultiDay?: boolean;
    isOvernightEvent?: boolean;
    context?: {
        flags?: {
            isAllDay?: boolean;
            isMultiDay?: boolean;
        }
    };
}

export interface Thread {
    _id: string;
    messages: Array<{
        sender: string;
        content: string;
        timestamp: string;
    }>;
    createdAt: string;
    conversationId?: string;
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

export interface ConversationResponse {
    id: string;
    threadId: string;
    intent: string;
    status: string;
    context: Record<string, any>;
    actions: Array<{
        type: string;
        status: string;
        metadata: Record<string, any>;
        timestamp: string;
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface UserPreferencesResponse {
    workingHours: Array<{
        day: string;
        timeRanges: Array<{
            start: string;
            end: string;
        }>;
    }>;
    defaultMeetingDuration: number;
    defaultBuffer: number;
    meetingPreferences: Array<{
        type: string;
        defaultDuration: number;
        bufferBefore: number;
        bufferAfter: number;
    }>;
    focusTimePreferences: {
        minimumDuration: number;
        preferredDays: string[];
        preferredHours: Array<{
            start: string;
            end: string;
        }>;
    };
    productivityPatterns: {
        mostProductiveHours: Array<{
            start: string;
            end: string;
        }>;
        leastProductiveHours: Array<{
            start: string;
            end: string;
        }>;
        focusTimeNeededDaily: number;
    };
}

export interface SchedulingSuggestionResponse {
    id: string;
    type: string;
    eventId?: string;
    suggestedTime?: string;
    suggestedDuration?: number;
    reason: string;
    applied: boolean;
    createdAt: string;
}