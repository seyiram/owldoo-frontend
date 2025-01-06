

export const API_BASE_URL = 'http://localhost:3000/api';
export const CALENDAR_ROUTES = {
    createFromText: '/calendar/events/create-from-text',
    events: '/calendar/events',
    event: (id: string) => `/calendar/events/${id}`,
    availability: '/calendar/availability',
    suggestTime: '/calendar/suggest-time'
};

export const CHAT_ROUTES = {
    createThread: '/chat',
    threads: '/chat',
    thread: (id: string) => `/chat/${id}`,
    messages: (threadId: string) => `/chat/${threadId}/messages`
};