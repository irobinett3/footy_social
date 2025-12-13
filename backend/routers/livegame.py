import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict, List
from zoneinfo import ZoneInfo

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth import get_user_by_username, verify_token, get_current_user
from database import SessionLocal, get_db
from models import LiveGame, LiveGameMessage, User, Poll, PollOption, PollVote, EPLMatch
from routers.chatbot import check_message_content
from schemas import (
    LiveGameMessageResponse,
    LiveGameResponse,
    PollCreate,
    PollResponse,
    PollVoteRequest,
)
from utils import uuid_bytes_to_str

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/livegames", tags=["livegames"])
LOCAL_TZ = ZoneInfo("America/Indiana/Indianapolis")
UTC = ZoneInfo("UTC")
SPECIAL_LIVE_GAME_ID = 999001
SPECIAL_LIVE_GAME_HOME = "Weninger FC"
SPECIAL_LIVE_GAME_AWAY = "Bui United"


def _to_local_match_time(match_date: datetime) -> datetime | None:
    """Convert stored GMT kickoff time to the local timezone."""
    if match_date is None:
        return None
    if match_date.tzinfo is None:
        match_date = match_date.replace(tzinfo=UTC)
    return match_date.astimezone(LOCAL_TZ)


def _ensure_live_game(db: Session, game_id: int) -> LiveGame | None:
    """
    Fetch a LiveGame; if missing, hydrate it from the EPL fixtures table so the room is joinable.
    """
    if game_id == SPECIAL_LIVE_GAME_ID:
        game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
        if game:
            return game
        game = LiveGame(
            id=SPECIAL_LIVE_GAME_ID,
            home_team=SPECIAL_LIVE_GAME_HOME,
            away_team=SPECIAL_LIVE_GAME_AWAY,
            match_date=datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
        )
        db.add(game)
        db.commit()
        db.refresh(game)
        return game

    game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
    if game:
        return game

    fixture = db.query(EPLMatch).filter(EPLMatch.id == game_id).first()
    if not fixture:
        return None

    # Create a LiveGame using the fixture details so users can join the room.
    game = LiveGame(
        id=fixture.id,
        home_team=fixture.home_team,
        away_team=fixture.away_team,
        match_date=fixture.match_date,
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


class LiveGameConnectionManager:
    """Manage websocket connections for live game rooms."""

    def __init__(self) -> None:
        self.active_connections: Dict[int, Dict[WebSocket, User]] = defaultdict(dict)

    async def connect(self, game_id: int, websocket: WebSocket, user: User) -> None:
        await websocket.accept()
        self.active_connections[game_id][websocket] = user

    def disconnect(self, game_id: int, websocket: WebSocket) -> None:
        room_connections = self.active_connections.get(game_id)
        if not room_connections:
            return
        room_connections.pop(websocket, None)
        if not room_connections:
            self.active_connections.pop(game_id, None)

    def get_active_count(self, game_id: int) -> int:
        return len(self.active_connections.get(game_id, {}))

    async def broadcast(self, game_id: int, payload: dict) -> None:
        for connection in list(self.active_connections.get(game_id, {})):
            try:
                await connection.send_json(payload)
            except Exception:
                self.disconnect(game_id, connection)

    async def broadcast_presence(self, game_id: int) -> None:
        await self.broadcast(
            game_id,
            {"type": "presence", "game_id": game_id, "active_users": self.get_active_count(game_id)},
        )


manager = LiveGameConnectionManager()


def get_poll_votes_dict(db: Session, poll_id: int) -> Dict[str, int]:
    """Get vote counts for each option in a poll."""
    vote_counts = (
        db.query(PollVote.option_key, func.count(PollVote.id))
        .filter(PollVote.poll_id == poll_id)
        .group_by(PollVote.option_key)
        .all()
    )
    return {option_key: count for option_key, count in vote_counts}


def poll_to_response(poll: Poll, db: Session) -> PollResponse:
    """Convert a Poll model to PollResponse schema."""
    votes_dict = get_poll_votes_dict(db, poll.id)
    
    # Ensure all options are in the votes dict, even if they have 0 votes
    for option in poll.options:
        if option.option_key not in votes_dict:
            votes_dict[option.option_key] = 0
    
    return PollResponse(
        id=poll.id,
        game_id=poll.game_id,
        title=poll.title,
        created_by=poll.created_by_username,
        options=[
            {"key": opt.option_key, "label": opt.option_label}
            for opt in sorted(poll.options, key=lambda x: x.display_order)
        ],
        votes=votes_dict,
        created_at=poll.created_at,
    )


@router.get("", response_model=List[LiveGameResponse])
def list_live_games(db: Session = Depends(get_db)) -> List[LiveGameResponse]:
    games = db.query(LiveGame).order_by(LiveGame.match_date.asc()).all()
    responses = [
        LiveGameResponse(
            id=game.id,
            home_team=game.home_team,
            away_team=game.away_team,
            match_date=_to_local_match_time(game.match_date),
        )
        for game in games
    ]
    special = _ensure_live_game(db, SPECIAL_LIVE_GAME_ID)
    if special and all(resp.id != SPECIAL_LIVE_GAME_ID for resp in responses):
        responses.append(
            LiveGameResponse(
                id=special.id,
                home_team=special.home_team,
                away_team=special.away_team,
                match_date=_to_local_match_time(special.match_date),
            )
        )
    return responses


@router.get("/{game_id}", response_model=LiveGameResponse)
def get_live_game(game_id: int, db: Session = Depends(get_db)) -> LiveGameResponse:
    game = _ensure_live_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live game not found")

    return LiveGameResponse(
        id=game.id,
        home_team=game.home_team,
        away_team=game.away_team,
        match_date=_to_local_match_time(game.match_date),
    )


@router.get("/{game_id}/messages", response_model=List[LiveGameMessageResponse])
def get_live_game_messages(
    game_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[LiveGameMessageResponse]:
    if limit <= 0 or limit > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be between 1 and 500")

    game = _ensure_live_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live game not found")

    messages = (
        db.query(LiveGameMessage)
        .filter(LiveGameMessage.game_id == game_id)
        .order_by(LiveGameMessage.created_at.asc())
        .limit(limit)
        .all()
    )

    return [
        LiveGameMessageResponse(
            message_id=message.id,
            game_id=message.game_id,
            user_id=uuid_bytes_to_str(message.user_id) or "",
            username=message.user.username if message.user else "Unknown",
            content=message.content,
            created_at=message.created_at,
        )
        for message in messages
    ]


@router.get("/{game_id}/polls", response_model=List[PollResponse])
def get_game_polls(
    game_id: int,
    db: Session = Depends(get_db),
) -> List[PollResponse]:
    """Get all polls for a specific game."""
    game = _ensure_live_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live game not found")

    polls = (
        db.query(Poll)
        .filter(Poll.game_id == game_id)
        .order_by(Poll.created_at.asc())
        .all()
    )

    return [poll_to_response(poll, db) for poll in polls]


@router.post("/{game_id}/polls", response_model=PollResponse)
def create_poll(
    game_id: int,
    poll_data: PollCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PollResponse:
    """Create a new poll for a game."""
    game = _ensure_live_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live game not found")

    # Create the poll
    poll = Poll(
        game_id=game_id,
        title=poll_data.title,
        created_by_user_id=current_user.user_id,
        created_by_username=current_user.username,
    )
    db.add(poll)
    db.flush()  # Get the poll ID

    # Create poll options
    for idx, option in enumerate(poll_data.options):
        poll_option = PollOption(
            poll_id=poll.id,
            option_key=option.key,
            option_label=option.label,
            display_order=idx,
        )
        db.add(poll_option)

    db.commit()
    db.refresh(poll)

    return poll_to_response(poll, db)


@router.post("/{game_id}/polls/{poll_id}/vote", response_model=PollResponse)
def vote_on_poll(
    game_id: int,
    poll_id: int,
    vote_data: PollVoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PollResponse:
    """Vote on a poll option. Changes vote if user already voted."""
    # Verify game exists
    game = _ensure_live_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live game not found")

    # Verify poll exists and belongs to this game
    poll = db.query(Poll).filter(Poll.id == poll_id, Poll.game_id == game_id).first()
    if poll is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")

    # Verify option exists
    option = (
        db.query(PollOption)
        .filter(PollOption.poll_id == poll_id, PollOption.option_key == vote_data.option_key)
        .first()
    )
    if option is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid poll option")

    # Check if user already voted
    existing_vote = (
        db.query(PollVote)
        .filter(PollVote.poll_id == poll_id, PollVote.user_id == current_user.user_id)
        .first()
    )

    if existing_vote:
        # If voting for same option, remove the vote (toggle off)
        if existing_vote.option_key == vote_data.option_key:
            db.delete(existing_vote)
        else:
            # Change vote to new option
            existing_vote.option_key = vote_data.option_key
            existing_vote.updated_at = datetime.utcnow()
    else:
        # Create new vote
        new_vote = PollVote(
            poll_id=poll_id,
            user_id=current_user.user_id,
            option_key=vote_data.option_key,
        )
        db.add(new_vote)

    db.commit()
    db.refresh(poll)

    return poll_to_response(poll, db)


@router.get("/{game_id}/polls/{poll_id}/user-vote")
def get_user_vote(
    game_id: int,
    poll_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's vote for a specific poll."""
    # Verify poll exists and belongs to this game
    poll = db.query(Poll).filter(Poll.id == poll_id, Poll.game_id == game_id).first()
    if poll is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")

    # Get user's vote
    vote = (
        db.query(PollVote)
        .filter(PollVote.poll_id == poll_id, PollVote.user_id == current_user.user_id)
        .first()
    )

    if vote:
        return {"option_key": vote.option_key}
    else:
        return {"option_key": None}


@router.websocket("/ws/{game_id}")
async def live_game_websocket(websocket: WebSocket, game_id: int) -> None:
    logger.info("WebSocket connection attempt for game_id=%s from client %s", game_id, websocket.client)
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        token_data = verify_token(token, credentials_exception)
    except HTTPException:
        await websocket.close(code=1008, reason="Authentication failed")
        return

    db = SessionLocal()
    try:
        user = get_user_by_username(db, token_data.username)
        game = _ensure_live_game(db, game_id)

        if game is None or user is None:
            await websocket.close(code=1008, reason="Live game unavailable")
            return

        await manager.connect(game_id, websocket, user)
        
        # Get all polls for this game
        polls = db.query(Poll).filter(Poll.game_id == game_id).order_by(Poll.created_at.asc()).all()
        polls_data = [poll_to_response(poll, db).dict() for poll in polls]
        local_match_date = _to_local_match_time(game.match_date)

        await websocket.send_json(
            {
                "type": "welcome",
                "game_id": game_id,
                "home_team": game.home_team,
                "away_team": game.away_team,
                "match_date": local_match_date.isoformat() if local_match_date else None,
                "active_users": manager.get_active_count(game_id),
                "polls": polls_data,
            }
        )
        await manager.broadcast_presence(game_id)

        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type", "chat")
            
            if message_type == "chat":
                content = (payload or {}).get("content", "").strip()

                if not content:
                    await websocket.send_json({"type": "error", "message": "Message cannot be empty."})
                    continue

                is_clean, error_msg = check_message_content(content)
                if not is_clean:
                    await websocket.send_json({"type": "error", "message": error_msg})
                    continue

                now = datetime.utcnow()
                message = LiveGameMessage(
                    game_id=game_id,
                    user_id=user.user_id,
                    content=content,
                    created_at=now,
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                await manager.broadcast(
                    game_id,
                    {
                        "type": "chat_message",
                        "message_id": message.id,
                        "game_id": message.game_id,
                        "user_id": uuid_bytes_to_str(message.user_id) or "",
                        "username": user.username,
                        "content": message.content,
                        "created_at": message.created_at.isoformat(),
                    },
                )
            
            elif message_type == "poll_created":
                # Broadcast that a new poll was created
                poll_id = payload.get("poll_id")
                if poll_id:
                    poll = db.query(Poll).filter(Poll.id == poll_id).first()
                    if poll:
                        poll_response = poll_to_response(poll, db)
                        await manager.broadcast(
                            game_id,
                            {
                                "type": "poll_created",
                                "poll": poll_response.dict(),
                            },
                        )
            
            elif message_type == "poll_voted":
                # Broadcast updated poll results
                poll_id = payload.get("poll_id")
                if poll_id:
                    poll = db.query(Poll).filter(Poll.id == poll_id).first()
                    if poll:
                        poll_response = poll_to_response(poll, db)
                        await manager.broadcast(
                            game_id,
                            {
                                "type": "poll_updated",
                                "poll": poll_response.dict(),
                            },
                        )

    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
        await manager.broadcast_presence(game_id)
    finally:
        db.close()
