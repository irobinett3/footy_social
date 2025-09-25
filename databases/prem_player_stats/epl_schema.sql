-- epl_schema.sql
CREATE TABLE IF NOT EXISTS players (
  player_id      BIGSERIAL PRIMARY KEY,
  fbref_id       TEXT UNIQUE,
  full_name      TEXT NOT NULL,
  birth_date     DATE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (full_name, birth_date)
);

CREATE TABLE IF NOT EXISTS clubs (
  club_id      BIGSERIAL PRIMARY KEY,
  fbref_id     TEXT UNIQUE,
  club_name    TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (club_name)
);

CREATE TABLE IF NOT EXISTS competitions (
  competition_id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  season_id   BIGSERIAL PRIMARY KEY,
  start_year  INT NOT NULL,
  end_year    INT NOT NULL,
  label       TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS national_teams (
  national_team_id BIGSERIAL PRIMARY KEY,
  fifa_code   TEXT UNIQUE,
  country_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_national_teams (
  player_id        BIGINT NOT NULL REFERENCES players(player_id),
  national_team_id BIGINT NOT NULL REFERENCES national_teams(national_team_id),
  start_date       DATE,
  end_date         DATE,
  PRIMARY KEY (player_id, national_team_id, start_date)
);

CREATE TABLE IF NOT EXISTS player_season_club_stats (
  player_id        BIGINT NOT NULL REFERENCES players(player_id),
  club_id          BIGINT NOT NULL REFERENCES clubs(club_id),
  season_id        BIGINT NOT NULL REFERENCES seasons(season_id),
  competition_id   BIGINT NOT NULL REFERENCES competitions(competition_id),
  matches_played   INT NOT NULL DEFAULT 0,
  starts           INT NOT NULL DEFAULT 0,
  minutes          INT NOT NULL DEFAULT 0,
  goals            INT NOT NULL DEFAULT 0,
  assists          INT NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, club_id, season_id, competition_id)
);