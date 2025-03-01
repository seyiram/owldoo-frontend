import React, { useState } from 'react';
import './FeedbackForm.css';

interface FeedbackFormProps {
  responseId: string;
  originalResponse: string;
  onClose: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ 
  responseId, 
  originalResponse, 
  onClose 
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [wasHelpful, setWasHelpful] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [corrections, setCorrections] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === null || wasHelpful === null) {
      setError('Please provide a rating and indicate if the response was helpful');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseId,
          rating,
          wasHelpful,
          comments,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      const feedbackResponse = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseId,
          rating,
          wasHelpful,
          comments,
          corrections,
          originalResponse
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      setSubmitted(true);
      setTimeout(onClose, 2000); // Close after 2 seconds
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (submitted) {
    return (
      <div className="feedback-form feedback-success">
        <h3>Thank you for your feedback!</h3>
        <p>Your input helps us improve our AI assistant.</p>
      </div>
    );
  }
  
  return (
    <div className="feedback-form">
      <div className="feedback-header">
        <h3>Provide Feedback</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="feedback-section">
          <label>Was this response helpful?</label>
          <div className="helpful-buttons">
            <button
              type="button"
              className={wasHelpful === true ? 'selected' : ''}
              onClick={() => setWasHelpful(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={wasHelpful === false ? 'selected' : ''}
              onClick={() => setWasHelpful(false)}
            >
              No
            </button>
          </div>
        </div>
        
        <div className="feedback-section">
          <label>Rate the response (1-5):</label>
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                className={rating !== null && star <= rating ? 'star selected' : 'star'}
                onClick={() => setRating(star)}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        
        <div className="feedback-section">
          <label htmlFor="comments">Additional comments (optional):</label>
          <textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="What did you like or dislike about this response?"
            rows={3}
          />
        </div>
        
        <div className="feedback-section">
          <label htmlFor="corrections">Suggest corrections (optional):</label>
          <textarea
            id="corrections"
            value={corrections}
            onChange={(e) => setCorrections(e.target.value)}
            placeholder="How would you improve this response?"
            rows={3}
          />
        </div>
        
        {error && <div className="feedback-error">{error}</div>}
        
        <div className="feedback-actions">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm;