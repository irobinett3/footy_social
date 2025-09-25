import os
import re
import time
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import glob


# ---------- CONFIG ----------
load_dotenv(override=True)

DB_HOST = os.getenv("ETL_DB_HOST", "localhost")
DB_PORT = os.getenv("ETL_DB_PORT", "5432")
DB_NAME = os.getenv("ETL_DB_NAME", "fifa_local")
DB_USER = os.getenv("ETL_DB_USER", "etl_user")
DB_PASS = os.getenv("ETL_DB_PASS", "password")
CSV_DIR = os.getenv("CSV_DIR", "./data_files")

engine = create_engine(
    f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    pool_pre_ping=True
)

# ---------- SQL HELP ----------
def q(sql, **p):
    with engine.begin() as conn:
        return pd.read_sql(text(sql), conn, params=p)

def exec_(sql, **p):
    with engine.begin() as conn:
        conn.execute(text(sql), p)

# ---------- UPSERT HELPERS ----------
def get_or_create_country(name: str | None) -> int | None:
    if not name or str(name).strip() == "":
        return None
    name = name.strip()
    df = q("SELECT country_id FROM countries WHERE country_name=:n", n=name)
    if df.empty:
        exec_("INSERT INTO countries (country_name) VALUES (:n)", n=name)
        df = q("SELECT country_id FROM countries WHERE country_name=:n", n=name)
    return int(df.country_id.iloc[0])

def get_or_create_club(name: str | None) -> int | None:
    if not name or str(name).strip() == "":
        return None
    name = name.strip()
    df = q("SELECT club_id FROM clubs WHERE club_name=:n", n=name)
    if df.empty:
        exec_("INSERT INTO clubs (club_name) VALUES (:n)", n=name)
        df = q("SELECT club_id FROM clubs WHERE club_name=:n", n=name)
    return int(df.club_id.iloc[0])

def get_or_create_version(label: str | None) -> int:
    lab = (label or "").strip()
    lab = lab if lab else "base"       # normalize blanks to 'base'
    df = q("SELECT version_id FROM fifa_versions WHERE label=:l", l=lab)
    if df.empty:
        exec_("INSERT INTO fifa_versions (label) VALUES (:l)", l=lab)
        df = q("SELECT version_id FROM fifa_versions WHERE label=:l", l=lab)
    return int(df.version_id.iloc[0])

def get_or_create_player(full_name: str, birth_date=None, fut_id=None) -> int:
    # If you later add fut_id, check it first
    if fut_id:
        df = q("SELECT player_id FROM players WHERE fut_id=:fid", fid=fut_id)
        if not df.empty:
            return int(df.player_id.iloc[0])

    df = q("""SELECT player_id FROM players
              WHERE full_name = :n AND (birth_date IS NULL OR birth_date = :b)
              ORDER BY player_id LIMIT 1""", n=full_name, b=birth_date)
    if df.empty:
        exec_("INSERT INTO players (fut_id, full_name, birth_date) VALUES (:fid,:n,:b)",
              fid=fut_id, n=full_name, b=birth_date)
        df = q("SELECT player_id FROM players WHERE full_name=:n ORDER BY player_id DESC LIMIT 1", n=full_name)
    return int(df.player_id.iloc[0])

