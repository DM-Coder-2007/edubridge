-- Migration 009: Create CONCEPT_MASTERY Table
-- Tracks student mastery progression on individual concepts over time with spaced repetition parameters
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.CONCEPT_MASTERY (
    user_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64) NOT NULL,
    id VARCHAR(64),
    attempts NUMBER(5, 0) DEFAULT 0,
    attempts_count NUMBER(5, 0) DEFAULT 0,
    correct_attempts NUMBER(5, 0) DEFAULT 0,
    correct_count NUMBER(5, 0) DEFAULT 0,
    mastery_score NUMBER(5, 2) DEFAULT 0.0,
    last_updated TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    consecutive_correct NUMBER(5, 0) DEFAULT 0,
    mastery_level VARCHAR(50) DEFAULT 'NOVICE' COMMENT 'NOVICE, DEVELOPING, PROFICIENT, MASTERED',
    decay_rate NUMBER(5, 4) DEFAULT 0.0500 COMMENT 'Spaced repetition forgetting curve decay rate',
    last_practiced_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    mastery_history VARIANT COMMENT 'Chronological score progression and delta history',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (user_id, concept_id)
)
COMMENT = 'Per-student mastery tracking across individual curriculum concepts with spaced repetition models';
