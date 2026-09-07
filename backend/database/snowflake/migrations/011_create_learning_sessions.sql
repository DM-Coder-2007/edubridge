-- Migration 011: Create LEARNING_SESSIONS Table
-- Tracks student interactive listening sessions, playback positions, and resume state
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.LEARNING_SESSIONS (
    session_id VARCHAR(64),
    id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL,
    lesson_id VARCHAR(64) NOT NULL,
    started_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ended_at TIMESTAMP_NTZ,
    questions_attempted NUMBER(5, 0) DEFAULT 0,
    questions_correct NUMBER(5, 0) DEFAULT 0,
    total_time_seconds NUMBER(10, 2) DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS' COMMENT 'IN_PROGRESS, PAUSED, COMPLETED, ABANDONED',
    completion_percentage NUMBER(5, 2) DEFAULT 0.0,
    last_audio_position_seconds NUMBER(10, 2) DEFAULT 0.0,
    last_concept_id VARCHAR(64) COMMENT 'Exact concept bookmark for resumed playback',
    total_play_time_seconds NUMBER(10, 2) DEFAULT 0.0,
    playback_rate NUMBER(3, 2) DEFAULT 1.00,
    interaction_history VARIANT COMMENT 'Log of pause, rewind, repeat, speed adjustment actions',
    notes TEXT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Active and historical student listening sessions with audio resume bookmarks';
