import React, { useState } from "react";
import {
  RefreshCw,
  UserCircle2,
  Mail,
  FileText,
  Settings,
  Paperclip,
  Image as ImageIcon,
  Send,
} from "lucide-react";
import "./ChatInterface.css";

interface Prompt {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const prompts: Prompt[] = [
  {
    id: "todo",
    title: "Write a to-do list for a personal project or task",
    icon: <UserCircle2 size={24} />,
  },
  {
    id: "email",
    title: "Generate an email to reply to a job offer",
    icon: <Mail size={24} />,
  },
  {
    id: "summary",
    title: "Summarise this article or text for me in one paragraph",
    icon: <FileText size={24} />,
  },
  {
    id: "ai",
    title: "How does AI work in a technical capacity",
    icon: <Settings size={24} />,
  },
];

const ChatInterface: React.FC = () => {
  const [inputText, setInputText] = useState<string>("");
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const handlePromptClick = (promptId: string) => {
    setSelectedPrompt(promptId);
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) {
      setInputText(prompt.title);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle submission logic here
    console.log("Submitted:", inputText);
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>
          Hi there, <span className="name">John</span>
        </h1>
        <h2>What would like to know?</h2>
        <p className="subtitle">
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
            <span className="prompt-icon">{prompt.icon}</span>
            <span className="prompt-text">{prompt.title}</span>
          </button>
        ))}
      </div>

      <div className="refresh-section">
        <button className="refresh-button">
          <RefreshCw size={20} />
          <span>Refresh Prompts</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask whatever you want...."
          className="chat-input"
        />
        <div className="input-actions">
          <button type="button" className="action-button">
            <Paperclip size={20} />
            Add Attachment
          </button>
          <button type="button" className="action-button">
            <ImageIcon size={20} />
            Use Image
          </button>
          <button type="submit" className="submit-button">
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
