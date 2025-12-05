-- user_trivia_stats.sql
CREATE TABLE user_prediction_results (
    player_id INT NOT NULL,
    game_id INT NOT NULL,
    prediction INT,
    correct INT,
    PRIMARY KEY (player_id, trivia_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    FOREIGN KEY (trivia_id) REFERENCES trivia(id)
);