-- Migration 010: Create AUDIO_ASSETS Table
-- Tracks synthesized audio narrations, Piper voice models, waveforms, and Cloudinary media pointers
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.AUDIO_ASSETS (
    audio_id VARCHAR(64),
    id VARCHAR(64),
    lesson_id VARCHAR(64),
    user_id VARCHAR(64),
    entity_type VARCHAR(50) DEFAULT 'LESSON' COMMENT 'LESSON, QUESTION, FEEDBACK, CONCEPT',
    entity_id VARCHAR(64),
    cloudinary_public_id VARCHAR(255),
    audio_public_id VARCHAR(255),
    audio_url VARCHAR(1000) NOT NULL COMMENT 'Cloudinary streaming audio URL',
    waveform_url VARCHAR(1000) COMMENT 'Cloudinary waveform visualizer JSON URL',
    duration_seconds NUMBER(10, 2) DEFAULT 0.0,
    voice VARCHAR(100) DEFAULT 'en_US-lessac-medium',
    voice_id VARCHAR(100) DEFAULT 'en_US-lessac-medium',
    format VARCHAR(20) DEFAULT 'mp3',
    audio_format VARCHAR(20) DEFAULT 'mp3',
    file_size_bytes NUMBER(12, 0),
    bitrate_kbps NUMBER(6, 0) DEFAULT 128,
    speech_rate NUMBER(3, 2) DEFAULT 1.00,
    waveform_data VARIANT COMMENT 'Audio waveform peaks array for frontend audio visualizer',
    tts_engine VARCHAR(50) DEFAULT 'PIPER_TTS',
    status VARCHAR(50) DEFAULT 'COMPLETED' COMMENT 'Lifecycle: PENDING, SYNTHESIZING, UPLOADING_CLOUDINARY, COMPLETED, FAILED',
    retry_count NUMBER(3, 0) DEFAULT 0,
    error_message TEXT,
    metadata VARIANT COMMENT 'Piper model configurations, latency stats, and Cloudinary response',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Neural audio recordings, waveform visualization data, and Cloudinary asset references';
