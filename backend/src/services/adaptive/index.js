/**
 * EduBridge Adaptive - Adaptive Learning Engine
 *
 * Exposes core adaptive services:
 * - masteryService: Cognitive mastery calculation & Snowflake persistence
 * - difficultyService: Multi-factor difficulty progression
 * - reinforcementService: Sensory reinforcement and pedagogical scaffolding
 * - recommendationService: Master adaptive attempt processor and next-step orchestrator
 * - feedbackService: Audio-first sensory feedback and screen reader formatter
 * - nextQuestionService: Dynamic question selector and Gemini question generator
 */

const masteryService = require('./mastery.service');
const difficultyService = require('./difficulty.service');
const reinforcementService = require('./reinforcement.service');
const recommendationService = require('./recommendation.service');
const feedbackService = require('./feedback.service');
const nextQuestionService = require('./nextQuestion.service');

module.exports = {
  masteryService,
  difficultyService,
  reinforcementService,
  recommendationService,
  feedbackService,
  nextQuestionService
};
