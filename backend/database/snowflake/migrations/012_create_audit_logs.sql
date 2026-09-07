-- Migration 012: Create AUDIT_LOGS Table
-- Immutable operational audit trail for pipeline stages, AI queries, latency, and user milestones
CREATE TABLE IF NOT EXISTS EDUBRIDGE_ADAPTIVE.APP.AUDIT_LOGS (
    audit_id VARCHAR(64),
    id VARCHAR(64),
    user_id VARCHAR(64) COMMENT 'User or actor triggering event, or NULL for background cron/worker',
    request_id VARCHAR(64) COMMENT 'Trace identifier correlated with HTTP X-Request-Id header',
    entity_type VARCHAR(50) NOT NULL COMMENT 'TEXTBOOK, LESSON, AUDIO, ATTEMPT, USER',
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(100) NOT NULL COMMENT 'e.g., OCR_EXTRACTION, LESSON_GENERATION, TTS_SYNTHESIS, QUIZ_EVALUATION',
    status VARCHAR(50) NOT NULL COMMENT 'STARTED, IN_PROGRESS, SUCCESS, FAILURE',
    metadata VARIANT COMMENT 'Arbitrary execution context, token usage, latency metrics, prompt params',
    details VARIANT COMMENT 'Arbitrary execution context, token usage, latency metrics, prompt params',
    progress_percent NUMBER(5, 2) DEFAULT 0.0,
    execution_time_ms NUMBER(10, 0),
    error_message TEXT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Audit trail and pipeline stage progression events for observability and auditability';
