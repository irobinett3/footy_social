from sqlalchemy import Column, String, Text, Integer, DateTime, BINARY
from sqlalchemy.sql import func
from database import Base
import uuid

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
