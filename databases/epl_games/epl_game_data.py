#!/usr/bin/env python3
"""
Script to create EPL matches table in MySQL and load data from CSV file.
Uses SQLAlchemy and pandas for a cleaner, more Pythonic approach.
"""

import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from datetime import datetime

# ---------- CONFIG ----------
load_dotenv(override=True)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASSWORD")
CSV_FILE = os.getenv("CSV_FILE", "epl-2025-GMTStandardTime.csv")

# Create SQLAlchemy engine
engine = create_engine(
    f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    pool_pre_ping=True
)

# ---------- SQL HELPERS ----------
def q(sql, **params):
    """Execute a query and return results as a DataFrame."""
    with engine.begin() as conn:
        return pd.read_sql(text(sql), conn, params=params)

def exec_(sql, **params):
    """Execute a SQL statement (INSERT, UPDATE, DELETE, etc.)."""
    with engine.begin() as conn:
        conn.execute(text(sql), params)

# ---------- TABLE CREATION ----------
def create_table():
    """Create the EPL matches table if it doesn't exist."""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS epl_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_number INT NOT NULL,
        round_number INT NOT NULL,
        match_date DATETIME NOT NULL,
        location VARCHAR(100) NOT NULL,
        home_team VARCHAR(50) NOT NULL,
        away_team VARCHAR(50) NOT NULL,
        result VARCHAR(20) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_match_number (match_number),
        INDEX idx_round_number (round_number),
        INDEX idx_match_date (match_date),
        INDEX idx_home_team (home_team),
        INDEX idx_away_team (away_team),
        INDEX idx_location (location)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """
    try:
        exec_(create_table_sql)
        print("✓ Table 'epl_matches' created successfully (or already exists)")
    except Exception as e:
        print(f"✗ Error creating table: {e}")
        raise

# ---------- DATA CLEANING ----------
def parse_date(date_str):
    """Parse date string from DD/MM/YYYY HH:MM or D/M/YY HH:MM format."""
    try:
        # Try full year format first (DD/MM/YYYY HH:MM)
        return pd.to_datetime(date_str, format='%d/%m/%Y %H:%M')
    except Exception:
        try:
            # Try short year format (D/M/YY HH:MM)
            return pd.to_datetime(date_str, format='%d/%m/%y %H:%M')
        except Exception:
            return None

def to_int(val):
    """Convert value to int, handling nulls and invalid data."""
    try:
        if val is None or str(val).strip() in {"", "-"}:
            return None
        return int(float(val))
    except Exception:
        return None

# ---------- DATA PROCESSING ----------
def process_dataframe(df):
    """
    Clean and ingest EPL match data into MySQL.
    """
    # Replace dashes and empty strings with None
    df = df.replace({"-": None, "": None})
    
    # Rename columns to match our database schema
    rename_map = {
        "Match Number": "match_number",
        "Round Number": "round_number",
        "Date": "match_date",
        "Location": "location",
        "Home Team": "home_team",
        "Away Team": "away_team",
        "Result": "result"
    }
    df = df.rename(columns=rename_map)
    
    # Parse dates
    df["match_date"] = df["match_date"].apply(parse_date)
    
    # Convert to proper types
    df["match_number"] = df["match_number"].apply(to_int)
    df["round_number"] = df["round_number"].apply(to_int)
    
    print(f"Total rows after parsing: {len(df)}")
    
    # Only drop rows missing essential fields: date, teams, and location
    df = df.dropna(subset=["match_date", "home_team", "away_team", "location"])
    
    print(f"Rows after dropping invalid data: {len(df)}")
    if len(df) < 379:
        print(f"⚠ Warning: Dropped {379 - len(df)} rows missing date, teams, or location")
    
    # Insert data using upsert (ON DUPLICATE KEY UPDATE)
    inserted_count = 0
    skipped_count = 0
    
    for idx, row in df.iterrows():
        try:
            # Convert pandas Timestamp to Python datetime
            match_date = row["match_date"]
            if pd.notna(match_date):
                match_date = match_date.to_pydatetime()
            else:
                match_date = None
            
            # Convert NaN to None for nullable fields
            result = row["result"] if pd.notna(row["result"]) else None
            match_num = row["match_number"] if pd.notna(row["match_number"]) else None
            round_num = row["round_number"] if pd.notna(row["round_number"]) else None
            
            exec_("""
            INSERT INTO epl_matches 
                (match_number, round_number, match_date, location, home_team, away_team, result)
            VALUES 
                (:match_num, :round_num, :date, :loc, :home, :away, :res)
            ON DUPLICATE KEY UPDATE
                round_number = VALUES(round_number),
                match_date = VALUES(match_date),
                location = VALUES(location),
                home_team = VALUES(home_team),
                away_team = VALUES(away_team),
                result = VALUES(result)
            """,
            match_num=match_num,
            round_num=round_num,
            date=match_date,
            loc=row["location"],
            home=row["home_team"],
            away=row["away_team"],
            res=result
            )
            inserted_count += 1
        except Exception as e:
            skipped_count += 1
            if skipped_count <= 5:  # Only show first 5 errors
                print(f"⚠ Warning row {idx}: {e}")
                print(f"   Data: match_num={row.get('match_number')}, date={row.get('match_date')}")
    
    print(f"✓ Successfully inserted/updated {inserted_count} records")
    if skipped_count > 0:
        print(f"⚠ Skipped {skipped_count} records due to errors")
    
    return inserted_count

def show_sample_data():
    """Display first and last rows of the loaded data."""
    try:
        # Get first 3 rows
        first_rows = q("""
        SELECT match_number, round_number, match_date, home_team, away_team, result
        FROM epl_matches
        ORDER BY match_date
        LIMIT 3
        """)
        
        # Get last 3 rows
        last_rows = q("""
        SELECT match_number, round_number, match_date, home_team, away_team, result
        FROM epl_matches
        ORDER BY match_date DESC
        LIMIT 3
        """)
        
        print("\n" + "="*80)
        print("FIRST 3 MATCHES (Earliest):")
        print("="*80)
        print(first_rows.to_string(index=False))
        
        print("\n" + "="*80)
        print("LAST 3 MATCHES (Latest):")
        print("="*80)
        # Reverse the order so they display chronologically
        print(last_rows.iloc[::-1].to_string(index=False))
        print()
        
    except Exception as e:
        print(f"✗ Error fetching sample data: {e}")

def show_stats():
    """Display statistics about the loaded data."""
    try:
        total = q("SELECT COUNT(*) as count FROM epl_matches")
        print(f"Total records in database: {total['count'].iloc[0]}")
        
        by_round = q("""
        SELECT round_number, COUNT(*) as matches
        FROM epl_matches
        GROUP BY round_number
        ORDER BY round_number
        LIMIT 5
        """)
        print("\nMatches per round (first 5 rounds):")
        print(by_round.to_string(index=False))
        
    except Exception as e:
        print(f"✗ Error fetching stats: {e}")

# ---------- MAIN ----------
def main():
    """Main execution function."""
    print("\n" + "="*80)
    print("EPL 2025 Data Import Script")
    print("="*80 + "\n")
    
    # Validate environment variables
    required_vars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"✗ Error: Missing required environment variables: {', '.join(missing_vars)}")
        print("Please create a .env file with the required variables.")
        return
    
    # Quick connectivity check
    try:
        with engine.begin():
            pass
        print("✓ Successfully connected to MySQL database")
    except Exception as e:
        print(f"✗ Error connecting to database: {e}")
        return
    
    # Create table
    try:
        create_table()
    except Exception:
        print("Failed to create table. Exiting.")
        return
    
    # Check if CSV file exists
    if not os.path.exists(CSV_FILE):
        print(f"✗ Error: CSV file '{CSV_FILE}' not found")
        return
    
    # Ask user if they want to clear existing data
    print("\nDo you want to clear existing data before importing? (y/n): ", end='')
    choice = input().strip().lower()
    
    if choice == 'y':
        exec_("DELETE FROM epl_matches")
        print("✓ Existing data cleared")
    
    # Load and process CSV data
    print(f"\nLoading data from '{CSV_FILE}'...")
    try:
        df = pd.read_csv(CSV_FILE)
        records_inserted = process_dataframe(df)
        
        # Show sample data and stats
        if records_inserted > 0:
            show_sample_data()
            show_stats()
        
        print("\n" + "="*80)
        print("✅ Import completed successfully!")
        print("="*80 + "\n")
        
    except FileNotFoundError:
        print(f"✗ Error: CSV file '{CSV_FILE}' not found")
    except Exception as e:
        print(f"✗ An error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()