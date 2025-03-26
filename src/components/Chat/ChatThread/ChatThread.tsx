import "./ChatThread.css";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Send, Settings, Clock, Focus, Calendar } from "lucide-react";
import { PropagateLoader } from "react-spinners";
import { useChatStore } from "../../../store/useChatStore";
import formatCalendarResponse from "../../../helpers/formatCalendarResponse";
import { apiService } from "../../../api/api";
import { useAuthStore } from "../../../store/useAuthStore";
import { AuthState } from "../../../types/auth.types";
import { formatDateTime } from "../../../utils/dateUtils";
import { v4 as uuid } from "uuid";
import { Thread, Message, MessageSender } from "../../../types/chat.types";

// Set to false unless actively debugging
const DEBUG = false;

const ChatThread: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const [visibleThreads, setVisibleThreads] = useState(10);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const navigate = useNavigate();

  const threads = useChatStore((state) => state.threads);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const getThreadHistory = useChatStore((state) => state.getThreadHistory);
  const queueAgentTask = useChatStore((state) => state.queueAgentTask);
  const getThreadById = useChatStore((state) => state.getThreadById); // Add getThreadById function

  const [newMessage, setNewMessage] = useState("");
  const isAuthenticated = useAuthStore(
    (state: AuthState) => state.isAuthenticated
  );
  const isCheckingAuth = useAuthStore(
    (state: AuthState) => state.isCheckingAuth
  );
  const userName = useAuthStore((state: AuthState) => state.userName);
  const [isTyping, setIsTyping] = useState(false);

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

  if (DEBUG) {
    console.log("Current thread:", currentThread);
    console.log("threads:", threads);
    console.log("threadId:", threadId);
    console.log("threads length:", threads.length);
    if (threads.length > 0) {
      console.log("Thread IDs in store:", threads.map(t => t.id));
    }
  }

  // Use refs to track if we've already loaded thread history and checked auth
  const historyLoadedRef = useRef(false);
  const authCheckedRef = useRef(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Unified auth check effect - does authentication check and handles redirect in one effect
  useEffect(() => {
    const checkAuth = async () => {
      if (!authCheckedRef.current) {
        setAuthChecking(true);
        
        // Check if we have a recent auth check first
        const hasAuthCookie = document.cookie.includes('auth_session=true');
        const authStore = useAuthStore.getState();
        const now = Date.now();
        
        // Only do a server check if cookie is missing or last check was a while ago
        if (!hasAuthCookie || now - authStore.lastChecked > authStore.checkInterval) {
          await authStore.checkAuthStatus();
        }
        
        authCheckedRef.current = true;
        setAuthChecking(false);
        
        // Handle redirect if needed
        if (!authStore.isAuthenticated) {
          navigate("/");
        }
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Load specific thread if threadId is in URL, otherwise load history
  useEffect(() => {
    if (DEBUG) {
      console.log("THREAD LOADING EFFECT - Auth state:", { 
        authCheckedRef: authCheckedRef.current,
        isAuthenticated,
        isCheckingAuth, 
        threadId,
        historyLoadedRef: historyLoadedRef.current
      });
    }
    
    // Only load data if we've confirmed authentication and haven't loaded history yet
    if (!historyLoadedRef.current && authCheckedRef.current && isAuthenticated) {
      historyLoadedRef.current = true; // Mark as loaded right away to prevent duplicate calls
      
      // Always load thread history first to populate the sidebar
      getThreadHistory();
      
      if (threadId) {
        // Check if the thread is already in the store first
        const existingThread = threads.find(t => t.id === threadId);
        
        if (existingThread && existingThread.messages && existingThread.messages.length > 0) {
          if (DEBUG) {
            console.log("Thread already in store, using cached data");
          }
          // Thread is already loaded, just set the current thread ID
          useChatStore.setState(state => ({
            ...state,
            currentThreadId: threadId,
            isLoading: false
          }));
        } else {
          // Thread not in store, need to load it
          if (DEBUG) {
            console.log("Loading specific thread by ID:", threadId);
          }
          
          // Use the existing getThreadById function from the store
          getThreadById(threadId);
        }
      }
    }
  }, [threadId, getThreadById, getThreadHistory, isAuthenticated, threads, authCheckedRef]);

  // Handle pending agent task if navigated from ChatCompose
  useEffect(() => {
    const pendingTask = localStorage.getItem("pendingAgentTask");
    const pendingThreadId = localStorage.getItem("pendingAgentTaskThreadId");

    if (pendingTask && pendingThreadId && pendingThreadId === threadId) {
      // Find if there's a bot message with the pending indicator
      const thread = threads.find((t) => t.id === threadId);
      const hasPendingMessage = thread?.messages.some(
        (m) => m.sender === "bot" && m.content === "_PENDING_AGENT_TASK_"
      );

      if (hasPendingMessage) {
        // Queue the task now that we're in the ChatThread component
        queueAgentTask(pendingTask, threadId);

        // Clear the pending task data
        localStorage.removeItem("pendingAgentTask");
        localStorage.removeItem("pendingAgentTaskThreadId");
      }
    }
  }, [threadId, threads, queueAgentTask]);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewMessage(event.target.value);
    },
    []
  );

  const handleSendMessage = React.useCallback(async () => {
    if (newMessage.trim() === "") return;

    try {
      setIsTyping(true); // Set typing state before sending

      // Find current thread to determine if we need to convert it to a conversation
      const thread = threads.find((t) => t.id === threadId);

      // For debugging
      console.log("Current thread before sending message:", thread);

      // Get the current state
      const store = useChatStore.getState();

      // Create message objects
      const userMessage = {
        id: uuid(),
        sender: "user" as MessageSender,
        content: newMessage,
        timestamp: new Date().toISOString(),
      };

      const botMessage = {
        id: uuid(),
        sender: "bot" as MessageSender,
        content: "Processing your request...",
        timestamp: new Date().toISOString(),
      };

      // Create a single update function that properly updates the threads array
      const updatedThreads = store.threads.map((thread) => {
        if (thread.id === threadId) {
          return {
            ...thread,
            messages: [...thread.messages, userMessage, botMessage],
          };
        }
        return thread;
      });

      // Store these IDs for reference in streaming updates
      const userMessageId = userMessage.id;
      const botMessageId = botMessage.id;

      // Update state once with the new messages
      store.setThreads(updatedThreads);

      console.log(
        "Starting direct agent task for message in thread:",
        threadId
      );

      // Use the agent API directly instead of going through conversation or chat APIs
      try {
        // Queue agent task directly for the thread
        const stream = await apiService.queueAgentTask(newMessage, 1, {
          threadId,
        });

        if (stream) {
          const reader = stream.getReader();
          let botContent = "Okay, let's process that task:\n";

          // Process the stream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Add artificial delay for more natural typing effect
            await new Promise((resolve) => setTimeout(resolve, 25));

            // Append new chunk to bot's message
            const newContent = new TextDecoder().decode(value);
            botContent += newContent;

            // Get current state to avoid race conditions
            const store = useChatStore.getState();

            // Create a new threads array with the updated message
            const updatedThreads = store.threads.map((thread) => {
              if (thread.id === threadId) {
                return {
                  ...thread,
                  messages: thread.messages.map((msg) =>
                    msg.id === botMessageId
                      ? {
                          ...msg,
                          content: botContent,
                        }
                      : msg
                  ),
                };
              }
              return thread;
            });

            // Update state with a single operation
            store.setThreads(updatedThreads);
          }
        }
      } catch (agentError) {
        console.error("Agent processing failed:", agentError);

        // Get current state
        const store = useChatStore.getState();

        // Create a new threads array with the error message
        const updatedThreads = store.threads.map((thread) => {
          if (thread.id === threadId) {
            return {
              ...thread,
              messages: thread.messages.map((msg) =>
                msg.id === botMessageId
                  ? {
                      ...msg,
                      content:
                        "Sorry, I encountered an error processing your request: " +
                        (agentError instanceof Error
                          ? agentError.message
                          : String(agentError)),
                    }
                  : msg
              ),
            };
          }
          return thread;
        });

        // Update state with a single operation
        store.setThreads(updatedThreads);

        // Also try regular message API as fallback
        try {
          console.log("Falling back to regular message API");
          await sendMessage(newMessage, threadId!);
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
        }
      }

      setNewMessage("");
      setIsTyping(false); // Clear typing state after completion
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsTyping(false); // Clear typing state on error
    }
  }, [newMessage, sendMessage, threadId, threads]);

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

  const renderMessage = (message: Message): JSX.Element | string => {
    if (message.sender === "bot") {
      // Process the streaming data format that shows raw SSE messages
      if (
        message.content.includes("Okay, let's process that task:") &&
        message.content.includes("data: {")
      ) {
        try {
          // Extract all data fragments from the SSE response
          const dataMatches = [
            ...message.content.matchAll(/data: (\{.*?\})\n\n/g),
          ];
          if (dataMatches && dataMatches.length > 0) {
            // Extract event data and calendar result
            let eventData: any = null;
            let calendarResult: any = null;
            let parsedCommand: any = null;
            let finalMessage = "Processing your request...";
            let processingSteps = [];

            // Find the appropriate message to display
            for (const match of dataMatches) {
              try {
                const data = JSON.parse(match[1]);

                // Collect processing steps
                if (data.message) {
                  processingSteps.push(data.message);
                }

                // Get parsed command data
                if (data.parsedCommand) {
                  parsedCommand = data.parsedCommand;
                }

                // Look for the "result" field containing event data
                if (data.result && data.result.event) {
                  eventData = data.result.event;
                  calendarResult = data.result;
                }

                // Look for a success message
                if (data.success === true && data.created === true) {
                  finalMessage =
                    data.message || "Calendar event created successfully!";
                }
              } catch (jsonError) {
                console.error("Error parsing JSON from data match:", jsonError);
              }
            }

            // If we found event data, format a nice response with process steps
            if (eventData && parsedCommand) {
              const eventStart = new Date(
                eventData.start.dateTime || eventData.start.date
              );
              const eventEnd = new Date(
                eventData.end.dateTime || eventData.end.date
              );

              // Build process steps content
              const formattedContent =
                `I will ${
                  parsedCommand.action
                } ${parsedCommand.title.toLowerCase()}\n` +
                "Here's what I'm doing:\n" +
                "1. Understanding your request\n" +
                `- Command type: ${parsedCommand.action.toUpperCase()}\n` +
                "2. Parsing time details:\n" +
                `- Start: ${new Date(
                  parsedCommand.startTime
                ).toLocaleString()}\n` +
                `- Duration: ${parsedCommand.duration} minutes\n` +
                "3. Creating calendar event:\n" +
                `- Title: ${eventData.summary}\n` +
                `- Start: ${eventStart.toLocaleString()}\n` +
                `- End: ${eventEnd.toLocaleString()}\n`;

              // Build a nicely formatted response with the process steps and event details
              return (
                <div className="bot-response">
                  <div className="process-details">
                    {formattedContent.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={`process-line ${
                          line.startsWith("- ")
                            ? "process-detail"
                            : line.match(/^\d\./)
                            ? "process-step"
                            : ""
                        }`}
                        style={{
                          animationDelay: `${i * 100}ms`,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                    <div
                      className="process-step"
                      style={{ animationDelay: "1000ms", marginTop: "12px" }}
                    >
                      4. Event created successfully! ✅
                    </div>
                  </div>

                  <div className="event-card">
                    <div className="event-title">{eventData.summary}</div>
                    <div className="event-time">
                      {eventStart.toLocaleString([], {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {eventEnd.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {eventData.description && (
                      <div className="event-description">
                        {eventData.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // If we have parsedCommand but no event (something failed)
            if (parsedCommand && !eventData) {
              const formattedContent =
                `I attempted to ${
                  parsedCommand.action
                } ${parsedCommand.title.toLowerCase()}\n` +
                "Here's what happened:\n" +
                "1. Understanding your request\n" +
                `- Command type: ${parsedCommand.action.toUpperCase()}\n` +
                "2. Parsing time details:\n" +
                `- Start: ${new Date(
                  parsedCommand.startTime
                ).toLocaleString()}\n` +
                `- Duration: ${parsedCommand.duration} minutes\n` +
                "3. Attempted to create calendar event but encountered an issue";

              return (
                <div className="bot-response">
                  <div className="process-details">
                    {formattedContent.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={`process-line ${
                          line.startsWith("- ")
                            ? "process-detail"
                            : line.match(/^\d\./)
                            ? "process-step"
                            : ""
                        }`}
                        style={{
                          animationDelay: `${i * 100}ms`,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                    <div
                      className="process-step error-message"
                      style={{ animationDelay: "1000ms", marginTop: "12px" }}
                    >
                      ⚠️ {finalMessage}
                    </div>
                  </div>
                </div>
              );
            }

            // Fallback for when all parsing fails
            return (
              <div className="bot-response">
                <div style={{ whiteSpace: "pre-wrap" }}>{finalMessage}</div>
              </div>
            );
          }
        } catch (e) {
          console.error("Error parsing streaming data:", e);
        }
      }

      // First check if message is a raw streaming response containing SSE data format
      if (
        message.content.includes("data: {") &&
        message.content.includes('"type":')
      ) {
        // Extract the actual text content from the SSE data format
        try {
          // Extract content portions
          const contentMatches = [
            ...message.content.matchAll(
              /data: {"type":"content","text":"([^"]+)"}/g
            ),
          ];
          if (contentMatches && contentMatches.length > 0) {
            // Combine all content fragments
            const actualContent = contentMatches
              .map((match) => match[1])
              .join("");

            // Check for completion message in final response
            if (
              actualContent.toLowerCase().includes("sorry") ||
              actualContent.toLowerCase().includes("couldn't") ||
              actualContent.toLowerCase().includes("error") ||
              actualContent.toLowerCase().includes("not available")
            ) {
              return (
                <div className="bot-response error-message">
                  <div style={{ whiteSpace: "pre-wrap" }}>{actualContent}</div>
                </div>
              );
            }

            return (
              <div className="bot-response">
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {actualContent || "I'll process your request..."}
                </div>
              </div>
            );
          }

          // If we couldn't extract content, check if it's a complete JSON response
          const jsonMatch = message.content.match(/data: (\{.*\})/);
          if (jsonMatch) {
            try {
              const jsonData = JSON.parse(jsonMatch[1]);
              if (jsonData.content) {
                return (
                  <div className="bot-response">
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {jsonData.content}
                    </div>
                  </div>
                );
              }
            } catch (e) {
              // JSON parsing failed, continue with other checks
            }
          }
        } catch (e) {
          console.error("Error parsing SSE content:", e);
        }
      }

      // Next check if this is an agent process message
      const isProcessMessage =
        message.content.includes("Here's what I'm doing:") ||
        message.content.includes("Step ") ||
        message.content.includes("I'll ") ||
        message.content.includes("Understanding your request") ||
        message.content.includes("Parsing command") ||
        message.content.includes("Creating calendar") ||
        /\d\.\s/.test(message.content);

      if (isProcessMessage) {
        return (
          <div className="bot-response">
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
                  style={{
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  {line}
                </div>
              ))}
              {message.content === "" && isTyping && (
                <span className="cursor" />
              )}
            </div>
          </div>
        );
      }

      // If not an SSE message or process message, try to parse as JSON
      try {
        const jsonContent = JSON.parse(message.content);

        // Handle NLP analysis response
        if (jsonContent.analysis && jsonContent.analysis.primaryIntent) {
          const analysis = jsonContent.analysis;
          const entities = analysis.entities || {};

          // Format entity info for display
          const entitySummary = Object.entries(entities)
            .filter(([_, entityList]) => (entityList as any[]).length > 0)
            .map(([type, list]) => {
              const entityValues = (list as any[])
                .map((e) => e.value)
                .join(", ");
              return `- ${type}: ${entityValues}`;
            })
            .join("\n");

          // Create a well-formatted analysis message
          const formattedContent =
            `I understood your request as: ${analysis.primaryIntent}\n` +
            `Here's what I recognized:\n` +
            (entitySummary
              ? entitySummary
              : "- No specific entities detected") +
            `\n\nTemporal context: ${
              analysis.temporalContext?.timeframe || "PRESENT"
            }\n` +
            (jsonContent.suggestedResponse
              ? `\nSuggested response: ${jsonContent.suggestedResponse}`
              : "");

          return (
            <div className="bot-response">
              <div className="process-details">
                {formattedContent.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className={`process-line ${
                      line.startsWith("- ")
                        ? "process-detail"
                        : line.match(/^I understood/)
                        ? "process-step"
                        : line.match(/^Here's what/)
                        ? "process-step"
                        : line.match(/^Temporal context/)
                        ? "process-step"
                        : line.match(/^Suggested response/)
                        ? "process-step highlight"
                        : ""
                    }`}
                    style={{
                      animationDelay: `${i * 100}ms`,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // If it's a parsed command response, format it nicely
        if (jsonContent.action && jsonContent.title) {
          // Check if this is a completed action
          const isSuccess =
            jsonContent.status === "completed" ||
            jsonContent.result?.created === true;

          if (isSuccess) {
            return (
              <div className="bot-response success-message">
                <div style={{ whiteSpace: "pre-wrap" }}>
                  Great! I've scheduled "{jsonContent.title}" for{" "}
                  {new Date(
                    jsonContent.startTime || jsonContent.result?.startTime
                  ).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  .
                </div>
              </div>
            );
          }

          // Default formatting for command responses
          const formattedContent =
            `I will schedule ${jsonContent.title.toLowerCase()} from ${new Date(
              jsonContent.startTime
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}\n` +
            "Here's what I'm doing:\n" +
            "1. Understanding your request:\n" +
            `${currentThread?.messages[0]?.content || "schedule an event"}\n` +
            "2. Parsing command details:\n" +
            `- Type: ${jsonContent.action}\n` +
            `- Start: ${new Date(jsonContent.startTime).toLocaleString()}\n` +
            `- Duration: ${jsonContent.duration} minutes\n` +
            "3. Creating calendar event:\n" +
            `- Title: ${jsonContent.title}\n` +
            `- Start: ${new Date(jsonContent.startTime).toLocaleString()}\n` +
            `- End: ${new Date(
              new Date(jsonContent.startTime).getTime() +
                jsonContent.duration * 60000
            ).toLocaleString()}\n` +
            "4. Event created successfully!";

          return (
            <div className="bot-response">
              <div className="process-details">
                {formattedContent.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className={`process-line ${
                      line.startsWith("- ")
                        ? "process-detail"
                        : line.match(/^\d\./)
                        ? "process-step"
                        : ""
                    }`}
                    style={{
                      animationDelay: `${i * 100}ms`,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          );
        }
      } catch (e) {
        // If JSON parsing fails, render normal text
        return (
          <div className="bot-response">
            <div style={{ whiteSpace: "pre-wrap" }}>
              {message.content}
              {message.content === "" && isTyping && (
                <span className="cursor" />
              )}
            </div>
          </div>
        );
      }
    }
    return message.content;
  };

  return (
    <div className="thread-interface">
      {isLoading || isCheckingAuth || authChecking ? (
        <div className="loader-container">
          <PropagateLoader
            color="#9333ea"
            loading={isLoading || isCheckingAuth || authChecking}
          />
        </div>
      ) : !isAuthenticated ? (
        <div className="auth-container">
          <h2>Authentication Required</h2>
          <p>You need to log in to view this chat thread.</p>
          <button className="google-auth-button" onClick={() => navigate('/')}>
            Go to Home
          </button>
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
                        <Link to={`/chat/${thread.id}`}>
                          <div className="thread-preview">
                            <span className="thread-title">
                              {thread.messages[0]?.content?.slice(0, 40) || "No content"}
                              {thread.messages[0]?.content?.length > 40
                                ? "..."
                                : ""}
                            </span>
                            <span className="timestamp">
                              {thread.messages[0]?.timestamp 
                                ? formatDateTime(thread.messages[0].timestamp)
                                : "Unknown date"}
                            </span>
                          </div>
                        </Link>
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

            <div className="settings-menu">
              <h3>
                <Settings size={16} />
                <span>Settings</span>
              </h3>
              <ul>
                <li>
                  <Link to="/settings/working-hours">
                    <Clock size={16} />
                    <span>Working Hours</span>
                  </Link>
                </li>
                <li>
                  <Link to="/settings/meeting-preferences">
                    <Calendar size={16} />
                    <span>Meeting Preferences</span>
                  </Link>
                </li>
                <li>
                  <Link to="/settings/focus-time">
                    <span className="focus-icon">⚡</span>
                    <span>Focus Time</span>
                  </Link>
                </li>
              </ul>
            </div>

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
              <div className="header-icons" />
            </div>
            <div className="thread-messages">
              <div className={`debug-info ${!showDebugPanel && !DEBUG ? 'hidden' : ''}`}>
                <button 
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="debug-toggle"
                >
                  {showDebugPanel ? 'Hide Debug' : 'Show Debug'}
                </button>
                {(showDebugPanel || DEBUG) && (
                  <>
                    <p>Thread ID: {threadId}</p>
                    <p>Current Thread Messages Count: {currentThread?.messages?.length || 0}</p>
                    <p>Total Threads in Store: {threads.length}</p>
                    <p>Thread IDs in Store: {threads.map(t => t.id).join(', ')}</p>
                    <button 
                      onClick={() => getThreadHistory()} 
                      className="debug-action"
                    >
                      Reload Thread History
                    </button>
                  </>
                )}
              </div>}
              
              {currentThread?.messages ? (
                currentThread.messages.map((message) => (
                  <div
                    key={message.id} // Changed from index to message.id
                    className={`message-item ${
                      message.sender === "user" ? "user-message" : "bot-message"
                    }`}
                  >
                    <div className="message-content">
                      {renderMessage(message)}
                    </div>
                    <span className="message-timestamp">
                      {formatDateTime(message.timestamp)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="no-messages">
                  No messages found in this thread. The thread may be loading or not available.
                </div>
              )}
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
