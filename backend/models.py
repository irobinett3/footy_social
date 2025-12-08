from sqlalchemy import Column, String, Text, Integer, DateTime, BINARY, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(BINARY(16), primary_key=True, default=func.uuid_to_bin(func.uuid()))
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    username = Column(String(30), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    favorite_team = Column(String(100), nullable=True)
    trivia_points = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    @property
    def user_id_str(self):
        """Convert binary UUID to string format."""
        if self.user_id:
            return str(uuid.UUID(bytes=self.user_id))
        return None

class Trivia(Base):
    __tablename__ = "trivia"
    # Primary key is the calendar date
    id = Column(Date, primary_key=True)
    question = Column(String(255), nullable=False)
    correct  = Column(String(255), nullable=False)
    wrong1   = Column(String(255), nullable=False)
    wrong2   = Column(String(255), nullable=False)
    wrong3   = Column(String(255), nullable=False)

class FanRoom(Base):
    __tablename__ = "fan_rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_name = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    messages = relationship("FanRoomMessage", back_populates="room", cascade="all, delete-orphan")

class FanRoomMessage(Base):
    __tablename__ = "fan_room_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("fan_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BINARY(16), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    chat_date = Column(Date, nullable=False, default=func.current_date(), index=True)

    room = relationship("FanRoom", back_populates="messages")
    user = relationship("User")


class EPLMatch(Base):
    __tablename__ = "epl_matches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_number = Column(Integer, nullable=False)
    round_number = Column(Integer, nullable=False)
    match_date = Column(DateTime, nullable=False, index=True)
    location = Column(String(255), nullable=True)
    home_team = Column(String(100), nullable=False)
    away_team = Column(String(100), nullable=False)
    result = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    @property
    def match_date_utc(self) -> datetime:
        """Return the match kickoff datetime (naive UTC)."""
        return self.match_date


class LiveGame(Base):
    __tablename__ = "live_games"

    id = Column(Integer, primary_key=True, autoincrement=True)
    home_team = Column(String(100), nullable=False)
    away_team = Column(String(100), nullable=False)
    match_date = Column(DateTime, nullable=False, index=True)

    messages = relationship("LiveGameMessage", back_populates="game", cascade="all, delete-orphan")


class LiveGameMessage(Base):
    __tablename__ = "live_game_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("live_games.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BINARY(16), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    game = relationship("LiveGame", back_populates="messages")
    user = relationship("User")



class Poll(Base):
    __tablename__ = "polls"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("live_games.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    created_by_user_id = Column(BINARY(16), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    created_by_username = Column(String(30), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    game = relationship("LiveGame", backref="polls")
    created_by = relationship("User")
    options = relationship("PollOption", back_populates="poll", cascade="all, delete-orphan")
    votes = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")


class PollOption(Base):
    __tablename__ = "poll_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    poll_id = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True)
    option_key = Column(String(50), nullable=False)
    option_label = Column(String(255), nullable=False)
    display_order = Column(Integer, nullable=False)

    poll = relationship("Poll", back_populates="options")


class PollVote(Base):
    __tablename__ = "poll_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    poll_id = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(BINARY(16), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    option_key = Column(String(50), nullable=False)
    voted_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    poll = relationship("Poll", back_populates="votes")
    user = relationship("User")