def upsert_player_version_row(
    player_id, version_id, club_id, country_id,
    position, height_cm, rating, ps, ski, wf, pac, sho, pas, dri, deff, phy,
    popularity, bs, igs
):
    exec_("""
    INSERT INTO player_version_stats
      (player_id, version_id, club_id, country_id, position, height_cm,
       rating, ps, ski, wf, pac, sho, pas, dri, def, phy, popularity, bs, igs)
    VALUES
      (:pid, :vid, :cid, :cty, :pos, :h,
       :rating, :ps, :ski, :wf, :pac, :sho, :pas, :dri, :def, :phy, :pop, :bs, :igs)
    ON CONFLICT (player_id, version_id)
    DO UPDATE SET
      club_id    = COALESCE(EXCLUDED.club_id, player_version_stats.club_id),
      country_id = COALESCE(EXCLUDED.country_id, player_version_stats.country_id),
      position   = COALESCE(EXCLUDED.position, player_version_stats.position),
      height_cm  = COALESCE(EXCLUDED.height_cm, player_version_stats.height_cm),
      rating     = COALESCE(EXCLUDED.rating, player_version_stats.rating),
      ps         = COALESCE(EXCLUDED.ps, player_version_stats.ps),
      ski        = COALESCE(EXCLUDED.ski, player_version_stats.ski),
      wf         = COALESCE(EXCLUDED.wf, player_version_stats.wf),
      pac        = COALESCE(EXCLUDED.pac, player_version_stats.pac),
      sho        = COALESCE(EXCLUDED.sho, player_version_stats.sho),
      pas        = COALESCE(EXCLUDED.pas, player_version_stats.pas),
      dri        = COALESCE(EXCLUDED.dri, player_version_stats.dri),
      def        = COALESCE(EXCLUDED.def, player_version_stats.def),
      phy        = COALESCE(EXCLUDED.phy, player_version_stats.phy),
      popularity = COALESCE(EXCLUDED.popularity, player_version_stats.popularity),
      bs         = COALESCE(EXCLUDED.bs, player_version_stats.bs),
      igs        = COALESCE(EXCLUDED.igs, player_version_stats.igs);
    """,
    pid=player_id, vid=version_id, cid=club_id, cty=country_id,
    pos=position, h=height_cm, rating=rating, ps=ps, ski=ski, wf=wf, pac=pac,
    sho=sho, pas=pas, dri=dri, def=deff, phy=phy, pop=popularity, bs=bs, igs=igs
    )

# ---------- CLEANING ----------
def to_int(val):
    try:
        if val is None or str(val).strip() in {"", "-"}:
            return None
        return int(float(val))
    except Exception:
        return None

def to_float(val):
    try:
        if val is None or str(val).strip() in {"", "-"}:
            return None
        return float(val)
    except Exception:
        return None

def parse_height_cm(body):
    if not isinstance(body, str):
        return None
    m = re.search(r'(\d+)\s*cm', body)
    return int(m.group(1)) if m else None


def process_dataframe(df: pd.DataFrame):
    """
    Cleans and ingests one DataFrame into Postgres.
    Move all your current renaming, coercion, and upsert logic here.
    """
    # Normalize dashes/empties
    df = df.replace({"-": None, "": None})

    # Rename columns
    rename_map = {
        "Name":"name","Ratings":"rating","Position":"position","Version":"version",
        "PS":"ps","SKI":"ski","WF":"wf","PAC":"pac","SHO":"sho","PAS":"pas","DRI":"dri",
        "DEF":"def","PHY":"phy","Body":"body","Popularity":"popularity","BS":"bs","IGS":"igs",
        "Club":"club","Country":"country"
    }
    df = df.rename(columns=rename_map)

    # Coerce numeric, parse height, upsert lookups, players, stats...
    # (all the detailed ETL logic you already have goes here)
    # -----------------------------------------------
    # Example:
    # df["height_cm"] = df["body"].apply(parse_height_cm)
    # for name in sorted(set(df["name"].tolist())):
    #     pid = get_or_create_player(name)
    #     ...
    # upsert_player_version_row(...)
    # -----------------------------------------------

def main():
    # Quick connectivity check
    with engine.begin():
        pass

    csv_files = glob.glob(os.path.join(CSV_DIR, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {CSV_DIR}")
        return

    for file_path in csv_files:
        print(f"Processing file: {file_path}")
        df = pd.read_csv(file_path)
        process_dataframe(df)

    print("✅ All CSV files processed.")

if __name__ == "__main__":
    main()