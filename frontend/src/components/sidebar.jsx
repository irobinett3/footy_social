import React, { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Sidebar({ fixtures, fanRooms, onSelectRoom }) {
  const { user } = useAuth();
  const favoriteTeam = useMemo(
    () => (user?.favorite_team || "").trim().toLowerCase(),
    [user?.favorite_team]
  );
  const teamRooms = useMemo(
    () => fanRooms.filter((room) => !room.is_global),
    [fanRooms]
  );

  return (
    <aside className="w-72 bg-gray-50 border-r p-4 hidden md:block">
      <section className="mb-6">
        <h3 className="font-semibold mb-3">Upcoming Fixtures</h3>
        <div className="space-y-2">
          {fixtures.map((f) => (
            <div key={f.id} className="p-2 rounded hover:bg-white cursor-pointer">
              <div className="text-sm font-medium">{f.home} vs {f.away}</div>
              <div className="text-xs text-gray-500">
                {new Date(f.date).toLocaleString(undefined, { hour: 'numeric', minute: 'numeric', year: 'numeric', month: 'short', day: 'numeric', second: undefined })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">Fan Rooms</h3>
        {!user && (
          <p className="text-xs text-gray-500 mb-3">
            Sign in to unlock your fan room.
          </p>
        )}
        {user && !user.favorite_team && (
          <p className="text-xs text-gray-500 mb-3">
            Set your favorite team in your profile to join a fan room.
          </p>
        )}
        <div className="space-y-2">
          {teamRooms.map((room) => {
            const isFavorite =
              favoriteTeam &&
              room.team_name.trim().toLowerCase() === favoriteTeam;
            const activeUsers = room.active_users ?? 0;
            return (
              <button
                key={room.id}
                onClick={() => {
                  if (isFavorite) onSelectRoom(room.id);
                }}
                disabled={!isFavorite}
                className={`w-full text-left p-2 rounded ${
                  isFavorite
                    ? "hover:bg-white"
                    : "cursor-not-allowed bg-gray-100"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{room.display_name}</div>
                    <div className="text-xs text-gray-500">
                      {activeUsers} online
                    </div>
                  </div>
                  <div
                    className={`text-xs ${
                      isFavorite ? "text-sky-600" : "text-gray-400"
                    }`}
                  >
                    {isFavorite ? "Join" : "Locked"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
