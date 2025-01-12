export interface Message {
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
   setCurrentThread: (threadId: string) => void;
   getThreadHistory: () => Promise<void>;
  }