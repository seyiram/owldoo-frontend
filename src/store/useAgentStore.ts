import { create } from 'zustand';
import { apiService } from '../api/api';
import { AgentStats, AgentTask, Insight, Suggestion } from '../types/agent.types';

interface AgentStore {
  stats: AgentStats | null;
  tasks: AgentTask[];
  insights: Insight[];
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchInsights: () => Promise<void>;
  fetchSuggestions: () => Promise<void>;
  queueTask: (task: string, priority?: number, metadata?: any) => Promise<string>;
  updateSuggestion: (suggestionId: string, action: 'accept' | 'dismiss') => Promise<void>;
  setStats: (stats: AgentStats) => void;
  setTasks: (tasks: AgentTask[]) => void;
  setInsights: (insights: Insight[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  stats: null,
  tasks: [],
  insights: [],
  suggestions: [],
  isLoading: false,
  error: null,

  fetchStats: async () => {
    try {
      set({ isLoading: true, error: null });
      const stats = await apiService.getAgentStats();
      set({ stats, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch agent stats', isLoading: false });
    }
  },

  fetchTasks: async () => {
    try {
      set({ isLoading: true, error: null });
      const tasks = await apiService.getAgentTasks();
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch agent tasks', isLoading: false });
    }
  },

  fetchInsights: async () => {
    try {
      set({ isLoading: true, error: null });
      const insights = await apiService.getAgentInsights();
      set({ insights, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch agent insights', isLoading: false });
    }
  },

  fetchSuggestions: async () => {
    try {
      set({ isLoading: true, error: null });
      const suggestions = await apiService.getSuggestions();
      set({ suggestions, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch suggestions', isLoading: false });
    }
  },

  queueTask: async (task: string, priority?: number, metadata?: any) => {
    try {
      set({ isLoading: true, error: null });
      const taskId = await apiService.queueAgentTask(task, priority, metadata);
      await get().fetchTasks(); // Refresh tasks list
      set({ isLoading: false });
      return taskId;
    } catch (error) {
      set({ error: 'Failed to queue task', isLoading: false });
      throw error;
    }
  },

  updateSuggestion: async (suggestionId: string, action: 'accept' | 'dismiss') => {
    try {
      set({ isLoading: true, error: null });
      await apiService.updateSuggestion(suggestionId, action);
      await get().fetchSuggestions(); // Refresh suggestions list
      set({ isLoading: false });
    } catch (error) {
      set({ error: 'Failed to update suggestion', isLoading: false });
      throw error;
    }
  },

  setStats: (stats) => set({ stats }),
  setTasks: (tasks) => set({ tasks }),
  setInsights: (insights) => set({ insights }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
