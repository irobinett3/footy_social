-- EPL Matches Table Creation Script
-- This script creates the table structure for storing EPL 2025 match data

-- Drop table if it exists (uncomment if you want to recreate the table)
-- DROP TABLE IF EXISTS epl_matches;

-- Create the epl_matches table
CREATE TABLE IF NOT EXISTS epl_matches (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Auto-incrementing primary key',
    match_number INT NOT NULL COMMENT 'Official match number',
    round_number INT NOT NULL COMMENT 'Round/gameweek number',
    match_date DATETIME NOT NULL COMMENT 'Date and time of the match',
    location VARCHAR(100) NOT NULL COMMENT 'Stadium/venue name',
    home_team VARCHAR(50) NOT NULL COMMENT 'Home team name',
    away_team VARCHAR(50) NOT NULL COMMENT 'Away team name',
    result VARCHAR(20) DEFAULT NULL COMMENT 'Match result/score',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
    
    -- Indexes for better query performance
    INDEX idx_match_number (match_number),
    INDEX idx_round_number (round_number),
    INDEX idx_match_date (match_date),
    INDEX idx_home_team (home_team),
    INDEX idx_away_team (away_team),
    INDEX idx_location (location)
    
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='EPL 2025 season match schedule and results';

-- Display table structure
DESCRIBE epl_matches;

-- Show indexes
SHOW INDEXES FROM epl_matches;

-- Verify table was created
SELECT 
    TABLE_NAME,
    ENGINE,
    TABLE_ROWS,
    CREATE_TIME
FROM 
    information_schema.TABLES
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'epl_matches';

-- Display success message
SELECT 'Table epl_matches created successfully!' AS Status;