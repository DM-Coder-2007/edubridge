-- Migration 004: Create TEXTBOOK_ASSETS Table
-- Tracks raw and processed textbook scans, Cloudinary media pointers, OCR text, and async pipeline status
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.TEXTBOOK_ASSETS (
    image_id VARCHAR(64),
    id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(500),
    subject VARCHAR(100),
    grade_level VARCHAR(50),
    chapter_title VARCHAR(255),
    original_url VARCHAR(1000),
    raw_image_url VARCHAR(1000),
    raw_image_public_id VARCHAR(255),
    processed_url VARCHAR(1000),
    processed_image_url VARCHAR(1000),
    processed_image_public_id VARCHAR(255),
    cloudinary_public_id VARCHAR(255),
    accessible_image_url VARCHAR(1000) COMMENT 'Cloudinary high-contrast / tactile edge-enhanced image for partial vision',
    accessible_image_public_id VARCHAR(255),
    asset_type VARCHAR(50) DEFAULT 'IMAGE',
    processing_status VARCHAR(50) DEFAULT 'PENDING' COMMENT 'Lifecycle: PENDING, PREPROCESSING, OCR_PROCESSING, GEMINI_ANALYSIS, GENERATING_LESSONS, COMPLETED, FAILED',
    retry_count NUMBER(3, 0) DEFAULT 0,
    error_message TEXT,
    processing_started_at TIMESTAMP_NTZ,
    processing_completed_at TIMESTAMP_NTZ,
    ocr_extracted_text TEXT,
    diagram_descriptions VARIANT COMMENT 'Extracted tactile and spatial audio descriptions of figures/diagrams',
    metadata VARIANT COMMENT 'Preprocessing transformations, dimensions, and image quality metrics',
    ai_metadata VARIANT COMMENT 'Gemini multimodal OCR token usage, confidence scores, and model metadata',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Textbook visual assets, OCR text representations, Cloudinary media mappings, and asynchronous AI processing state';
