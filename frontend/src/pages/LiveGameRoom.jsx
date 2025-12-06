import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/navbar.jsx";
import { api } from "../api/api";
import { useAuth } from "../contexts/AuthContext";

const buildSocketUrl = (gameId, token) =>
  `ws://localhost:8000/livegames/ws/${gameId}?token=${encodeURIComponent(
    token
  )}`;

const presenceFallback = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function LiveGameRoom() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const gameId = Number(matchId);
  const { user, token } = useAuth();
  const [game, setGame] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [activeUsers, setActiveUsers] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polls, setPolls] = useState([]);
  const [activePollIndex, setActivePollIndex] = useState(0);
  const [pollSelections, setPollSelections] = useState({});
  const [showPollModal, setShowPollModal] = useState(false);
  const [newPollTitle, setNewPollTitle] = useState("");
  const [newPollOptions, setNewPollOptions] = useState(["", ""]);
  const socketRef = useRef(null);
  const listRef = useRef(null);

const kickoff = useMemo(() => {
  if (!game?.match_date) return "";
  return new Date(game.match_date).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}, [game?.match_date]);

const stadiumName = useMemo(() => {
  if (!game) return "";
  return game.stadium || `${game.home_team || "Home"} Stadium`;
}, [game]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setGame(null);
    setPolls([]);
    setPollSelections({});
    setActivePollIndex(0);

    if (!Number.isFinite(gameId)) {
      setError("Invalid match id.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await api.fetchLiveGame(gameId);
        if (!cancelled) {
          setGame(data);
        }
      } catch (err) {
        console.error("Failed to load live game", err);
        if (!cancelled) {
          setError("Unable to load this live game right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);

    if (!Number.isFinite(gameId)) return;

    (async () => {
      try {
        const history = await api.fetchLiveGameMessages(gameId);
        if (!cancelled) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
        if (!cancelled) {
          setError("Could not load chat history.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    const defaultPoll = {
      id: "winner",
      title: `${game.home_team} vs ${game.away_team} – Who wins?`,
      options: [
        { key: "home", label: game.home_team || "Home" },
        { key: "away", label: game.away_team || "Away" },
      ],
      votes: { home: 0, away: 0 },
      createdBy: "FootySocial",
    };
    setPolls([defaultPoll]);
    setActivePollIndex(0);
    setPollSelections({});
  }, [game?.home_team, game?.away_team]);

  useEffect(() => {
    if (!game || !token) {
      setStatus(game ? "unauthorized" : "idle");
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    setStatus("connecting");
    const socket = new WebSocket(buildSocketUrl(gameId, token));
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "welcome" || data.type === "presence") {
          setActiveUsers(presenceFallback(data.active_users));
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
  }, [game, gameId, token]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const currentPoll = polls[activePollIndex];

  const totalVotes =
    currentPoll?.options.reduce(
      (sum, opt) => sum + (currentPoll.votes[opt.key] || 0),
      0
    ) || 0;

  const handleVote = (pollId, optionKey) => {
    setPolls((prev) =>
      prev.map((poll) => {
        if (poll.id !== pollId) return poll;
        const prevSelection = pollSelections[pollId];
        const nextVotes = { ...poll.votes };
        if (prevSelection && prevSelection !== optionKey) {
          nextVotes[prevSelection] = Math.max(
            0,
            (nextVotes[prevSelection] || 0) - 1
          );
        }
        if (prevSelection === optionKey) {
          nextVotes[optionKey] = Math.max(0, (nextVotes[optionKey] || 0) - 1);
          return { ...poll, votes: nextVotes };
        }
        nextVotes[optionKey] = (nextVotes[optionKey] || 0) + 1;
        return { ...poll, votes: nextVotes };
      })
    );
    setPollSelections((prev) => ({
      ...prev,
      [pollId]: prev[pollId] === optionKey ? null : optionKey,
    }));
  };

  const cyclePoll = (direction) => {
    if (!polls.length) return;
    setActivePollIndex((prev) => {
      const next = (prev + direction + polls.length) % polls.length;
      return next;
    });
  };

  const openNewPollModal = () => {
    setNewPollTitle("");
    setNewPollOptions(["", ""]);
    setShowPollModal(true);
  };

  const addPollOptionField = () => {
    if (newPollOptions.length >= 4) return;
    setNewPollOptions((prev) => [...prev, ""]);
  };

  const handlePollCreate = (event) => {
    event.preventDefault();
    const trimmedTitle = newPollTitle.trim();
    const filledOptions = newPollOptions.map((o) => o.trim()).filter(Boolean);
    if (!trimmedTitle || filledOptions.length < 2) {
      setError("Please add a title and at least two options.");
      return;
    }
    const pollId = `poll-${Date.now()}`;
    const options = filledOptions.map((label, idx) => ({
      key: `opt-${idx}`,
      label,
    }));
    const votes = options.reduce((acc, opt) => ({ ...acc, [opt.key]: 0 }), {});
    const newPoll = {
      id: pollId,
      title: trimmedTitle,
      options,
      votes,
      createdBy: user?.username || "Guest",
    };
    setPolls((prev) => [...prev, newPoll]);
    setShowPollModal(false);
    setError(null);
  };

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

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-100 to-blue-900 text-slate-800 flex flex-col">
      <Navbar />
      <main className="flex-1 min-h-0 overflow-hidden p-6 flex flex-col gap-4">
        <button
          onClick={() => navigate("/")}
          className="self-start inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 font-semibold"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
          Back to Home
        </button>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-4 md:p-6">
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ) : game ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center text-center gap-2">
                <p className="text-sm uppercase tracking-wide text-slate-500">
                  Live Match Room
                </p>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {game.home_team} vs {game.away_team}
                </h1>
                <p className="text-sm text-slate-600">
                  Kickoff:{" "}
                  <span className="font-semibold text-slate-900">
                    {kickoff || "TBD"}
                  </span>
                  {" · "}Stadium:{" "}
                  <span className="font-semibold text-slate-900">
                    {stadiumName || "TBD"}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-rose-600">
              {error || "We could not find this live game."}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          <section className="lg:col-span-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md flex flex-col min-h-0">
            <header className="border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Live Chat</p>
                <p className="text-xs text-slate-400">
                  Status: {status === "connected" ? "Connected" : status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-600">
                  Fans online:{" "}
                  <span className="text-blue-700 font-semibold">
                    {activeUsers}
                  </span>
                </p>
                {error && <p className="text-xs text-rose-600">{error}</p>}
              </div>
            </header>

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            >
              {messages.map((msg) => (
                <div
                  key={msg.message_id}
                  className="flex items-start gap-2 text-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {msg.username}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTimestamp(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
              {!messages.length && (
                <p className="text-center text-sm text-slate-400">
                  Be the first to cheer on this match!
                </p>
              )}
            </div>

            <footer className="border-t border-slate-200 px-4 py-3">
              {!user ? (
                <p className="text-sm text-slate-500">
                  Sign in to join the live chat for this match.
                </p>
              ) : (
                <form className="flex gap-2" onSubmit={handleSubmit}>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      status === "connected"
                        ? "Send a message to the room"
                        : "Connecting to chat..."
                    }
                    className="flex-1 rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80"
                    disabled={status !== "connected"}
                  />
                  <button
                    type="submit"
                    disabled={status !== "connected" || !text.trim()}
                    className="px-4 py-2 bg-blue-700 text-white rounded-md disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    Send
                  </button>
                </form>
              )}
            </footer>
          </section>

          <aside className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-4 space-y-4 min-h-0 overflow-y-auto">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Match Polls
              </h3>
              <p className="text-sm text-slate-600">
                Pick who takes the win. One vote per device; changing removes your previous pick.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cyclePoll(-1)}
                  disabled={polls.length <= 1}
                  className="px-2 py-1 rounded border border-slate-200 text-slate-700 disabled:opacity-50"
                >
                  ←
                </button>
                <button
                  onClick={() => cyclePoll(1)}
                  disabled={polls.length <= 1}
                  className="px-2 py-1 rounded border border-slate-200 text-slate-700 disabled:opacity-50"
                >
                  →
                </button>
              </div>
              <button
                onClick={openNewPollModal}
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                + New Poll
              </button>
            </div>

            <div className="space-y-3">
              {currentPoll ? (
                <>
                  <div className="border border-slate-200 rounded-md px-3 py-2 bg-white/70">
                    <p className="text-sm font-semibold text-slate-900">
                      {currentPoll.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Poll {activePollIndex + 1} of {polls.length}
                    </p>
                    <p className="text-xs text-slate-500">
                      Created by {currentPoll.createdBy || "Unknown"}
                    </p>
                  </div>
                  {currentPoll.options.map((row) => {
                    const votes = currentPoll.votes[row.key] || 0;
                    const percent =
                      totalVotes > 0
                        ? Math.round((votes / totalVotes) * 100)
                        : 0;
                    const selected = pollSelections[currentPoll.id] === row.key;
                    return (
                      <button
                        key={row.key}
                        onClick={() => handleVote(currentPoll.id, row.key)}
                        className={`w-full text-left border rounded-md px-3 py-3 transition ${
                          selected
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{row.label}</span>
                          <span className="text-sm text-slate-600">
                            {votes} votes
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {percent}% of votes
                        </p>
                      </button>
                    );
                  })}
                  <div className="text-xs text-slate-500">
                    Total votes: {totalVotes}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  No polls yet. Create one to get fans talking.
                </p>
              )}
            </div>

          </aside>
        </div>
      </main>

      {showPollModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Create a Poll
              </h3>
              <button
                onClick={() => setShowPollModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form className="space-y-3" onSubmit={handlePollCreate}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newPollTitle}
                  onChange={(e) => setNewPollTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Who scores first?"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">
                    Options (2-4)
                  </label>
                  <button
                    type="button"
                    onClick={addPollOptionField}
                    disabled={newPollOptions.length >= 4}
                    className="text-sm text-blue-700 font-semibold disabled:opacity-50"
                  >
                    + Option
                  </button>
                </div>
                {newPollOptions.map((opt, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...newPollOptions];
                      next[idx] = e.target.value;
                      setNewPollOptions(next);
                    }}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Option ${idx + 1}`}
                    required={idx < 2}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="px-4 py-2 rounded-md border border-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-700 text-white font-semibold hover:bg-blue-800"
                >
                  Create Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
