import { CalendarCheck, CalendarX, CalendarClock, CalendarSearch } from 'lucide-react';
import './formatCalendarResponse.css';

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
              {parsed.events.map((event: any, index: number) => (
                <div key={index} className="event-item">
                  <div className="event-title">{event.summary}</div>
                  <div className="event-time">
                    {new Date(event.start.dateTime).toLocaleString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit'
                    })} -
                    {new Date(event.end.dateTime).toLocaleString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                  {event.location && (
                    <div className="event-location">📍 {event.location}</div>
                  )}
                </div>
              ))}
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
                {new Date(parsed.startTime).toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
              <p className="event-duration">Duration: {parsed.duration} minutes</p>
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
                New time: {new Date(parsed.startTime).toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
              {parsed.duration && <p className="event-duration">Duration: {parsed.duration} minutes</p>}
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