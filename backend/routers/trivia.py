# routers/trivia.py
from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from models import Trivia
from pydantic import BaseModel, Field

# OpenAI via LangChain
from langchain_openai import ChatOpenAI

router = APIRouter(prefix="/api/trivia", tags=["trivia"])

# Local timezone
TZ = ZoneInfo("America/Indiana/Indianapolis")

# ---------- Schemas ----------
class TriviaOut(BaseModel):
    id: date
    question: str
    correct: str
    wrong1: str
    wrong2: str
    wrong3: str

# Structured output schema for the LLM
class TriviaFormat(BaseModel):
    question: str = Field(..., description="MCQ prompt text")
    correct: str
    wrong1: str
    wrong2: str
    wrong3: str

SYSTEM_PROMPT = """You are a soccer trivia generator for the English Premier League.

You will be given (player_name, season_label, goals). Create ONE multiple-choice question:

- Question must be exactly: "How many goals did <player_name> score in the <season_label> Premier League season?"
- Provide exactly one correct numeric answer (string) and three distinct plausible wrong numeric answers (strings).
- All answers must be integers and non-negative.
- Wrong answers should be close to the true value and all answers must be unique.
- Return ONLY the structured fields (no extra commentary)."""

# OpenAI model (set OPENAI_API_KEY in your env)
_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, max_tokens=300)
_structured_llm = _llm.with_structured_output(TriviaFormat)

# ---------- Helpers ----------
def _today() -> date:
    return datetime.now(TZ).date()

def _dialect_rand(dialect_name: str) -> str:
    # MySQL uses RAND(); SQLite uses RANDOM()
    return "RAND()" if dialect_name.startswith("mysql") else "RANDOM()"

def _pick_seed(db: Session) -> Optional[dict]:
    """
    Pull a random (player_name, season_label, goals) from your tables.
    """
    dialect = db.bind.dialect.name if db.bind else "mysql"
    rand_fn = _dialect_rand(dialect)

    sql = f"""
        SELECT
            p.full_name AS player_name,
            s.label     AS season_label,
            ps.goals    AS goals
        FROM player_season_club_stats ps
        JOIN players p  ON p.player_id  = ps.player_id
        JOIN seasons s  ON s.season_id  = ps.season_id
        WHERE
          p.full_name IS NOT NULL
          AND p.full_name <> ''
          AND p.full_name <> '<NA>'
          AND ps.goals IS NOT NULL
          AND ps.goals >= 0
        ORDER BY {rand_fn}
        LIMIT 1
    """
    row = db.execute(text(sql)).mappings().first()
    return dict(row) if row else None

def _validate_answers(trivia: TriviaFormat, true_goals: int) -> TriviaFormat:
    def to_int(x: Any):
        try:
            return int(str(x).strip())
        except Exception:
            return None

    c = to_int(trivia.correct)
    w1 = to_int(trivia.wrong1)
    w2 = to_int(trivia.wrong2)
    w3 = to_int(trivia.wrong3)

    valid = (
        c is not None and c == true_goals and
        all(v is not None and v >= 0 for v in [w1, w2, w3]) and
        len({c, w1, w2, w3}) == 4
    )
    if valid:
        return TriviaFormat(
            question=trivia.question.strip(),
            correct=str(c),
            wrong1=str(w1),
            wrong2=str(w2),
            wrong3=str(w3),
        )

    # Fallback: synthesize plausible wrong answers near truth
    base = true_goals
    candidates = []
    for d in [1, 2, 3, 4, 5, 6, 7]:
        if base - d >= 0:
            candidates.append(base - d)
        candidates.append(base + d)
    uniq = []
    for v in candidates:
        if v != base and v not in uniq:
            uniq.append(v)
    alt = (uniq + [0, base + 8, base + 9])[:3]
    return TriviaFormat(
        question=trivia.question.strip() if trivia.question else "How many goals did the player score?",
        correct=str(base),
        wrong1=str(alt[0]),
        wrong2=str(alt[1]),
        wrong3=str(alt[2]),
    )

def _generate_trivia(db: Session) -> TriviaOut:
    seed = _pick_seed(db)
    if not seed:
        raise HTTPException(500, "No suitable player/season seed found.")

    player = seed["player_name"]
    season = seed["season_label"]
    true_goals = int(seed["goals"])

    user_prompt = (
        "Seed data:\n"
        f"- player_name: {player}\n"
        f"- season_label: {season}\n"
        f"- goals: {true_goals}\n\n"
        "Create the trivia now."
    )

    # Get structured object directly from OpenAI
    structured: TriviaFormat = _structured_llm.invoke(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
    )

    # Force exact wording and validate
    structured.question = f"How many goals did {player} score in the {season} Premier League season?"
    cleaned = _validate_answers(structured, true_goals)

    return TriviaOut(
        id=_today(),
        question=cleaned.question,
        correct=cleaned.correct,
        wrong1=cleaned.wrong1,
        wrong2=cleaned.wrong2,
        wrong3=cleaned.wrong3,
    )

# ---------- Route ----------
@router.get("/daily", response_model=TriviaOut)
def get_daily_trivia(db: Session = Depends(get_db)):
    """
    1) Look up today's trivia by DATE PK.
    2) If found, return it.
    3) If not, generate via LLM, insert, return.
    """
    today = _today()

    existing = db.query(Trivia).filter(Trivia.id == today).first()
    if existing:
        return TriviaOut(
            id=existing.id,
            question=existing.question,
            correct=existing.correct,
            wrong1=existing.wrong1,
            wrong2=existing.wrong2,
            wrong3=existing.wrong3,
        )

    # Create new trivia
    new_trivia = _generate_trivia(db)

    # Persist
    rec = Trivia(
        id=new_trivia.id,
        question=new_trivia.question,
        correct=new_trivia.correct,
        wrong1=new_trivia.wrong1,
        wrong2=new_trivia.wrong2,
        wrong3=new_trivia.wrong3,
    )
    db.add(rec)
    db.commit()

    return new_trivia
