import React, { useState, useEffect } from 'react';
import './NLPDashboard.css';
import { apiService } from '../../api/api';
import { Calendar, Send, Info, Activity, Zap, MessageSquare, Tag, AlertCircle, FileText, Eye, Brain } from 'lucide-react';

interface Entity {
  type: string;
  value: string;
  normalized?: string;
  confidence: number;
}

interface IntentAnalysis {
  primaryIntent: string;
  secondaryIntents: string[];
  entities: {
    people: Entity[];
    times: Entity[];
    dates: Entity[];
    locations: Entity[];
    events: Entity[];
    durations: Entity[];
  };
  temporalContext: {
    timeframe: string;
    specificity: string;
    reference?: Date;
  };
  implicitConstraints: string[];
  requiredClarifications: string[];
  urgencyLevel: string;
  confidenceScores: Record<string, number>;
  ambiguityAnalysis: {
    alternateInterpretations: string[];
    resolutionStrategy: string;
  };
}

interface ScheduleParameters {
  title: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  location?: string;
  participants?: string[];
  priority: string;
  flexibility: string;
  recurrence?: {
    pattern: string;
    interval: number;
    endDate?: Date;
    count?: number;
  };
  isAllDay: boolean;
  reminderTime?: number;
  notes?: string;
  constraints: string[];
}

interface NLPResponse {
  input: string;
  analysis: IntentAnalysis;
  extractedParameters?: ScheduleParameters;
  suggestedResponse?: string;
  confidence: number;
}

