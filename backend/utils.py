"""
Utility functions for the application.
"""
from typing import Optional
import uuid

from schemas import UserResponse
from models import User


def user_to_response(user: User) -> UserResponse:
    """Convert a User model instance to UserResponse schema."""
    return UserResponse(
        user_id=user.user_id_str,
        first_name=user.first_name,
        last_name=user.last_name,
        username=user.username,
        email=user.email,
        bio=user.bio,
        favorite_team=user.favorite_team,
        trivia_points=user.trivia_points,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


def uuid_bytes_to_str(value: Optional[bytes]) -> Optional[str]:
    """Convert binary UUID bytes to string format."""
    if value is None:
        return None
    return str(uuid.UUID(bytes=value))
