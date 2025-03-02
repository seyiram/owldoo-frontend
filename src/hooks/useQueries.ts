import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api/api';

export function useEvents(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['events', startDate, endDate],
    queryFn: () => apiService.getEvents(startDate, endDate)
  });
}

export function useThread(threadId: string) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => apiService.getThread(threadId)
  });
}

export function useAgentStats() {
  return useQuery({
    queryKey: ['agentStats'],
    queryFn: () => apiService.getAgentStats()
  });
}

export function useAddMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ threadId, message }: { threadId: string; message: string }) => 
      apiService.addMessage(threadId, message),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['thread', variables.threadId] });
    }
  });
}
