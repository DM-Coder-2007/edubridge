-- ==============================================================================
-- EduBridge Adaptive - Snowflake Database Initial Schema
-- Source of Truth for all Educational, AI, Audio, and Progress entities
-- ==============================================================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS USERS (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    grade_level VARCHAR(50),
    preferred_language VARCHAR(20) DEFAULT 'en',
    accessibility_preferences VARIANT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 2. TEXTBOOKS
CREATE TABLE IF NOT EXISTS TEXTBOOKS (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(500) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50),
    chapter_title VARCHAR(255),
    raw_image_url VARCHAR(1000) NOT NULL,
    raw_image_public_id VARCHAR(255) NOT NULL,
    processed_image_url VARCHAR(1000),
    processed_image_public_id VARCHAR(255),
    processing_status VARCHAR(50) DEFAULT 'UPLOADED',
    metadata VARIANT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 3. PROCESSING_STATUS
CREATE TABLE IF NOT EXISTS PROCESSING_STATUS (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    stage VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    progress_percent NUMBER(5, 2) DEFAULT 0.0,
    error_message TEXT,
    metadata VARIANT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 4. LESSONS
CREATE TABLE IF NOT EXISTS LESSONS (
    id VARCHAR(64) PRIMARY KEY,
    textbook_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT NOT NULL,
    simplified_text TEXT NOT NULL,
    screen_reader_transcript TEXT NOT NULL,
    audio_url VARCHAR(1000),
    audio_public_id VARCHAR(255),
    audio_duration_seconds NUMBER(10, 2) DEFAULT 0,
    waveform_url VARCHAR(1000),
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 5. CONCEPTS
CREATE TABLE IF NOT EXISTS CONCEPTS (
    id VARCHAR(64) PRIMARY KEY,
    lesson_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    simplified_analogy TEXT,
    audio_cue_hint TEXT,
    difficulty_level VARCHAR(50) DEFAULT 'medium',
    order_index NUMBER(5, 0) DEFAULT 0,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 6. QUESTIONS
CREATE TABLE IF NOT EXISTS QUESTIONS (
    id VARCHAR(64) PRIMARY KEY,
    lesson_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'MULTIPLE_CHOICE',
    options VARIANT,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    audio_prompt_hint TEXT,
    difficulty_level VARCHAR(50) DEFAULT 'medium',
    order_index NUMBER(5, 0) DEFAULT 0,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 7. ANSWERS
CREATE TABLE IF NOT EXISTS ANSWERS (
    id VARCHAR(64) PRIMARY KEY,
    attempt_id VARCHAR(64) NOT NULL,
    question_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    user_answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    ai_score NUMBER(5, 2) DEFAULT 0.0,
    ai_feedback TEXT,
    adaptive_followup_question TEXT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 8. ATTEMPTS
CREATE TABLE IF NOT EXISTS ATTEMPTS (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    lesson_id VARCHAR(64) NOT NULL,
    total_questions NUMBER(5, 0) DEFAULT 0,
    correct_questions NUMBER(5, 0) DEFAULT 0,
    score_percentage NUMBER(5, 2) DEFAULT 0.0,
    time_spent_seconds NUMBER(10, 0) DEFAULT 0,
    started_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    completed_at TIMESTAMP_NTZ
);

-- 9. MASTERY
CREATE TABLE IF NOT EXISTS MASTERY (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64) NOT NULL,
    mastery_score NUMBER(5, 2) DEFAULT 0.0,
    attempts_count NUMBER(5, 0) DEFAULT 0,
    successful_attempts NUMBER(5, 0) DEFAULT 0,
    last_practiced_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    status VARCHAR(50) DEFAULT 'LEARNING',
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 10. PROGRESS
CREATE TABLE IF NOT EXISTS PROGRESS (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    lesson_id VARCHAR(64) NOT NULL,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    completion_percentage NUMBER(5, 2) DEFAULT 0.0,
    last_audio_position_seconds NUMBER(10, 2) DEFAULT 0.0,
    last_accessed_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    notes TEXT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 11. AI_GENERATION_METADATA
CREATE TABLE IF NOT EXISTS AI_GENERATION_METADATA (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens NUMBER(10, 0) DEFAULT 0,
    candidate_tokens NUMBER(10, 0) DEFAULT 0,
    total_tokens NUMBER(10, 0) DEFAULT 0,
    latency_ms NUMBER(10, 0) DEFAULT 0,
    prompt_preview TEXT,
    raw_response TEXT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
