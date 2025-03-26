// Use relative URL to work with Vite proxy
export const API_BASE_URL = '/api';

// Auth routes
export const AUTH_ROUTES = {
    googleConnect: '/auth/google/connect',
    googleCallback: '/auth/google/callback',
    logout: '/auth/logout',
    status: '/auth/status'
};

// User routes
export const USER_ROUTES = {
    profile: '/users/profile',
    preferences: '/users/preferences',
    workingHours: '/users/working-hours',
    meetingPreferences: '/users/meeting-preferences',
    account: '/users/account'
};

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
    thread: (id: string) => `/chat/${id}`, // Fixed: changed from '/chat/threads/${id}' to match backend route
    messages: (threadId: string) => `/chat/${threadId}/messages`, // Fixed: similar update for consistency
    stream: (threadId: string) => `/chat/${threadId}/stream` // Fixed: similar update for consistency
};

export const CONVERSATION_ROUTES = {
    conversations: '/conversation',
    conversation: (id: string) => `/conversation/${id}`,
    message: '/conversation/message',
    stream: '/conversation/stream',
    byThread: (threadId: string) => `/conversation/thread/${threadId}`,
    actions: (conversationId: string) => `/conversation/${conversationId}/actions`,
};

export const AGENT_ROUTES = {
    stats: '/agent/stats',
    tasks: '/agent/tasks',
    insights: '/agent/insights',
    suggestions: '/agent/suggestions',
    suggestion: (id: string) => `/agent/suggestions/${id}`
};

export const SCHEDULING_ROUTES = {
    preferences: '/scheduling/preferences',
    optimizations: '/scheduling/optimizations',
    suggestions: '/scheduling/suggestions',
    suggestion: (id: string) => `/scheduling/suggestions/${id}`,
    feedback: '/scheduling/feedback',
    focusTime: '/scheduling/focus-time',
    bufferTime: '/scheduling/buffer-time',
    meetingTypes: '/scheduling/meeting-types',
    productivityPatterns: '/scheduling/productivity',
};

export const FEEDBACK_ROUTES = {
    submit: '/feedback',
    stats: '/feedback/stats'
};