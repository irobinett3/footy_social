import os, time, math
from datetime import timedelta
from dateutil.relativedelta import relativedelta
import pandas as pd
from sqlalchemy import create_engine, text
from soccerdata import FBref  # pip install soccerdata
from dotenv import load_dotenv
load_dotenv(override=True)


# ---------- CONFIG ----------
DB_HOST = os.getenv("ETL_DB_HOST", "localhost")
DB_PORT = os.getenv("ETL_DB_PORT", "5432")
DB_NAME = os.getenv("ETL_DB_NAME", "epl_trivia")
DB_USER = os.getenv("ETL_DB_USER", "etl_user")
DB_PASS = os.getenv("ETL_DB_PASS", "password")



SEASONS = list(range(1993, 2025))  # 1992-93 .. 2023-24
PAUSE_BASE, PAUSE_JITTER = 5, 2
CHECKPOINT_DIR = "raw_checkpoints"
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

engine = create_engine(
    f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    pool_pre_ping=True
)

def q(sql, **p):
    with engine.begin() as conn:
        return pd.read_sql(text(sql), conn, params=p)

def exec_(sql, **p):
    with engine.begin() as conn:
        conn.execute(text(sql), p)

# ---------- UPSERT HELPERS ----------
def get_or_create_competition(code="ENG1", name="Premier League"):
    df = q("SELECT competition_id FROM competitions WHERE code=:code", code=code)
    if df.empty:
        exec_("INSERT INTO competitions (code, name) VALUES (:code,:name)", code=code, name=name)
        df = q("SELECT competition_id FROM competitions WHERE code=:code", code=code)
    return int(df.competition_id.iloc[0])

def get_or_create_season(start_year, end_year):
    label = f"{start_year}-{end_year%100:02d}"
    df = q("SELECT season_id FROM seasons WHERE label=:label", label=label)
    if df.empty:
        exec_("""INSERT INTO seasons (start_year, end_year, label)
                  VALUES (:sy,:ey,:label)""", sy=start_year, ey=end_year, label=label)
        df = q("SELECT season_id FROM seasons WHERE label=:label", label=label)
    return int(df.season_id.iloc[0])

def get_or_create_club(name):
    df = q("SELECT club_id FROM clubs WHERE club_name=:n", n=name)
    if df.empty:
        exec_("INSERT INTO clubs (club_name) VALUES (:n)", n=name)
        df = q("SELECT club_id FROM clubs WHERE club_name=:n", n=name)
    return int(df.club_id.iloc[0])

def get_or_create_player(full_name, birth_date=None, fbref_id=None):
    if fbref_id:
        df = q("SELECT player_id FROM players WHERE fbref_id=:fid", fid=fbref_id)
        if not df.empty: return int(df.player_id.iloc[0])
    df = q("""SELECT player_id FROM players
              WHERE full_name=:n AND (birth_date IS NULL OR birth_date = :b) 
              ORDER BY player_id LIMIT 1""", n=full_name, b=birth_date)
    if df.empty:
        exec_("INSERT INTO players (fbref_id, full_name, birth_date) VALUES (:fid,:n,:b)",
              fid=fbref_id, n=full_name, b=birth_date)
        df = q("SELECT player_id FROM players WHERE full_name=:n ORDER BY player_id DESC LIMIT 1", n=full_name)
    return int(df.player_id.iloc[0])

def upsert_player_season_stat(pid, cid, sid, compid, matches, starts, minutes, goals, assists):
    exec_("""
    INSERT INTO player_season_club_stats
    (player_id, club_id, season_id, competition_id, matches_played, starts, minutes, goals, assists)
    VALUES (:pid,:cid,:sid,:comp,:mp,:st,:min,:g,:a)
    ON CONFLICT (player_id, club_id, season_id, competition_id)
    DO UPDATE SET
      matches_played = EXCLUDED.matches_played,
      starts = EXCLUDED.starts,
      minutes = EXCLUDED.minutes,
      goals = EXCLUDED.goals,
      assists = EXCLUDED.assists;
    """, pid=pid, cid=cid, sid=sid, comp=compid, mp=matches, st=starts, min=minutes, g=goals, a=assists)

