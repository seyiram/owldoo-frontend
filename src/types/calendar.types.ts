// src/types/calendar.types.ts
export interface Event {
    id?: string;
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
    attendees?: { email: string }[];
    // Add new fields to support all-day events and multi-day events
    isAllDay?: boolean;
    isMultiDay?: boolean;
    isOvernightEvent?: boolean; // For events that cross midnight
}

export interface CreateEventRequest {
    title: string;
    description?: string;
    startTime: Date | string;
    duration: number;
    location?: string;
    attendees?: string[];
    isRecurring?: boolean;
    recurringPattern?: string;
    videoConference?: boolean;
    isAllDay?: boolean;
    isMultiDay?: boolean;
    timeZone?: string;
    context?: {
        flags?: {
            isAllDay?: boolean;
            isMultiDay?: boolean;
        }
    };
}