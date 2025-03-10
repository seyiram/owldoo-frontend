export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type MeetingType = 
  | 'oneOnOne' 
  | 'team' 
  | 'client' 
  | 'interview' 
  | 'brainstorm' 
  | 'presentation' 
  | 'training' 
  | 'social'
  | 'other';

export interface TimeRange {
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface DayTimeRange {
  day: DayOfWeek;
  timeRanges: TimeRange[];
}

export interface MeetingPreference {
  type: MeetingType;
  defaultDuration: number; // In minutes
  bufferBefore: number;    // In minutes
  bufferAfter: number;     // In minutes
}

export interface FocusTimePreference {
  minimumDuration: number; // In minutes
  preferredDays: DayOfWeek[];
  preferredHours: TimeRange[];
}

export interface ProductivityPattern {
  mostProductiveHours: TimeRange[];
  leastProductiveHours: TimeRange[];
  focusTimeNeededDaily: number; // In minutes
}

export interface UserSchedulingPreferences {
  workingHours: DayTimeRange[];
  defaultMeetingDuration: number; // In minutes
  defaultBuffer: number;          // In minutes
  meetingPreferences: MeetingPreference[];
  focusTimePreferences: FocusTimePreference;
  productivityPatterns: ProductivityPattern;
}

export interface SchedulingFeedback {
  id: string;
  suggestionId: string;
  accepted: boolean;
  helpful: boolean;
  rating?: number; // 1-5
  comments?: string;
  createdAt: string;
}

export interface SchedulingSuggestion {
  id: string;
  type: 'buffer_time' | 'focus_time' | 'meeting_time' | 'reschedule';
  eventId?: string;
  suggestedTime?: string;
  suggestedDuration?: number;
  reason: string;
  applied: boolean;
  createdAt: string;
}

export interface SchedulingState {
  preferences: UserSchedulingPreferences | null;
  suggestions: SchedulingSuggestion[];
  feedback: SchedulingFeedback[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  getPreferences: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserSchedulingPreferences>) => Promise<void>;
  getSuggestions: () => Promise<void>;
  applySuggestion: (suggestionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => Promise<void>;
  provideFeedback: (feedback: Partial<SchedulingFeedback>) => Promise<void>;
}