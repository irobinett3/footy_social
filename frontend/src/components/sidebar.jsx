import React, { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Sidebar({ fixtures, fanRooms, onSelectRoom }) {
  const { user } = useAuth();
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  
  const favoriteTeam = useMemo(
    () => (user?.favorite_team || "").trim().toLowerCase(),
    [user?.favorite_team]
  );
  
  // Helper function to normalize team names for comparison
  const normalizeTeamName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/manchester city/gi, "manchester city")
      .replace(/man city/gi, "manchester city")
      .replace(/manchester united/gi, "manchester united")
      .replace(/man united/gi, "manchester united")
      .replace(/man u/gi, "manchester united");
  };
  
  const teamRooms = useMemo(
    () => fanRooms.filter((room) => !room.is_global),
    [fanRooms]
  );
  
  // Separate favorite room from others
  const { favoriteRoom, otherRooms } = useMemo(() => {
    if (!favoriteTeam) {
      return { favoriteRoom: null, otherRooms: teamRooms };
    }
    
    const favorite = teamRooms.find((room) => {
      const roomNameNormalized = normalizeTeamName(room.team_name);
      const favoriteNormalized = normalizeTeamName(favoriteTeam);
      return roomNameNormalized === favoriteNormalized ||
             room.team_name.toLowerCase().includes(favoriteNormalized) ||
             favoriteNormalized.includes(roomNameNormalized);
    });
    
    const others = teamRooms.filter((room) => {
      if (!favorite) return true;
      return room.id !== favorite.id;
    });
    
    return { favoriteRoom: favorite, otherRooms: others };
  }, [teamRooms, favoriteTeam]);
  
  // Determine which rooms to display
  const roomsToDisplay = useMemo(() => {
    if (showAllRooms) {
      // Show favorite first, then others
      return favoriteRoom ? [favoriteRoom, ...otherRooms] : otherRooms;
    }
    // Show only favorite room
    return favoriteRoom ? [favoriteRoom] : [];
  }, [showAllRooms, favoriteRoom, otherRooms]);

  return (
    <aside className="hidden md:flex md:flex-col md:flex-shrink-0 w-72 bg-gray-50 border-r p-4 h-full overflow-y-auto min-h-0">
      <section className="mb-6 space-y-4">
        {fixtures?.live && fixtures.live.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Live Games</h3>
            <div className="space-y-2">
              {fixtures.live.map((f) => (
                <div key={`live-${f.id}`} className="p-2 rounded bg-red-50 border border-red-100">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-semibold text-red-700">LIVE</div>
                    <div className="text-xs text-red-600">{f.location || "Venue TBA"}</div>
                  </div>
                  <div className="text-sm font-medium">{f.home} vs {f.away}</div>
                  <div className="text-xs text-gray-600">
                    {new Date(f.date).toLocaleString(undefined, { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-3">Upcoming Fixtures</h3>
          {!fixtures?.upcoming || fixtures.upcoming.length === 0 ? (
            <div className="text-gray-500 text-xs">No upcoming fixtures.</div>
          ) : (
            <>
              <div className="space-y-2">
                {(showAllUpcoming ? fixtures.upcoming : fixtures.upcoming.slice(0, 5)).map((f) => (
                  <div key={`up-${f.id}`} className="p-2 rounded hover:bg-white cursor-pointer">
                    <div className="text-sm font-medium">{f.home} vs {f.away}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(f.date).toLocaleString(undefined, { hour: 'numeric', minute: 'numeric', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
              {fixtures.upcoming.length > 5 && (
                <button
                  className="mt-2 w-full text-center text-xs text-sky-700 hover:text-sky-900"
                  onClick={() => setShowAllUpcoming((s) => !s)}
                >
                  {showAllUpcoming ? "Show less" : `Show more (${fixtures.upcoming.length - 5} more)`}
                </button>
              )}
            </>
          )}
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
          {roomsToDisplay.map((room) => {
            const isFavorite = favoriteRoom && room.id === favoriteRoom.id;
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
                    ? "bg-sky-50 border border-sky-200 hover:bg-sky-100"
                    : "cursor-not-allowed bg-gray-100"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm font-medium ${isFavorite ? "text-sky-700" : "text-gray-600"}`}>
                      {room.display_name}
                    </div>
                    <div className={`text-xs ${isFavorite ? "text-sky-600" : "text-gray-500"}`}>
                      {activeUsers} online
                    </div>
                  </div>
                  <div
                    className={`text-xs ${
                      isFavorite ? "text-sky-600 font-semibold" : "text-gray-400"
                    }`}
                  >
                    {isFavorite ? "Join" : "Locked"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {favoriteRoom && otherRooms.length > 0 && (
          <button
            onClick={() => setShowAllRooms(!showAllRooms)}
            className="mt-3 w-full text-xs text-sky-700 hover:text-sky-900"
          >
            {showAllRooms
              ? "Show less"
              : `Show more (${otherRooms.length} other${otherRooms.length !== 1 ? "s" : ""})`}
          </button>
        )}
      </section>
    </aside>
  );
}
