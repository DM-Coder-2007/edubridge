/**
 * EduBridge Adaptive - Audio-First Adaptive Feedback Service
 *
 * Formulates multi-tiered, sensory feedback for visually impaired learners:
 * 1. Celebratory audio cues and conceptual reinforcement for correct answers
 * 2. Gentle error pinpointing, tactile analogies, and scaffolded re-explanations for mistakes
 * 3. Dynamic integration with Gemini simpler explanation generator
 * 4. Screen-reader and Piper TTS formatted speech scripts
 */

const generationService = require('../../integrations/gemini/generation.service');
const logger = require('../../utils/logger');

class FeedbackService {
  /**
   * Build complete adaptive feedback for a student's answer attempt
   *
   * @param {object} params
   * @param {object} params.evaluation - AI evaluation output { isCorrect, score, feedback, weakConcepts, followupQuestion }
   * @param {object} params.question - Question record { questionText, explanation, correctAnswer }
   * @param {string} params.studentAnswer - Raw student response
   * @param {object} [params.concept] - Optional concept details { name, explanation, simplifiedAnalogy }
   * @param {boolean} [params.generateDeepScaffold=true] - Whether to invoke Gemini simpler explanation on incorrect
   * @returns {Promise<object>} Complete sensory adaptive feedback package
   */
  async buildAdaptiveFeedback({
    evaluation,
    question,
    studentAnswer,
    concept = null,
    generateDeepScaffold = true
  }) {
    const isCorrect = Boolean(evaluation?.isCorrect);
    const score = evaluation?.score || (isCorrect ? 100 : 0);
    const rawAiFeedback = evaluation?.feedback || '';
    const conceptName = concept?.name || (evaluation?.weakConcepts?.[0] || 'Core Concept');

    logger.info(`[FeedbackService] Generating feedback: isCorrect=${isCorrect}, concept=${conceptName}`);

    // Tier 1: Audio Cue Tagging
    const audioCue = isCorrect
      ? (score >= 90 ? '[Audio Cue: bright chime]' : '[Audio Cue: pleasant confirmation]')
      : '[Audio Cue: gentle low bell]';

    // Tier 2: Positive Reinforcement or Scaffolded Remediation
    let scaffoldedContent = null;
    let sensoryAnalogy = concept?.simplifiedAnalogy || null;

    if (!isCorrect && generateDeepScaffold) {
      try {
        const simpler = await generationService.generateSimplerExplanation({
          conceptName,
          currentExplanation: question?.explanation || concept?.explanation || 'Core curriculum rule',
          studentMisconception: studentAnswer
        });

        scaffoldedContent = {
          simplifiedExplanation: simpler.simplifiedExplanation,
          auditoryAnalogy: simpler.auditoryAnalogy,
          tactileAnalogy: simpler.tactileAnalogy,
          stepByStepBreakdown: simpler.stepByStepBreakdown || []
        };

        sensoryAnalogy = simpler.tactileAnalogy || simpler.auditoryAnalogy || sensoryAnalogy;
      } catch (err) {
        logger.warn(`[FeedbackService] Deep scaffolding fallback to standard explanation: ${err.message}`);
      }
    }

    // Tier 3: Construct Voice Narration Script (Audio-First)
    let spokenFeedback = '';
    if (isCorrect) {
      spokenFeedback = `${audioCue} ${rawAiFeedback || 'Great job! You answered correctly.'}`;
      if (question?.explanation) {
        spokenFeedback += ` Remember: ${question.explanation}`;
      }
    } else {
      spokenFeedback = `${audioCue} ${rawAiFeedback || "That was a good attempt, but let's review together."}`;
      if (scaffoldedContent?.simplifiedExplanation) {
        spokenFeedback += ` Here is a simpler way to think about it: ${scaffoldedContent.simplifiedExplanation}`;
      }
      if (sensoryAnalogy) {
        spokenFeedback += ` Picture this: ${sensoryAnalogy}`;
      }
      if (scaffoldedContent?.stepByStepBreakdown?.length) {
        spokenFeedback += ` First, ${scaffoldedContent.stepByStepBreakdown[0]}.`;
      }
    }

    // Tier 4: Screen Reader Transcript with spatial/sensory anchors
    const screenReaderText = this.formatForScreenReader({
      audioCue,
      isCorrect,
      feedback: rawAiFeedback,
      correctAnswer: question?.correctAnswer,
      sensoryAnalogy,
      scaffoldedContent
    });

    return {
      isCorrect,
      score,
      audioCue,
      spokenFeedback: spokenFeedback.trim(),
      screenReaderTranscript: screenReaderText.trim(),
      sensoryAnalogy,
      scaffoldedBreakdown: scaffoldedContent,
      followupQuestion: evaluation?.followupQuestion || null
    };
  }

  /**
   * Format structured output specifically for screen reader users
   */
  formatForScreenReader({ audioCue, isCorrect, feedback, correctAnswer, sensoryAnalogy, scaffoldedContent }) {
    const lines = [];
    lines.push(`${audioCue} Assessment Result: ${isCorrect ? 'Correct' : 'Needs Review'}.`);
    if (feedback) lines.push(feedback);

    if (!isCorrect && correctAnswer) {
      lines.push(`Target Answer: ${correctAnswer}.`);
    }

    if (sensoryAnalogy) {
      lines.push(`Tactile / Audio Analogy: ${sensoryAnalogy}`);
    }

    if (scaffoldedContent?.stepByStepBreakdown?.length) {
      lines.push('Step-by-step breakdown:');
      scaffoldedContent.stepByStepBreakdown.forEach((step, idx) => {
        lines.push(`  ${idx + 1}. ${step}`);
      });
    }

    return lines.join('\n');
  }
}

const feedbackService = new FeedbackService();
module.exports = feedbackService;
