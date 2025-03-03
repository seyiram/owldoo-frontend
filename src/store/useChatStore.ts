import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { ChatState, Message, Thread, ServerThread, MessageSender } from '../types/chat.types';
import { apiService } from '../api/api';
import { AgentTaskResponse } from '../types/api.types';

export const useChatStore = create<ChatState>((set: (fn: (state: ChatState) => ChatState) => void, get) => ({
    threads: [],
    currentThreadId: null,
    isLoading: false,
    error: null,
    createThread: async (initialMessage: string) => {
        set((state) => ({
            ...state, isLoading: true, error: null
        }));
        try {
            // check calendar first
            try {
                const calendarStatus = await apiService.checkCalendarAuth();
                if (!calendarStatus) {
                    throw new Error('Calendar authentication required');
                }
            } catch (error: any) {
                console.error('Calendar check failed:', error);
                throw new Error('Failed to check calendar status');
            }

            // If no calendar conflicts, create thread
            // optimistically add user message
            const tempThread: Thread = {
                id: uuid(),
                messages: [
                    {
                        id: uuid(),
                        sender: 'user',
                        content: initialMessage,
                        timestamp: new Date().toISOString()
                    }
                ],
                createdAt: new Date().toISOString(),
            }

            set((state) => ({
                ...state, threads: [...state.threads, tempThread]
            }));

            // API call
            const response = await apiService.createThread(initialMessage);
            const { threadId, message: botResponse } = response;

            // Update with real threadId and bot response
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === tempThread.id ? {
                        ...thread,
                        id: threadId,
                        messages: [
                            ...thread.messages,
                            {
                                id: uuid(),
                                sender: 'bot',
                                content: botResponse,
                                timestamp: new Date().toISOString(),
                            }
                        ]
                    } : thread
                ),
                currentThreadId: threadId,
                isLoading: false
            }));

            return threadId;
        } catch (error: any) {
            console.error('Error creating thread:', error);
            set((state) => ({
                ...state, isLoading: false, error: error.message
            }));
            throw new Error(error.message); // Ensure a string is always returned
        }
    },
    sendMessage: async (content: string, threadId: string) => {
        const currentState = get();
        if (!currentState.threads.find(thread => thread.id === threadId)) {
            throw new Error('Thread not found');
        }

        // Create optimistic message
        const newMessage: Message = {
            id: uuid(),
            sender: 'user',
            content,
            timestamp: new Date().toISOString(),
        }

        // Update local state immediately with user message
        set(state => ({
            ...state,
            error: null,
            threads: state.threads.map(thread =>
                thread.id === threadId
                    ? { ...thread, messages: [...thread.messages, newMessage] }
                    : thread
            ),
        }));

        try {
            const response = await apiService.addMessage(threadId, content);
            const { message: botResponse, calendarError } = response;

            if (calendarError) {
                console.error('Calendar error:', calendarError);
                throw new Error(calendarError.error || 'Calendar conflict detected');
            }

            // Update with bot response
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: [
                                ...thread.messages,
                                {
                                    id: uuid(),
                                    sender: 'bot',
                                    content: botResponse,
                                    timestamp: new Date().toISOString(),
                                }
                            ]
                        }
                        : thread
                ),
            }));
        } catch (error: any) {
            console.error('Error sending message:', error);
            set(state => ({
                ...state,
                error: error.message
            }));
        }
    },
    queueAgentTask: async (task: string, threadId: string) => {
        const currentState = get();
        if (!currentState.threads.find(thread => thread.id === threadId)) {
            throw new Error('Thread not found');
        }

        // Create optimistic message
        const newMessage: Message = {
            id: uuid(),
            sender: 'user',
            content: task,
            timestamp: new Date().toISOString(),
        }

        // Update local state immediately with user message
        set(state => ({
            ...state,
            error: null,
            threads: state.threads.map(thread =>
                thread.id === threadId
                    ? { ...thread, messages: [...thread.messages, newMessage] }
                    : thread
            ),
        }));

        try {
            console.log('Queuing agent task:', { task, threadId });
            const response: AgentTaskResponse = await apiService.queueAgentTask(task, 1, { threadId });
            console.log('Agent task response:', response);

            // Combine responses to show both initial understanding and action details
            const botResponse = response.initialResponse 
                ? `${response.initialResponse}\n\n${response.processDetails || ''}`
                : response.processDetails || response.message || 'No response from agent';

            // Update with bot response
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: [
                                ...thread.messages,
                                {
                                    id: uuid(),
                                    sender: 'bot',
                                    content: botResponse,
                                    timestamp: new Date().toISOString(),
                                }
                            ]
                        }
                        : thread
                ),
            }));
        } catch (error: any) {
            console.error('Error queuing agent task:', error);
            set(state => ({
                ...state,
                error: error.message,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: [
                                ...thread.messages,
                                {
                                    id: uuid(),
                                    sender: 'bot',
                                    content: `Error: ${error.message}`,
                                    timestamp: new Date().toISOString(),
                                }
                            ]
                        }
                        : thread
                ),
            }));
        }
    },
    setCurrentThread: (threadId: string) => {
        set(state => ({ ...state, currentThreadId: threadId }));
    },
    getThreadHistory: async () => {
        set(state => ({ ...state, isLoading: true, error: null }));
        try {
            const threadsFromServer = await apiService.getThreads();
            const transformedThreads: Thread[] = threadsFromServer.map(thread => ({
                id: thread._id,
                messages: thread.messages.map(message => ({
                    id: uuid(),
                    sender: mapSenderType(message.sender),
                    content: message.content,
                    timestamp: message.timestamp,
                })),
                createdAt: thread.createdAt,
            }));

            set(state => ({ ...state, threads: transformedThreads, isLoading: false }));
        } catch (error: any) {
            console.error('Error fetching thread history:', error);
            set(state => ({
                ...state,
                isLoading: false,
                error: error.message
            }));
        }
    },
}));

// Add this helper function in the same file
const mapSenderType = (sender: string): MessageSender => {
    // Map server sender types to our MessageSender type
    return sender.toLowerCase() === 'user' ? 'user' : 'bot';
};