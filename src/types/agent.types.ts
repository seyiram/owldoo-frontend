export interface AgentStats {
    eventsManaged: number;
    suggestionsGenerated: number;
    suggestionsAcceptedRate: number;
    insightsGenerated: number;
    taskDistribution: Array<{ name: string; value: number }>;
    weeklyActivity: Array<{ day: string; tasks: number; events: number }>;
    averageConfidence: number;
    accuracyRate: number;
    userSatisfaction: number;
  }
  
  export interface AgentTask {
    _id: string;
    title: string;
    description: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
  }
  
  export interface Insight {
    _id: string;
    title: string;
    description: string;
    category: string;
    actionable: boolean;
    actionLink?: string;
    timestamp: string;
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
    relevance: number;
    status: 'pending' | 'accepted' | 'dismissed' | 'executed';
    expiresAt: string;
    createdAt: string;
  }