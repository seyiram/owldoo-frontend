import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  Send,
  Calendar,
  Clock,
  Search,
  Repeat,
  LogOut,
} from "lucide-react";
import "./ChatCompose.css";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../../../store/useChatStore";
import { apiService } from "../../../api/api";
import owldooLogo from "../../../assets/owldoo-logo-2.svg";
import { useAuthStore } from "../../../store/useAuthStore";
import { useAgentStore } from "../../../store/useAgentStore";
import { useQueueAgentTask } from "../../../hooks/useApi";

const prompts = [
  {
    id: "schedule",
    title: "Schedule a meeting with John tomorrow at 3pm",
    icon: <Calendar size={20} />,
  },
  {
    id: "reschedule",
    title: "Move my 2pm meeting to 4pm today",
    icon: <Clock size={20} />,
  },
  {
    id: "availability",
    title: "Check my availability for tomorrow afternoon",
    icon: <Search size={20} />,
  },
  {
    id: "recurring",
    title: "Set up a weekly team sync every Monday at 10am",
    icon: <Repeat size={20} />,
  },
];

// Check if the message requires calendar access
const isCalendarRelatedCommand = (message: string): boolean => {
  const calendarKeywords = [
    'schedule', 'meeting', 'calendar', 'appointment', 'book', 
    'reschedule', 'cancel', 'move', 'postpone', 'availability',
    'free time', 'busy', 'event', 'remind', 'sync', 'when am i',
    'time slot', 'tomorrow at', 'today at', 'pm', 'am'
  ];
  
  const lowerMessage = message.toLowerCase();
  return calendarKeywords.some(keyword => lowerMessage.includes(keyword));
};

