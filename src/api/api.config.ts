export const API_BASE_URL = 'http://localhost:3000/api';
export const CALENDAR_ROUTES = {
    createFromText: '/calendar/events/create-from-text',
    events: '/calendar/events',
    event: (id: string) => `/calendar/events/${id}`,
    availability: '/calendar/availability',
    suggestTime: '/calendar/suggest-time'
};

export const THREAD_ROUTES = {
    threads: '/threads/threads',
    thread: (id: string) => `/threads/threads/${id}`,
    messages: '/threads/messages'
};