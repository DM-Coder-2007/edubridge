/**
 * EduBridge Adaptive - Gemini Multimodal AI Integration Module
 *
 * Central export for all Gemini AI capabilities:
 * - Client connection and configuration manager
 * - Prompt engineering templates (optimized for visually impaired accessibility)
 * - Strict schema validation and parsing
 * - Curriculum content generation service
 * - Formative answer evaluation service
 * - Multimodal textbook OCR & tactile spatial description
 */

const client = require('./client');
const prompts = require('./prompts');
const schemas = require('./schemas');
const generationService = require('./generation.service');
const evaluationService = require('./evaluation.service');
const aiMetadataRepository = require('../../repositories/aiMetadataRepository');
const logger = require('../../utils/logger');

/**
 * Multimodal textbook OCR & diagram analysis
 *
 * @param {Buffer} imageBuffer - Scanned textbook page image buffer
 * @param {string} [mimeType='image/jpeg'] - Image MIME type
 * @param {string} [entityId='textbook_ocr'] - Tracking entity ID
 * @returns {Promise<{ extractedText: string, diagramDescriptions: string[], keyTopics: string[], sections?: Array, concepts?: Array, formulas?: Array, examples?: Array }>}
 */
async function extractAndUnderstandTextbook(imageBuffer, mimeType = 'image/jpeg', entityId = 'textbook_ocr') {
  const startTime = Date.now();
  const prompt = prompts.textbookOcr({ title: 'Textbook Page' });

  if (client.isMockMode()) {
    const mockResult = {
      title: 'Chapter 4: Plant Cell Structure and Function',
      documentTitle: 'Chapter 4: Plant Cell Structure and Function',
      contentType: 'TEXTBOOK_PAGE',
      rawText: 'Chapter 4: Cell Structure and Function. Plant cells are eukaryotic cells that differ in several key aspects from the cells of other eukaryotic organisms. Their distinctive features include primary cell walls containing cellulose, hemicelluloses and pectin, plastids such as chloroplasts for photosynthesis, and a large central vacuole.',
      extractedText: 'Chapter 4: Cell Structure and Function. Plant cells are eukaryotic cells that differ in several key aspects from the cells of other eukaryotic organisms. Their distinctive features include primary cell walls containing cellulose, hemicelluloses and pectin, plastids such as chloroplasts for photosynthesis, and a large central vacuole.',
      headings: ['Cell Structure and Function', 'Cell Wall & Rigidity'],
      paragraphs: ['Plant cells are eukaryotic cells that differ in several key aspects...'],
      keyTerms: ['Plant Cell Wall', 'Chloroplasts & Photosynthesis', 'Central Vacuole'],
      confidenceScore: 0.95,
      sections: [
        {
          heading: 'Cell Wall & Rigidity',
          content: 'The cell wall is an outer protective layer surrounding the cell membrane.',
          orderIndex: 1
        }
      ],
      concepts: [
        {
          name: 'Plant Cell Wall',
          description: 'A rigid outer structural boundary composed of cellulose.',
          visualCue: 'Outer perimeter box',
          tactileAnalogy: 'Like a cardboard carton protecting a delicate fruit inside.'
        },
        {
          name: 'Chloroplasts & Photosynthesis',
          description: 'Organelles responsible for harvesting sunlight to manufacture glucose.',
          visualCue: 'Oval green discs along perimeter',
          tactileAnalogy: 'Like miniature solar tiles placed on a rooftop.'
        },
        {
          name: 'Central Vacuole',
          description: 'Large fluid reservoir maintaining cellular turgor pressure.',
          visualCue: 'Large center bubble',
          tactileAnalogy: 'Like a water balloon inside a rigid container.'
        }
      ],
      formulas: [],
      examples: [
        {
          title: 'Turgor Pressure',
          problem: 'Why do celery stalks stay crisp when hydrated?',
          solution: 'Water fills the central vacuoles, pressing against the cell walls.'
        }
      ],
      diagramDescriptions: [
        'Spatial diagram of a Plant Cell: The cell is rectangular with rounded corners. Around the exterior is a thick boundary representing the rigid cell wall. In the interior center lies a large fluid-filled oval representing the central vacuole, pushing the nucleus to the upper-right corner. Oval disc-like chloroplasts are distributed along the perimeter.'
      ],
      keyTopics: ['Plant Cell Wall', 'Chloroplasts & Photosynthesis', 'Central Vacuole']
    };

    await aiMetadataRepository.record({
      entityType: 'TEXTBOOK_OCR',
      entityId,
      modelName: `${client.getModelName()}-mock`,
      promptTokens: 180,
      candidateTokens: 220,
      totalTokens: 400,
      latencyMs: Date.now() - startTime,
      promptPreview: typeof prompt === 'string' ? prompt.substring(0, 500) : '',
      rawResponse: mockResult
    });

    return mockResult;
  }

  try {
    const imagePart = {
      inlineData: {
        data: Buffer.isBuffer(imageBuffer) ? imageBuffer.toString('base64') : String(imageBuffer),
        mimeType
      }
    };

    const response = await client.generateContent([prompt, imagePart], { operation: 'TEXTBOOK_OCR' });
    const parsed = schemas.cleanAndParseJson(response.text);

    // Normalize property aliases for cross-compatibility
    if (parsed.rawText && !parsed.extractedText) parsed.extractedText = parsed.rawText;
    if (parsed.extractedText && !parsed.rawText) parsed.rawText = parsed.extractedText;
    if (parsed.concepts && !parsed.keyTopics) parsed.keyTopics = parsed.concepts.map(c => c.name || c);

    await aiMetadataRepository.record({
      entityType: 'TEXTBOOK_OCR',
      entityId,
      modelName: client.getModelName(),
      promptTokens: response.usage?.promptTokens || 250,
      candidateTokens: response.usage?.candidateTokens || 300,
      totalTokens: response.usage?.totalTokens || 550,
      latencyMs: response.latencyMs || (Date.now() - startTime),
      promptPreview: typeof prompt === 'string' ? prompt.substring(0, 500) : '',
      rawResponse: parsed
    });

    return parsed;
  } catch (err) {
    logger.error('[GeminiMultimodal] OCR extraction failed:', err.message);
    throw new Error(`Gemini OCR failed: ${err.message}`);
  }
}

