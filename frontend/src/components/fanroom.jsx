import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/api.js";
import GifPicker from "./GifPicker.jsx";

const buildSocketUrl = (roomId, token) =>
  `ws://localhost:8000/fanrooms/ws/${roomId}?token=${encodeURIComponent(token)}`;

const presenceFallback = (value) => (typeof value === "number" ? value : 0);

export default function FanRoomPanel({
  room,
  onPresenceUpdate = () => {},
  enforceFavorite = true,
}) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [activeUsers, setActiveUsers] = useState(room?.active_users ?? 0);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const listRef = useRef(null);
  const socketRef = useRef(null);
  const favoriteTeam = useMemo(
    () => (user?.favorite_team || "").trim().toLowerCase(),
    [user?.favorite_team]
  );
  const isGlobalRoom = Boolean(room?.is_global);

  const canJoinRoom = useMemo(() => {
    if (!user || !room) return false;
    if (!enforceFavorite || isGlobalRoom) {
      return true;
    }
    return (
      favoriteTeam.length > 0 &&
      room.team_name.trim().toLowerCase() === favoriteTeam
    );
  }, [user, room, enforceFavorite, isGlobalRoom, favoriteTeam]);

  useEffect(() => {
    setMessages([]);
    setText("");
    setError(null);
    setActiveUsers(room?.active_users ?? 0);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (!room) {
      setStatus("idle");
    } else if (!token) {
      setStatus("unauthorized");
    } else if (!canJoinRoom) {
      setStatus(enforceFavorite && !isGlobalRoom ? "restricted" : "connecting");
    } else {
      setStatus("connecting");
    }
  }, [room?.id, token, canJoinRoom, enforceFavorite, isGlobalRoom]);

  useEffect(() => {
    if (room && typeof room.active_users === "number") {
      setActiveUsers(room.active_users);
    }
  }, [room?.active_users]);

  useEffect(() => {
    if (!room) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const history = await api.fetchFanRoomMessages(room.id);
        if (!cancelled) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
        if (!cancelled) {
          setError("Failed to load chat history.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [room?.id]);

  useEffect(() => {
    if (!room || !token || !canJoinRoom) {
      return;
    }

    const socket = new WebSocket(buildSocketUrl(room.id, token));
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "welcome" || data.type === "presence") {
          const count = presenceFallback(data.active_users);
          setActiveUsers(count);
          onPresenceUpdate(room.id, count);
        } else if (data.type === "chat_message") {
          setMessages((prev) => {
            if (prev.some((msg) => msg.message_id === data.message_id)) {
              return prev;
            }

            return [
              ...prev,
              {
                message_id: data.message_id,
                room_id: data.room_id,
                user_id: data.user_id,
                username: data.username,
                content: data.content,
                created_at: data.created_at,
                chat_date: data.chat_date,
              },
            ];
          });
        } else if (data.type === "error") {
          setError(data.message || "An error occurred.");
        }
      } catch (err) {
        console.error("Malformed websocket message:", err);
      }
    };

    socket.onerror = () => {
      setStatus("error");
      setError("WebSocket connection error.");
    };

    socket.onclose = (event) => {
      setStatus(event.wasClean ? "closed" : "error");
      if (event.reason) {
        setError(event.reason);
      }
      socketRef.current = null;
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [room?.id, token, canJoinRoom, onPresenceUpdate]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = text.trim();

    if (!trimmed || status !== "connected" || !socketRef.current) {
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ content: trimmed }));
      setText("");
    } catch (err) {
      console.error("Failed to send websocket message:", err);
      setError("Failed to send message.");
    }
  };

  const handleGifSelect = (gifUrl) => {
    if (status !== "connected" || !socketRef.current) {
      return;
    }

    try {
      // Send GIF URL as message content
      socketRef.current.send(JSON.stringify({ content: gifUrl }));
    } catch (err) {
      console.error("Failed to send GIF:", err);
      setError("Failed to send GIF.");
    }
  };

  // Check if message content is a GIF URL
  const isGifUrl = (content) => {
    return /\.gif(\?|$)/i.test(content) || /giphy\.com|gif/i.test(content);
  };

  if (!user) {
    return (
      <div className="p-4 bg-white rounded shadow-sm">
        <h3 className="text-lg font-semibold mb-2">
          {enforceFavorite ? "Fan Room" : "Community Chat"}
        </h3>
        <p className="text-sm text-gray-600">
          {enforceFavorite
            ? "Sign in to join your team's fan room and chat with fellow supporters."
            : "Sign in to join the community chat and talk with the entire FootySocial crowd."}
        </p>
      </div>
    );
  }

  if (enforceFavorite && !isGlobalRoom && !user.favorite_team) {
    return (
      <div className="p-4 bg-white rounded shadow-sm">
        <h3 className="text-lg font-semibold mb-2">Fan Room</h3>
        <p className="text-sm text-gray-600">
          Set your favorite team in your profile to unlock the daily fan chat.
        </p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-4 bg-white rounded shadow-sm">
        <h3 className="text-lg font-semibold mb-2">
          {enforceFavorite ? "Fan Room" : "Community Chat"}
        </h3>
        <p className="text-sm text-gray-600">
          {enforceFavorite
            ? "We could not find a fan room that matches your favorite team yet. Try refreshing."
            : "Loading the community chat. Please try again in a moment."}
        </p>
      </div>
    );
  }

  if (!canJoinRoom) {
    return (
      <div className="p-4 bg-white rounded shadow-sm">
        <h3 className="text-lg font-semibold mb-2">{room.display_name}</h3>
        {enforceFavorite && !isGlobalRoom ? (
          <p className="text-sm text-gray-600">
            You can only join the fan room for your favorite team: {user.favorite_team || "Unknown"}.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            We could not connect to this chat. Try refreshing the page.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">{room.display_name}</h3>
            <p className="text-xs text-gray-500">
              {isGlobalRoom
                ? "Open community chat • resets daily"
                : "Live chat resets daily"}
              {" • "}
              {activeUsers} supporter{activeUsers === 1 ? "" : "s"} online
            </p>
          </div>
          <span className={`text-xs font-semibold ${status === "connected" ? "text-green-600" : "text-gray-500"}`}>
            {status === "connected" ? "LIVE" : status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3" ref={listRef}>
        {messages.map((message) => (
          <div key={message.message_id} className="space-y-1">
            <div className="text-xs text-gray-500">
              {message.username} • {new Date(message.created_at).toLocaleTimeString()}
            </div>
            <div
              className={`inline-block px-3 py-2 rounded ${
                message.user_id === user.user_id ? "bg-sky-100 text-sky-900" : "bg-gray-100 text-gray-800"
              }`}
            >
              {isGifUrl(message.content) ? (
                <img
                  src={message.content}
                  alt="GIF"
                  className="max-w-xs max-h-48 rounded"
                />
              ) : (
                <span>{message.content}</span>
              )}
            </div>
          </div>
        ))}
        {!messages.length && (
          <p className="text-sm text-gray-500 text-center">
            Be the first to start the conversation today!
          </p>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 border-t bg-red-50">{error}</div>
      )}

      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowGifPicker(true)}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400"
            disabled={status !== "connected"}
            title="Send GIF"
          >
            GIF
          </button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Send a message..."
            disabled={status !== "connected"}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-sky-600 text-white rounded text-sm disabled:bg-gray-300"
            disabled={status !== "connected" || !text.trim()}
          >
            Send
          </button>
        </form>
      </div>

      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleGifSelect}
      />
    </div>
  );
}
