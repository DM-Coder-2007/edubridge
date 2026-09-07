-- Migration 006: Create CONCEPTS Table
-- Granular educational concepts with concrete tactile and acoustic hints
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.CONCEPTS (
    concept_id VARCHAR(64),
    id VARCHAR(64),
    lesson_id VARCHAR(64) NOT NULL,
    concept_name VARCHAR(255),
    name VARCHAR(255),
    explanation TEXT NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    difficulty_level VARCHAR(50) DEFAULT 'medium',
    order_index NUMBER(5, 0) DEFAULT 0,
    simplified_analogy TEXT COMMENT 'Everyday tactile or audio analogy',
    tactile_description TEXT COMMENT 'Spatial and textural guide for tactile graphics/surfaces',
    audio_cue_hint TEXT COMMENT 'Earcon or sound cue hint (e.g., chime, tap)',
    audio_url VARCHAR(1000) COMMENT 'Cloudinary audio clip explaining this specific concept',
    metadata VARIANT COMMENT 'Curriculum tags, keywords, and tactile graphics notes',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Granular educational concepts dissected from textbook chapters';
