import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session

from auth import get_user_by_username, verify_token
from database import SessionLocal, get_db
from models import LiveGame, LiveGameMessage, User
from routers.chatbot import check_message_content
from schemas import LiveGameMessageResponse, LiveGameResponse
from utils import uuid_bytes_to_str

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/livegames", tags=["livegames"])


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


@router.get("", response_model=List[LiveGameResponse])
def list_live_games(db: Session = Depends(get_db)) -> List[LiveGameResponse]:
    games = db.query(LiveGame).order_by(LiveGame.match_date.asc()).all()
    return [
        LiveGameResponse(
            id=game.id,
            home_team=game.home_team,
            away_team=game.away_team,
            match_date=game.match_date,
        )
        for game in games
    ]


@router.get("/{game_id}", response_model=LiveGameResponse)
def get_live_game(game_id: int, db: Session = Depends(get_db)) -> LiveGameResponse:
    game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live game not found")

    return LiveGameResponse(
        id=game.id,
        home_team=game.home_team,
        away_team=game.away_team,
        match_date=game.match_date,
    )


@router.get("/{game_id}/messages", response_model=List[LiveGameMessageResponse])
def get_live_game_messages(
    game_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[LiveGameMessageResponse]:
    if limit <= 0 or limit > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limit must be between 1 and 500")

    game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
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
        game = db.query(LiveGame).filter(LiveGame.id == game_id).first()

        if game is None or user is None:
            await websocket.close(code=1008, reason="Live game unavailable")
            return

        await manager.connect(game_id, websocket, user)
        await websocket.send_json(
            {
                "type": "welcome",
                "game_id": game_id,
                "home_team": game.home_team,
                "away_team": game.away_team,
                "match_date": game.match_date.isoformat() if game.match_date else None,
                "active_users": manager.get_active_count(game_id),
            }
        )
        await manager.broadcast_presence(game_id)

        while True:
            payload = await websocket.receive_json()
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

    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
        await manager.broadcast_presence(game_id)
    finally:
        db.close()
