import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function StandingsPanel() {
  const { user } = useAuth();
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/standings")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStandings(data);
      })
      .catch((err) => {
        console.error("Error fetching standings:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4">Loading standings...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading standings: {error}</div>;
  }

  if (!standings || !standings.standings || standings.standings.length === 0) {
    return <div className="p-4 text-gray-500">No standings available.</div>;
  }

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

  // Check if a team matches the user's favorite team
  const isFavoriteTeam = (teamName) => {
    if (!user?.favorite_team) return false;
    const favoriteNormalized = normalizeTeamName(user.favorite_team);
    const teamNormalized = normalizeTeamName(teamName);
    return favoriteNormalized === teamNormalized || 
           teamName.toLowerCase().includes(favoriteNormalized) ||
           favoriteNormalized.includes(teamNormalized);
  };

  return (
    <div className="bg-white rounded shadow-sm p-4 max-w mx-auto">
      <h2 className="text-lg font-semibold mb-3">{standings.season} Standings</h2>
      
      <div className="overflow-x-auto overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-center p-2 font-semibold">Rank</th>
              <th className="text-left p-2 font-semibold">Team</th>
              <th className="text-center p-2 font-semibold">GP</th>
              <th className="text-center p-2 font-semibold">W</th>
              <th className="text-center p-2 font-semibold">D</th>
              <th className="text-center p-2 font-semibold">L</th>
              <th className="text-center p-2 font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.standings.map((team) => {
              const isFavorite = isFavoriteTeam(team.team_name);
              return (
                <tr
                  key={team.rank}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    isFavorite ? "bg-blue-50 border-blue-200" : ""
                  }`}
                >
                  <td className={`p-2 text-center font-medium ${isFavorite ? "text-blue-700" : ""}`}>
                    {team.rank}
                  </td>
                  <td className={`p-2 ${isFavorite ? "font-semibold text-blue-700" : ""}`}>
                    <div className="flex items-center gap-2">
                      {team.team_logo && (
                        <img
                          src={team.team_logo}
                          alt={team.team_name}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <span className="font-medium">{team.team_name}</span>
                      {isFavorite && (
                        <span className="ml-2 text-xs text-blue-600">⭐</span>
                      )}
                      {team.team_abbreviation && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({team.team_abbreviation})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`p-2 text-center ${isFavorite ? "text-blue-700" : ""}`}>
                    {team.games_played}
                  </td>
                  <td className={`p-2 text-center ${isFavorite ? "text-blue-700" : ""}`}>
                    {team.wins}
                  </td>
                  <td className={`p-2 text-center ${isFavorite ? "text-blue-700" : ""}`}>
                    {team.draws}
                  </td>
                  <td className={`p-2 text-center ${isFavorite ? "text-blue-700" : ""}`}>
                    {team.losses}
                  </td>
                  <td className={`p-2 text-center font-semibold ${isFavorite ? "text-blue-700" : ""}`}>
                    {team.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

