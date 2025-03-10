import React, { useState, useEffect } from 'react';
import './FocusTimePreferences.css';
import { 
  DayOfWeek, 
  FocusTimePreference,
  TimeRange
} from '../../../types/scheduling.types';
import { formatDuration } from '../../../utils/schedulingUtils';
import { useSchedulingPreferences, useUpdateSchedulingPreferences } from '../../../hooks/useApi';

const daysOfWeek: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

interface TimeRangeInputProps {
  range: TimeRange;
  onUpdate: (updatedRange: TimeRange) => void;
  onRemove: () => void;
}

const TimeRangeInput: React.FC<TimeRangeInputProps> = ({ range, onUpdate, onRemove }) => {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...range, start: e.target.value });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...range, end: e.target.value });
  };

  return (
    <div className="focus-time-range">
      <input 
        type="time" 
        value={range.start} 
        onChange={handleStartChange}
        aria-label="Start time"
      />
      <span className="time-separator">to</span>
      <input 
        type="time" 
        value={range.end} 
        onChange={handleEndChange}
        aria-label="End time"
      />
      <button 
        className="remove-time-range" 
        onClick={onRemove}
        aria-label="Remove time range"
      >
        ✕
      </button>
    </div>
  );
};

const FocusTimePreferences: React.FC = () => {
  const { data: preferences, isLoading: isLoadingData } = useSchedulingPreferences();
  const { mutate: updatePreferences, isPending: isUpdating } = useUpdateSchedulingPreferences();
  
  const isLoading = isLoadingData || isUpdating;
  
  const [focusPreference, setFocusPreference] = useState<FocusTimePreference>({
    minimumDuration: 60,
    preferredDays: [],
    preferredHours: []
  });

  useEffect(() => {
    if (preferences?.focusTimePreferences) {
      setFocusPreference(preferences.focusTimePreferences);
    }
  }, [preferences]);

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFocusPreference({
      ...focusPreference,
      minimumDuration: parseInt(e.target.value)
    });
  };

  const handleDayToggle = (day: DayOfWeek) => {
    if (focusPreference.preferredDays.includes(day)) {
      setFocusPreference({
        ...focusPreference,
        preferredDays: focusPreference.preferredDays.filter(d => d !== day)
      });
    } else {
      setFocusPreference({
        ...focusPreference,
        preferredDays: [...focusPreference.preferredDays, day]
      });
    }
  };

  const addTimeRange = () => {
    // Default to 9am-11am for the first range
    const newRange: TimeRange = { 
      start: '09:00', 
      end: '11:00' 
    };
    
    setFocusPreference({
      ...focusPreference,
      preferredHours: [...focusPreference.preferredHours, newRange]
    });
  };

  const updateTimeRange = (index: number, updatedRange: TimeRange) => {
    const updatedRanges = [...focusPreference.preferredHours];
    updatedRanges[index] = updatedRange;
    
    setFocusPreference({
      ...focusPreference,
      preferredHours: updatedRanges
    });
  };

  const removeTimeRange = (index: number) => {
    setFocusPreference({
      ...focusPreference,
      preferredHours: focusPreference.preferredHours.filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
    updatePreferences({
      focusTimePreferences: focusPreference
    });
  };

  if (isLoadingData && !preferences) {
    return <div className="focus-preferences-loading">Loading focus time preferences...</div>;
  }

  return (
    <div className="focus-preferences-container">
      <h2>Focus Time Preferences</h2>
      <p className="section-description">
        Configure when and how you'd like to block off focus time in your calendar.
        These settings help the AI optimize your schedule.
      </p>
      
      <div className="focus-preferences-form">
        <div className="focus-section">
          <h3>Minimum Focus Time Duration</h3>
          <p className="focus-description">
            What's the minimum amount of uninterrupted time you need to focus effectively?
          </p>
          <select 
            value={focusPreference.minimumDuration} 
            onChange={handleDurationChange}
            className="duration-select"
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
            <option value="240">4 hours</option>
          </select>
        </div>
        
        <div className="focus-section">
          <h3>Preferred Days</h3>
          <p className="focus-description">
            Which days do you prefer to have focus time scheduled?
          </p>
          <div className="day-checkboxes">
            {daysOfWeek.map(day => (
              <label key={day.value} className="day-checkbox">
                <input 
                  type="checkbox" 
                  checked={focusPreference.preferredDays.includes(day.value)}
                  onChange={() => handleDayToggle(day.value)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="focus-section">
          <h3>Preferred Hours</h3>
          <p className="focus-description">
            During which time ranges do you prefer to have focus time?
          </p>
          
          {focusPreference.preferredHours.length === 0 ? (
            <p className="no-hours">No preferred hours set. Add a time range below.</p>
          ) : (
            <div className="time-ranges-list">
              {focusPreference.preferredHours.map((range, index) => (
                <TimeRangeInput 
                  key={index}
                  range={range}
                  onUpdate={(updatedRange) => updateTimeRange(index, updatedRange)}
                  onRemove={() => removeTimeRange(index)}
                />
              ))}
            </div>
          )}
          
          <button 
            type="button" 
            className="add-time-range-button"
            onClick={addTimeRange}
          >
            + Add Time Range
          </button>
        </div>
      </div>
      
      <div className="actions">
        <button 
          type="button" 
          className="save-button"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Focus Preferences'}
        </button>
      </div>
    </div>
  );
};

export default FocusTimePreferences;