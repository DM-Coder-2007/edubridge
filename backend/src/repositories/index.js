/**
 * EduBridge Adaptive - Repositories Central Export
 *
 * Exposes repository abstractions for Snowflake data access.
 * Strict Architecture: Controller -> Service -> Repository -> Snowflake
 */

const userRepository = require('./user.repository');
const lessonRepository = require('./lesson.repository');
const questionRepository = require('./question.repository');
const attemptRepository = require('./attempt.repository');
const masteryRepository = require('./mastery.repository');
const mediaRepository = require('./media.repository');
const audioRepository = require('./audio.repository');

// Also re-export conceptRepository, textbookRepository, progressRepository for backwards compatibility
const conceptRepository = require('./conceptRepository');
const textbookRepository = require('./textbookRepository');
const progressRepository = require('./progressRepository');
const processingStatusRepository = require('./processingStatusRepository');
const aiMetadataRepository = require('./aiMetadataRepository');

module.exports = {
  // Mandated Repository Abstractions
  userRepository,
  lessonRepository,
  questionRepository,
  attemptRepository,
  masteryRepository,
  mediaRepository,
  audioRepository,

  // Additional Data Access Helpers
  conceptRepository,
  textbookRepository,
  progressRepository,
  processingStatusRepository,
  aiMetadataRepository
};
