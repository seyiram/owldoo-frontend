export const API_BASE_URL = 'http://localhost:3000/api';
export const CALENDAR_ROUTES = {
    // Auth routes
    authUrl: '/calendar/auth/url',
    authStatus: '/calendar/auth/status',
    authCallback: '/calendar/auth/callback',
    userProfile: '/calendar/profile',
    logout: '/auth/logout',

    // Main command endpoint
    command: '/calendar/command',

    events: '/calendar/events',
    event: (id: string) => `/calendar/events/${id}`,
};

export const CHAT_ROUTES = {
    createThread: '/chat/threads',
    threads: '/chat/threads',
    thread: (id: string) => `/chat/threads/${id}`,
    messages: (threadId: string) => `/chat/threads/${threadId}/messages`,
    stream: (threadId: string) => `/chat/threads/${threadId}/stream`
};

export const AGENT_ROUTES = {
    stats: '/agent/stats',
    tasks: '/agent/tasks',
    insights: '/agent/insights',
    suggestions: '/agent/suggestions',
    suggestion: (id: string) => `/agent/suggestions/${id}`
};