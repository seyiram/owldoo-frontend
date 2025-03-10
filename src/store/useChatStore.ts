import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
    ChatState,
    Message,
    Thread,
    ServerThread,
    MessageSender,
    Conversation,
    ServerConversation,
    ConversationIntent,
    ConversationStatus,
    ActionType,
    ActionStatus
} from '../types/chat.types';
import { apiService } from '../api/api';
import { AgentTaskResponse, ConversationResponse } from '../types/api.types';

export const useChatStore = create<ChatState>((set: (fn: (state: ChatState) => ChatState) => void, get) => ({
    threads: [] as Thread[],
    conversations: [] as Conversation[],
    currentThreadId: null,
    currentConversationId: null,
    isLoading: false,
    error: null,
    createThread: async (initialMessage: string, skipAgentTask?: boolean, useConversation?: boolean): Promise<string> => {
        set((state) => ({
            ...state, isLoading: true, error: null
        }));
        try {
            // Authentication should already be checked in the UI component
            // This prevents redundant auth checking which can cause performance issues

            // Create temp thread with properly typed message sender
            const tempThread: Thread = {
                id: uuid(),
                messages: [
                    {
                        id: uuid(),
                        sender: 'user' as MessageSender,
                        content: initialMessage,
                        timestamp: new Date().toISOString()
                    }
                ],
                createdAt: new Date().toISOString(),
            };

            set((state) => ({
                ...state,
                threads: [...state.threads, tempThread]
            }));

            // API call to create thread or conversation
            let threadId: string;
            let conversationId: string | undefined;

            try {
                // Create a new conversation without a threadId
                const response = await apiService.sendConversationMessage(
                    initialMessage,
                );

                if (response.threadId) {
                    threadId = response.threadId; // Save threadId
                    conversationId = response.conversationId; // Save conversationId

                    // Update threads list with new thread
                    set(state => ({
                        ...state,
                        threads: [{
                            id: response.threadId,
                            messages: [{
                                id: uuid(),
                                sender: 'user',
                                content: initialMessage,
                                timestamp: new Date().toISOString()
                            }],
                            createdAt: new Date().toISOString(),
                            conversationId: response.conversationId
                        }, ...state.threads],
                        currentThreadId: threadId,
                    }));
                    
                    return threadId;
                }

                throw new Error("No threadId returned from server");
            } catch (error) {
                console.error('Error creating conversation, falling back to regular thread:', error);

                try {
                    // Fall back to regular thread creation
                    console.log('Falling back to regular thread creation');
                    const response = await apiService.createThread(initialMessage);
                    console.log('Response from createThread fallback:', response);
                    threadId = response.threadId;
                } catch (fallbackError) {
                    console.error('Error in fallback thread creation:', fallbackError);
                    throw fallbackError; // Re-throw to handle at the higher level
                }
            }

            // Create bot message placeholder with empty content for streaming
            const botMessage: Message = {
                id: uuid(),
                sender: 'bot' as MessageSender,
                // If skipping agent task, set content to an indicator that lets ChatThread know it needs to queue the task
                content: skipAgentTask ? '_PENDING_AGENT_TASK_' : '',
                timestamp: new Date().toISOString(),
            };

            // Update thread with bot message and conversation ID if applicable
            set(state => {
                // First check if we already have a thread with the new threadId
                const existingThread = state.threads.find(t => t.id === threadId);

                if (existingThread) {
                    // If there's already a thread with this ID, remove the temporary thread
                    return {
                        ...state,
                        threads: state.threads
                            .filter(thread => thread.id !== tempThread.id)
                            .map(thread =>
                                thread.id === threadId ? {
                                    ...thread,
                                    conversationId,
                                    messages: [...thread.messages, botMessage]
                                } : thread
                            ),
                        currentThreadId: threadId,
                        isLoading: false
                    };
                } else {
                    // Otherwise update the temporary thread with the new ID
                    return {
                        ...state,
                        threads: state.threads.map(thread =>
                            thread.id === tempThread.id ? {
                                ...thread,
                                id: threadId,
                                conversationId, // Add conversation ID if it exists
                                messages: [...thread.messages, botMessage]
                            } : thread
                        ),
                        currentThreadId: threadId,
                        isLoading: false
                    };
                }
            });

            // Handle response based on mode
            if (skipAgentTask) {
                // Store the initial message in localStorage so ChatThread can access it
                localStorage.setItem('pendingAgentTask', initialMessage);
                localStorage.setItem('pendingAgentTaskThreadId', threadId);
            } else if (conversationId) {
                // Stream conversation response if we created a conversation
                const stream = await apiService.streamConversationResponse(initialMessage);
                const reader = stream.getReader();
                let botContent = '';

                // Update with initial text
                set(state => ({
                    ...state,
                    threads: state.threads.map(t =>
                        t.id === threadId ? {
                            ...t,
                            messages: t.messages.map(msg =>
                                msg.id === botMessage.id ? {
                                    ...msg, content: "Processing your request..."
                                } : msg
                            )
                        } : t
                    )
                }));

                // Process the stream
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Add artificial delay for more natural typing effect
                    await new Promise(resolve => setTimeout(resolve, 25));

                    // Append new chunk to bot's message
                    const newContent = new TextDecoder().decode(value);
                    botContent += newContent;

                    // Update bot's message with accumulated content
                    set(state => ({
                        ...state,
                        threads: state.threads.map(t =>
                            t.id === threadId ? {
                                ...t,
                                messages: t.messages.map(msg =>
                                    msg.id === botMessage.id ? {
                                        ...msg, content: botContent
                                    } : msg
                                )
                            } : t
                        )
                    }));
                }

                // Update conversation after response is complete
                await get().getCurrentConversation(conversationId);
            } else {
                // Regular agent task
                await get().queueAgentTask(initialMessage, threadId);
            }

            return threadId;
        } catch (error: any) {
            console.error('Error creating thread:', error);
            set((state) => ({
                ...state, isLoading: false, error: error.message
            }));
            throw new Error(error.message);
        }
    },
    sendMessage: async (content: string, threadId: string) => {
        const currentState = get();
        if (!currentState.threads.find(thread => thread.id === threadId)) {
            console.error('Thread not found:', threadId);
            return;
        }

        // Create message ID to track optimistic update
        const messageId = uuid();

        // Create optimistic message with proper typing
        const optimisticMessage: Message = {
            id: messageId,
            sender: 'user' as MessageSender,
            content,
            timestamp: new Date().toISOString()
        };

        // Update state with optimistic message
        set(state => ({
            ...state,
            threads: state.threads.map(thread => {
                if (thread.id === threadId) {
                    // Only add message if it doesn't already exist
                    const messageExists = thread.messages.some(m =>
                        m.content === content &&
                        m.sender === 'user' &&
                        // Check if message was sent within the last 5 seconds
                        new Date().getTime() - new Date(m.timestamp).getTime() < 5000
                    );

                    if (!messageExists) {
                        return {
                            ...thread,
                            messages: [...thread.messages, optimisticMessage]
                        };
                    }
                }
                return thread;
            })
        }));

        try {
            // Find if this thread is linked to a conversation
            const thread = get().threads.find(t => t.id === threadId);
            const conversation = thread?.conversationId
                ? get().conversations.find(c => c.id === thread.conversationId)
                : null;

            // If there's an associated conversation, use conversation API, otherwise use agent task
            if (conversation) {
                // Bot message placeholder for conversation response
                const botMessage: Message = {
                    id: uuid(),
                    sender: 'bot' as MessageSender,
                    content: '',
                    timestamp: new Date().toISOString(),
                };

                // Add empty bot message
                set(state => ({
                    ...state,
                    threads: state.threads.map(t =>
                        t.id === threadId ? {
                            ...t,
                            messages: [...t.messages, botMessage]
                        } : t
                    )
                }));

                // Start streaming conversation response
                try {
                    const stream = await apiService.streamConversationResponse(content);
                    const reader = stream.getReader();
                    let botContent = '';

                    // Update with initial text
                    set(state => ({
                        ...state,
                        threads: state.threads.map(t =>
                            t.id === threadId ? {
                                ...t,
                                messages: t.messages.map(msg =>
                                    msg.id === botMessage.id ? {
                                        ...msg, content: "Processing your request..."
                                    } : msg
                                )
                            } : t
                        )
                    }));

                    // Process the stream
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Add artificial delay for more natural typing effect
                        await new Promise(resolve => setTimeout(resolve, 25));

                        // Append new chunk to bot's message
                        const newContent = new TextDecoder().decode(value);
                        botContent += newContent;

                        // Update bot's message with accumulated content
                        set(state => ({
                            ...state,
                            threads: state.threads.map(t =>
                                t.id === threadId ? {
                                    ...t,
                                    messages: t.messages.map(msg =>
                                        msg.id === botMessage.id ? {
                                            ...msg, content: botContent
                                        } : msg
                                    )
                                } : t
                            )
                        }));
                    }

                    // Update conversation after response is complete
                    await get().getCurrentConversation(conversation.id);

                } catch (error) {
                    console.error('Error streaming conversation:', error);

                    // Update bot message with error
                    set(state => ({
                        ...state,
                        threads: state.threads.map(t =>
                            t.id === threadId ? {
                                ...t,
                                messages: t.messages.map(msg =>
                                    msg.id === botMessage.id ? {
                                        ...msg, content: "Sorry, I encountered an error processing your request."
                                    } : msg
                                )
                            } : t
                        )
                    }));
                }
            } else {
                // Use the original agent task approach
                const messageAdded = thread?.messages.some(m => m.id === messageId);

                if (messageAdded) {
                    await get().queueAgentTask(content, threadId);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);

            // Remove optimistic message on error
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: thread.messages.filter(m => m.id !== messageId)
                        }
                        : thread
                )
            }));
        }
    },
    queueAgentTask: async (task: string, threadId: string) => {
        const currentState = get();
        if (!currentState.threads.find(thread => thread.id === threadId)) {
            throw new Error('Thread not found');
        }

        // Create bot message placeholder with empty content
        const botMessage: Message = {
            id: uuid(),
            sender: 'bot' as MessageSender,
            content: '',
            timestamp: new Date().toISOString(),
        }

        // Update local state with empty bot message
        set(state => ({
            ...state,
            error: null,
            threads: state.threads.map(thread =>
                thread.id === threadId
                    ? {
                        ...thread,
                        messages: [...thread.messages, botMessage]
                    }
                    : thread
            ) as Thread[],
        }));

        try {
            // Add initial processing message to improve UX
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: thread.messages.map(msg =>
                                msg.id === botMessage.id
                                    ? { ...msg, content: "I'll process your request..." }
                                    : msg
                            )
                        }
                        : thread
                ) as Thread[],
            }));

            const response = await apiService.queueAgentTask(task, 1, { threadId });
            const reader = response.getReader();
            let botContent = '';

            // Start with process indicator text for all agent responses
            botContent = "Okay, let's process that task:\n";

            // Update with initial content
            set(state => ({
                ...state,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: thread.messages.map(msg =>
                                msg.id === botMessage.id
                                    ? { ...msg, content: botContent }
                                    : msg
                            )
                        }
                        : thread
                ) as Thread[],
            }));

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Add artificial delay for more natural typing effect
                await new Promise(resolve => setTimeout(resolve, 25));

                // Append new chunk to bot's message
                const newContent = new TextDecoder().decode(value);
                botContent += newContent;

                // Try to detect if this is JSON content and format it as a process
                let displayContent = botContent;

                try {
                    // Check if content is valid JSON and contains calendar event data
                    if (botContent.trim().startsWith('{') && botContent.trim().endsWith('}')) {
                        const jsonData = JSON.parse(botContent);
                        if (jsonData.action && jsonData.title) {
                            // It's a calendar event - format it as a process
                            // Note: We don't add "Okay, let's process that task" here as it's already in botContent
                            const eventAction: string = jsonData.action;
                            displayContent =
                                `I will schedule ${jsonData.title.toLowerCase()} from ${new Date(jsonData.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
                                "Here's what I'm doing:\n" +
                                "1. Understanding your request:\n" +
                                `${task}\n` +
                                "2. Parsing command details:\n" +
                                `- Type: ${eventAction}\n` +
                                `- Start: ${new Date(jsonData.startTime).toLocaleString()}\n` +
                                `- Duration: ${jsonData.duration} minutes\n` +
                                "3. Creating calendar event:\n" +
                                `- Title: ${jsonData.title}\n` +
                                `- Start: ${new Date(jsonData.startTime).toLocaleString()}\n` +
                                `- End: ${new Date(new Date(jsonData.startTime).getTime() + jsonData.duration * 60000).toLocaleString()}\n` +
                                "4. Event created successfully!";
                        }
                    }
                } catch (e) {
                    // Not valid JSON, use the original content
                    displayContent = botContent;
                }

                // Update bot's message with accumulated content
                set(state => ({
                    ...state,
                    threads: state.threads.map(thread =>
                        thread.id === threadId
                            ? {
                                ...thread,
                                messages: thread.messages.map(msg =>
                                    msg.id === botMessage.id
                                        ? { ...msg, content: displayContent }
                                        : msg
                                )
                            }
                            : thread
                    ) as Thread[],
                }));
            }
        } catch (error: any) {
            console.error('Error queuing agent task:', error);
            set(state => ({
                ...state,
                error: error.message,
                threads: state.threads.map(thread =>
                    thread.id === threadId
                        ? {
                            ...thread,
                            messages: thread.messages.map(msg =>
                                msg.id === botMessage.id
                                    ? { ...msg, content: `Error: ${error.message}` }
                                    : msg
                            )
                        }
                        : thread
                ),
            }));
        }
    },
    setCurrentThread: (threadId: string) => {
        set(state => ({ ...state, currentThreadId: threadId }));
    },

    setThreadConversation: (threadId: string, conversationId: string) => {
        set(state => ({
            ...state,
            threads: state.threads.map(thread =>
                thread.id === threadId ? { ...thread, conversationId } : thread
            ),
            currentConversationId: conversationId
        }));
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
                conversationId: thread.conversationId
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
    getConversationHistory: async () => {
        set(state => ({ ...state, isLoading: true, error: null }));
        try {
            const conversationsFromServer = await apiService.getConversations();
            const transformedConversations: Conversation[] = conversationsFromServer.map(conv => ({
                id: conv.id,
                threadId: conv.threadId,
                intent: conv.intent as ConversationIntent,
                status: conv.status as ConversationStatus,
                context: conv.context || {},
                actions: conv.actions.map((action: {
                    type: string;
                    status: string;
                    metadata?: Record<string, any>;
                    timestamp: string;
                }) => ({
                    type: action.type as ActionType,
                    status: action.status as ActionStatus,
                    metadata: action.metadata || {},
                    timestamp: action.timestamp
                })),
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt
            }));

            set(state => ({
                ...state,
                conversations: transformedConversations,
                isLoading: false
            }));
        } catch (error: any) {
            console.error('Error fetching conversation history:', error);
            set(state => ({
                ...state,
                isLoading: false,
                error: error.message
            }));
        }
    },
    getCurrentConversation: async (conversationId: string) => {
        set(state => ({ ...state, isLoading: true, error: null }));
        try {
            const conversationFromServer = await apiService.getConversation(conversationId);

            if (!conversationFromServer) {
                set(state => ({ ...state, isLoading: false }));
                return null;
            }

            const transformedConversation: Conversation = {
                id: conversationFromServer.id,
                threadId: conversationFromServer.threadId,
                intent: conversationFromServer.intent as ConversationIntent,
                status: conversationFromServer.status as ConversationStatus,
                context: conversationFromServer.context || {},
                actions: (conversationFromServer.actions || []).map((action: {
                    type: string;
                    status: string;
                    metadata?: Record<string, any>;
                    timestamp: string;
                }) => ({
                    type: action.type as ActionType,
                    status: action.status as ActionStatus,
                    metadata: action.metadata || {},
                    timestamp: action.timestamp
                })),
                createdAt: conversationFromServer.createdAt,
                updatedAt: conversationFromServer.updatedAt
            };

            set(state => ({
                ...state,
                currentConversationId: conversationId,
                conversations: [...state.conversations.filter(c => c.id !== conversationId), transformedConversation],
                isLoading: false
            }));

            return transformedConversation;
        } catch (error: any) {
            console.error('Error fetching conversation:', error);
            set(state => ({
                ...state,
                isLoading: false,
                error: error.message
            }));
            return null;
        }
    },
}));

// Add this helper function in the same file
const mapSenderType = (sender: string): MessageSender => {
    // Map server sender types to our MessageSender type
    return sender.toLowerCase() === 'user' ? 'user' : 'bot';
};