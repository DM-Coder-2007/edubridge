/**
 * EduBridge Adaptive - Gemini Response Schemas & Strict Validation
 *
 * CRITICAL ARCHITECTURE RULE:
 * Never blindly trust model JSON.
 * Enforces strict validation of required fields, question types,
 * difficulty values, answer formats, and concept references.
 */

const VALID_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'OPEN_ENDED_VOICE',
  'TRUE_FALSE',
  'AUDIO_IDENTIFICATION'
];

const VALID_DIFFICULTY_LEVELS = [
  'easy',
  'medium',
  'hard',
  'beginner',
  'intermediate',
  'advanced'
];

/**
 * Robust JSON extractor from raw model text, stripping markdown code blocks
 *
 * @param {string} rawText
 * @returns {any} Parsed JSON data
 * @throws {Error} If text cannot be parsed as valid JSON
 */
function cleanAndParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Malformed AI response: Response text is empty or not a string.');
  }

  const trimmed = rawText.trim();

  // 1. Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const targetText = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  // 2. Locate outermost JSON object or array
  const jsonMatch = targetText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  const textToParse = jsonMatch ? jsonMatch[0] : targetText;

  try {
    return JSON.parse(textToParse);
  } catch (err) {
    throw new Error(`Malformed AI JSON: Failed to parse model output (${err.message}). Raw snippet: "${textToParse.slice(0, 150)}..."`);
  }
}

/**
 * Validate Lesson Generation Output
 */
function validateLessonResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Schema validation failed: Lesson response must be a JSON object.');
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw new Error('Schema validation failed: Lesson "title" is required and must be a non-empty string.');
  }

  if (!data.summary || typeof data.summary !== 'string' || data.summary.trim().length === 0) {
    throw new Error('Schema validation failed: Lesson "summary" is required and must be a non-empty string.');
  }

  if (!data.simplifiedText || typeof data.simplifiedText !== 'string' || data.simplifiedText.trim().length === 0) {
    throw new Error('Schema validation failed: Lesson "simplifiedText" is required for audio narration.');
  }

  if (!data.screenReaderTranscript || typeof data.screenReaderTranscript !== 'string') {
    data.screenReaderTranscript = data.simplifiedText; // safe fallback
  }

  if (!Array.isArray(data.concepts) || data.concepts.length === 0) {
    throw new Error('Schema validation failed: Lesson must contain an array of at least 1 "concepts" item.');
  }

  for (let i = 0; i < data.concepts.length; i++) {
    const c = data.concepts[i];
    if (!c.name || typeof c.name !== 'string') {
      throw new Error(`Schema validation failed: Concept at index ${i} is missing required "name".`);
    }
    if (!c.description && !c.explanation) {
      throw new Error(`Schema validation failed: Concept "${c.name}" is missing required "description".`);
    }
  }

  return true;
}

/**
 * Validate Generated Questions
 */
function validateQuestionsResponse(data) {
  const questions = Array.isArray(data) ? data : data?.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Schema validation failed: Output must contain a non-empty array of questions.');
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // 1. Validate questionText
    if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
      throw new Error(`Schema validation failed: Question at index ${i} is missing "questionText".`);
    }

    // 2. Validate questionType
    const normalizedType = String(q.questionType || 'MULTIPLE_CHOICE').toUpperCase().replace(/\s+/g, '_');
    if (!VALID_QUESTION_TYPES.includes(normalizedType)) {
      throw new Error(
        `Schema validation failed: Question #${i + 1} has invalid questionType "${q.questionType}". Allowed: ${VALID_QUESTION_TYPES.join(', ')}`
      );
    }
    q.questionType = normalizedType;

    // 3. Validate options for multiple choice
    if (q.questionType === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(
          `Schema validation failed: Multiple choice question #${i + 1} must include an "options" array with at least 2 choices.`
        );
      }
    }

    // 4. Validate correctAnswer
    if (q.correctAnswer === undefined || q.correctAnswer === null || String(q.correctAnswer).trim().length === 0) {
      throw new Error(`Schema validation failed: Question #${i + 1} is missing "correctAnswer".`);
    }

    // 5. Validate explanation
    if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length === 0) {
      throw new Error(`Schema validation failed: Question #${i + 1} is missing "explanation".`);
    }

    // 6. Validate difficultyLevel
    if (q.difficultyLevel) {
      const diffLower = String(q.difficultyLevel).toLowerCase().trim();
      if (!VALID_DIFFICULTY_LEVELS.includes(diffLower)) {
        throw new Error(
          `Schema validation failed: Question #${i + 1} has invalid difficultyLevel "${q.difficultyLevel}". Allowed: ${VALID_DIFFICULTY_LEVELS.join(', ')}`
        );
      }
      q.difficultyLevel = diffLower;
    } else {
      q.difficultyLevel = 'medium';
    }
  }

  return true;
}

/**
 * Validate Student Answer Evaluation Output
 */
function validateEvaluationResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Schema validation failed: Answer evaluation response must be a JSON object.');
  }

  if (typeof data.isCorrect !== 'boolean') {
    throw new Error('Schema validation failed: Evaluation must contain boolean "isCorrect".');
  }

  if (typeof data.score !== 'number' || data.score < 0 || data.score > 100) {
    throw new Error('Schema validation failed: Evaluation "score" must be a number between 0 and 100.');
  }

  if (!data.feedback || typeof data.feedback !== 'string' || data.feedback.trim().length === 0) {
    throw new Error('Schema validation failed: Evaluation must include non-empty "feedback" text.');
  }

  if (data.recommendedNextDifficulty) {
    const diffLower = String(data.recommendedNextDifficulty).toLowerCase().trim();
    if (!VALID_DIFFICULTY_LEVELS.includes(diffLower)) {
      data.recommendedNextDifficulty = data.isCorrect ? 'medium' : 'easy';
    } else {
      data.recommendedNextDifficulty = diffLower;
    }
  } else {
    data.recommendedNextDifficulty = data.isCorrect ? 'medium' : 'easy';
  }

  if (!Array.isArray(data.weakConcepts)) {
    data.weakConcepts = [];
  }

  return true;
}

/**
 * Validate Simpler Explanation Output
 */
function validateSimplerExplanationResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Schema validation failed: Simpler explanation response must be a JSON object.');
  }

  if (!data.conceptName || typeof data.conceptName !== 'string') {
    throw new Error('Schema validation failed: Simpler explanation is missing "conceptName".');
  }

  if (!data.simplifiedExplanation || typeof data.simplifiedExplanation !== 'string') {
    throw new Error('Schema validation failed: Simpler explanation is missing "simplifiedExplanation".');
  }

  return true;
}

module.exports = {
  VALID_QUESTION_TYPES,
  VALID_DIFFICULTY_LEVELS,
  cleanAndParseJson,
  validateLessonResponse,
  validateQuestionsResponse,
  validateEvaluationResponse,
  validateSimplerExplanationResponse
};
