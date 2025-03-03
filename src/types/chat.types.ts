export interface Message {
export type MessageSender = 'user' | 'bot';

export interface Message {
    id: string;
    sender: MessageSender;
    content: string;
    timestamp: string;
}

export interface Thread {
    id: string;
    messages: Message[];
    createdAt: string;
}

export interface ChatState {
    threads: Thread[];
    currentThreadId: string | null;
    isLoading: boolean;
    error: string | null;
}

// Add server response types
export interface ServerMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
}

export interface ServerThread {
    _id: string;
    messages: ServerMessage[];
    createdAt: string;
}
    id: string;
    sender: 'user' | 'bot';
    content: string;
    timestamp: string;
    hasConflict?: boolean;
}

export interface Thread {
    id: string;
    messages: Message[];
    title?: string;
    createdAt: string;
}

export interface ChatState {
    threads: Thread[];
    currentThreadId: string | null;
    isLoading: boolean;
    error: string | null;
    createThread: (initialMessage: string) => Promise<string>;
    sendMessage: (content: string, threadId: string) => Promise<void>;
    queueAgentTask: (task: string, threadId: string) => Promise<void>;
    setCurrentThread: (threadId: string) => void;
    getThreadHistory: () => Promise<void>;
}