const NLPDashboard: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [nlpResponse, setNLPResponse] = useState<NLPResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'intent' | 'parameters' | 'response' | 'reasoning'>('intent');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [sampleQueries, setSampleQueries] = useState<string[]>([
    "Schedule a meeting with John tomorrow at 2pm for 1 hour",
    "Find me some free time for deep work next Monday afternoon",
    "Move my afternoon meeting with the design team to Friday at 4pm",
    "Reschedule tomorrow's dentist appointment to next week",
    "Book an all-day event called 'Strategic Planning' for next Tuesday",
    "I need to meet with Sarah between 9-11pm tomorrow",
    "What's my calendar looking like for the rest of the week?"
  ]);
  
  useEffect(() => {
    // Pre-load a sample query for better UX
    analyzeText(sampleQueries[0]);
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };
  
  const handleSampleClick = (sample: string) => {
    setInputText(sample);
    analyzeText(sample);
  };
  
  const analyzeText = async (text: string) => {
    if (!text.trim()) return;
    
    setIsAnalyzing(true);
    setErrorMessage(null);
    
    try {
      // Call our new advanced NLP endpoint
      const response = await apiService.analyzeUserInput(text);
      
      if (response.success && response.analysis) {
        // Extract parameters from the text
        const parametersResponse = await apiService.extractSchedulingParameters(text);
        
        // Generate a response suggestion
        const responseData = await apiService.generateResponse({
          rawText: text,
          intentAnalysis: response.analysis,
          context: {
            conversationHistory: [],
            userPreferences: {
              workingHours: { start: '09:00', end: '17:00' },
              defaultMeetingDuration: 30,
              preferredMeetingTimes: ['10:00', '14:00', '16:00'],
              focusTimes: [],
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            currentDateTime: new Date(),
            recentCalendarEvents: []
          }
        });
        
        // Combine all the data
        const combinedResponse: NLPResponse = {
          input: text,
          analysis: response.analysis,
          extractedParameters: parametersResponse.success ? parametersResponse.parameters : undefined,
          suggestedResponse: responseData.success ? responseData.response.suggestedResponse : undefined,
          confidence: response.analysis.confidenceScores.overall || 0.8
        };
        
        setNLPResponse(combinedResponse);
      } else {
        throw new Error('Failed to analyze input');
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
      
      // Simulate a response for demo purposes
      simulateResponse(text);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const simulateResponse = (text: string) => {
    // This is a fallback simulation if the API isn't available yet
    const mockResponse: NLPResponse = {
      input: text,
      analysis: {
        primaryIntent: text.toLowerCase().includes('schedule') || text.toLowerCase().includes('book') || text.toLowerCase().includes('meeting')
          ? 'CREATE'
          : text.toLowerCase().includes('move') || text.toLowerCase().includes('reschedule')
            ? 'UPDATE'
            : text.toLowerCase().includes('free time') || text.toLowerCase().includes('deep work')
              ? 'ANALYZE'
              : 'QUERY',
        secondaryIntents: [],
        entities: {
          people: text.includes('John') 
            ? [{ type: 'PERSON', value: 'John', confidence: 0.95 }]
            : text.includes('Sarah')
              ? [{ type: 'PERSON', value: 'Sarah', confidence: 0.95 }]
              : text.includes('design team')
                ? [{ type: 'PERSON', value: 'design team', confidence: 0.85 }]
                : [],
          times: text.includes('2pm')
            ? [{ type: 'TIME', value: '2:00 PM', confidence: 0.95 }]
            : text.includes('afternoon')
              ? [{ type: 'TIME', value: 'afternoon', confidence: 0.85 }]
              : text.includes('9-11pm')
                ? [{ type: 'TIME', value: '9:00 PM', confidence: 0.95 }, { type: 'TIME', value: '11:00 PM', confidence: 0.95 }]
                : [],
          dates: text.includes('tomorrow')
            ? [{ type: 'DATE', value: 'tomorrow', confidence: 0.95 }]
            : text.includes('Monday')
              ? [{ type: 'DATE', value: 'next Monday', confidence: 0.95 }]
              : text.includes('Friday')
                ? [{ type: 'DATE', value: 'Friday', confidence: 0.95 }]
                : text.includes('next week')
                  ? [{ type: 'DATE', value: 'next week', confidence: 0.85 }]
                  : text.includes('Tuesday')
                    ? [{ type: 'DATE', value: 'next Tuesday', confidence: 0.9 }]
                    : [],
          locations: [],
          events: text.includes('dentist')
            ? [{ type: 'EVENT', value: 'dentist appointment', confidence: 0.9 }]
            : text.includes('Strategic Planning')
              ? [{ type: 'EVENT', value: 'Strategic Planning', confidence: 0.95 }]
              : [],
          durations: text.includes('1 hour')
            ? [{ type: 'DURATION', value: '1 hour', confidence: 0.95 }]
            : []
        },
        temporalContext: {
          timeframe: text.includes('tomorrow') || text.includes('next') ? 'FUTURE' : 'PRESENT',
          specificity: text.includes('2pm') ? 'EXACT' : 'APPROXIMATE',
          reference: new Date()
        },
        implicitConstraints: [
          'Must occur during working hours',
          'Should not overlap with existing meetings'
        ],
        requiredClarifications: [],
        urgencyLevel: text.includes('need') ? 'HIGH' : 'MEDIUM',
        confidenceScores: {
          intent: 0.92,
          entities: 0.88,
          overall: 0.9
        },
        ambiguityAnalysis: {
          alternateInterpretations: [],
          resolutionStrategy: 'Direct interpretation'
        }
      },
      extractedParameters: {
        title: text.includes('Strategic Planning') 
          ? 'Strategic Planning'
          : text.includes('dentist')
            ? 'Dentist Appointment'
            : text.includes('meeting with John')
              ? 'Meeting with John'
              : text.includes('design team')
                ? 'Design Team Meeting'
                : text.includes('meet with Sarah')
                  ? 'Meeting with Sarah'
                  : 'Calendar Event',
        startTime: new Date(Date.now() + 86400000), // tomorrow
        duration: text.includes('1 hour') ? 60 : 30,
        priority: text.includes('need') ? 'HIGH' : 'MEDIUM',
        flexibility: text.includes('between') ? 'FLEXIBLE' : 'EXACT',
        isAllDay: text.includes('all-day') || text.includes('Strategic Planning'),
        constraints: []
      },
      suggestedResponse: text.toLowerCase().includes('schedule') || text.toLowerCase().includes('book')
        ? `I've scheduled ${text.includes('Strategic Planning') ? 'the Strategic Planning all-day event' : 'your meeting'} for ${text.includes('tomorrow') ? 'tomorrow' : text.includes('Monday') ? 'next Monday' : text.includes('Friday') ? 'Friday' : 'the specified date'}.`
        : text.toLowerCase().includes('move') || text.toLowerCase().includes('reschedule')
          ? `I've rescheduled ${text.includes('dentist') ? 'your dentist appointment' : 'your meeting'} to ${text.includes('next week') ? 'next week' : text.includes('Friday') ? 'Friday at 4pm' : 'the new time'}.`
          : text.toLowerCase().includes('free time') || text.toLowerCase().includes('deep work')
            ? 'I found some free time blocks for deep work next Monday afternoon between 1-3pm and 4-5pm.'
            : "Here's your calendar for the rest of the week. You have 5 meetings scheduled.",
      confidence: 0.9
    };
    
    setNLPResponse(mockResponse);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyzeText(inputText);
  };
  
  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'CREATE': return '#10b981'; // green
      case 'UPDATE': return '#f97316'; // orange  
      case 'QUERY': return '#3b82f6'; // blue
      case 'ANALYZE': return '#a855f7'; // purple
      case 'RECOMMEND': return '#06b6d4'; // cyan
      default: return '#6b7280'; // gray
    }
  };
  
  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'CREATE': return <Calendar size={18} />;
      case 'UPDATE': return <Activity size={18} />;
      case 'QUERY': return <Eye size={18} />;
      case 'ANALYZE': return <Brain size={18} />;
      case 'RECOMMEND': return <Zap size={18} />;
      default: return <Tag size={18} />;
    }
  };
  
  return (
    <div className="nlp-dashboard">
      <header className="nlp-header">
        <h1>Advanced NLP Testing Dashboard</h1>
        <p className="subtitle">
          See how our advanced natural language processing analyzes calendar queries
        </p>
      </header>
      
      <div className="nlp-content">
        <div className="nlp-input-section">
          <h2>Test a calendar query</h2>
          <form onSubmit={handleSubmit} className="nlp-form">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type a calendar-related query..."
              className="nlp-input"
            />
            <button type="submit" className="analyze-button" disabled={isAnalyzing}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              {!isAnalyzing && <Send size={18} />}
            </button>
          </form>
          
          <div className="sample-queries">
            <h3>Sample queries</h3>
            <div className="query-buttons">
              {sampleQueries.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => handleSampleClick(sample)}
                  className="query-button"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {errorMessage && (
          <div className="error-message">
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
          </div>
        )}
        
        {nlpResponse && (
          <div className="analysis-results">
            <h2>Analysis Results</h2>
            
            <div className="result-tabs">
              <button 
                className={`tab-button ${activeTab === 'intent' ? 'active' : ''}`}
                onClick={() => setActiveTab('intent')}
              >
                <Brain size={16} />
                Intent Analysis
              </button>
              <button 
                className={`tab-button ${activeTab === 'parameters' ? 'active' : ''}`}
                onClick={() => setActiveTab('parameters')}
              >
                <FileText size={16} />
                Parameters
              </button>
              <button 
                className={`tab-button ${activeTab === 'response' ? 'active' : ''}`}
                onClick={() => setActiveTab('response')}
              >
                <MessageSquare size={16} />
                Response
              </button>
            </div>
            
            <div className="tab-content">
              {activeTab === 'intent' && (
                <>
                  <div className="result-card intent-card">
                    <div className="card-header">
                      <h3>Primary Intent</h3>
                      <div className="confidence-badge" style={{background: `${getIntentColor(nlpResponse.analysis.primaryIntent)}20`}}>
                        {Math.round((nlpResponse.analysis.confidenceScores.intent || 0.9) * 100)}% confident
                      </div>
                    </div>
                    <div className="intent-badge" style={{background: `${getIntentColor(nlpResponse.analysis.primaryIntent)}20`, color: getIntentColor(nlpResponse.analysis.primaryIntent)}}>
                      {getIntentIcon(nlpResponse.analysis.primaryIntent)}
                      <span>{nlpResponse.analysis.primaryIntent}</span>
                    </div>
                    
                    {nlpResponse.analysis.secondaryIntents.length > 0 && (
                      <div className="secondary-intents">
                        <h4>Secondary Intents</h4>
                        <div className="intent-list">
                          {nlpResponse.analysis.secondaryIntents.map((intent, index) => (
                            <span key={index} className="secondary-intent-badge">
                              {intent}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="result-card entities-card">
                    <h3>Extracted Entities</h3>
                    
                    {Object.entries(nlpResponse.analysis.entities).map(([entityType, entities]) => 
                      entities.length > 0 ? (
                        <div key={entityType} className="entity-section">
                          <h4 className="entity-type-header">{entityType}</h4>
                          <ul className="entities-list">
                            {entities.map((entity, index) => (
                              <li key={index} className="entity-item">
                                <span className="entity-value">{entity.value}</span>
                                {entity.normalized && <span className="entity-normalized">→ {entity.normalized}</span>}
                                <span className="entity-confidence">{Math.round(entity.confidence * 100)}%</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null
                    )}
                    
                    {Object.values(nlpResponse.analysis.entities).flat().length === 0 && (
                      <p className="no-entities">No entities extracted</p>
                    )}
                  </div>
                  
                  <div className="result-card context-card">
                    <h3>Temporal Context</h3>
                    <div className="context-details">
                      <div className="context-item">
                        <span className="context-label">Timeframe:</span>
                        <span className="context-value">{nlpResponse.analysis.temporalContext.timeframe}</span>
                      </div>
                      <div className="context-item">
                        <span className="context-label">Specificity:</span>
                        <span className="context-value">{nlpResponse.analysis.temporalContext.specificity}</span>
                      </div>
                      {nlpResponse.analysis.temporalContext.reference && (
                        <div className="context-item">
                          <span className="context-label">Reference date:</span>
                          <span className="context-value">
                            {new Date(nlpResponse.analysis.temporalContext.reference).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="result-card urgency-card">
                    <h3>Urgency & Constraints</h3>
                    <div className="urgency-level" data-level={nlpResponse.analysis.urgencyLevel}>
                      {nlpResponse.analysis.urgencyLevel}
                    </div>
                    
                    {nlpResponse.analysis.implicitConstraints.length > 0 && (
                      <div className="constraints-section">
                        <h4>Implicit Constraints</h4>
                        <ul className="constraints-list">
                          {nlpResponse.analysis.implicitConstraints.map((constraint, index) => (
                            <li key={index} className="constraint-item">{constraint}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {nlpResponse.analysis.requiredClarifications.length > 0 && (
                      <div className="clarifications-section">
                        <h4>Required Clarifications</h4>
                        <ul className="clarifications-list">
                          {nlpResponse.analysis.requiredClarifications.map((clarification, index) => (
                            <li key={index} className="clarification-item">{clarification}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {activeTab === 'parameters' && nlpResponse.extractedParameters && (
                <div className="parameters-content">
                  <div className="result-card parameters-card">
                    <h3>Scheduling Parameters</h3>
                    <div className="parameter-grid">
                      <div className="parameter-item">
                        <span className="parameter-label">Title:</span>
                        <span className="parameter-value">{nlpResponse.extractedParameters.title}</span>
                      </div>
                      
                      {nlpResponse.extractedParameters.startTime && (
                        <div className="parameter-item">
                          <span className="parameter-label">Start time:</span>
                          <span className="parameter-value">
                            {new Date(nlpResponse.extractedParameters.startTime).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.endTime && (
                        <div className="parameter-item">
                          <span className="parameter-label">End time:</span>
                          <span className="parameter-value">
                            {new Date(nlpResponse.extractedParameters.endTime).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.duration !== undefined && (
                        <div className="parameter-item">
                          <span className="parameter-label">Duration:</span>
                          <span className="parameter-value">
                            {nlpResponse.extractedParameters.duration} minutes
                          </span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.location && (
                        <div className="parameter-item">
                          <span className="parameter-label">Location:</span>
                          <span className="parameter-value">{nlpResponse.extractedParameters.location}</span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.participants && nlpResponse.extractedParameters.participants.length > 0 && (
                        <div className="parameter-item">
                          <span className="parameter-label">Participants:</span>
                          <span className="parameter-value">
                            {nlpResponse.extractedParameters.participants.join(', ')}
                          </span>
                        </div>
                      )}
                      
                      <div className="parameter-item">
                        <span className="parameter-label">Priority:</span>
                        <span className="parameter-value priority-badge" data-priority={nlpResponse.extractedParameters.priority}>
                          {nlpResponse.extractedParameters.priority}
                        </span>
                      </div>
                      
                      <div className="parameter-item">
                        <span className="parameter-label">Flexibility:</span>
                        <span className="parameter-value">{nlpResponse.extractedParameters.flexibility}</span>
                      </div>
                      
                      <div className="parameter-item">
                        <span className="parameter-label">All day event:</span>
                        <span className="parameter-value">{nlpResponse.extractedParameters.isAllDay ? 'Yes' : 'No'}</span>
                      </div>
                      
                      {nlpResponse.extractedParameters.reminderTime !== undefined && (
                        <div className="parameter-item">
                          <span className="parameter-label">Reminder:</span>
                          <span className="parameter-value">
                            {nlpResponse.extractedParameters.reminderTime} minutes before
                          </span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.recurrence && (
                        <div className="parameter-item full-width">
                          <span className="parameter-label">Recurrence:</span>
                          <span className="parameter-value">
                            {nlpResponse.extractedParameters.recurrence.pattern} 
                            (every {nlpResponse.extractedParameters.recurrence.interval} {nlpResponse.extractedParameters.recurrence.pattern.toLowerCase()})
                            {nlpResponse.extractedParameters.recurrence.endDate && 
                              ` until ${new Date(nlpResponse.extractedParameters.recurrence.endDate).toLocaleDateString()}`}
                            {nlpResponse.extractedParameters.recurrence.count && 
                              ` for ${nlpResponse.extractedParameters.recurrence.count} occurrences`}
                          </span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.notes && (
                        <div className="parameter-item full-width">
                          <span className="parameter-label">Notes:</span>
                          <span className="parameter-value">{nlpResponse.extractedParameters.notes}</span>
                        </div>
                      )}
                      
                      {nlpResponse.extractedParameters.constraints.length > 0 && (
                        <div className="parameter-item full-width">
                          <span className="parameter-label">Constraints:</span>
                          <ul className="parameter-constraints">
                            {nlpResponse.extractedParameters.constraints.map((constraint, index) => (
                              <li key={index}>{constraint}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'response' && nlpResponse.suggestedResponse && (
                <div className="response-content">
                  <div className="result-card response-card">
                    <h3>Suggested Response</h3>
                    <div className="response-container">
                      <div className="ai-message">
                        <div className="ai-avatar">🤖</div>
                        <div className="ai-bubble">
                          {nlpResponse.suggestedResponse}
                        </div>
                      </div>
                    </div>
                    
                    <div className="response-stats">
                      <div className="stat-item">
                        <span className="stat-label">Confidence:</span>
                        <span className="stat-value">{Math.round(nlpResponse.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NLPDashboard;