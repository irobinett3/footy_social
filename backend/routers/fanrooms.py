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
from database import SessionLocal, get_db
from models import FanRoom, FanRoomMessage, User
from schemas import FanRoomMessageResponse, FanRoomResponse
from utils import uuid_bytes_to_str

logger = logging.getLogger(__name__)

GLOBAL_FAN_ROOM_NAME = "FootySocial Hub"

FAN_ROOM_TEAM_NAMES: List[str] = [
    "Arsenal",
    "Aston Villa",
    "Bournemouth",
    "Brentford",
    "Brighton & Hove Albion",
    "Burnley",
    "Chelsea",
    "Crystal Palace",
    "Everton",
    "Fulham",
    "Liverpool",
    "Luton Town",
    "Manchester City",
    "Manchester United",
    "Newcastle United",
    "Nottingham Forest",
    "Sheffield United",
    "Tottenham Hotspur",
    "West Ham United",
    "Wolverhampton Wanderers",
]

router = APIRouter(prefix="/fanrooms", tags=["fanrooms"])


def ensure_fan_rooms_exist(db: Session) -> None:
    """Create the default fan rooms if they are missing."""
    existing = {room.team_name for room in db.query(FanRoom).all()}
    created = False

    if GLOBAL_FAN_ROOM_NAME not in existing:
        db.add(FanRoom(team_name=GLOBAL_FAN_ROOM_NAME))
        created = True

    for team_name in FAN_ROOM_TEAM_NAMES:
        if team_name not in existing:
            db.add(FanRoom(team_name=team_name))
            created = True

    if created:
        db.commit()


def is_global_room(room: FanRoom) -> bool:
    return room.team_name.strip().lower() == GLOBAL_FAN_ROOM_NAME.lower()


class FanRoomConnectionManager:
    """Manage websocket connections for fan rooms."""

    def __init__(self) -> None:
        self.active_connections: Dict[int, Dict[WebSocket, User]] = defaultdict(dict)

    async def connect(self, room_id: int, websocket: WebSocket, user: User) -> None:
        await websocket.accept()
        self.active_connections[room_id][websocket] = user

    def disconnect(self, room_id: int, websocket: WebSocket) -> None:
        room_connections = self.active_connections.get(room_id)
        if not room_connections:
            return
        room_connections.pop(websocket, None)
        if not room_connections:
            self.active_connections.pop(room_id, None)

    def get_active_count(self, room_id: int) -> int:
        return len(self.active_connections.get(room_id, {}))

    def get_participants(self, room_id: int) -> List[User]:
        return list(self.active_connections.get(room_id, {}).values())

    async def broadcast(self, room_id: int, payload: dict) -> None:
        for connection in list(self.active_connections.get(room_id, {})):
            try:
                await connection.send_json(payload)
            except Exception:
                # Connection is already closed; drop it.
                self.disconnect(room_id, connection)

    async def broadcast_presence(self, room_id: int) -> None:
        await self.broadcast(
            room_id,
            {
                "type": "presence",
                "room_id": room_id,
                "active_users": self.get_active_count(room_id),
            },
        )


manager = FanRoomConnectionManager()


@router.get("/", response_model=List[FanRoomResponse])
def list_fan_rooms(db: Session = Depends(get_db)) -> List[FanRoomResponse]:
    rooms = db.query(FanRoom).all()
    ordered_rooms = sorted(
        rooms,
        key=lambda room: (0 if is_global_room(room) else 1, room.team_name.lower()),
    )

    responses: List[FanRoomResponse] = []
    for room in ordered_rooms:
        global_room = is_global_room(room)
        display_name = room.team_name if global_room else f"{room.team_name} Fans"
        responses.append(
            FanRoomResponse(
                id=room.id,
                team_name=room.team_name,
                display_name=display_name,
                active_users=manager.get_active_count(room.id),
                is_global=global_room,
            )
        )
    return responses


