import { ApiResponse } from '../types/api.types';
import { apiService } from './api';
import { API_BASE_URL } from './api.config';

/**
 * Service for interacting with the Owldoo intelligent agent
 */
class AgentService {
    /**
     * Send a query to the agent and get a response
     */
    async processQuery(query: string, threadId?: string): Promise<ApiResponse<any>> {
        try {
            // Use the appropriate endpoint pattern like the rest of the codebase
            const response = await apiService['request']('/agent/query', {
                method: 'POST',
                body: JSON.stringify({ query, threadId })
            });
            
            return {
                success: true,
                data: response
            };
        } catch (error: any) {
            console.error('Error in AgentService.processQuery:', error);
            return {
                success: false,
                error: error.message || 'Failed to process query'
            };
        }
    }

    /**
     * Add a task to the agent's queue for asynchronous processing
     */
    async queueTask(task: string, priority: number = 1): Promise<ApiResponse<any>> {
        try {
            const response = await apiService['request']('/agent/task', {
                method: 'POST',
                body: JSON.stringify({ task, priority })
            });
            
            return {
                success: true,
                data: response
            };
        } catch (error: any) {
            console.error('Error in AgentService.queueTask:', error);
            return {
                success: false,
                error: error.message || 'Failed to queue task'
            };
        }
    }

    /**
     * Get personalized suggestions based on calendar data and user history
     */
    async getSuggestions(): Promise<ApiResponse<string[]>> {
        try {
            const response = await apiService['request']<string[]>('/agent/suggestions', {
                method: 'GET'
            });
            
            return {
                success: true,
                data: response
            };
        } catch (error: any) {
            console.error('Error in AgentService.getSuggestions:', error);
            return {
                success: false,
                error: error.message || 'Failed to get suggestions'
            };
        }
    }
}

export const agentService = new AgentService();
