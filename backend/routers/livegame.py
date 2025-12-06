import logging
from collections import defaultdict
from datetime import datetime, date
from typing import Dict, List, Optional

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
from routers.chatbot import check_message_content, process_chat_message
from database import SessionLocal, get_db
from models import LiveGame, LiveGameMessage, User
from schemas import LiveGameMessageResponse, LiveGameResponse
from utils import uuid_bytes_to_str

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/livegame", tags=["livegame"])


class LiveGameConnectionManager:
    """Manage websocket connections for live game rooms."""

    def __init__(self) -> None:
        self.active_connections: Dict[int, Dict[WebSocket, User]] = defaultdict(dict)

    async def connect(self, game_id: int, websocket: WebSocket, user: User) -> None:
        await websocket.accept()
        self.active_connections[game_id][websocket] = user

    def disconnect(self, game_id: int, websocket: WebSocket) -> None:
        game_connections = self.active_connections.get(game_id)
        if not game_connections:
            return
        game_connections.pop(websocket, None)
        if not game_connections:
            self.active_connections.pop(game_id, None)

    def get_active_count(self, game_id: int) -> int:
        return len(self.active_connections.get(game_id, {}))

    def get_participants(self, game_id: int) -> List[User]:
        return list(self.active_connections.get(game_id, {}).values())

    async def broadcast(self, game_id: int, payload: dict) -> None:
        for connection in list(self.active_connections.get(game_id, {})):
            try:
                await connection.send_json(payload)
            except Exception:
                # Connection is already closed; drop it.
                self.disconnect(game_id, connection)

    async def broadcast_presence(self, game_id: int) -> None:
        await self.broadcast(
            game_id,
            {
                "type": "presence",
                "game_id": game_id,
                "active_users": self.get_active_count(game_id),
            },
        )


manager = LiveGameConnectionManager()


@router.get("/", response_model=List[LiveGameResponse])
def list_live_games(db: Session = Depends(get_db)) -> List[LiveGameResponse]:
    """List all live game rooms."""
    games = db.query(LiveGame).all()
    
    responses: List[LiveGameResponse] = []
    for game in games:
        responses.append(
            LiveGameResponse(
                id=game.id,
                home_team=game.home_team,
                away_team=game.away_team,
                match_date=game.match_date,
                active_users=manager.get_active_count(game.id),
            )
        )
    return responses


@router.get("/{game_id}", response_model=LiveGameResponse)
def get_live_game(game_id: int, db: Session = Depends(get_db)) -> LiveGameResponse:
    """Get a specific live game room."""
    game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Live game room not found"
        )

    return LiveGameResponse(
        id=game.id,
        home_team=game.home_team,
        away_team=game.away_team,
        match_date=game.match_date,
        active_users=manager.get_active_count(game.id),
    )


@router.get("/history/{game_id}", response_model=List[LiveGameMessageResponse])
def get_live_game_messages(
    game_id: int,
    db: Session = Depends(get_db),
) -> List[LiveGameMessageResponse]:
    """Get chat history for a live game room."""
    game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Live game room not found"
        )

    messages = (
        db.query(LiveGameMessage)
        .filter(LiveGameMessage.game_id == game_id)
        .order_by(LiveGameMessage.created_at.asc())
        .all()
    )

    response_messages: List[LiveGameMessageResponse] = []
    for message in messages:
        response_messages.append(
            LiveGameMessageResponse(
                message_id=message.id,
                game_id=message.game_id,
                user_id=uuid_bytes_to_str(message.user_id) or "",
                username=message.user.username if message.user else "Unknown",
                content=message.content,
                created_at=message.created_at,
            )
        )

    return response_messages


