# routers/gifs.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import httpx

router = APIRouter(prefix="/api/gifs", tags=["gifs"])

# Tenor API key - for production, move this to environment variables
TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"
TENOR_API_URL = "https://tenor.googleapis.com/v2"

@router.get("/trending")
async def get_trending_gifs(limit: int = Query(20, ge=1, le=50)):
    """
    Fetch trending GIFs from Tenor API.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{TENOR_API_URL}/featured",
                params={
                    "key": TENOR_API_KEY,
                    "limit": limit,
                    "media_filter": "gif"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch trending GIFs: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/search")
async def search_gifs(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50)):
    """
    Search for GIFs using Tenor API.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{TENOR_API_URL}/search",
                params={
                    "key": TENOR_API_KEY,
                    "q": q,
                    "limit": limit,
                    "media_filter": "gif"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to search GIFs: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

