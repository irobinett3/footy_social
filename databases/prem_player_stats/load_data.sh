mysql --local-infile=1 -u irobinet -p irobinet -e "SET FOREIGN_KEY_CHECKS=0;

LOAD DATA LOCAL INFILE '/var/www/html/cse30246/footysocial/databases/prem_player_stats/seasons.csv'
INTO TABLE seasons
FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
IGNORE 1 ROWS
(season_id, start_year, end_year, label);

LOAD DATA LOCAL INFILE '/var/www/html/cse30246/footysocial/databases/prem_player_stats/clubs.csv'
INTO TABLE clubs
FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
IGNORE 1 ROWS
(club_id, club_name);

LOAD DATA LOCAL INFILE '/var/www/html/cse30246/footysocial/databases/prem_player_stats/players.csv'
INTO TABLE players
FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
IGNORE 1 ROWS
(player_id, fbref_id, full_name, @birth)
SET birth_date = NULLIF(@birth,'');

LOAD DATA LOCAL INFILE '/var/www/html/cse30246/footysocial/databases/prem_player_stats/player_season_club_stats.csv'
INTO TABLE player_season_club_stats
FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
IGNORE 1 ROWS
(player_id, club_id, season_id, competition_id, @mp, @st, @min, @g, @a)
SET matches_played = NULLIF(@mp,''),
    starts         = NULLIF(@st,''),
    minutes        = NULLIF(@min,''),
    goals          = NULLIF(@g,''),
    assists        = NULLIF(@a,'');

SET FOREIGN_KEY_CHECKS=1;"