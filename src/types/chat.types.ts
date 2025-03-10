export type MessageSender = 'user' | 'bot';

export interface Message {
    id: string;
    sender: MessageSender;
    content: string;
    timestamp: string;
    hasConflict?: boolean;
}

export interface Thread {
    id: string;
    messages: Message[];
    title?: string;
    createdAt: string;
    conversationId?: string; // Link to conversation if part of a structured conversation
}

export type ConversationIntent = 
  | 'schedule_event' 
  | 'reschedule_event' 
  | 'check_availability' 
  | 'find_focus_time' 
  | 'optimize_schedule' 
  | 'general_inquiry'
  | 'unknown';

export type ConversationStatus = 
  | 'active' 
  | 'completed' 
  | 'failed';

export type ActionType = 
  | 'create_event' 
  | 'update_event' 
  | 'delete_event' 
  | 'suggest_time' 
  | 'optimize_schedule' 
  | 'find_focus_time';

export type ActionStatus = 
  | 'pending' 
  | 'completed' 
  | 'failed';

export interface ConversationAction {
  type: ActionType;
  status: ActionStatus;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface Conversation {
  id: string;
  threadId: string;
  intent: ConversationIntent;
  status: ConversationStatus;
  context: Record<string, any>;
  actions: ConversationAction[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatState {
    threads: Thread[];
    conversations: Conversation[];
    currentThreadId: string | null;
    currentConversationId: string | null;
    isLoading: boolean;
    error: string | null;
    createThread: (initialMessage: string, skipAgentTask?: boolean, useConversation?: boolean) => Promise<string>;
    sendMessage: (content: string, threadId: string) => Promise<void>;
    queueAgentTask: (task: string, threadId: string) => Promise<void>;
    setCurrentThread: (threadId: string) => void;
    setThreadConversation: (threadId: string, conversationId: string) => void;
    getThreadHistory: () => Promise<void>;
    getConversationHistory: () => Promise<void>;
    getCurrentConversation: (conversationId: string) => Promise<Conversation | null>;
}

// Server response types
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
    conversationId?: string;
}

export interface ServerConversation {
    _id: string;
    threadId: string;
    intent: ConversationIntent;
    status: ConversationStatus;
    context: Record<string, any>;
    actions: ConversationAction[];
    createdAt: string;
    updatedAt: string;
}