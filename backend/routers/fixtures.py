from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import EPLMatch

router = APIRouter(prefix="/api/fixtures", tags=["fixtures"])


class Fixture(BaseModel):
    id: int
    home: str
    away: str
    date: datetime
    location: str | None = None
    result: str | None = None
    state: str = "upcoming"
    competition: str = "Premier League"

    class Config:
        orm_mode = True


class FixturesResponse(BaseModel):
    live: List[Fixture]
    upcoming: List[Fixture]


@router.get("", response_model=FixturesResponse)
def get_fixtures(db: Session = Depends(get_db)) -> FixturesResponse:
    """
    Return live fixtures (kickoff within the last 2 hours) and all fixtures in the next 7 days.
    Data is read from the pre-loaded epl_matches table instead of the external API.
    """
    now = datetime.utcnow()
    recent_kickoff_window = now - timedelta(hours=2)
    seven_days = now + timedelta(days=7)

    live_matches = (
        db.query(EPLMatch)
        .filter(EPLMatch.match_date <= now, EPLMatch.match_date >= recent_kickoff_window)
        .order_by(EPLMatch.match_date.asc())
        .all()
    )

    upcoming_matches = (
        db.query(EPLMatch)
        .filter(EPLMatch.match_date > now, EPLMatch.match_date <= seven_days)
        .order_by(EPLMatch.match_date.asc())
        .all()
    )

    def to_fixture(match: EPLMatch, state: str) -> Fixture:
        return Fixture(
            id=match.id,
            home=match.home_team,
            away=match.away_team,
            date=match.match_date,
            location=match.location,
            result=match.result,
            state=state,
        )

    live = [to_fixture(m, "live") for m in live_matches]
    upcoming = [to_fixture(m, "upcoming") for m in upcoming_matches]

    return FixturesResponse(live=live, upcoming=upcoming)
