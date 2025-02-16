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
} from "lucide-react";
import "./ChatCompose.css";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../../../store/useChatStore";
import { apiService } from "../../../api/api";

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

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsCheckingAuth(true);
      const status = await apiService.checkCalendarAuth();
      setIsAuthenticated(status);
    } catch (error) {
      console.error("Error checking authentication status:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { url } = await apiService.initiateCalendarAuth();
      // Open the auth window
      window.open(url, "CalendarAuth", "width=600,height=600");
      // Listen for auth completion
      window.addEventListener("message", async (event) => {
        if (event.data.type === "CALENDAR_AUTH_SUCCESS") {
          await checkAuthStatus();
        }
      });
    } catch (error) {
      console.error("Failed to initiate auth:", error);
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
      <div className="auth-loading">Checking authentication status...</div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <h1>Welcome to Owldoo</h1>
        <p>To get started, please connect your Google Calendar</p>
        <button className="google-auth-button" onClick={handleGoogleAuth}>
          Connect Google Calendar
        </button>
      </div>
    );
  }

  return (
    <div className="compose-container">
      <header className="compose-header">
        <h1>
          Hi there, <span className="compose-name">John</span>
        </h1>
        <h2>What would like to know?</h2>
        <p className="compose-subtitle">
          Use one of the most common prompts below or use your own to begin
        </p>
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
