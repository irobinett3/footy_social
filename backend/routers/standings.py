# routers/standings.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx

router = APIRouter(prefix="/api/standings", tags=["standings"])

# ---------- Schemas ----------
class TeamStanding(BaseModel):
    rank: int
    team_name: str
    team_abbreviation: str
    team_logo: Optional[str] = None
    games_played: int
    wins: int
    losses: int
    draws: int
    points: int
    goal_difference: Optional[int] = None
    goals_for: Optional[int] = None
    goals_against: Optional[int] = None

class StandingsResponse(BaseModel):
    season: str
    standings: List[TeamStanding]

# ---------- Route ----------
@router.get("", response_model=StandingsResponse)
async def get_standings():
    """
    Fetch Premier League standings from ESPN API and return formatted data.
    """
    url = "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch standings from ESPN: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
    # Parse the ESPN API response
    try:
        # Navigate to the current season standings
        children = data.get("children", [])
        if not children:
            raise HTTPException(status_code=404, detail="No standings data found")
        
        # Get the first (current) season
        current_season = children[0]
        standings_data = current_season.get("standings", {})
        entries = standings_data.get("entries", [])
        
        if not entries:
            raise HTTPException(status_code=404, detail="No standings entries found")
        
        # Extract season info
        season_display = standings_data.get("seasonDisplayName", "Current Season")
        
        # Transform entries to our format
        team_standings = []
        for entry in entries:
            team = entry.get("team", {})
            stats = entry.get("stats", [])
            
            # Extract team logo
            logos = team.get("logos", [])
            team_logo = logos[0].get("href", "") if logos and len(logos) > 0 else None
            
            # Extract stats by name
            stats_dict = {stat.get("name"): stat for stat in stats}
            
            rank_stat = stats_dict.get("rank", {})
            games_played_stat = stats_dict.get("gamesPlayed", {})
            wins_stat = stats_dict.get("wins", {})
            losses_stat = stats_dict.get("losses", {})
            draws_stat = stats_dict.get("ties", {})
            points_stat = stats_dict.get("points", {})
            goal_diff_stat = stats_dict.get("pointDifferential", {})
            goals_for_stat = stats_dict.get("pointsFor", {})
            goals_against_stat = stats_dict.get("pointsAgainst", {})
            
            team_standings.append(TeamStanding(
                rank=int(rank_stat.get("value", 0)),
                team_name=team.get("displayName", "Unknown"),
                team_abbreviation=team.get("abbreviation", ""),
                team_logo=team_logo,
                games_played=int(games_played_stat.get("value", 0)),
                wins=int(wins_stat.get("value", 0)),
                losses=int(losses_stat.get("value", 0)),
                draws=int(draws_stat.get("value", 0)),
                points=int(points_stat.get("value", 0)),
                goal_difference=int(goal_diff_stat.get("value", 0)) if goal_diff_stat.get("value") is not None else None,
                goals_for=int(goals_for_stat.get("value", 0)) if goals_for_stat.get("value") is not None else None,
                goals_against=int(goals_against_stat.get("value", 0)) if goals_against_stat.get("value") is not None else None,
            ))
        
        # Sort by rank to ensure correct order
        team_standings.sort(key=lambda x: x.rank)
        
        return StandingsResponse(
            season=season_display,
            standings=team_standings
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing standings data: {str(e)}")

