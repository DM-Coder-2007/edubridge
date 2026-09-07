-- Migration 008: Create ATTEMPTS Table
-- Student assessment attempts, voice answers, faster-whisper transcripts, and Gemini feedback
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS (
    attempt_id VARCHAR(64),
    id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL,
    lesson_id VARCHAR(64) NOT NULL,
    question_id VARCHAR(64),
    answer TEXT,
    is_correct BOOLEAN,
    time_taken_seconds NUMBER(10, 0) DEFAULT 0,
    total_questions NUMBER(5, 0) DEFAULT 0,
    correct_questions NUMBER(5, 0) DEFAULT 0,
    score_percentage NUMBER(5, 2) DEFAULT 0.0,
    time_spent_seconds NUMBER(10, 0) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS' COMMENT 'Lifecycle: IN_PROGRESS, EVALUATING, COMPLETED, ABANDONED, FAILED',
    error_message TEXT,
    feedback_audio_url VARCHAR(1000) COMMENT 'Cloudinary audio URL for spoken adaptive feedback',
    answers_summary VARIANT COMMENT 'Summary of student voice and text answers, transcripts, and AI evaluation',
    ai_evaluation_metadata VARIANT COMMENT 'Gemini evaluation model metadata, token count, and latency',
    started_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    completed_at TIMESTAMP_NTZ,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Quiz and practice attempts tracking student comprehension, speech transcripts, and adaptive feedback';
