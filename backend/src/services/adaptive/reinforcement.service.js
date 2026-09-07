/**
 * EduBridge Adaptive - Reinforcement Service
 *
 * Evaluates whether a student requires conceptual reinforcement or expansion:
 * - Weak concepts trigger:
 *   1. Simpler explanations
 *   2. Tactile / acoustic sensory analogies
 *   3. Easier foundational questions
 *   4. Step-by-step cognitive scaffolding
 * - Strong concepts trigger:
 *   1. Application problems
 *   2. Advanced transfer explanations
 *   3. Harder challenge questions
 */

const generationService = require('../../integrations/gemini/generation.service');
const logger = require('../../utils/logger');

const REINFORCEMENT_TYPES = {
  SIMPLER_EXPLANATION: 'SIMPLER_EXPLANATION',
  SENSORY_ANALOGY: 'SENSORY_ANALOGY',
  STEP_BY_STEP_BREAKDOWN: 'STEP_BY_STEP_BREAKDOWN',
  FLUENCY_PRACTICE: 'FLUENCY_PRACTICE',
  APPLICATION_CHALLENGE: 'APPLICATION_CHALLENGE',
  NONE: 'NONE'
};

const URGENCY_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  NONE: 'NONE'
};

class ReinforcementService {
  /**
   * Determine if student requires reinforcement and what pedagogical strategy to apply
   *
   * @param {object} params
   * @param {boolean} params.isCorrect - Current answer correctness
   * @param {number} [params.masteryScore=50] - Concept mastery score (0-100)
   * @param {number} [params.recentAccuracy=1] - Recent sliding window accuracy (0-1)
   * @param {number} [params.historicalAccuracy=1] - All attempts accuracy (0-1)
   * @param {number} [params.consecutiveIncorrect=0] - Trailing incorrect streak
   * @param {number} [params.consecutiveCorrect=0] - Trailing correct streak
   * @param {number} [params.timeTaken=0] - Time taken in seconds
   * @param {string} [params.difficulty='medium'] - Question difficulty
   * @returns {object} Reinforcement assessment
   */
  evaluateReinforcementRequirement({
    isCorrect,
    masteryScore = 50,
    recentAccuracy = null,
    historicalAccuracy = null,
    consecutiveIncorrect = 0,
    consecutiveCorrect = 0,
    timeTaken = null,
    difficulty = 'medium'
  }) {
    const isBoolCorrect = Boolean(isCorrect);
    const score = Number(masteryScore);

    // 1. Critical Weak Concept: High Urgency
    if (!isBoolCorrect && (consecutiveIncorrect >= 2 || score < 40 || (recentAccuracy !== null && recentAccuracy < 0.35))) {
      return {
        requiresReinforcement: true,
        urgency: URGENCY_LEVELS.HIGH,
        reinforcementType: REINFORCEMENT_TYPES.SIMPLER_EXPLANATION,
        pedagogy: 'Critical misconception or recurring failure; deliver simplified conceptual model and everyday physical analogy.',
        suggestedNextStep: 'EASIER_QUESTION'
      };
    }

    // 2. Emerging Struggle / Moderate Weakness: Medium Urgency
    if (!isBoolCorrect || score < 60 || (recentAccuracy !== null && recentAccuracy < 0.60)) {
      return {
        requiresReinforcement: true,
        urgency: URGENCY_LEVELS.MEDIUM,
        reinforcementType: REINFORCEMENT_TYPES.SENSORY_ANALOGY,
        pedagogy: 'Developing understanding with gaps; ground the concept in sensory auditory and tactile analogies.',
        suggestedNextStep: 'FOUNDATIONAL_PRACTICE'
      };
    }

    // 3. Fluency Hesitation: Correct but took very long
    if (isBoolCorrect && typeof timeTaken === 'number' && timeTaken > 65) {
      return {
        requiresReinforcement: true,
        urgency: URGENCY_LEVELS.LOW,
        reinforcementType: REINFORCEMENT_TYPES.FLUENCY_PRACTICE,
        pedagogy: 'Conceptual grasp is correct, but processing latency indicates hesitation; practice similar difficulty for speed.',
        suggestedNextStep: 'FLUENCY_REINFORCEMENT'
      };
    }

    // 4. Strong Concept: Challenge / Application Opportunity
    if (isBoolCorrect && score >= 85 && consecutiveCorrect >= 2 && (recentAccuracy === null || recentAccuracy >= 0.80)) {
      return {
        requiresReinforcement: false,
        urgency: URGENCY_LEVELS.NONE,
        reinforcementType: REINFORCEMENT_TYPES.APPLICATION_CHALLENGE,
        pedagogy: 'Mastery established; advance to complex real-world application problems and advanced cross-concept synthesis.',
        suggestedNextStep: 'HARDER_QUESTION'
      };
    }

    // 5. Standard Progression
    return {
      requiresReinforcement: false,
      urgency: URGENCY_LEVELS.NONE,
      reinforcementType: REINFORCEMENT_TYPES.NONE,
      pedagogy: 'Student progressing stably within the expected mastery zone.',
      suggestedNextStep: 'CONTINUE_CURRENT_DIFFICULTY'
    };
  }

