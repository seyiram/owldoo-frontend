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
import { useAuthStore } from "../../../store/useAuthStore";
import { useAgentStore } from "../../../store/useAgentStore";
import { v4 as uuid } from "uuid";

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
  const queueAgentTask = useChatStore((state) => state.queueAgentTask);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isCalendarAuthPending, setIsCalendarAuthPending] = useState(false);
  const [conflictError, setConflictError] = useState<{
    error: string;
    suggestion?: string;
  } | null>(null);

  const { isAuthenticated, isCheckingAuth, userName, checkAuthStatus, logout } =
    useAuthStore();

  const { queueTask } = useAgentStore();
  const createThread = useChatStore((state) => state.createThread);

  useEffect(() => {
    const now = Date.now();
    const lastChecked = parseInt(localStorage.getItem("lastChecked") || "0");

    // Only check auth if:
    // 1. Not authenticated AND
    // 2. Not currently checking AND
    // 3. Haven't checked in the last 5 seconds
    if (!isAuthenticated && !isCheckingAuth && now - lastChecked > 5000) {
      checkAuthStatus();
    }
  }, []); // Run only once on mount

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
                checkAuthStatus();
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
    let isAuth = false; // Define isAuth outside the try block
    try {
      setConflictError(null);

      // Check authentication status before creating a thread
      isAuth = await apiService.checkCalendarAuth();
      if (!isAuth) {
        setIsCalendarAuthPending(true);
        await handleGoogleAuth();
        return;
      }

      // Create a new thread first
      const threadId = await createThread(inputText);

      if (!threadId) {
        throw new Error("Failed to create thread");
      }

      // Now queue the agent task with the new thread ID
      await queueAgentTask(inputText, threadId);

      setInputText("");
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
      // Ensure this is only set to false if it was set to true earlier
      if (!isAuth) {
        setIsCalendarAuthPending(false);
      }
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
    await logout();
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
