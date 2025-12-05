import React from "react";

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

  return (
    <div className="bg-white rounded shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-3">Fixtures</h2>

      {!nextGame ? (
        <div className="text-gray-500 text-sm">No fixtures available.</div>
      ) : (
        <div className="p-4 border rounded bg-slate-50 flex items-center justify-between">
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
        </div>
      )}
    </div>
  );
}
