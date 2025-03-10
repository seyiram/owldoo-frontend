import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api/api';
import { UserPreferencesResponse, SchedulingSuggestionResponse, ConversationResponse } from '../types/api.types';

// Auth & User hooks
export const useUserProfile = () => {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: () => apiService.getUserProfile()
  });
};

export const useUserPreferences = () => {
  return useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => apiService.getUserPreferences()
  });
};

export const useUpdateUserPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: any) => apiService.updateUserPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    }
  });
};

export const useWorkingHours = () => {
  return useQuery({
    queryKey: ['workingHours'],
    queryFn: () => apiService.getWorkingHours()
  });
};

export const useUpdateWorkingHours = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workingHours: any) => apiService.updateWorkingHours(workingHours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours'] });
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    }
  });
};

export const useMeetingPreferences = () => {
  return useQuery({
    queryKey: ['meetingPreferences'],
    queryFn: () => apiService.getMeetingPreferences()
  });
};

export const useUpdateMeetingPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: any) => apiService.updateMeetingPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    }
  });
};

// Calendar hooks
export const useEvents = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['events', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => apiService.getEvents(startDate, endDate)
  });
};

export const useEvent = (eventId: string) => {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiService.getEvent(eventId),
    enabled: !!eventId
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, event }: { eventId: string; event: any }) => 
      apiService.updateEvent(eventId, event),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => apiService.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });
};

// Chat hooks
export const useThreads = () => {
  return useQuery({
    queryKey: ['threads'],
    queryFn: () => apiService.getThreads()
  });
};

export const useThread = (threadId: string) => {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => apiService.getThread(threadId),
    enabled: !!threadId
  });
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => apiService.createThread(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    }
  });
};

export const useAddMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, message }: { threadId: string; message: string }) => 
      apiService.addMessage(threadId, message),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['thread', variables.threadId] });
    }
  });
};

// Conversation hooks
export const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiService.getConversations()
  });
};

export const useConversation = (conversationId: string) => {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => apiService.getConversation(conversationId),
    enabled: !!conversationId
  });
};

export const useConversationByThread = (threadId: string) => {
  return useQuery({
    queryKey: ['conversationByThread', threadId],
    queryFn: () => apiService.getConversationByThread(threadId),
    enabled: !!threadId
  });
};

export const useSendConversationMessage = () => {
  return useMutation({
    mutationFn: (message: string) => apiService.sendConversationMessage(message)
  });
};

export const useUpdateConversationAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ 
      conversationId, 
      actionData 
    }: { 
      conversationId: string; 
      actionData: {
        type: string;
        status: string;
        metadata: Record<string, any>;
      } 
    }) => apiService.updateConversationAction(conversationId, actionData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });
};

// Agent hooks
export const useAgentStats = () => {
  return useQuery({
    queryKey: ['agentStats'],
    queryFn: () => apiService.getAgentStats()
  });
};

export const useAgentTasks = () => {
  return useQuery({
    queryKey: ['agentTasks'],
    queryFn: () => apiService.getAgentTasks()
  });
};

export const useAgentInsights = () => {
  return useQuery({
    queryKey: ['agentInsights'],
    queryFn: () => apiService.getAgentInsights()
  });
};

export const useSuggestions = () => {
  return useQuery({
    queryKey: ['suggestions'],
    queryFn: () => apiService.getSuggestions()
  });
};

export const useUpdateSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, action }: { suggestionId: string; action: 'accept' | 'dismiss' }) => 
      apiService.updateSuggestion(suggestionId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    }
  });
};

export const useQueueAgentTask = () => {
  return useMutation({
    mutationFn: ({ task, priority, metadata }: { task: string; priority?: number; metadata?: any }) => 
      apiService.queueAgentTask(task, priority, metadata)
  });
};

export const useProvideFeedback = () => {
  return useMutation({
    mutationFn: ({ 
      responseId, 
      feedback 
    }: { 
      responseId: string; 
      feedback: {
        rating: number;
        wasHelpful: boolean;
        comments?: string;
        corrections?: string;
      } 
    }) => apiService.provideFeedback(responseId, feedback)
  });
};

// Scheduling hooks
export const useSchedulingPreferences = () => {
  return useQuery<UserPreferencesResponse>({
    queryKey: ['schedulingPreferences'],
    queryFn: () => apiService.getSchedulingPreferences()
  });
};

export const useUpdateSchedulingPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Partial<UserPreferencesResponse>) => 
      apiService.updateSchedulingPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulingPreferences'] });
    }
  });
};

export const useSchedulingSuggestions = () => {
  return useQuery<SchedulingSuggestionResponse[]>({
    queryKey: ['schedulingSuggestions'],
    queryFn: () => apiService.getSchedulingSuggestions()
  });
};

export const useApplySchedulingSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => apiService.applySchedulingSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulingSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });
};

export const useDismissSchedulingSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => apiService.dismissSchedulingSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulingSuggestions'] });
    }
  });
};

export const useProvideSchedulingFeedback = () => {
  return useMutation({
    mutationFn: (feedback: {
      suggestionId: string;
      accepted: boolean;
      helpful: boolean;
      rating?: number;
      comments?: string;
    }) => apiService.provideSchedulingFeedback(feedback)
  });
};

export const useFocusTimeRecommendations = (date?: string) => {
  return useQuery({
    queryKey: ['focusTimeRecommendations', date],
    queryFn: () => apiService.getFocusTimeRecommendations(date)
  });
};

export const useProductivityPatterns = () => {
  return useQuery({
    queryKey: ['productivityPatterns'],
    queryFn: () => apiService.getProductivityPatterns()
  });
};

export const useSchedulingOptimizations = () => {
  return useQuery({
    queryKey: ['schedulingOptimizations'],
    queryFn: () => apiService.getSchedulingOptimizations()
  });
};

// Feedback hooks
export const useSubmitFeedback = () => {
  return useMutation({
    mutationFn: (feedback: {
      type: string;
      content: string;
      rating?: number;
      source?: string;
    }) => apiService.submitFeedback(feedback)
  });
};

export const useFeedbackStats = () => {
  return useQuery({
    queryKey: ['feedbackStats'],
    queryFn: () => apiService.getFeedbackStats()
  });
};