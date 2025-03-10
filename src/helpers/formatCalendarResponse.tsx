import { CalendarCheck, CalendarX, CalendarClock, CalendarSearch, Calendar } from 'lucide-react';
import './formatCalendarResponse.css';

// Helper function to format time display
const formatEventTime = (event: any) => {
  // Check if it's an all-day event
  const isAllDay = event.start.date || 
                  (event.context?.flags?.isAllDay) || 
                  event.isAllDay;
  
  if (isAllDay) {
    // Format for all-day events
    const startDate = event.start.date 
      ? new Date(event.start.date) 
      : new Date(event.startTime);
    
    // Check if multi-day event
    const isMultiDay = event.isMultiDay || event.context?.flags?.isMultiDay;
    
    if (isMultiDay && event.end?.date) {
      const endDate = new Date(event.end.date);
      return (
        <span className="all-day-event">
          All day: {startDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })} to {endDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
        </span>
      );
    }
    
    return (
      <span className="all-day-event">
        All day: {startDate.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })}
      </span>
    );
  }
  
  // Regular event or overnight event
  const startTime = event.start.dateTime 
    ? new Date(event.start.dateTime) 
    : new Date(event.startTime);
  
  const endTime = event.end?.dateTime 
    ? new Date(event.end.dateTime) 
    : undefined;
  
  // Check if it's an overnight event (end date > start date)
  const isOvernight = endTime && endTime.getDate() > startTime.getDate();
  
  if (isOvernight) {
    return (
      <span className="overnight-event">
        {startTime.toLocaleString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })} - {endTime.toLocaleString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}
      </span>
    );
  }
  
  // Regular event
  return (
    <span className="regular-event">
      {startTime.toLocaleString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })}
      {endTime && <> to {endTime.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      })}</>}
    </span>
  );
};

// Main component
const formatCalendarResponse = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    
    switch (parsed.action) {
      case 'delete':
        return (
          <div className="calendar-action-result">
            <div className="action-header">
              <CalendarX className="action-icon" size={24} color="#dc2626" />
              <span className="action-title">Event Deleted</span>
            </div>
            <div className="action-details">
              <p className="event-time">
                {new Date(parsed.targetTime).toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
              {parsed.title && <p className="event-title">{parsed.title}</p>}
            </div>
          </div>
        );
      
      case 'query':
        if (!parsed.events || parsed.events.length === 0) {
          return (
            <div className="calendar-action-result">
              <div className="action-header">
                <CalendarSearch className="action-icon" size={24} color="#6b7280" />
                <span className="action-title">No events found</span>
              </div>
              <p className="query-time">
                at {new Date(parsed.queryTime).toLocaleString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
          );
        }

        return (
          <div className="calendar-action-result">
            <div className="action-header">
              <CalendarSearch className="action-icon" size={24} color="#0891b2" />
              <span className="action-title">Found Events</span>
            </div>
            <div className="events-list">
              {parsed.events.map((event: any, index: number) => {
                // Detect all-day event
                const isAllDay = event.start.date || 
                               (event.context?.flags?.isAllDay) || 
                               event.isAllDay;
                               
                return (
                  <div key={index} className={`event-item ${isAllDay ? 'all-day' : ''}`}>
                    <div className="event-title">
                      {isAllDay && <Calendar size={16} className="all-day-icon" />}
                      {event.summary}
                    </div>
                    <div className="event-time">
                      {isAllDay ? (
                        // All-day event formatting
                        new Date(event.start.date || event.start.dateTime).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })
                      ) : (
                        // Regular event formatting
                        <>
                          {new Date(event.start.dateTime).toLocaleString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit'
                          })} -
                          {new Date(event.end.dateTime).toLocaleString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </>
                      )}
                    </div>
                    {event.location && (
                      <div className="event-location">📍 {event.location}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'create':
        return (
          <div className="calendar-action-result">
            <div className="action-header">
              <CalendarCheck className="action-icon" size={24} color="#059669" />
              <span className="action-title">Event Created</span>
            </div>
            <div className="action-details">
              <p className="event-title">{parsed.title}</p>
              <p className="event-time">
                {formatEventTime(parsed)}
              </p>
              {!parsed.context?.flags?.isAllDay && (
                <p className="event-duration">Duration: {parsed.duration} minutes</p>
              )}
            </div>
          </div>
        );

      case 'update':
        return (
          <div className="calendar-action-result">
            <div className="action-header">
              <CalendarClock className="action-icon" size={24} color="#0891b2" />
              <span className="action-title">Event Updated</span>
            </div>
            <div className="action-details">
              <p className="event-title">{parsed.title}</p>
              <p className="event-time">
                New time: {formatEventTime(parsed)}
              </p>
              {!parsed.context?.flags?.isAllDay && parsed.duration && (
                <p className="event-duration">Duration: {parsed.duration} minutes</p>
              )}
            </div>
          </div>
        );

      default:
        return content;
    }
  } catch (e) {
    // If not JSON or parsing fails, return original content
    return content;
  }
};

export default formatCalendarResponse;