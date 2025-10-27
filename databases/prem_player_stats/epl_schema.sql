CREATE DATABASE IF NOT EXISTS irobinet CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE irobinet;

/* Parents first */
CREATE TABLE IF NOT EXISTS seasons (
  season_id   INT NOT NULL PRIMARY KEY,
  start_year  INT,
  end_year    INT,
  label       VARCHAR(16) UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clubs (
  club_id   INT NOT NULL PRIMARY KEY,
  club_name VARCHAR(255) UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS players (
  player_id  INT NOT NULL PRIMARY KEY,
  fbref_id   VARCHAR(64) UNIQUE,
  full_name  VARCHAR(255),
  birth_date DATE
) ENGINE=InnoDB;

/* Fact table */
CREATE TABLE IF NOT EXISTS player_season_club_stats (
  player_id      INT NOT NULL,
  club_id        INT NOT NULL,
  season_id      INT NOT NULL,
  competition_id INT NOT NULL,
  matches_played INT,
  starts         INT,
  minutes        INT,
  goals          INT,
  assists        INT,
  PRIMARY KEY (player_id, club_id, season_id, competition_id),
  CONSTRAINT fk_pscs_player FOREIGN KEY (player_id) REFERENCES players(player_id),
  CONSTRAINT fk_pscs_club   FOREIGN KEY (club_id)   REFERENCES clubs(club_id),
  CONSTRAINT fk_pscs_season FOREIGN KEY (season_id) REFERENCES seasons(season_id)
) ENGINE=InnoDB;