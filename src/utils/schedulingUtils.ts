import { UserPreferencesResponse } from '../types/api.types';
import { 
    UserSchedulingPreferences, 
    DayOfWeek, 
    TimeRange, 
    DayTimeRange,
    MeetingPreference,
    FocusTimePreference,
    ProductivityPattern
} from '../types/scheduling.types';

/**
 * Maps the API response to our frontend type for scheduling preferences
 */
export const mapUserPreferencesResponse = (response: UserPreferencesResponse): UserSchedulingPreferences => {
    return {
        workingHours: response.workingHours.map(day => ({
            day: day.day as DayOfWeek,
            timeRanges: day.timeRanges.map(range => ({
                start: range.start,
                end: range.end
            }))
        })),
        defaultMeetingDuration: response.defaultMeetingDuration,
        defaultBuffer: response.defaultBuffer,
        meetingPreferences: response.meetingPreferences.map(pref => ({
            type: pref.type as any,
            defaultDuration: pref.defaultDuration,
            bufferBefore: pref.bufferBefore,
            bufferAfter: pref.bufferAfter
        })),
        focusTimePreferences: {
            minimumDuration: response.focusTimePreferences.minimumDuration,
            preferredDays: response.focusTimePreferences.preferredDays as DayOfWeek[],
            preferredHours: response.focusTimePreferences.preferredHours.map(range => ({
                start: range.start,
                end: range.end
            }))
        },
        productivityPatterns: {
            mostProductiveHours: response.productivityPatterns.mostProductiveHours.map(range => ({
                start: range.start,
                end: range.end
            })),
            leastProductiveHours: response.productivityPatterns.leastProductiveHours.map(range => ({
                start: range.start,
                end: range.end
            })),
            focusTimeNeededDaily: response.productivityPatterns.focusTimeNeededDaily
        }
    };
};

/**
 * Converts time string (HH:MM) to number of minutes since midnight
 */
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Converts minutes since midnight to time string (HH:MM)
 */
export const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Formats a duration in minutes to a human-readable string
 */
export const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
        return `${minutes} minutes`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }
};

/**
 * Gets the default meeting duration based on meeting type and user preferences
 */
export const getDefaultDuration = (
    meetingType: string, 
    preferences: UserSchedulingPreferences | null
): number => {
    if (!preferences) return 30; // Default to 30 minutes if no preferences
    
    const meetingPref = preferences.meetingPreferences.find(pref => pref.type === meetingType);
    if (meetingPref) {
        return meetingPref.defaultDuration;
    }
    
    return preferences.defaultMeetingDuration;
};

/**
 * Gets the buffer times for a meeting based on meeting type and user preferences
 */
export const getBufferTimes = (
    meetingType: string, 
    preferences: UserSchedulingPreferences | null
): { before: number, after: number } => {
    if (!preferences) return { before: 0, after: 0 }; // Default to no buffer if no preferences
    
    const meetingPref = preferences.meetingPreferences.find(pref => pref.type === meetingType);
    if (meetingPref) {
        return { before: meetingPref.bufferBefore, after: meetingPref.bufferAfter };
    }
    
    return { before: preferences.defaultBuffer, after: preferences.defaultBuffer };
};