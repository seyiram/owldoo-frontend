import "./ChatThread.css";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PropagateLoader } from "react-spinners";
import { useChatStore } from "../../../store/useChatStore";

const ChatThread: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const { threads, isLoading, error, sendMessage, getThreadHistory } =
    useChatStore();

  const [newMessage, setNewMessage] = useState("");

  // Get current thread
  const currentThread = threads.find((thread) => thread.id === threadId);
  console.log("Current thread:", currentThread);
  console.log("Get thread history:", getThreadHistory);
  console.log("threads:", threads);

  useEffect(() => {
    getThreadHistory();
  }, [getThreadHistory]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(event.target.value);
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === "") return;

    try {
      await sendMessage(newMessage, threadId!);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
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
              <button className="new-chat-button">+ New Chat</button>
            </div>
            <div className="search-bar">
              <input type="text" placeholder="Search" />
            </div>
            <nav className="sidebar-nav">
              <ul>
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
              </ul>
              <div className="history-list">
                <ul>
                  <li>
                    <a href="#">
                      What cross-selling oppo...
                      <span className="timestamp">15m</span>
                    </a>
                  </li>
                  <li>
                    <a href="#">
                      What are some common
                      <span className="timestamp">35m</span>
                    </a>
                  </li>
                  <li>
                    <a href="#">
                      Give me an example of...
                      <span className="timestamp">15m</span>
                    </a>
                  </li>
                  <li>
                    <a href="#">
                      Write a 100-characte...
                      <span className="timestamp">15m</span>
                    </a>
                  </li>
                  <li>
                    <a href="#">
                      Compose a blog post of...
                      <span className="timestamp">35m</span>
                    </a>
                  </li>
                </ul>
                <button className="show-more">Show more</button>
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
                  <div className="message-content">{message.content}</div>
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
                className="message-input"
              />
              <button
                className="send-button"
                onClick={handleSendMessage}
              ></button>
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
