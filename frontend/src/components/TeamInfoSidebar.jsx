import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TeamInfoSidebar({ teamName }) {
  const navigate = useNavigate();
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamName) {
      setLoading(false);
      return;
    }

    fetch("http://localhost:8000/api/standings")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
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

        const teamNameNormalized = normalizeTeamName(teamName);
        const found = data.standings?.find((team) => {
          const statsNameNormalized = normalizeTeamName(team.team_name);
          return (
            statsNameNormalized === teamNameNormalized ||
            team.team_name.toLowerCase().includes(teamNameNormalized) ||
            teamNameNormalized.includes(statsNameNormalized)
          );
        });

        setTeamStats(found || null);
      })
      .catch((err) => {
        console.error("Error fetching team stats:", err);
        setTeamStats(null);
      })
      .finally(() => setLoading(false));
  }, [teamName]);

  if (loading) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col items-center">
        <div className="text-gray-500">Loading...</div>
      </aside>
    );
  }

  if (!teamStats) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col items-center">
        <div className="text-gray-500 text-center">Team stats not available</div>
      </aside>
    );
  }

  // Get stadium and location info
  const getStadiumInfo = (teamName) => {
    const stadiums = {
      "Arsenal": { name: "Emirates Stadium", location: "London" },
      "Manchester City": { name: "Etihad Stadium", location: "Manchester" },
      "Liverpool": { name: "Anfield", location: "Liverpool" },
      "Chelsea": { name: "Stamford Bridge", location: "London" },
      "Manchester United": { name: "Old Trafford", location: "Manchester" },
      "Tottenham Hotspur": { name: "Tottenham Hotspur Stadium", location: "London" },
      "Newcastle United": { name: "St. James' Park", location: "Newcastle upon Tyne" },
      "Brighton & Hove Albion": { name: "American Express Community Stadium", location: "Brighton" },
      "West Ham United": { name: "London Stadium", location: "London" },
      "Aston Villa": { name: "Villa Park", location: "Birmingham" },
      "Crystal Palace": { name: "Selhurst Park", location: "London" },
      "Fulham": { name: "Craven Cottage", location: "London" },
      "Wolverhampton Wanderers": { name: "Molineux Stadium", location: "Wolverhampton" },
      "Everton": { name: "Goodison Park", location: "Liverpool" },
      "Brentford": { name: "Gtech Community Stadium", location: "London" },
      "Nottingham Forest": { name: "City Ground", location: "Nottingham" },
      "Leicester City": { name: "King Power Stadium", location: "Leicester" },
      "Ipswich Town": { name: "Portman Road", location: "Ipswich" },
      "Southampton": { name: "St. Mary's Stadium", location: "Southampton" },
      "Bournemouth": { name: "Vitality Stadium", location: "Bournemouth" }
    };
    
    return stadiums[teamName] || { name: "Unknown Stadium", location: "Unknown" };
  };

  // Get club description (you can expand this with more detailed descriptions)
  const getClubDescription = (teamName) => {
    const descriptions = {
      "Arsenal": "Founded in 1886, Arsenal is one of England's most successful clubs with 13 league titles.",
      "Manchester City": "Based in Manchester, City has become a dominant force in English football in recent years.",
      "Liverpool": "One of England's most successful clubs with 19 league titles and 6 European Cups.",
      "Chelsea": "Founded in 1905, Chelsea has won multiple Premier League titles and European trophies.",
      "Manchester United": "One of the world's most famous clubs with 20 league titles and 3 European Cups.",
      "Tottenham Hotspur": "North London club known for attacking football and passionate fanbase.",
      "Newcastle United": "Based in the North East, known for their passionate supporters at St. James' Park.",
      "Brighton & Hove Albion": "South coast club known for progressive football and strong community ties.",
      "West Ham United": "East London club with a rich history and passionate fanbase at the London Stadium.",
      "Aston Villa": "One of England's oldest clubs, based in Birmingham with a proud history.",
      "Crystal Palace": "South London club known for their vibrant atmosphere at Selhurst Park.",
      "Fulham": "West London club with a rich history, playing at the historic Craven Cottage.",
      "Wolverhampton Wanderers": "Midlands club with a strong tradition and passionate fanbase.",
      "Everton": "Liverpool-based club with a rich history and one of England's founding members.",
      "Brentford": "West London club known for their innovative approach and community focus.",
      "Nottingham Forest": "Two-time European Cup winners with a proud history in English football.",
      "Leicester City": "2015-16 Premier League champions, known for their remarkable title win.",
      "Ipswich Town": "East Anglian club with a proud history and strong community support.",
      "Southampton": "South coast club known for developing young talent and attractive football.",
      "Bournemouth": "South coast club known for their attacking style and community spirit."
    };
    
    return descriptions[teamName] || `${teamName} is a professional football club competing in the English Premier League.`;
  };

  const stadiumInfo = getStadiumInfo(teamStats.team_name);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col items-center overflow-y-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate("/")}
        className="w-full mb-4 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center justify-center gap-2"
      >
        <span>←</span>
        <span>Back to Home</span>
      </button>
      
      {/* Team Name */}
      <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">
        {teamStats.team_name}
      </h1>
      
      {/* Stadium and Location */}
      <div className="mb-3 text-center">
        <div className="text-sm font-medium text-gray-700">{stadiumInfo.name}</div>
        <div className="text-xs text-gray-500">{stadiumInfo.location}</div>
      </div>

      {/* Team Logo */}
      {teamStats.team_logo && (
        <div className="mb-4">
          <img
            src={teamStats.team_logo}
            alt={teamStats.team_name}
            className="w-24 h-24 object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Club Description */}
      <div className="mb-5 text-xs text-gray-600 text-center leading-relaxed px-2">
        {getClubDescription(teamStats.team_name)}
      </div>

      {/* Stats - Clean List Style */}
      <div className="w-full space-y-1">
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Position</span>
          <span className="text-lg font-semibold text-gray-900">#{teamStats.rank}</span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Games Played</span>
          <span className="text-lg font-semibold text-gray-900">{teamStats.games_played}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Wins</span>
          <span className="text-lg font-semibold text-green-600">{teamStats.wins}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Draws</span>
          <span className="text-lg font-semibold text-yellow-600">{teamStats.draws}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Losses</span>
          <span className="text-lg font-semibold text-red-600">{teamStats.losses}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-600">Points</span>
          <span className="text-lg font-semibold text-blue-600">{teamStats.points}</span>
        </div>

        {teamStats.goal_difference !== null && (
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-sm text-gray-600">Goal Difference</span>
            <span className="text-lg font-semibold text-gray-900">
              {teamStats.goal_difference > 0 ? '+' : ''}{teamStats.goal_difference}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

