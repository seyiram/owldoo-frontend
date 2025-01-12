import React, { useState } from "react";
import {
  RefreshCw,
  User,
  Mail,
  FileText,
  SlidersHorizontal,
  Paperclip,
  Image as ImageIcon,
  Send,
} from "lucide-react";
import "./ChatCompose.css";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../../../store/useChatStore";


interface Prompt {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const prompts: Prompt[] = [
  {
    id: "todo",
    title: "Write a to-do list for a personal project or task",
    icon: <User size={20} />,
  },
  {
    id: "email",
    title: "Generate an email to reply to a job offer",
    icon: <Mail size={20} />,
  },
  {
    id: "summary",
    title: "Summarise this article or text for me in one paragraph",
    icon: <FileText size={20} />,
  },
  {
    id: "ai",
    title: "How does AI work in a technical capacity",
    icon: <SlidersHorizontal size={20} />,
  },
];

const ChatCompose: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState<string>("");
  const { createThread, isLoading, error } = useChatStore();
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isCalendarAuthPending, setIsCalendarAuthPending] = useState(false);
  const [conflictError, setConflictError] = useState<{
    error: string;
    suggestion?: string;
  } | null>(null);

  const handlePromptClick = (promptId: string) => {
    setSelectedPrompt(promptId);
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) {
      setInputText(prompt.title);
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
          placeholder="Ask whatever you want...."
          className="compose-input"
        />
        <div className="compose-input-actions">
          <button type="button" className="compose-action-button">
            <Paperclip size={20} />
            Add Attachment
          </button>
          <button type="button" className="compose-action-button">
            <ImageIcon size={20} />
            Use Image
          </button>
        </div>
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
