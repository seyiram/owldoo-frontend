import React, { useState, useEffect } from 'react';
import './MeetingPreferences.css';
import { MeetingPreference, MeetingType } from '../../../types/scheduling.types';
import { formatDuration } from '../../../utils/schedulingUtils';
import { useMeetingPreferences, useUpdateMeetingPreferences } from '../../../hooks/useApi';

const meetingTypes: { value: MeetingType; label: string }[] = [
  { value: 'oneOnOne', label: 'One-on-One' },
  { value: 'team', label: 'Team Meeting' },
  { value: 'client', label: 'Client Meeting' },
  { value: 'interview', label: 'Interview' },
  { value: 'brainstorm', label: 'Brainstorming' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'training', label: 'Training' },
  { value: 'social', label: 'Social Event' },
  { value: 'other', label: 'Other' },
];

interface MeetingTypePreferenceProps {
  preference: MeetingPreference;
  onUpdate: (updatedPreference: MeetingPreference) => void;
  onRemove: () => void;
}

const MeetingTypePreference: React.FC<MeetingTypePreferenceProps> = ({
  preference,
  onUpdate,
  onRemove,
}) => {
  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({
      ...preference,
      defaultDuration: parseInt(e.target.value),
    });
  };

  const handleBufferBeforeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({
      ...preference,
      bufferBefore: parseInt(e.target.value),
    });
  };

  const handleBufferAfterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({
      ...preference,
      bufferAfter: parseInt(e.target.value),
    });
  };

  return (
    <div className="meeting-type-preference">
      <div className="meeting-type-label">
        {meetingTypes.find(t => t.value === preference.type)?.label || preference.type}
      </div>
      <div className="meeting-preferences-grid">
        <div className="preference-item">
          <label>Duration</label>
          <select 
            value={preference.defaultDuration} 
            onChange={handleDurationChange}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
            <option value="240">4 hours</option>
          </select>
        </div>
        <div className="preference-item">
          <label>Buffer before</label>
          <select 
            value={preference.bufferBefore} 
            onChange={handleBufferBeforeChange}
          >
            <option value="0">No buffer</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </div>
        <div className="preference-item">
          <label>Buffer after</label>
          <select 
            value={preference.bufferAfter} 
            onChange={handleBufferAfterChange}
          >
            <option value="0">No buffer</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </div>
        <button 
          className="remove-meeting-type-button" 
          onClick={onRemove}
          aria-label="Remove meeting type preference"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const MeetingPreferences: React.FC = () => {
  const { data: preferenceData, isLoading: isLoadingData } = useMeetingPreferences();
  const { mutate: updateMeetingPrefs, isPending: isUpdating } = useUpdateMeetingPreferences();
  
  const [meetingPreferences, setMeetingPreferences] = useState<MeetingPreference[]>([]);
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [defaultBuffer, setDefaultBuffer] = useState(10);
  const [newMeetingType, setNewMeetingType] = useState<MeetingType | ''>('');
  
  const isLoading = isLoadingData || isUpdating;

  useEffect(() => {
    if (preferenceData) {
      setMeetingPreferences(preferenceData.meetingPreferences || []);
      setDefaultDuration(preferenceData.defaultMeetingDuration || 30);
      setDefaultBuffer(preferenceData.defaultBuffer || 10);
    }
  }, [preferenceData]);

  const handleDefaultDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDefaultDuration(parseInt(e.target.value));
  };

  const handleDefaultBufferChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDefaultBuffer(parseInt(e.target.value));
  };

  const handleAddMeetingType = () => {
    if (!newMeetingType) return;

    // Check if the meeting type already exists
    if (meetingPreferences.some(p => p.type === newMeetingType)) {
      alert('This meeting type already has preferences set.');
      return;
    }

    const newPreference: MeetingPreference = {
      type: newMeetingType,
      defaultDuration: defaultDuration,
      bufferBefore: defaultBuffer,
      bufferAfter: defaultBuffer,
    };

    setMeetingPreferences([...meetingPreferences, newPreference]);
    setNewMeetingType('');
  };

  const handleUpdatePreference = (index: number, updatedPreference: MeetingPreference) => {
    const updatedPreferences = [...meetingPreferences];
    updatedPreferences[index] = updatedPreference;
    setMeetingPreferences(updatedPreferences);
  };

  const handleRemovePreference = (index: number) => {
    const updatedPreferences = meetingPreferences.filter((_, i) => i !== index);
    setMeetingPreferences(updatedPreferences);
  };

  const handleSave = () => {
    updateMeetingPrefs({
      meetingPreferences,
      defaultMeetingDuration: defaultDuration,
      defaultBuffer,
    });
  };

  // Filter out meeting types that already have preferences
  const availableMeetingTypes = meetingTypes.filter(
    type => !meetingPreferences.some(p => p.type === type.value)
  );

  if (isLoadingData && !preferenceData) {
    return <div className="meeting-preferences-loading">Loading meeting preferences...</div>;
  }

  return (
    <div className="meeting-preferences-container">
      <h2>Meeting Preferences</h2>
      <p className="section-description">
        Set your default durations and buffer times for different types of meetings.
      </p>

      <div className="default-settings">
        <h3>Default Settings</h3>
        <div className="default-settings-grid">
          <div className="preference-item">
            <label>Default Meeting Duration</label>
            <select 
              value={defaultDuration} 
              onChange={handleDefaultDurationChange}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>
          <div className="preference-item">
            <label>Default Buffer Time</label>
            <select 
              value={defaultBuffer} 
              onChange={handleDefaultBufferChange}
            >
              <option value="0">No buffer</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="meeting-type-preferences">
        <h3>Meeting Type Preferences</h3>
        {meetingPreferences.length === 0 ? (
          <p className="no-preferences">No specific meeting type preferences set. Add a meeting type below.</p>
        ) : (
          meetingPreferences.map((preference, index) => (
            <MeetingTypePreference
              key={preference.type}
              preference={preference}
              onUpdate={(updatedPreference) => handleUpdatePreference(index, updatedPreference)}
              onRemove={() => handleRemovePreference(index)}
            />
          ))
        )}

        <div className="add-meeting-type">
          <select
            value={newMeetingType}
            onChange={(e) => setNewMeetingType(e.target.value as MeetingType)}
            disabled={availableMeetingTypes.length === 0}
          >
            <option value="">Select a meeting type...</option>
            {availableMeetingTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddMeetingType}
            disabled={!newMeetingType}
          >
            Add Meeting Type
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
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default MeetingPreferences;