@router.websocket("/ws/{game_id}")
async def live_game_websocket(websocket: WebSocket, game_id: int) -> None:
    """WebSocket endpoint for live game chat."""
    print(f"🔵 WEBSOCKET START: game_id={game_id}")  # ← Add this
    
    logger.info(
        "WebSocket connection attempt for game_id=%s from client %s",
        game_id,
        websocket.client
    )
    
    print(f"🔵 After logger.info")  # ← Add this
    
    token = websocket.query_params.get("token")
    print(f"🔵 Token: {token[:20] if token else 'None'}...")
    
    if not token:
        logger.warning("WebSocket denied for game_id=%s: missing token", game_id)
        await websocket.close(code=1008, reason="Authentication required")
        return

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        token_data = verify_token(token, credentials_exception)
    except HTTPException:
        logger.warning("WebSocket denied for game_id=%s: invalid token", game_id)
        await websocket.close(code=1008, reason="Authentication failed")
        return

    db = SessionLocal()
    try:
        user = get_user_by_username(db, token_data.username)
        game = db.query(LiveGame).filter(LiveGame.id == game_id).first()
        
        # If live game doesn't exist, try to auto-create it from fixtures
        if game is None:
            logger.info("Live game room not found for game_id=%s, attempting auto-creation", game_id)
            
            # Import EPLMatch model
            from models import EPLMatch
            
            fixture = db.query(EPLMatch).filter(EPLMatch.id == game_id).first()
            
            if fixture is None:
                logger.warning("EPL match not found for game_id=%s", game_id)
                await websocket.close(code=1008, reason="Match not found")
                return
            
            # Auto-create the live game room
            game = LiveGame(
                id=fixture.id,
                home_team=fixture.home_team,
                away_team=fixture.away_team,
                match_date=fixture.match_date
            )
            db.add(game)
            db.commit()
            db.refresh(game)
            logger.info("Auto-created live game room for game_id=%s (%s vs %s)", 
                       game_id, game.home_team, game.away_team)

        if user is None:
            logger.warning("User not found for username=%s", token_data.username)
            await websocket.close(code=1008, reason="User not found")
            return

        await manager.connect(game_id, websocket, user)
        logger.info("WebSocket connected for game_id=%s user=%s", game_id, token_data.username)
        
        try:
            await websocket.send_json(
                {
                    "type": "welcome",
                    "game_id": game_id,
                    "home_team": game.home_team,
                    "away_team": game.away_team,
                    "active_users": manager.get_active_count(game_id),
                }
            )
            logger.info("Sent welcome message for game_id=%s", game_id)
        except Exception as e:
            logger.error("Failed to send welcome message: %s", str(e))
            raise
            
        await manager.broadcast_presence(game_id)
        logger.info("Broadcasted presence for game_id=%s", game_id)

        while True:
            payload = await websocket.receive_json()
            content = (payload or {}).get("content", "").strip()

            if not content:
                await websocket.send_json(
                    {"type": "error", "message": "Message cannot be empty."}
                )
                continue

            # Check for inappropriate content
            is_clean, error_msg = check_message_content(content)
            if not is_clean:
                logger.warning(
                    "Message blocked for user %s in game %s: inappropriate content",
                    user.username,
                    game_id
                )
                await websocket.send_json(
                    {"type": "error", "message": error_msg}
                )
                continue

            # Save and broadcast user message
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
                    "game_id": game_id,
                    "user_id": uuid_bytes_to_str(message.user_id) or "",
                    "username": user.username,
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                },
            )

            # Check if FootyBot should respond (optional - can be match-specific)
            try:
                bot_response = await process_chat_message(
                    room_id=game_id,
                    username=user.username,
                    content=content,
                    timestamp=now,
                    team_name=f"{game.home_team} vs {game.away_team}"
                )

                if bot_response:
                    logger.info(
                        "FootyBot responding in game %s to user %s",
                        game_id,
                        user.username
                    )
                    
                    # Save bot message to database
                    bot_message = LiveGameMessage(
                        game_id=game_id,
                        user_id=user.user_id,
                        content=bot_response,
                        created_at=datetime.utcnow(),
                    )
                    db.add(bot_message)
                    db.commit()
                    db.refresh(bot_message)

                    # Broadcast bot response
                    await manager.broadcast(
                        game_id,
                        {
                            "type": "chat_message",
                            "message_id": bot_message.id,
                            "game_id": game_id,
                            "user_id": "bot",
                            "username": "FootyBot",
                            "content": bot_response,
                            "created_at": bot_message.created_at.isoformat(),
                            "is_bot": True,
                        },
                    )
            except Exception as bot_error:
                logger.warning("FootyBot error in game %s: %s", game_id, str(bot_error))
                # Continue without bot response if it fails

    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
        await manager.broadcast_presence(game_id)
        logger.info("WebSocket disconnected for game_id=%s", game_id)
    except Exception as e:
        logger.error("Unexpected error in WebSocket for game_id=%s: %s", game_id, str(e))
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        db.close()