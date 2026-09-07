-- Migration 007: Create QUESTIONS Table
-- Formative assessment questions with speech prompt hints and adaptive grading rubrics
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.QUESTIONS (
    question_id VARCHAR(64),
    id VARCHAR(64),
    lesson_id VARCHAR(64) NOT NULL,
    concept_id VARCHAR(64),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'MULTIPLE_CHOICE' COMMENT 'MULTIPLE_CHOICE, OPEN_ENDED_VOICE, TRUE_FALSE, AUDIO_IDENTIFICATION',
    options VARIANT COMMENT 'Array of answer choices for multiple choice questions',
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    difficulty_level VARCHAR(50) DEFAULT 'medium',
    audio_prompt_hint TEXT COMMENT 'Audio-friendly speech prompt for screen reader or voice input',
    audio_prompt_url VARCHAR(1000) COMMENT 'Cloudinary URL for synthesized spoken question',
    adaptive_rubric VARIANT COMMENT 'Rubric criteria for Gemini to evaluate voice/open-ended answers',
    order_index NUMBER(5, 0) DEFAULT 0,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Comprehension questions designed for voice and screen reader accessibility';
