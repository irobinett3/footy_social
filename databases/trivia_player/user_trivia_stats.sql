-- user_trivia_stats.sql
CREATE TABLE player_trivia_results (
    player_id INT NOT NULL,
    trivia_id DATE NOT NULL,
    answer VARCHAR(255),
    score INT,
    PRIMARY KEY (player_id, trivia_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (trivia_id) REFERENCES trivia(id)
);