  /**
   * Generate scaffolded pedagogical reinforcement materials
   *
   * @param {object} params
   * @param {object} params.concept - Concept object { name, explanation, simplifiedAnalogy }
   * @param {string} [params.studentMisconception] - Student's typed or spoken incorrect response
   * @param {string} [params.reinforcementType] - Target reinforcement type
   * @param {boolean} [params.invokeAi=true] - Whether to invoke Gemini generation
   * @returns {Promise<object>}
   */
  async buildReinforcementContent({
    concept,
    studentMisconception = '',
    reinforcementType = REINFORCEMENT_TYPES.SIMPLER_EXPLANATION,
    invokeAi = true
  }) {
    const conceptName = concept?.name || 'Core Curriculum Concept';
    const baseExplanation = concept?.explanation || 'Core conceptual foundation';
    const fallbackAnalogy = concept?.simplifiedAnalogy || 'Think of this concept like a protective outer shell.';

    if (reinforcementType === REINFORCEMENT_TYPES.NONE) {
      return null;
    }

    // If AI generation is requested and concept is weak
    if (invokeAi && (reinforcementType === REINFORCEMENT_TYPES.SIMPLER_EXPLANATION || reinforcementType === REINFORCEMENT_TYPES.SENSORY_ANALOGY)) {
      try {
        const aiSimpler = await generationService.generateSimplerExplanation({
          conceptName,
          currentExplanation: baseExplanation,
          studentMisconception: studentMisconception || 'Unclear student answer'
        });

        return {
          conceptName,
          simplerExplanation: aiSimpler.simplifiedExplanation,
          tactileAnalogy: aiSimpler.tactileAnalogy || fallbackAnalogy,
          auditoryAnalogy: aiSimpler.auditoryAnalogy || 'Like a clear musical chime maintaining rhythm.',
          stepByStepBreakdown: aiSimpler.stepByStepBreakdown || [
            'Notice the core principle.',
            'Connect it to an everyday physical sensation.',
            'Apply it to solve the problem.'
          ],
          action: 'Present sensory analogy before offering the next question.'
        };
      } catch (err) {
        logger.warn(`[ReinforcementService] AI scaffolding fallback: ${err.message}`);
      }
    }

    // High-quality deterministic fallback content
    return {
      conceptName,
      simplerExplanation: `Here is a simpler way to understand ${conceptName}: ${baseExplanation}`,
      tactileAnalogy: fallbackAnalogy,
      auditoryAnalogy: 'Like a distinct acoustic chime that sounds whenever harmony is achieved.',
      stepByStepBreakdown: [
        `Understand the main rule behind ${conceptName}.`,
        'Imagine the tactile feel of its everyday physical anchor.',
        'Use that image to answer the question.'
      ],
      action: 'Present sensory analogy before offering the next question.'
    };
  }
}

const reinforcementService = new ReinforcementService();
module.exports = reinforcementService;
