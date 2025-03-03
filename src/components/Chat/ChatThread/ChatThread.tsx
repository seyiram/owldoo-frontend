import "./ChatThread.css";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { PropagateLoader } from "react-spinners";
import { useChatStore } from "../../../store/useChatStore";
import formatCalendarResponse from "../../../helpers/formatCalendarResponse";
import { apiService } from "../../../api/api";
import { useAuthStore } from "../../../store/useAuthStore";
import { AuthState } from "../../../types/auth.types";
import { formatDateTime } from "../../../utils/dateUtils";

const ChatThread: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const [visibleThreads, setVisibleThreads] = useState(10);
  const navigate = useNavigate();

  const threads = useChatStore((state) => state.threads);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const getThreadHistory = useChatStore((state) => state.getThreadHistory);
  const queueAgentTask = useChatStore((state) => state.queueAgentTask);

  const [newMessage, setNewMessage] = useState("");
  const isAuthenticated = useAuthStore(
    (state: AuthState) => state.isAuthenticated
  );
  const isCheckingAuth = useAuthStore(
    (state: AuthState) => state.isCheckingAuth
  );
  const userName = useAuthStore((state: AuthState) => state.userName);

  const handleNewChat = React.useCallback(() => {
    if (!isAuthenticated) {
      apiService.initiateCalendarAuth();
    } else {
      navigate("/");
    }
  }, [navigate, isAuthenticated]);

  // Get current thread
  const currentThread = React.useMemo(
    () => threads.find((thread) => thread.id === threadId),
    [threadId, threads]
  );

  console.log("Current thread:", currentThread);
  console.log("threads:", threads);

  useEffect(() => {
    getThreadHistory();
  }, [getThreadHistory]);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessage(event.target.value);
    },
    []
  );

  const handleSendMessage = React.useCallback(async () => {
    if (newMessage.trim() === "") return;

    try {
      await sendMessage(newMessage, threadId!);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [newMessage, sendMessage, threadId]);

  const handleSendAgentTask = React.useCallback(async () => {
    if (newMessage.trim() === "") return;

    try {
      await queueAgentTask(newMessage, threadId!);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to queue agent task:", error);
    }
  }, [newMessage, queueAgentTask, threadId]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleShowMore = () => {
    setVisibleThreads((prev) => prev + 5);
  };

  return (
    <div className="thread-interface">
      {isLoading || isCheckingAuth ? (
        <div className="loader-container">
          <PropagateLoader
            color="#9333ea"
            loading={isLoading || isCheckingAuth}
          />
        </div>
      ) : (
        <>
          <aside className="thread-sidebar">
            <div className="thread-sidebar-header">
              <button className="new-chat-button" onClick={handleNewChat}>
                + New Chat
              </button>
            </div>
            <div className="search-bar">
              <input type="text" placeholder="Search" />
            </div>
            <nav className="sidebar-nav">
              <div className="history-list">
                <ul>
                  {threads
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .slice(0, visibleThreads)
                    .map((thread) => (
                      <li key={thread.id}>
                        <a href={`/chat/${thread.id}`}>
                          <div className="thread-preview">
                            <span className="thread-title">
                              {thread.messages[0].content.slice(0, 40)}
                              {thread.messages[0].content.length > 40
                                ? "..."
                                : ""}
                            </span>
                            <span className="timestamp">
                              {formatDateTime(thread.messages[0].timestamp)}
                            </span>
                          </div>
                        </a>
                      </li>
                    ))}
                </ul>
                {threads.length > visibleThreads && (
                  <button className="show-more" onClick={handleShowMore}>
                    Show more
                  </button>
                )}
              </div>
            </nav>

            <div className="user-profile">
              <img
                src="profile.jpg"
                alt="User Profile"
                className="profile-picture"
              />
              <div>
                <p className="user-name">{userName}</p>
                <p className="user-role">Protal</p>
              </div>
            </div>
          </aside>

          <main className="chat-area">
            <div className="thread-header">
              <h2>Chat</h2>
              <div className="header-icons"></div>
            </div>
            <div className="thread-messages">
              {currentThread?.messages.map((message, index) => (
                <div
                  key={index}
                  className={`message-item ${
                    message.sender === "user" ? "user-message" : "bot-message"
                  }`}
                >
                  <div className="message-content">
                    {message.sender === "bot" ? (
                      <div className="bot-response">
                        {message.content.includes("Here's what I'm doing:") ? (
                          <div className="process-details">
                            {message.content.split("\n").map((line, i) => (
                              <div
                                key={i}
                                className={`process-line ${
                                  line.startsWith("- ")
                                    ? "process-detail"
                                    : line.match(/^\d\./)
                                    ? "process-step"
                                    : ""
                                }`}
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          formatCalendarResponse(message.content)
                        )}
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                  <span className="message-timestamp">
                    {formatDateTime(message.timestamp)}
                  </span>
                </div>
              ))}
            </div>
            <div className="message-input-area">
              <input
                type="text"
                placeholder="Enter a prompt here....."
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="message-input"
              />
              <button
                type="submit"
                className="send-button"
                onClick={handleSendMessage}
              >
                <Send size={20} />
              </button>
              <button
                type="button"
                className="send-agent-button"
                onClick={handleSendAgentTask}
              >
                Send to Agent
              </button>
            </div>
            {error && <p className="error-message">Error: {error}</p>}
            <p className="disclaimer">
              Disclaimer: Oowldoo has the potential to generate incorrect
              information.
            </p>
          </main>
        </>
      )}
    </div>
  );
};

export default ChatThread;
