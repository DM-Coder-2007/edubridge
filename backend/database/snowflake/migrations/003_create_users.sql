-- Migration 003: Create USERS Table
-- Stores student, educator, and administrator accounts with accessibility preferences
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.USERS (
    user_id VARCHAR(64),
    id VARCHAR(64),
    name VARCHAR(255),
    full_name VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    grade_level VARCHAR(50),
    preferred_language VARCHAR(50) DEFAULT 'en',
    accessibility_preferences VARIANT COMMENT 'Auditory, tactile, visual preferences in JSON format',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Platform user profiles and personalized accessibility configurations';
