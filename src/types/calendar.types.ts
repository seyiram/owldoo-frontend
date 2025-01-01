// src/types/calendar.types.ts
export interface Event {
    id?: string;
    summary: string;
    description?: string;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: string;
    attendees?: { email: string }[];
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
}