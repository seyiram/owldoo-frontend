

export const API_BASE_URL = 'http://localhost:3000/api';
export const CALENDAR_ROUTES = {
    // Auth routes
    authUrl: '/calendar/auth/url',
    authStatus: 'calendar/auth/status',
    authCallback: '/calendar/auth/callback',

    // Main command endpoint
    command: '/calendar/command',

    events: '/calendar/events',
    event: (id: string) => `/calendar/events/${id}`,
};

export const CHAT_ROUTES = {
    createThread: '/chat',
    threads: '/chat',
    thread: (id: string) => `/chat/${id}`,
    messages: (threadId: string) => `/chat/${threadId}/messages`
};