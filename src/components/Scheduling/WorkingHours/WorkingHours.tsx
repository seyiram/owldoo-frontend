import React, { useState, useEffect } from 'react';
import './WorkingHours.css';
import { DayOfWeek, DayTimeRange, TimeRange } from '../../../types/scheduling.types';
import { minutesToTime, timeToMinutes } from '../../../utils/schedulingUtils';
import { useWorkingHours, useUpdateWorkingHours } from '../../../hooks/useApi';

const daysOfWeek: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

const formatDay = (day: string): string => {
  return day.charAt(0).toUpperCase() + day.slice(1);
};

interface TimeRangeInputProps {
  range: TimeRange;
  onUpdate: (range: TimeRange) => void;
  onRemove: () => void;
  isRemovable: boolean;
}

const TimeRangeInput: React.FC<TimeRangeInputProps> = ({ range, onUpdate, onRemove, isRemovable }) => {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...range, start: e.target.value });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...range, end: e.target.value });
  };

  return (
    <div className="time-range-input">
      <input
        type="time"
        value={range.start}
        onChange={handleStartChange}
        aria-label="Start time"
      />
      <span>to</span>
      <input
        type="time"
        value={range.end}
        onChange={handleEndChange}
        aria-label="End time"
      />
      {isRemovable && (
        <button
          type="button"
          className="remove-range-button"
          onClick={onRemove}
          aria-label="Remove time range"
        >
          &times;
        </button>
      )}
    </div>
  );
};

interface DayTimeRangesProps {
  day: DayOfWeek;
  ranges: TimeRange[];
  onUpdate: (day: DayOfWeek, ranges: TimeRange[]) => void;
}

const DayTimeRanges: React.FC<DayTimeRangesProps> = ({ day, ranges, onUpdate }) => {
  const addTimeRange = () => {
    // Add a new time range with default values
    // Default to 9am-5pm if first range, or next hour after last range's end time
    let newRange: TimeRange;
    if (ranges.length === 0) {
      newRange = { start: '09:00', end: '17:00' };
    } else {
      const lastRange = ranges[ranges.length - 1];
      const lastEndMinutes = timeToMinutes(lastRange.end);
      const newStartMinutes = lastEndMinutes + 30; // 30 min after last end
      const newEndMinutes = newStartMinutes + 60; // 1 hour duration
      newRange = {
        start: minutesToTime(newStartMinutes),
        end: minutesToTime(newEndMinutes)
      };
    }
    onUpdate(day, [...ranges, newRange]);
  };

  const updateTimeRange = (index: number, updatedRange: TimeRange) => {
    const newRanges = [...ranges];
    newRanges[index] = updatedRange;
    onUpdate(day, newRanges);
  };

  const removeTimeRange = (index: number) => {
    const newRanges = ranges.filter((_, i) => i !== index);
    onUpdate(day, newRanges);
  };

  return (
    <div className="day-time-ranges">
      <div className="day-label">{formatDay(day)}</div>
      <div className="time-ranges">
        {ranges.length === 0 ? (
          <p className="no-hours">No working hours set</p>
        ) : (
          ranges.map((range, index) => (
            <TimeRangeInput
              key={index}
              range={range}
              onUpdate={(updatedRange) => updateTimeRange(index, updatedRange)}
              onRemove={() => removeTimeRange(index)}
              isRemovable={ranges.length > 1}
            />
          ))
        )}
        <button
          type="button"
          className="add-time-range-button"
          onClick={addTimeRange}
        >
          + Add Hours
        </button>
      </div>
    </div>
  );
};

const WorkingHours: React.FC = () => {
  const { data: workingHoursData, isLoading: isLoadingData } = useWorkingHours();
  const { mutate: updateWorkingHours, isPending: isUpdating } = useUpdateWorkingHours();
  const [workingHours, setWorkingHours] = useState<DayTimeRange[]>([]);
  
  const isLoading = isLoadingData || isUpdating;

  useEffect(() => {
    if (workingHoursData) {
      // Convert API response to our format
      setWorkingHours(workingHoursData.workingHours || []);
    }
  }, [workingHoursData]);

  const handleUpdateDay = (day: DayOfWeek, ranges: TimeRange[]) => {
    const updatedHours = workingHours.map(dayRange => 
      dayRange.day === day ? { day, timeRanges: ranges } : dayRange
    );
    
    // If the day doesn't exist yet, add it
    if (!updatedHours.some(dayRange => dayRange.day === day)) {
      updatedHours.push({ day, timeRanges: ranges });
    }
    
    setWorkingHours(updatedHours);
  };

  const handleSave = () => {
    updateWorkingHours({ workingHours });
  };

  if (isLoadingData && !workingHoursData) {
    return <div className="working-hours-loading">Loading working hours...</div>;
  }

  return (
    <div className="working-hours-container">
      <h2>Working Hours</h2>
      <p className="section-description">
        Set your normal working hours for each day of the week. These settings help optimize your scheduling.
      </p>
      
      <div className="working-hours-grid">
        {daysOfWeek.map(day => {
          const dayRanges = workingHours.find(d => d.day === day);
          return (
            <DayTimeRanges
              key={day}
              day={day}
              ranges={dayRanges?.timeRanges || []}
              onUpdate={handleUpdateDay}
            />
          );
        })}
      </div>
      
      <div className="actions">
        <button 
          type="button" 
          className="save-button"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Working Hours'}
        </button>
      </div>
    </div>
  );
};

export default WorkingHours;