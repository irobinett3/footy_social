import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from database import engine, get_db, SessionLocal
from models import Base
from routers import auth, users, trivia
from routers import fanrooms as fanroom_router
from routers.fanrooms import ensure_fan_rooms_exist
from config import settings
from routers.chatbot import initialize_chatbot

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="FootySocial API",
    description="A social platform for football fans",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(trivia.router)
app.include_router(fanroom_router.router)


@app.on_event("startup")
def bootstrap_fan_rooms():
    """Ensure the default fan rooms exist."""
    with SessionLocal() as db:
        ensure_fan_rooms_exist(db)


@app.on_event("startup")
async def initialize_chatbot_on_startup():
    """Initialize the FootyBot chatbot and bad word filter."""
    openai_api_key = os.getenv("OPENAI_API_KEY")
    
    if not openai_api_key:
        print("⚠️  WARNING: OPENAI_API_KEY not set - FootyBot will not work!")
        print("   Set it in your .env file or environment variables")
        return
    
    try:
        # Optional: customize bad words list
        custom_badwords = [
            "damn", "hell", "crap", "sucks", "shit", "fuck", 
            "bitch", "ass", "bastard", "piss"
            # Add more words as needed for your platform
        ]
        
        # Initialize the chatbot
        initialize_chatbot(
            openai_api_key=openai_api_key,
            badwords=custom_badwords
        )
        print("✅ FootyBot initialized successfully!")
        print("   Users can mention @FootyBot, !bot, or !footy in fan rooms")
    except Exception as e:
        print(f"❌ Failed to initialize FootyBot: {e}")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to FootySocial API"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)