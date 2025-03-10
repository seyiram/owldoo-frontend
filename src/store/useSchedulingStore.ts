import { create } from 'zustand';
import { apiService } from '../api/api';
import { 
    SchedulingState, 
    UserSchedulingPreferences, 
    SchedulingSuggestion, 
    SchedulingFeedback 
} from '../types/scheduling.types';
import { mapUserPreferencesResponse } from '../utils/schedulingUtils';

export const useSchedulingStore = create<SchedulingState>((set, get) => ({
    preferences: null,
    suggestions: [],
    feedback: [],
    isLoading: false,
    error: null,

    getPreferences: async () => {
        try {
            set({ isLoading: true, error: null });
            const response = await apiService.getSchedulingPreferences();
            const preferences = mapUserPreferencesResponse(response);
            set({ preferences, isLoading: false });
        } catch (error: any) {
            console.error('Failed to fetch scheduling preferences:', error);
            set({ error: error.message, isLoading: false });
        }
    },

    updatePreferences: async (preferences: Partial<UserSchedulingPreferences>) => {
        try {
            set({ isLoading: true, error: null });
            const response = await apiService.updateSchedulingPreferences(preferences);
            const updatedPreferences = mapUserPreferencesResponse(response);
            set({ 
                preferences: { ...get().preferences, ...updatedPreferences } as UserSchedulingPreferences, 
                isLoading: false 
            });
        } catch (error: any) {
            console.error('Failed to update scheduling preferences:', error);
            set({ error: error.message, isLoading: false });
        }
    },

    getSuggestions: async () => {
        try {
            set({ isLoading: true, error: null });
            const response = await apiService.getSchedulingSuggestions();
            const suggestions: SchedulingSuggestion[] = response.map(suggestion => ({
                id: suggestion.id,
                type: suggestion.type as any, // Type casting to match our enum
                eventId: suggestion.eventId,
                suggestedTime: suggestion.suggestedTime,
                suggestedDuration: suggestion.suggestedDuration,
                reason: suggestion.reason,
                applied: suggestion.applied,
                createdAt: suggestion.createdAt
            }));
            set({ suggestions, isLoading: false });
        } catch (error: any) {
            console.error('Failed to fetch scheduling suggestions:', error);
            set({ error: error.message, isLoading: false });
        }
    },

    applySuggestion: async (suggestionId: string) => {
        try {
            set({ isLoading: true, error: null });
            await apiService.applySchedulingSuggestion(suggestionId);
            
            // Update the local suggestions list to mark this one as applied
            set(state => ({
                ...state,
                suggestions: state.suggestions.map(suggestion => 
                    suggestion.id === suggestionId 
                        ? { ...suggestion, applied: true } 
                        : suggestion
                ),
                isLoading: false
            }));
        } catch (error: any) {
            console.error('Failed to apply scheduling suggestion:', error);
            set({ error: error.message, isLoading: false });
        }
    },

    dismissSuggestion: async (suggestionId: string) => {
        try {
            set({ isLoading: true, error: null });
            await apiService.dismissSchedulingSuggestion(suggestionId);
            
            // Remove the suggestion from the local list
            set(state => ({
                ...state,
                suggestions: state.suggestions.filter(suggestion => suggestion.id !== suggestionId),
                isLoading: false
            }));
        } catch (error: any) {
            console.error('Failed to dismiss scheduling suggestion:', error);
            set({ error: error.message, isLoading: false });
        }
    },

    provideFeedback: async (feedback: Partial<SchedulingFeedback>) => {
        try {
            set({ isLoading: true, error: null });
            await apiService.provideSchedulingFeedback({
                suggestionId: feedback.suggestionId!,
                accepted: feedback.accepted!,
                helpful: feedback.helpful!,
                rating: feedback.rating,
                comments: feedback.comments
            });
            
            // Add the feedback to our local store
            const newFeedback: SchedulingFeedback = {
                id: Date.now().toString(), // Temporary ID until we get the real one
                suggestionId: feedback.suggestionId!,
                accepted: feedback.accepted!,
                helpful: feedback.helpful!,
                rating: feedback.rating,
                comments: feedback.comments,
                createdAt: new Date().toISOString()
            };
            
            set(state => ({
                ...state,
                feedback: [...state.feedback, newFeedback],
                isLoading: false
            }));
        } catch (error: any) {
            console.error('Failed to provide scheduling feedback:', error);
            set({ error: error.message, isLoading: false });
        }
    }
}));