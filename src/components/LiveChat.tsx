import {
  useEffect,
  useRef,
  useState,
} from "react";

import { connectSocket } from "../services/socket";
import type { FormEvent } from "react";
import "../styles/LiveChat.css";

export interface LiveChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: "streamer" | "viewer";
  text: string;
  timestamp: number;
}

interface LiveChatProps {
  roomId: string;
  userName: string;
  role: "streamer" | "viewer";
  onHide?: () => void;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LiveChat({
  roomId,
  userName,
  role,
  onHide,
}: LiveChatProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [chatError, setChatError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [socketId, setSocketId] = useState("");

  useEffect(() => {
    const socket = connectSocket();

    const handleConnect = () => {
      setSocketId(socket.id || "");
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const requestHistory = () => {
      if (socket.connected && roomId) {
        socket.emit("live-chat-history-request", { roomId });
      }
    };

    const handleHistory = (history: LiveChatMessage[]) => {
      if (!Array.isArray(history)) {
        return;
      }

      setMessages(history.slice(-100));
    };

    const handleChatError = (data: { message?: string }) => {
      setChatError(data?.message || "Unable to send message.");
    };

    const handleMessage = (message: LiveChatMessage) => {
      setChatError("");
      if (!message || message.text?.trim() === "") {
        return;
      }

      setMessages((previous) => {
        if (previous.some((item) => item.id === message.id)) {
          return previous;
        }

        return [...previous, message].slice(-100);
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("live-chat-history", handleHistory);
    socket.on("live-chat-message", handleMessage);
    socket.on("live-chat-error", handleChatError);

    setSocketId(socket.id || "");
    setConnected(socket.connected);

    if (socket.connected) {
      requestHistory();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("live-chat-history", handleHistory);
      socket.off("live-chat-message", handleMessage);
      socket.off("live-chat-error", handleChatError);
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanText = text.trim();

    if (!cleanText || !roomId) {
      return;
    }

    const socket = connectSocket();

    if (!socket.connected) {
      return;
    }

    socket.emit("live-chat-message", {
      roomId,
      text: cleanText,
      senderName: userName,
      role,
    });

    setText("");
  };

  const remainingCharacters = 500 - text.length;

  return (
    <div className="live-chat">
      <div className="live-chat-header">
        <div className="live-chat-title">
          <div>
            <h2>Live Chat</h2>
            <p>
              {connected
                ? "Messages are shared with everyone watching."
                : "Reconnecting to chat..."}
            </p>
          </div>

          <div className="live-chat-header-actions">
            <span
              className={
                connected
                  ? "live-chat-status live-chat-status-on"
                  : "live-chat-status"
              }
              aria-label={
                connected
                  ? "Chat connected"
                  : "Chat disconnected"
              }
            />

            {onHide && (
              <button
                type="button"
                className="live-chat-hide"
                onClick={onHide}
                aria-label="Hide live chat"
              >
                Hide
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="live-chat-messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="live-chat-empty">
            <strong>Start the conversation</strong>
            <span>Say hello to everyone watching.</span>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage =
              message.senderId === socketId;

            return (
              <div
                className={
                  isOwnMessage
                    ? "live-chat-message live-chat-message-own"
                    : "live-chat-message"
                }
                key={message.id}
              >
                <div className="live-chat-message-meta">
                  <strong>
                    {message.senderName}
                  </strong>

                  {message.role === "streamer" && (
                    <span className="live-chat-host-badge">
                      Host
                    </span>
                  )}

                  <time dateTime={new Date(message.timestamp).toISOString()}>
                    {formatTime(message.timestamp)}
                  </time>
                </div>

                <p>{message.text}</p>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {chatError && (
        <p className="live-chat-error" role="alert">
          {chatError}
        </p>
      )}

      <form
        className="live-chat-form"
        onSubmit={sendMessage}
      >
        <div className="live-chat-input-wrap">
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              connected
                ? "Write a message..."
                : "Connecting..."
            }
            maxLength={500}
            disabled={!connected}
            aria-label="Chat message"
          />

          {text.length > 0 && (
            <span className="live-chat-character-count">
              {remainingCharacters}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!connected || !text.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
