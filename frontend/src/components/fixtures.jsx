import React from "react";
import { Link } from "react-router-dom";

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    hour: "numeric",
    minute: "numeric",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function FixturesPanel({ fixtures }) {
  const live = fixtures?.live || [];
  const upcoming = fixtures?.upcoming || [];
  const nextGame = live[0] ?? upcoming[0] ?? null;
  const now = Date.now();
  const nextGameDate = nextGame ? new Date(nextGame.date).getTime() : null;
  const isLive = live.length > 0 && live[0]?.id === nextGame?.id;
  const isWithin24h =
    nextGameDate !== null && nextGameDate >= now && nextGameDate - now <= 24 * 60 * 60 * 1000;
  const canJoin = isLive || isWithin24h;

  return (
    <div className="bg-white rounded shadow-sm p-4">
      {!nextGame ? (
        <div className="text-gray-500 text-sm">No fixtures available.</div>
      ) : (
        (() => {
          const Wrapper = canJoin ? Link : "div";
          const wrapperProps = canJoin ? { to: `/live-game/${nextGame.id}` } : {};

          return (
            <Wrapper
              {...wrapperProps}
              className={`p-4 border rounded bg-slate-50 flex items-center justify-between ${
                canJoin ? "hover:bg-sky-50 cursor-pointer" : "cursor-default"
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-semibold text-lg">
                    {nextGame.home} vs {nextGame.away}
                  </div>
                  {live.length > 0 && live[0]?.id === nextGame.id && (
                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  {formatDate(nextGame.date)} · {nextGame.location || "Venue TBA"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {nextGame.competition || "Premier League"}
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-xs font-semibold mb-1 text-sky-700">
                  Join
                </div>
              </div>
            </Wrapper>
          );
        })()
      )}
    </div>
  );
}
