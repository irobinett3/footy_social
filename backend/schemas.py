from pydantic import BaseModel, validator
from datetime import datetime, date
from typing import Optional

# User schemas
class UserBase(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: str
    bio: Optional[str] = None
    favorite_team: Optional[str] = None

class UserCreate(UserBase):
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    password: Optional[str] = None
    favorite_team: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if v is not None:
            if len(v) < 6:
                raise ValueError('Password must be at least 6 characters long')
        return v

class UserResponse(UserBase):
    user_id: str  # This will be the UUID as string
    trivia_points: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Fan room schemas
class FanRoomResponse(BaseModel):
    id: int
    team_name: str
    display_name: str
    active_users: int
    is_global: bool = False

class FanRoomMessageResponse(BaseModel):
    message_id: int
    room_id: int
    user_id: str
    username: str
    content: str
    created_at: datetime
    chat_date: date

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str
