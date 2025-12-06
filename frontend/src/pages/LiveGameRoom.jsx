import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/navbar.jsx";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/api.js";
import GifPicker from "../components/GifPicker.jsx";

const buildSocketUrl = (gameId, token) =>
  `ws://localhost:8000/livegame/ws/${gameId}?token=${encodeURIComponent(token)}`;

const presenceFallback = (value) => (typeof value === "number" ? value : 0);

export default function LiveGameRoom() {
  const location = useLocation();
  const { user, token } = useAuth();

  // Match data from navigation state
  const game = location.state?.match;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [teamStats, setTeamStats] = useState({ home: null, away: null });
  const [loadingStats, setLoadingStats] = useState(false);
  const [poll, setPoll] = useState({ home: 0, away: 0, userVote: null });

  const listRef = useRef(null);
  const socketRef = useRef(null);

  // Reset state when game changes
  useEffect(() => {
    setMessages([]);
    setText("");
    setError(null);
    setActiveUsers(0);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (!game) {
      setStatus("idle");
    } else if (!token) {
      setStatus("unauthorized");
    } else {
      setStatus("connecting");
    }
  }, [game, token]);

  // Load team stats
  useEffect(() => {
    if (!game) return;

    let cancelled = false;
    setLoadingStats(true);

    (async () => {
      try {
        const response = await fetch('http://localhost:8000/api/standings');
        const data = await response.json();
        const standings = Array.isArray(data) ? data : (data.standings || data.teams || []);
        
        if (!cancelled && Array.isArray(standings)) {
          const homeTeamStats = standings.find(
            team => team.team?.toLowerCase().trim() === game.home?.toLowerCase().trim()
          );
          const awayTeamStats = standings.find(
            team => team.team?.toLowerCase().trim() === game.away?.toLowerCase().trim()
          );
          
          setTeamStats({
            home: homeTeamStats || null,
            away: awayTeamStats || null
          });
          setLoadingStats(false);
        }
      } catch (err) {
        console.error("Failed to load team stats:", err);
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [game]);

  // Load chat history
  useEffect(() => {
    if (!game || !token) return;

    let cancelled = false;

    (async () => {
      try {
        const history = await api.fetchLiveGameMessages(game.id);
        if (!cancelled) {
          setMessages(Array.isArray(history) ? history : (history.messages || []));
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
        if (!cancelled && !err.message?.includes("404")) {
          setError("Failed to load chat history.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [game, token]);

  // WebSocket connection
  useEffect(() => {
    if (!game || !token) return;

    const socket = new WebSocket(buildSocketUrl(game.id, token));
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
        } else if (data.type === "chat_message") {
          setMessages((prev) => {
            if (prev.some((msg) => msg.message_id === data.message_id)) {
              return prev;
            }
            return [
              ...prev,
              {
                message_id: data.message_id,
                game_id: data.game_id,
                user_id: data.user_id,
                username: data.username,
                content: data.content,
                created_at: data.created_at,
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
  }, [game, token]);

  // Auto-scroll to bottom
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
      socketRef.current.send(JSON.stringify({ content: gifUrl }));
      setShowGifPicker(false);
    } catch (err) {
      console.error("Failed to send GIF:", err);
      setError("Failed to send GIF.");
    }
  };

  const handleVote = (team) => {
    if (poll.userVote) return; // Already voted
    
    setPoll(prev => ({
      ...prev,
      [team]: prev[team] + 1,
      userVote: team
    }));
  };

  const isGifUrl = (content) => {
    return /\.gif(\?|$)/i.test(content) || /giphy\.com|gif/i.test(content);
  };

  const getTotalVotes = () => poll.home + poll.away;
  const getPercentage = (votes) => {
    const total = getTotalVotes();
    return total === 0 ? 0 : Math.round((votes / total) * 100);
  };

  // No user - prompt to sign in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-6 max-w-xl w-full text-center">
            <h1 className="text-2xl font-semibold mb-2">Live Match Chat</h1>
            <p className="text-sm text-gray-600">
              Sign in to join the live match discussion and chat with other fans.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // No game data
  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-6 max-w-xl w-full text-center">
            <h1 className="text-2xl font-semibold mb-2">Match Not Found</h1>
            <p className="text-sm text-gray-600">
              Match data is missing. Please navigate via the Fixtures page.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 flex flex-col">
      <Navbar />

      {/* Match Header */}
      <div className="p-4 text-center text-white border-b border-white/20 flex-shrink-0">
        <div className="text-2xl font-bold">
          {game.home} vs {game.away}
        </div>
        <div className="text-sm opacity-80 mb-1">
          {new Date(game.date).toLocaleString()}
        </div>
        <div className="text-xs opacity-90">
          {activeUsers} fan{activeUsers === 1 ? "" : "s"} online •{" "}
          <span className={status === "connected" ? "text-green-300" : "text-gray-300"}>
            {status === "connected" ? "LIVE" : status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main Content: 3 Column Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Panel - Team Stats */}
        <div className="w-80 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Team Stats</h2>
          
          {/* Home Team */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-2 text-sky-700">{game.home}</h3>
            {teamStats.home ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Position:</span>
                  <span className="font-semibold">{teamStats.home.position}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Played:</span>
                  <span className="font-semibold">{teamStats.home.played}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Won:</span>
                  <span className="font-semibold">{teamStats.home.won}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Drawn:</span>
                  <span className="font-semibold">{teamStats.home.drawn}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Lost:</span>
                  <span className="font-semibold">{teamStats.home.lost}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Points:</span>
                  <span className="font-bold text-sky-600">{teamStats.home.points}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Goal Diff:</span>
                  <span className={`font-bold ${teamStats.home.goal_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {teamStats.home.goal_difference > 0 ? '+' : ''}{teamStats.home.goal_difference}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading stats...</p>
            )}
          </div>

          {/* Away Team */}
          <div>
            <h3 className="font-bold text-lg mb-2 text-sky-700">{game.away}</h3>
            {teamStats.away ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Position:</span>
                  <span className="font-semibold">{teamStats.away.position}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Played:</span>
                  <span className="font-semibold">{teamStats.away.played}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Won:</span>
                  <span className="font-semibold">{teamStats.away.won}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Drawn:</span>
                  <span className="font-semibold">{teamStats.away.drawn}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Lost:</span>
                  <span className="font-semibold">{teamStats.away.lost}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Points:</span>
                  <span className="font-bold text-sky-600">{teamStats.away.points}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Goal Diff:</span>
                  <span className={`font-bold ${teamStats.away.goal_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {teamStats.away.goal_difference > 0 ? '+' : ''}{teamStats.away.goal_difference}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading stats...</p>
            )}
          </div>
        </div>

        {/* Center Panel - Chat */}
        <div className="flex-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-md flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold text-gray-800">Match Chat</h2>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={listRef}>
            {messages.map((message) => (
              <div key={message.message_id || Math.random()} className="space-y-1">
                <div className="text-xs text-gray-500">
                  {message.username} • {new Date(message.created_at).toLocaleTimeString()}
                </div>
                <div
                  className={`inline-block px-3 py-2 rounded-lg ${
                    message.user_id === user?.user_id
                      ? "bg-sky-100 text-sky-900"
                      : "bg-gray-100 text-gray-800"
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
                Be the first to start the match discussion!
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t">
              {error}
            </div>
          )}

          {/* Input Form */}
          <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowGifPicker(true)}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                disabled={status !== "connected"}
                title="Send GIF"
              >
                GIF
              </button>

              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Send a message..."
                disabled={status !== "connected"}
              />

              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 text-white rounded text-sm disabled:bg-gray-300 hover:bg-sky-700 transition-colors"
                disabled={status !== "connected" || !text.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel - Poll */}
        <div className="w-80 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Who Will Win?</h2>
          
          <div className="space-y-4">
            {/* Home Team Vote */}
            <button
              onClick={() => handleVote('home')}
              disabled={poll.userVote !== null}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                poll.userVote === 'home'
                  ? 'border-sky-500 bg-sky-50'
                  : poll.userVote
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-sky-400 hover:bg-sky-50 cursor-pointer'
              }`}
            >
              <div className="font-bold text-lg mb-2">{game.home}</div>
              <div className="text-2xl font-bold text-sky-600">{getPercentage('home')}%</div>
              <div className="text-sm text-gray-600">{poll.home} votes</div>
              {poll.userVote === 'home' && (
                <div className="text-xs text-sky-600 mt-2">✓ Your vote</div>
              )}
            </button>

            {/* Away Team Vote */}
            <button
              onClick={() => handleVote('away')}
              disabled={poll.userVote !== null}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                poll.userVote === 'away'
                  ? 'border-sky-500 bg-sky-50'
                  : poll.userVote
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-sky-400 hover:bg-sky-50 cursor-pointer'
              }`}
            >
              <div className="font-bold text-lg mb-2">{game.away}</div>
              <div className="text-2xl font-bold text-sky-600">{getPercentage('away')}%</div>
              <div className="text-sm text-gray-600">{poll.away} votes</div>
              {poll.userVote === 'away' && (
                <div className="text-xs text-sky-600 mt-2">✓ Your vote</div>
              )}
            </button>

            <div className="text-xs text-gray-500 text-center pt-2">
              Total votes: {getTotalVotes()}
            </div>
          </div>
        </div>
      </div>

      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleGifSelect}
      />
    </div>
  );
}