export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'Just now';
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

/**
 * Formats a date as YYYY-MM-DD string for all-day events
 */
export const formatDateForAllDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculates the end time for an event, handling overnight events
 */
export const calculateEndTime = (startTime: Date, durationMinutes: number): Date => {
  // Create a new Date object to avoid modifying the original
  const endTime = new Date(startTime);
  
  // First calculate what the end time would be
  const tempEnd = new Date(startTime);
  tempEnd.setMinutes(tempEnd.getMinutes() + durationMinutes);
  
  // Get start and end hours/minutes
  const startHour = startTime.getHours();
  const endHour = tempEnd.getHours();
  const startMinute = startTime.getMinutes();
  const endMinute = tempEnd.getMinutes();
  
  // Determine if this is an overnight event by checking:
  // 1. End hour is earlier than start hour (e.g., 9pm to 2am)
  // 2. End time falls in early morning (midnight to 6am) after long duration
  // 3. End hour equals start hour but end minute is less than start minute (e.g., 11:30pm to 12:15am)
  const isOvernight = startHour > endHour || 
                     (durationMinutes > 600 && endHour >= 0 && endHour < 6) ||
                     (startHour === endHour && startMinute > endMinute);
  
  if (isOvernight) {
    // This is an overnight event - calculate the next day's date correctly
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(endHour, endMinute, 0, 0);
    return endTime;
  }
  
  // Standard case - just add the duration
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  return endTime;
};

/**
 * Detects if an event is an overnight event (crossing midnight)
 */
export const isOvernightEvent = (startTime: Date, endTime: Date): boolean => {
  return endTime.getDate() > startTime.getDate();
};

/**
 * Formats duration in a human-readable way, handling overnight events
 */
export const formatEventDuration = (startTime: Date, endTime: Date): string => {
  // Calculate duration in milliseconds
  const durationMs = endTime.getTime() - startTime.getTime();
  
  // Convert to hours and minutes
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
};