const ChatCompose = () => {
  const navigate = useNavigate();
  const queueAgentTask = useAgentStore((state) => state.queueTask);
  const [inputText, setInputText] = useState("");
  const createThread = useChatStore((state) => state.createThread);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isCalendarAuthPending, setIsCalendarAuthPending] = useState(false);
  const [conflictError, setConflictError] = useState<{
    error: string;
    suggestion?: string;
  } | null>(null);
  const [calendarAuthNeeded, setCalendarAuthNeeded] = useState(false);
  const [authInitiated, setAuthInitiated] = useState(false);

  // Use refs to manage the polling interval and track authentication attempts
  const authPollIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const { isAuthenticated, isCheckingAuth, userName, checkAuthStatus, logout } =
    useAuthStore();

  useEffect(() => {
    return () => {
      if (authPollIntervalRef.current) {
        clearInterval(authPollIntervalRef.current);
        authPollIntervalRef.current = undefined;
      }
    };
  }, []);

  // Track when last auth was initiated to prevent duplicate requests
  const lastAuthInitRef = useRef<number>(0);
  const AUTH_COOLDOWN = 10000; // 10 seconds cooldown between auth attempts

  const handleGoogleAuth = useCallback(async () => {
    // Prevent multiple auth requests in a short time period
    const now = Date.now();
    if (now - lastAuthInitRef.current < AUTH_COOLDOWN) {
      console.log("Auth request too soon after previous request, ignoring");
      return;
    }
    
    // Check if cookie already exists - if so, just update auth status
    const hasAuthCookie = document.cookie.includes('auth_session=true');
    if (hasAuthCookie) {
      console.log("Auth cookie already exists, just refreshing auth status");
      await checkAuthStatus();
      return;
    }
    
    try {
      // Update last auth time
      lastAuthInitRef.current = now;
      setIsCalendarAuthPending(true);
      console.log("Initiating Google Calendar authentication...");
      await apiService.initiateCalendarAuth();

      // Create a single event listener that manages both success and polling
      const handleAuthMessage = (event: MessageEvent) => {
        if (event.data?.type === "CALENDAR_AUTH_SUCCESS") {
          console.log("Authentication successful via message");
          window.removeEventListener("message", handleAuthMessage);

          // Clear polling interval if it exists
          if (authPollIntervalRef.current) {
            clearTimeout(authPollIntervalRef.current);
            authPollIntervalRef.current = undefined;
          }

          // Store tokens from the message
          if (event.data.tokens) {
            console.log("Received tokens in postMessage, storing locally");
            localStorage.setItem('googleCalendarTokens', JSON.stringify(event.data.tokens));
          }

          // Set a local flag to indicate successful auth
          localStorage.setItem('auth_completed', 'true');

          // Small delay to ensure everything is ready
          setTimeout(() => {
            checkAuthStatus();
            setIsCalendarAuthPending(false);
          }, 500);
        }
      };

      window.removeEventListener("message", handleAuthMessage); // Clean up any existing listeners
      window.addEventListener("message", handleAuthMessage);

      // Use recursive setTimeout with incremental backoff instead of setInterval
      // This prevents overlapping polls and works better with async operations
      const pollAuth = async (attempt = 0, maxAttempts = 10, delay = 2000) => {
        // Don't continue polling if component is unmounted
        if (attempt >= maxAttempts) {
          console.log("Auth polling max attempts reached");
          setIsCalendarAuthPending(false);
          return;
        }
        
        // Check for the auth flag first
        if (localStorage.getItem('auth_completed') === 'true') {
          console.log("Auth already completed via postMessage, skipping polling");
          setIsCalendarAuthPending(false);
          return;
        }
        
        console.log(`Polling auth status (attempt ${attempt+1}/${maxAttempts})...`);
        
        try {
          const status = await apiService.checkCalendarAuth();
          if (status) {
            console.log("Auth polling detected successful authentication");
            // Update auth status
            checkAuthStatus();
            setIsCalendarAuthPending(false);
          } else {
            // Check if the cookie exists despite the API saying not authenticated
            const hasAuthCookie = document.cookie.includes('auth_session=true');
            if (hasAuthCookie) {
              console.log("Cookie exists but API reports not authenticated, forcing refresh");
              checkAuthStatus();
              setIsCalendarAuthPending(false);
              return;
            }
            
            // Schedule next poll with slightly increasing delay (capped at 5 seconds)
            const nextDelay = Math.min(delay * 1.2, 5000);
            authPollIntervalRef.current = setTimeout(() => {
              pollAuth(attempt + 1, maxAttempts, nextDelay);
            }, delay);
          }
        } catch (error: unknown) {
          console.error("Error during auth polling:", error);
          
          // If error, still continue polling but with a longer delay
          const nextDelay = Math.min(delay * 1.5, 5000);
          authPollIntervalRef.current = setTimeout(() => {
            pollAuth(attempt + 1, maxAttempts, nextDelay);
          }, nextDelay);
        }
      };
      
      // Clean up any existing timer
      if (authPollIntervalRef.current) {
        clearTimeout(authPollIntervalRef.current);
        authPollIntervalRef.current = undefined;
      }
      
      // Start polling
      pollAuth();
    } catch (error: unknown) {
      console.error("Failed to initiate auth:", error);
      setIsCalendarAuthPending(false);
    }
  }, [checkAuthStatus]);

  const handleCalendarAuthDirect = useCallback(async () => {
    try {
      setCalendarAuthNeeded(true);
      console.log("Directly initiating Google Calendar auth (bypassing regular auth)");
      const response = await fetch('/calendar/auth/url', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const { url } = await response.json();
        console.log('Opening calendar-specific auth URL:', url);
        // Open in a popup
        const authWindow = window.open(url, 'calendarAuth', 'width=800,height=600');
        if (!authWindow) {
          console.error("Popup blocked - could not open auth window");
          setCalendarAuthNeeded(false);
          return false;
        }
        
        setIsCalendarAuthPending(true);
        
        // Start polling to check if calendar auth is complete
        let attempts = 0;
        const maxAttempts = 30; // Try for up to 30 * 2 seconds = 1 minute
        
        const checkCalendarAuth = () => {
          attempts++;
          if (attempts > maxAttempts || authWindow.closed) {
            clearInterval(checkInterval);
            setIsCalendarAuthPending(false);
            setCalendarAuthNeeded(false);
            return;
          }
          
          // Check calendar auth specifically
          fetch('/calendar/auth/status', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          })
          .then(resp => resp.json())
          .then(data => {
            if (data.isAuthenticated) {
              console.log("Calendar auth completed successfully via polling");
              clearInterval(checkInterval);
              if (!authWindow.closed) {
                authWindow.close();
              }
              checkAuthStatus(); // Update main auth state
              setIsCalendarAuthPending(false);
              setCalendarAuthNeeded(false);
            }
          })
          .catch(err => {
            console.error("Error checking calendar auth:", err);
            // Still continue polling
          });
        };
        
        const checkInterval = setInterval(checkCalendarAuth, 2000);
        return true;
      } else {
        console.error("Failed to get calendar auth URL:", await response.text());
        setCalendarAuthNeeded(false);
        setIsCalendarAuthPending(false);
        return false;
      }
    } catch (error) {
      console.error("Error initiating direct calendar auth:", error);
      setCalendarAuthNeeded(false);
      setIsCalendarAuthPending(false);
      return false;
    }
  }, [checkAuthStatus]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!inputText.trim()) return;

      try {
        setConflictError(null);
        
        // Only check calendar authentication for calendar-related commands
        const needsCalendarAuth = isCalendarRelatedCommand(inputText);
        console.log(`Message analysis: ${needsCalendarAuth ? 'Calendar-related' : 'Non-calendar'} command detected`);
        
        // For calendar operations, check authentication just-in-time
        if (needsCalendarAuth) {
          console.log("Calendar operation detected, verifying authentication");
          
          // Check if already authenticated first (to avoid unnecessary API calls)
          if (!isAuthenticated) {
            console.log("Not authenticated, checking server auth status");
            
            // Server-side auth check
            const serverAuthCheck = await fetch('/api/auth/status', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            let isRegularAuthOk = false;
            if (serverAuthCheck.ok) {
              const authData = await serverAuthCheck.json();
              isRegularAuthOk = authData.isAuthenticated === true;
            }
            
            // If not authenticated, initiate auth flow
            if (!isRegularAuthOk) {
              console.log("Authentication needed for calendar operation");
              handleGoogleAuth();
              return;
            }
          }
          
          // Calendar-specific auth check for calendar operations
          console.log("Checking specific calendar auth status");
          try {
            const calendarAuthCheck = await fetch('/calendar/auth/status', {
              method: 'GET',
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (calendarAuthCheck.ok) {
              const calendarAuthData = await calendarAuthCheck.json();
              const isCalendarAuthOk = calendarAuthData.isAuthenticated === true;
              
              if (!isCalendarAuthOk) {
                console.log("Calendar auth required - initiating direct calendar auth");
                const initiated = await handleCalendarAuthDirect();
                if (initiated) {
                  // Return early, user needs to complete the auth flow
                  return;
                }
              }
            }
          } catch (calendarCheckError) {
            console.error("Error checking calendar auth:", calendarCheckError);
            // Continue to try the thread creation, may work with regular auth
          }
        } else {
          // For non-calendar operations, no authentication checks needed
          console.log("Non-calendar operation - skipping auth checks");
        }
        
        // Create a new thread with conversation mode and get the ID
        console.log("Creating thread and queueing agent task");
        try {
          const threadId = await createThread(inputText, false, true);
          if (!threadId) {
            throw new Error("Failed to create thread");
          }
  
          await queueAgentTask(inputText, 1, { threadId }).catch(console.error);
  
          setInputText("");
  
          // Navigate to the thread to see the streaming response
          navigate(`/chat/${threadId}`);
        } catch (threadError) {
          // If thread creation fails with calendar auth error, try direct calendar auth
          if (threadError instanceof Error && 
              threadError.message.includes("Calendar authentication")) {
            console.log("Thread creation failed due to calendar auth, trying direct auth");
            await handleCalendarAuthDirect();
          } else {
            // Re-throw other errors
            throw threadError;
          }
        }
      } catch (error: unknown) {
        console.error("Error in handleSubmit:", error);

        // Type guard to safely check error properties
        if (error && typeof error === "object" && "type" in error) {
          const errorObj = error as {
            type: string;
            error: string;
            suggestion?: string;
          };
          if (errorObj.type === "CALENDAR_CONFLICT") {
            setConflictError({
              error: errorObj.error,
              suggestion: errorObj.suggestion,
            });
            return;
          }
        }

        // Special handling for calendar auth errors
        if (
          error instanceof Error &&
          error.message.includes("Calendar authentication")
        ) {
          console.log("Direct calendar auth required error, initiating specific flow");
          await handleCalendarAuthDirect();
        }
        // Handle other authentication errors
        else if (
          error instanceof Error &&
          (error.message.includes("authentication") ||
           error.message.includes("auth"))
        ) {
          // Check if we've already tried authenticating recently
          const now = Date.now();
          if (now - lastAuthInitRef.current > AUTH_COOLDOWN) {
            console.log("Auth error, initiating new auth flow");
            handleGoogleAuth();
          } else {
            console.log("Auth error but recently tried auth, waiting for completion");
            // Just refresh the auth status instead of starting a new flow
            await checkAuthStatus();
          }
        }
      }
    },
    [inputText, isAuthenticated, createThread, navigate, handleGoogleAuth, checkAuthStatus, AUTH_COOLDOWN, handleCalendarAuthDirect]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(event);
      }
    },
    [handleSubmit]
  );

  const handlePromptClick = useCallback((promptId: string) => {
    setSelectedPrompt(promptId);
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) {
      setInputText(prompt.title);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setAuthInitiated(false); // Reset auth state for next login
  }, [logout]);

  // Only show auth UI when triggered by an actual calendar operation
  const [showingAuthCheck, setShowingAuthCheck] = useState(false);
  
  useEffect(() => {
    if (isCheckingAuth && (isCalendarAuthPending || calendarAuthNeeded)) {
      setShowingAuthCheck(true);
    } else if (!isCheckingAuth) {
      setShowingAuthCheck(false);
    }
  }, [isCheckingAuth, isCalendarAuthPending, calendarAuthNeeded]);
  
  if (showingAuthCheck) {
    return (
      <div className="auth-loading">
        <img
          src={owldooLogo}
          alt="Owldoo Logo"
          width="80"
          height="80"
          className="loader-logo"
        />
        <div className="spinner"></div>
        <div className="loader-text">Checking your authentication...</div>
      </div>
    );
  }

  // Show calendar auth pending state
  if (isCalendarAuthPending) {
    return (
      <div className="auth-loading">
        <img
          src={owldooLogo}
          alt="Owldoo Logo"
          width="80"
          height="80"
          className="loader-logo"
        />
        <div className="spinner"></div>
        <div className="loader-text">Connecting to Google Calendar...</div>
      </div>
    );
  }
  
  // Show calendar auth needed but not pending
  if (calendarAuthNeeded && !isCalendarAuthPending) {
    return (
      <div className="auth-container">
        <div className="welcome-icon">
          <img src={owldooLogo} alt="Owldoo Logo" width="120" height="120" />
        </div>
        <h1>Google Calendar Authentication Required</h1>
        <p>We need to connect to your Google Calendar to continue.</p>
        <p>You are signed in to Owldoo but need calendar access to perform this action.</p>
        <button className="google-auth-button" onClick={handleCalendarAuthDirect}>
          Connect Google Calendar
        </button>
      </div>
    );
  }

  // Show unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="welcome-icon">
          <img src={owldooLogo} alt="Owldoo Logo" width="120" height="120" />
        </div>
        <h1>Welcome to Owldoo</h1>
        <p>To get started, please connect your Google Calendar</p>
        <button className="google-auth-button" onClick={handleGoogleAuth}>
          Connect Google Calendar
        </button>
      </div>
    );
  }

  // Show authenticated state / main UI
  return (
    <div className="compose-container">
      <header className="compose-header">
        <div className="header-top">
          <h1>
            Hi there,{" "}
            <span className="compose-name">
              {userName ? ` ${userName}` : ""}
            </span>
          </h1>

          <h2>How can I help you with your calendar?</h2>
          <p className="compose-subtitle">
            Schedule meetings, check availability, or manage your calendar using
            the prompts below
          </p>
        </div>
        <div className="header-bottom">
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="prompts-grid">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            className={`prompt-card ${
              selectedPrompt === prompt.id ? "selected" : ""
            }`}
            onClick={() => handlePromptClick(prompt.id)}
          >
            <span className="prompt-text">{prompt.title}</span>
            <span className="prompt-icon">{prompt.icon}</span>
          </button>
        ))}
      </div>

      <div className="refresh-section">
        <button className="refresh-button">
          <RefreshCw size={20} />
          <span>Refresh Prompts</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="compose-input-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask whatever you want...."
          className="compose-input"
        />
        <button
          type="submit"
          className="compose-submit-button"
          disabled={isLoading}
        >
          <Send size={20} />
        </button>
      </form>

      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}

      {conflictError && (
        <div className="conflict-alert">
          <p>{conflictError.error}</p>
          {conflictError.suggestion && (
            <div className="conflict-actions">
              <button
                onClick={() => {
                  setInputText(
                    `Yes, schedule for ${new Date(
                      conflictError?.suggestion || Date.now()
                    ).toLocaleString()}`
                  );
                }}
              >
                Accept suggested time
              </button>
              <button
                onClick={() => {
                  setInputText("Find another time");
                }}
              >
                Find another time
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatCompose;
