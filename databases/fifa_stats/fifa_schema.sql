-- fifa_schema.sql

-- Core entities
CREATE TABLE IF NOT EXISTS players (
  player_id    BIGSERIAL PRIMARY KEY,
  fut_id       TEXT UNIQUE,                 -- optional external id if you ever add one
  full_name    TEXT NOT NULL,
  birth_date   DATE,                        -- unknown in the CSV; keep for future
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (full_name, birth_date)
);

CREATE TABLE IF NOT EXISTS clubs (
  club_id     BIGSERIAL PRIMARY KEY,
  club_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (club_name)
);

CREATE TABLE IF NOT EXISTS countries (
  country_id  BIGSERIAL PRIMARY KEY,
  country_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (country_name)
);

-- If you want to track different “editions”/labels in the CSV 'Version' column
CREATE TABLE IF NOT EXISTS fifa_versions (
  version_id  BIGSERIAL PRIMARY KEY,
  label       TEXT UNIQUE NOT NULL,         -- e.g., '', 'IF', 'TOTW', 'FIFA11', etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- One row per (player, version)
-- Includes per-entry club/country & position because they can vary by version/card
CREATE TABLE IF NOT EXISTS player_version_stats (
  player_id   BIGINT NOT NULL REFERENCES players(player_id),
  version_id  BIGINT NOT NULL REFERENCES fifa_versions(version_id),
  club_id     BIGINT REFERENCES clubs(club_id),
  country_id  BIGINT REFERENCES countries(country_id),

  -- snapshot attributes from the CSV
  position    TEXT,                          -- e.g., 'ST','RW','GK', etc.
  height_cm   SMALLINT,                      -- parsed from "Body" field (e.g., 169cm | 5'7"")
  rating      SMALLINT,                      -- Ratings
  ps          INTEGER,                       -- PS (unknown meaning; kept nullable)
  ski         NUMERIC(3,1),                  -- SKI shows decimals (e.g., 5.0)
  wf          SMALLINT,                      -- WF
  pac         SMALLINT, sho SMALLINT, pas SMALLINT, dri SMALLINT, def SMALLINT, phy SMALLINT,
  popularity  INTEGER,
  bs          INTEGER,
  igs         INTEGER,

  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (player_id, version_id)        -- 1 row per player+version snapshot
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_players_name      ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_pvs_rating        ON player_version_stats(rating DESC);
CREATE INDEX IF NOT EXISTS idx_pvs_club          ON player_version_stats(club_id);
CREATE INDEX IF NOT EXISTS idx_pvs_country       ON player_version_stats(country_id);
CREATE INDEX IF NOT EXISTS idx_pvs_position      ON player_version_stats(position);