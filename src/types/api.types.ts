export interface Event {
    id?: string;
    summary: string;
    description?: string;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: string;
    attendees?: { email: string }[];
}

export interface Thread {
    _id: string;
    messages: {
        sender: 'user' | 'bot';
        content: string;
        timestamp: string;
    }[];
    createdAt: string;
}

export interface ConflictResponse {
    error: string;
    conflicts?: Event[];
    suggestion?: string;
    originalRequest?: any;
}

export interface Suggestion {
  _id: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  action: {
    type: string;
    data: any;
  };
  status: 'pending' | 'accepted' | 'dismissed';
  relevance: number;
  expiresAt: string;
  createdAt: string;
}