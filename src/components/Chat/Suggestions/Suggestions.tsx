import React, { useEffect, useState } from 'react';
import './Suggestions.css';

interface Suggestion {
  _id: string;
  type: string;
  title: string;
  description: string;
  action: {
    type: string;
    data: any;
  };
  relevance: number;
}

const Suggestions: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchSuggestions();
    
    // Refresh suggestions every 5 minutes
    const interval = setInterval(fetchSuggestions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agent/suggestions');
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAccept = async (suggestionId: string) => {
    try {
      const response = await fetch(`/api/agent/suggestions/${suggestionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      });
      
      if (response.ok) {
        // Remove from list
        setSuggestions(suggestions.filter(s => s._id !== suggestionId));
      } else {
        throw new Error('Error accepting suggestion');
      }
    } catch (error) {
      console.error('Error accepting suggestion:', error);
    }
  };
  
  const handleDismiss = async (suggestionId: string) => {
    try {
      const response = await fetch(`/api/agent/suggestions/${suggestionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      
      if (response.ok) {
        // Remove from list
        setSuggestions(suggestions.filter(s => s._id !== suggestionId));
      } else {
        throw new Error('Error dismissing suggestion');
      }
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
    }
  };
  
  if (loading && suggestions.length === 0) {
    return <div className="suggestions-loading">Loading suggestions...</div>;
  }
  
  if (suggestions.length === 0) {
    return null; // Don't show anything if no suggestions
  }
  
  return (
    <div className="suggestions-container">
      <h3 className="suggestions-title">Suggestions</h3>
      <div className="suggestions-list">
        {suggestions.map(suggestion => (
          <div key={suggestion._id} className="suggestion-card">
            <div className="suggestion-header">
              <h4>{suggestion.title}</h4>
              <span className={`suggestion-type ${suggestion.type}`}>{suggestion.type}</span>
            </div>
            <p className="suggestion-description">{suggestion.description}</p>
            <div className="suggestion-actions">
              <button 
                className="accept-button"
                onClick={() => handleAccept(suggestion._id)}
              >
                Accept
              </button>
              <button 
                className="dismiss-button"
                onClick={() => handleDismiss(suggestion._id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Suggestions;