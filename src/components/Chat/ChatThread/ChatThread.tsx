import "./ChatThread.css";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { PropagateLoader } from "react-spinners";
import { useChatStore } from "../../../store/useChatStore";
import formatCalendarResponse from "../../../helpers/formatCalendarResponse";

const ChatThread: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const [visibleThreads, setVisibleThreads] = useState(10);
  // const { threads, isLoading, error, sendMessage, getThreadHistory } =
  // useChatStore();
  const navigate = useNavigate();

  const threads = useChatStore((state) => state.threads);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const getThreadHistory = useChatStore((state) => state.getThreadHistory);

  const [newMessage, setNewMessage] = useState("");

  const handleNewChat = React.useCallback(() => {
    navigate("/");
  }, [navigate]);

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
      {isLoading ? (
        <div className="loader-container">
          <PropagateLoader color="#9333ea" loading={isLoading} />
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
              {/* <ul>
                <li className="nav-item folder">
                  <span className="nav-item-icon"></span>
                  <span className="nav-item-text">Folder</span>
                  <span className="nav-item-badge">8</span>
                </li>
                <li className="nav-item favorite">
                  <span className="nav-item-icon"></span>
                  <span className="nav-item-text">Favorite</span>
                  <span className="nav-item-badge">15</span>
                </li>
                <li className="nav-item archive">
                  <span className="nav-item-icon"></span>
                  <span className="nav-item-text">Archive</span>
                  <span className="nav-item-badge">36</span>
                </li>
              </ul> */}
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
                          {thread.messages[0].content}
                          <span className="timestamp">
                            {thread.messages[0].timestamp}
                          </span>
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
                <p className="user-name">Brooklyn Simmons</p>
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
                    {message.sender === "bot"
                      ? formatCalendarResponse(message.content)
                      : message.content}
                    {message.hasConflict && (
                      <div className="conflict-actions">
                        <button onClick={() => console.log("Resolve conflict")}>
                          Accept suggestion
                        </button>
                        <button onClick={() => console.log("Ignore conflict")}>
                          Find another time
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="message-timestamp">{message.timestamp}</span>
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