async function analyzeLessonImage(imageBuffer, mimeType = 'image/jpeg', entityId = 'image_analysis') {
  return extractAndUnderstandTextbook(imageBuffer, mimeType, entityId);
}

/**
 * Generate accessible lesson from extracted textbook content
 */
async function generateLessonFromContent(params) {
  return generationService.generateLessonFromContent(params);
}

async function validateGrounding(params) {
  return generationService.validateGrounding(params);
}

async function generateSpeechScript(params) {
  return generationService.generateSpeechScript(params);
}

/**
 * Generate comprehension questions with voice hints
 */
async function generateQuestions(params) {
  return generationService.generateQuestions(params);
}

/**
 * Alias for generateQuestions matching legacy pipeline call
 */
async function generateQuestionsForLesson({ lessonTitle, subject, concepts, count = 3, targetDifficulty = 'medium', entityId }) {
  return generationService.generateQuestions({
    lessonTitle,
    subject,
    concepts,
    count,
    targetDifficulty,
    entityId
  });
}

/**
 * Evaluate student answer (text or voice transcript)
 */
async function evaluateStudentAnswer(params) {
  return evaluationService.evaluateStudentAnswer(params);
}

/**
 * Alias for evaluateStudentAnswer matching legacy call
 */
async function evaluateAnswer(params) {
  return evaluationService.evaluateStudentAnswer(params);
}

/**
 * Generate simpler explanation for struggling concept
 */
async function generateSimplerExplanation(params) {
  return generationService.generateSimplerExplanation(params);
}

/**
 * Generate tactile/auditory analogies
 */
async function generateAnalogies(params) {
  return generationService.generateAnalogies(params);
}

/**
 * Generate adaptive follow-up question
 */
async function generateFollowupQuestion(params) {
  return generationService.generateFollowupQuestion(params);
}

module.exports = {
  // Modules
  client,
  prompts,
  schemas,
  generationService,
  evaluationService,

  // Direct operations
  extractAndUnderstandTextbook,
  analyzeLessonImage,
  validateGrounding,
  generateSpeechScript,
  generateLessonFromContent,
  generateQuestions,
  generateQuestionsForLesson,
  evaluateStudentAnswer,
  evaluateAnswer,
  generateSimplerExplanation,
  generateAnalogies,
  generateFollowupQuestion,

  // Client utilities
  ping: () => client.ping(),
  isMockMode: () => client.isMockMode(),
  setMockMode: (mock) => client.setMockMode(mock),
  getSafeConfig: () => client.getSafeConfig(),
  getModelName: () => client.getModelName()
};
