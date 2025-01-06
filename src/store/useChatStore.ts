import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { ChatState, Message, Thread } from '../types/chat.types';

const API_BASE_URL = 'http://localhost:3000/api';

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

            // Send to backend
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: initialMessage }),
            });
            if (!response.ok) throw new Error('Failed to create thread');
            const { threadId, message: botResponse } = await response.json();

            const newThread: Thread = {
                id: threadId,
                messages: [
                    {
                        id: uuid(),
                        sender: 'user',
                        content: initialMessage,
                        timestamp: new Date().toISOString()
                    },
                    {
                        id: uuid(),
                        sender: 'bot',
                        content: botResponse,
                        timestamp: new Date().toISOString(),
                    }
                ],
                createdAt: new Date().toISOString(),
            };
            set(state => ({
                ...state,
                threads: [...state.threads, newThread],
                currentThreadId: threadId,
                isLoading: false,
            }));
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
        try {
            const newMessage: Message = {
                id: uuid(),
                sender: 'user',
                content,
                timestamp: new Date().toISOString(),
            };
            // Update local state immediately with user message
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? { ...thread, messages: [...thread.messages, newMessage] }
                        : thread
                ),
            }));
            // Send to backend
            const response = await fetch(`${API_BASE_URL}/chat/${threadId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content }),
            });
            if (!response.ok) throw new Error('Failed to send message');
            const { message: botResponse } = await response.json();

            // Add bot response
            const botMessage: Message = {
                id: uuid(),
                sender: 'bot',
                content: botResponse,
                timestamp: new Date().toISOString(),
            };
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
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set(state => ({ ...state, error: errorMessage, isLoading: false }));
            throw error;
        }
    },
    setCurrentThread: (threadId: string) => {
        set(state => ({ ...state, currentThreadId: threadId }));
    },
    getThreadHistory: async () => {
        set(state => ({ ...state, isLoading: true, error: null }));
        try {
            const response = await fetch(`${API_BASE_URL}/chat`);
            if (!response.ok) throw new Error('Failed to fetch thread history');

            const threads = await response.json();
            set(state => ({ ...state, threads, isLoading: false }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set(state => ({ ...state, error: errorMessage, isLoading: false }));
        }
    },
}));