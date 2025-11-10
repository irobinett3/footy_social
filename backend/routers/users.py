from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserResponse, UserUpdate
from auth import get_current_active_user, get_password_hash
from utils import user_to_response

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return user_to_response(current_user)

@router.put("/me", response_model=UserResponse)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user information."""
    # Update fields if provided
    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name
    
    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name
    
    if user_update.username is not None:
        # Check if username is already taken by another user
        existing_user = db.query(User).filter(
            User.username == user_update.username,
            User.user_id != current_user.user_id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = user_update.username
    
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.user_id != current_user.user_id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken"
            )
        current_user.email = user_update.email
    
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    
    if user_update.favorite_team is not None:
        current_user.favorite_team = user_update.favorite_team

    if user_update.password is not None:
        current_user.password_hash = get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(current_user)
    
    return user_to_response(current_user)

@router.delete("/me")
async def delete_user_me(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete current user account."""
    db.delete(current_user)
    db.commit()
    
    return {"message": "User account deleted successfully"}
