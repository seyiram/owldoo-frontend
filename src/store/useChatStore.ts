import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { ChatState, Message, Thread } from '../types/chat.types';
import { apiService } from '../api/api';



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

            }))


            return threadId;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set(state => ({ ...state, error: errorMessage, isLoading: false }));
            throw error;
        }
    },
    sendMessage: async (content: string, threadId: string) => {
        const currentState = get();
        if (!currentState.threads.find(thread => thread.id === threadId)) {
            throw new Error('Thread not found');
        }

        set(state => ({ ...state, isLoading: true, error: null }));

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
            threads: state.threads.map(thread =>
                thread.id === threadId
                    ? { ...thread, messages: [...thread.messages, newMessage] }
                    : thread
            ),
        }));

        try {
            // API call
            const response = await apiService.addMessage(threadId, content);

            // Add bot response
            const botMessage: Message = {
                id: uuid(),
                sender: 'bot',
                content: response.message,
                timestamp: new Date().toISOString(),
            }



            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? { ...thread, messages: [...thread.messages, botMessage] }
                        : thread
                ),
                isLoading: false,
            }));
        } catch (error) {
            // Revert optimistic update on error
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: thread.messages.filter(msg => msg.id !== newMessage.id)
                        }
                        : thread
                ),
                error: error instanceof Error ? error.message : 'Unknown error',
                isLoading: false,
            }));
            throw error;
        }
    },
    setCurrentThread: (threadId: string) => {
        set(state => ({ ...state, currentThreadId: threadId }));
    },
    getThreadHistory: async () => {
        set(state => ({ ...state, isLoading: true, error: null }));
        try {
            const threadsFromServer = await apiService.getThreads();
            const transformedThreads = threadsFromServer.map(thread => ({
                id: thread._id,
                messages: thread.messages.map(message => ({
                    id: uuid(),
                    sender: message.sender,
                    content: message.content,
                    timestamp: message.timestamp,
                })),
                createdAt: thread.createdAt,
            }));

            set(state => ({ ...state, threads: transformedThreads, isLoading: false }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set(state => ({ ...state, error: errorMessage, isLoading: false }));
        }
    },
}));