# ---------- DATA FETCH ----------
def fetch_epl_tables(end_year):
    """
    Returns (std, pt) DataFrames for ENG-Premier League, season ending `end_year`,
    using soccerdata 1.8.7 (class FBref, method read_player_season).
    """
    import os
    import pandas as pd
    from soccerdata import FBref  # NOTE: capital B

    fb = FBref(leagues=["ENG-Premier League"], seasons=[end_year])

    # Preferred signature in 1.8.7:
    try:
        std = fb.read_player_season_stats(table="standard")
        pt  = fb.read_player_season_stats(table="playing_time")
    except TypeError:
        # Some builds accept the table as a positional arg
        std = fb.read_player_season_stats("standard")
        pt  = fb.read_player_season_stats("playing_time")

    # Check types
    if not isinstance(std, pd.DataFrame) or not isinstance(pt, pd.DataFrame):
        raise RuntimeError("Unexpected return type from soccerdata.FBref.read_player_season")

    # Optional checkpoints
    std.to_csv(os.path.join(CHECKPOINT_DIR, f"fbref_standard_{end_year}.csv"), index=False)
    pt.to_csv(os.path.join(CHECKPOINT_DIR, f"fbref_playtime_{end_year}.csv"), index=False)

    return std, pt

def norm_cols(df):
    # lower snake
    df = df.rename(columns=lambda c: c.strip().lower().replace(" ", "_"))
    return df

def pick(df, *candidates):
    """
    Return the first matching column in df from the given candidates.
    If none are found, return a pandas Series of NaN with correct length.
    """
    for c in candidates:
        if c in df.columns:
            return df[c]
    # fallback: return Series of NaN
    return pd.Series([pd.NA] * len(df))

def safe_series(val, length):
    """Ensure val is a pandas Series, matching DataFrame length if needed."""
    import pandas as pd
    if isinstance(val, pd.Series):
        return val
    # broadcast scalar across DataFrame length
    return pd.Series([val] * length)

def normalize_join(std, pt, season_end_year):
    std = std.rename(columns=lambda x: str(x).lower().replace(" ", "_"))
    pt  = pt.rename(columns=lambda x: str(x).lower().replace(" ", "_"))

    n = len(std)

    out = pd.DataFrame({
        "season_end_year": season_end_year,
        "player": safe_series(pick(std, "player", "player_name"), n).astype(str).str.strip(),
        "squad":  safe_series(pick(std, "squad", "team"), n).astype(str).str.strip(),
        "gls": pd.to_numeric(
            safe_series(pick(std, "gls", "goals"), n), errors="coerce"
        ).fillna(0).astype(int),
        "ast": pd.to_numeric(
            safe_series(pick(std, "ast", "assists"), n), errors="coerce"
        ).fillna(0).astype(int),
    })

    pt_df = pd.DataFrame({
        "season_end_year": season_end_year,
        "player": safe_series(pick(pt, "player", "player_name"), len(pt)).astype(str).str.strip(),
        "squad":  safe_series(pick(pt, "squad", "team"), len(pt)).astype(str).str.strip(),
        "mp": pd.to_numeric(safe_series(pick(pt, "mp", "matches_played"), len(pt)), errors="coerce").fillna(0).astype(int),
        "starts": pd.to_numeric(safe_series(pick(pt, "starts", "starts_"), len(pt)), errors="coerce").fillna(0).astype(int),
        "minutes": pd.to_numeric(safe_series(pick(pt, "min", "minutes_played"), len(pt)), errors="coerce").fillna(0).astype(int),
    })

    return out.merge(pt_df, on=["season_end_year", "player", "squad"], how="left")

# ---------- MAIN ----------
def main():
    comp_id = get_or_create_competition("ENG1", "Premier League")
    with engine.begin() as conn:
        pass  # connectivity check

    for end_year in SEASONS:
        start_year = end_year - 1
        label = f"{start_year}-{end_year%100:02d}"
        print(f"Processing season {label}")

        sid = get_or_create_season(start_year, end_year)
        exists = q("SELECT 1 FROM player_season_club_stats WHERE season_id=:sid LIMIT 1", sid=sid)
        if not exists.empty:
            print(f"Season {label} already present; skipping.")
            continue

        # fetch
        std, pt = fetch_epl_tables(end_year)
        season_df = normalize_join(std, pt, end_year)

        # ingest
        n = len(season_df)
        print(f"Rows to ingest: {n}")
        for i, row in season_df.iterrows():
            club_id = get_or_create_club(row["squad"])
            pid = get_or_create_player(row["player"], birth_date=None, fbref_id=None)
            upsert_player_season_stat(
                pid, club_id, sid, comp_id,
                matches=int(row.get("mp",0)),
                starts=int(row.get("starts",0)),
                minutes=int(row.get("minutes",0)),
                goals=int(row.get("gls",0)),
                assists=int(row.get("ast",0)),
            )
            if (i+1) % 50 == 0:
                print(f"Processed {i+1}/{n}")
        print(f"Finished season {label}")
        time.sleep(PAUSE_BASE)  # be polite

    print("ETL completed.")

if __name__ == "__main__":
    import os
    print(os.getcwd())
    print(DB_HOST)
    print(DB_PORT)
    main()