@router.get("/{room_id}", response_model=FanRoomResponse)
def get_fan_room(room_id: int, db: Session = Depends(get_db)) -> FanRoomResponse:
    room = db.query(FanRoom).filter(FanRoom.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fan room not found")

    global_room = is_global_room(room)
    display_name = room.team_name if global_room else f"{room.team_name} Fans"

    return FanRoomResponse(
        id=room.id,
        team_name=room.team_name,
        display_name=display_name,
        active_users=manager.get_active_count(room.id),
        is_global=global_room,
    )


@router.get("/{room_id}/messages", response_model=List[FanRoomMessageResponse])
def get_fan_room_messages(
    room_id: int,
    chat_date: Optional[date] = None,
    db: Session = Depends(get_db),
) -> List[FanRoomMessageResponse]:
    room = db.query(FanRoom).filter(FanRoom.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fan room not found")

    target_date = chat_date or date.today()

    messages = (
        db.query(FanRoomMessage)
        .filter(
            FanRoomMessage.room_id == room_id,
            FanRoomMessage.chat_date == target_date,
        )
        .order_by(FanRoomMessage.created_at.asc())
        .all()
    )

    response_messages: List[FanRoomMessageResponse] = []
    for message in messages:
        response_messages.append(
            FanRoomMessageResponse(
                message_id=message.id,
                room_id=message.room_id,
                user_id=uuid_bytes_to_str(message.user_id) or "",
                username=message.user.username if message.user else "Unknown",
                content=message.content,
                created_at=message.created_at,
                chat_date=message.chat_date,
            )
        )

    return response_messages


@router.websocket("/ws/{room_id}")
async def fan_room_websocket(websocket: WebSocket, room_id: int) -> None:
    logger.info("WebSocket connection attempt for room_id=%s from client %s", room_id, websocket.client)
    token = websocket.query_params.get("token")
    if not token:
        logger.warning("WebSocket denied for room_id=%s: missing token", room_id)
        await websocket.close(code=1008, reason="Authentication required")
        return

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        token_data = verify_token(token, credentials_exception)
    except HTTPException:
        logger.warning("WebSocket denied for room_id=%s: invalid token", room_id)
        await websocket.close(code=1008, reason="Authentication failed")
        return

    db = SessionLocal()
    try:
        user = get_user_by_username(db, token_data.username)
        room = db.query(FanRoom).filter(FanRoom.id == room_id).first()

        if room is None or user is None:
            logger.warning(
                "WebSocket denied for room_id=%s: room exists=%s user exists=%s",
                room_id,
                bool(room),
                bool(user),
            )
            await websocket.close(code=1008, reason="Fan room unavailable")
            return

        if not is_global_room(room):
            if not user.favorite_team:
                logger.warning("WebSocket denied for room_id=%s user=%s: favorite team missing", room_id, token_data.username)
                await websocket.close(code=1008, reason="Set your favorite team to join a fan room")
                return

            if user.favorite_team.lower().strip() != room.team_name.lower().strip():
                logger.warning(
                    "WebSocket denied for room_id=%s user=%s: favorite team mismatch (%s vs %s)",
                    room_id,
                    token_data.username,
                    user.favorite_team,
                    room.team_name,
                )
                await websocket.close(code=1008, reason="You can only join your favorite team's fan room")
                return

        await manager.connect(room_id, websocket, user)
        logger.info("WebSocket connected for room_id=%s user=%s", room_id, token_data.username)
        await websocket.send_json(
            {
                "type": "welcome",
                "room_id": room_id,
                "team_name": room.team_name,
                "active_users": manager.get_active_count(room_id),
            }
        )
        await manager.broadcast_presence(room_id)

        while True:
            payload = await websocket.receive_json()
            content = (payload or {}).get("content", "").strip()

            if not content:
                await websocket.send_json(
                    {"type": "error", "message": "Message cannot be empty."}
                )
                continue

            now = datetime.utcnow()
            message = FanRoomMessage(
                room_id=room_id,
                user_id=user.user_id,
                content=content,
                created_at=now,
                chat_date=now.date(),
            )
            db.add(message)
            db.commit()
            db.refresh(message)

            await manager.broadcast(
                room_id,
                {
                    "type": "chat_message",
                    "message_id": message.id,
                    "room_id": room_id,
                    "user_id": uuid_bytes_to_str(message.user_id) or "",
                    "username": user.username,
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                    "chat_date": message.chat_date.isoformat(),
                },
            )
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
        await manager.broadcast_presence(room_id)
        logger.info("WebSocket disconnected for room_id=%s", room_id)
    finally:
        db.close()
