import React, { useEffect, useState } from "react";
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

interface Prompt {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const prompts: Prompt[] = [
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

const ChatCompose: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState<string>("");
  // const { createThread, isLoading, error } = useChatStore();
  const createThread = useChatStore((state) => state.createThread);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isCalendarAuthPending, setIsCalendarAuthPending] = useState(false);
  const [conflictError, setConflictError] = useState<{
    error: string;
    suggestion?: string;
  } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // This effect will run whenever the authentication state changes
  useEffect(() => {
    // When authentication state changes to true, force a re-render
    if (isAuthenticated && !isCheckingAuth) {
      console.log("Authentication detected, updating UI...");
      // Force a complete UI update after auth state change
      const timer = setTimeout(() => {
        // This is more reliable than the previous approach
        setInputText((prev) => prev + " "); // Add a space to force state change
        setTimeout(() => setInputText((prev) => prev.trim()), 10); // Then remove it
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isCheckingAuth]);

  const checkAuthStatus = async () => {
    try {
      console.log("Checking authentication status...");
      setIsCheckingAuth(true);
      const status = await apiService.checkCalendarAuth();
      console.log("Auth status result:", status);
      setIsAuthenticated(status);
      if (status) {
        console.log("User is authenticated. Fetching profile...");
        const profile = await apiService.getUserProfile();
        console.log("Profile received:", profile);
        setUserName(profile.name);
      }
    } catch (error) {
      console.error("Error checking authentication status:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setIsCalendarAuthPending(true);
      console.log("Initiating Google Calendar authentication...");

      // Get the auth URL and let the API service handle the window opening
      await apiService.initiateCalendarAuth();

      // one-time event listener for auth completion
      const handleAuthMessage = (event: MessageEvent) => {
        console.log("Received message event:", event.data);
        if (event.data.type === "CALENDAR_AUTH_SUCCESS") {
          console.log("Authentication successful");
          window.removeEventListener("message", handleAuthMessage);
          
          // Add a small delay before updating state to ensure everything is ready
          setTimeout(() => {
            setIsAuthenticated(true); // update auth state
            setIsCheckingAuth(false); // done checking auth status
            checkAuthStatus(); // check for full profile info
          }, 100);
        } else if (event.data.type === "CALENDAR_AUTH_ERROR") {
          console.error("Authentication failed:", event.data.error);
          window.removeEventListener("message", handleAuthMessage);
        }
      };

      window.addEventListener("message", handleAuthMessage);

      // Start polling to check auth status in case message event doesn't fire
      const pollAuthStatus = async () => {
        const maxAttempts = 15;
        let attempts = 0;

        const checkInterval = setInterval(async () => {
          attempts++;
          console.log(
            `Polling auth status (attempt ${attempts}/${maxAttempts})...`
          );

          try {
            const status = await apiService.checkCalendarAuth();
            if (status) {
              console.log("Auth polling detected successful authentication");
              clearInterval(checkInterval);
              
              // Add a small delay before updating state to ensure everything is ready
              setTimeout(() => {
                setIsAuthenticated(true);
                setIsCheckingAuth(false);

                // Get user profile after successful authentication
                apiService.getUserProfile()
                  .then(profile => {
                    setUserName(profile.name);
                    console.log("Profile fetched successfully:", profile);
                  })
                  .catch(profileError => {
                    console.error("Error fetching profile:", profileError);
                  });
              }, 100);
            } else if (attempts >= maxAttempts) {
              console.log("Auth polling max attempts reached");
              clearInterval(checkInterval);
            }
          } catch (error) {
            console.error("Error during auth polling:", error);
            if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
            }
          }
        }, 2000); // Check every 2 seconds
      };

      pollAuthStatus();
    } catch (error) {
      console.error("Failed to initiate auth:", error);
    } finally {
      setIsCalendarAuthPending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCalendarAuthPending(true);
      setConflictError(null);

      const threadId = await createThread(inputText);

      console.log("Thread created with ID:", threadId);
      navigate(`/chat/${threadId}`);
    } catch (error: any) {
      if (error.type === "CALENDAR_CONFLICT") {
        setConflictError({
          error: error.error,
          suggestion: error.suggestion,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "Calendar authentication required"
      ) {
        // Auth window is already opened by the ApiService
        // wait for it to complete
        return;
      }
      console.error("Failed to create thread:", error);
    } finally {
      setIsCalendarAuthPending(false);
    }

    console.log("Submitted:", inputText);
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(event);
      }
    },
    [handleSubmit]
  );

  const handlePromptClick = (promptId: string) => {
    setSelectedPrompt(promptId);
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) {
      setInputText(prompt.title);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="auth-loading">
        <img src={owldooLogo} alt="Owldoo Logo" width="80" height="80" className="loader-logo" />
        <div className="spinner"></div>
        <div className="loader-text">Checking your authentication...</div>
      </div>
    );
  }

  if (isCalendarAuthPending) {
    return (
      <div className="auth-loading">
        <img src={owldooLogo} alt="Owldoo Logo" width="80" height="80" className="loader-logo" />
        <div className="spinner"></div>
        <div className="loader-text">Connecting to Google Calendar...</div>
      </div>
    );
  }

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

  const handleLogout = async () => {
    try {
      await apiService.logout();
      setIsAuthenticated(false);
      setUserName("");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
         {/* TODO: move logout button to chat threads page */}
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
        {/* <div className="compose-input-actions">
          <button type="button" className="compose-action-button">
            <Paperclip size={20} />
            Add Attachment
          </button>
          <button type="button" className="compose-action-button">
            <ImageIcon size={20} />
            Use Image
          </button>
        </div> */}
        <button type="submit" className="compose-submit-button">
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
                      conflictError.suggestion!
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
