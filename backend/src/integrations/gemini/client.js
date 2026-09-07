/**
 * EduBridge Adaptive - Google Gemini Client Manager
 *
 * CRITICAL ARCHITECTURE RULE:
 * Secure Gemini client providing resilient API calling, latency measurement,
 * and zero API key leakage. Never exposes GEMINI_API_KEY in logs or objects.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../utils/logger');

class GeminiClient {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    const forceMock = process.env.GEMINI_MOCK_FALLBACK === 'true';
    const hasKey = Boolean(this.apiKey && this.apiKey.trim() && !this.apiKey.includes('placeholder'));

    this._isMock = forceMock || !hasKey;
    this._mockResponseQueue = [];
    this._customMockHandler = null;

    this._initSDK();
  }

  _initSDK() {
    if (!this._isMock) {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        logger.info(`[GeminiClient] Live Google Gemini SDK initialized with model: "${this.modelName}"`);
      } catch (err) {
        logger.error('[GeminiClient] Failed to initialize live Gemini SDK:', err.message);
        this._isMock = true;
      }
    } else {
      logger.info('[GeminiClient] Initialized in MOCK/SIMULATION mode. Gemini is the primary multimodal AI engine.');
    }
  }

  /**
   * Return safe configuration sanitized of all credentials
   */
  getSafeConfig() {
    const rawKey = this.apiKey || 'mock_api_key';
    return {
      model: this.modelName,
      apiKey: `${rawKey.slice(0, 4)}****`,
      mode: this._isMock ? 'MOCK_EMULATION' : 'LIVE_GEMINI',
      temperature: 0.2
    };
  }

  isMockMode() {
    return this._isMock;
  }

  setMockMode(mock) {
    this._isMock = Boolean(mock);
  }

  getModelName() {
    return this.modelName;
  }

  /**
   * Inject a mock response for deterministic testing (e.g. malformed JSON or errors)
   */
  enqueueMockResponse(responseOrError) {
    this._mockResponseQueue.push(responseOrError);
  }

  setCustomMockHandler(handler) {
    this._customMockHandler = handler;
  }

  clearMockOverrides() {
    this._mockResponseQueue = [];
    this._customMockHandler = null;
  }

  /**
   * Execute content generation with Gemini model safely
   *
   * @param {string|Array} prompt - Prompt string or parts array
   * @param {object} [options={}] - Options { timeoutMs, operation }
   * @returns {Promise<{ text: string, latencyMs: number, usage: object }>}
   */
  async generateContent(prompt, options = {}) {
    const startTime = Date.now();
    const operation = options.operation || 'GEMINI_GENERATE';

    // 1. Check test mock overrides
    if (this._mockResponseQueue.length > 0) {
      const nextMock = this._mockResponseQueue.shift();
      if (nextMock instanceof Error) {
        throw nextMock;
      }
      return {
        text: typeof nextMock === 'string' ? nextMock : JSON.stringify(nextMock),
        latencyMs: Date.now() - startTime,
        usage: { promptTokens: 150, candidateTokens: 250, totalTokens: 400 }
      };
    }

    if (this._customMockHandler) {
      const handled = await this._customMockHandler(prompt, options);
      if (handled instanceof Error) throw handled;
      return {
        text: typeof handled === 'string' ? handled : JSON.stringify(handled),
        latencyMs: Date.now() - startTime,
        usage: { promptTokens: 150, candidateTokens: 250, totalTokens: 400 }
      };
    }

    // 2. Mock mode default simulation
    if (this._isMock || !this.model) {
      return {
        text: this._getSyntheticMockResponse(prompt, operation),
        latencyMs: Date.now() - startTime,
        usage: { promptTokens: 200, candidateTokens: 300, totalTokens: 500 }
      };
    }

    // 3. Live Gemini API execution
    try {
      const contents = Array.isArray(prompt) ? prompt : [prompt];
      const result = await this.model.generateContent(contents);
      const response = await result.response;
      const text = response.text();
      const latencyMs = Date.now() - startTime;

      const usage = {
        promptTokens: response.usageMetadata?.promptTokenCount || 200,
        candidateTokens: response.usageMetadata?.candidatesTokenCount || 300,
        totalTokens: response.usageMetadata?.totalTokenCount || 500
      };

      logger.info(`[GeminiClient] ${operation} completed in ${latencyMs}ms (${usage.totalTokens} tokens)`);
      return { text, latencyMs, usage };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      logger.error(`[GeminiClient] ${operation} failed after ${latencyMs}ms:`, { error: err.message });
      throw new Error(`Gemini API error during ${operation}: ${err.message}`);
    }
  }

  /**
   * Connectivity test
   */
  async ping() {
    const startTime = Date.now();
    if (this._isMock) {
      return { status: 'healthy', connected: true, mode: 'MOCK_EMULATION', latencyMs: 1 };
    }

    try {
      await this.model.generateContent('Hello');
      return {
        status: 'healthy',
        connected: true,
        mode: 'LIVE_GEMINI',
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        connected: false,
        mode: 'LIVE_GEMINI',
        error: err.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Helper generating realistic mock JSON responses for EduBridge domain
   * @private
   */
  _getSyntheticMockResponse(prompt, operation) {
    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    // Answer evaluation
    if (operation.includes('EVALUATE') || promptStr.includes('studentAnswer') || promptStr.includes('isCorrect')) {
      const isCorrect = !promptStr.includes('wrong_test_answer');
      return JSON.stringify({
        isCorrect,
        score: isCorrect ? 95 : 35,
        feedback: isCorrect
          ? 'Excellent! You clearly understand the concept and explained it with accuracy.'
          : "That was a thoughtful attempt, but let's revisit the core principle. Think of the structure like a sturdy frame.",
        weakConcepts: isCorrect ? [] : ['Cell Wall Rigid Structure'],
        recommendedNextDifficulty: isCorrect ? 'medium' : 'easy',
        followupQuestion: isCorrect
          ? null
          : 'Can you describe the physical material that gives the outer wall its firmness?'
      });
    }

    // Follow-up question (single adaptive question)
    if (operation === 'FOLLOWUP_QUESTION' || promptStr.includes('follow-up question to help')) {
      return JSON.stringify({
        questionText: 'Can you describe the physical material that gives the cell wall its rigidity?',
        questionType: 'MULTIPLE_CHOICE',
        options: ['Cellulose fibers', 'Liquid water', 'Animal fat', 'Air bubbles'],
        correctAnswer: 'Cellulose fibers',
        explanation: 'Cellulose forms tough, interlocking fibers that provide structural firmness.',
        audioPromptHint: 'Say option 1, 2, 3, or 4.',
        difficultyLevel: 'medium',
        conceptId: 'cpt_cell_wall'
      });
    }

    // Questions generation
    if (operation.includes('QUESTION') || promptStr.includes('comprehension questions')) {
      return JSON.stringify({
        questions: [
          {
            questionText: 'What is the primary function of the rigid cell wall in plant cells?',
            questionType: 'MULTIPLE_CHOICE',
            options: [
              'Providing structural support and maintaining shape',
              'Absorbing audio frequencies',
              'Propelling the plant cell through water',
              'Synthesizing animal fats'
            ],
            correctAnswer: 'Providing structural support and maintaining shape',
            explanation: 'Just like a rigid wooden frame supports a tent against wind, the cell wall keeps plant cells firm.',
            audioPromptHint: 'Say option 1, 2, 3, or 4, or state your answer clearly.',
            difficultyLevel: 'medium',
            conceptId: 'cpt_cell_wall'
          },
          {
            questionText: 'Which organelle captures light energy for photosynthesis like a solar panel?',
            questionType: 'MULTIPLE_CHOICE',
            options: ['Chloroplast', 'Mitochondria', 'Nucleus', 'Ribosome'],
            correctAnswer: 'Chloroplast',
            explanation: 'Chloroplasts absorb sunlight to produce glucose, similar to solar panels generating power.',
            audioPromptHint: 'Say the name of the organelle.',
            difficultyLevel: 'medium',
            conceptId: 'cpt_chloroplast'
          }
        ]
      });
    }

    // Simpler explanation / analogies
    if (operation.includes('SIMPLER_EXPLANATION') || promptStr.includes('simpler explanation')) {
      return JSON.stringify({
        conceptName: 'Plant Cell Wall',
        simplifiedExplanation: 'The cell wall is a sturdy protective barrier surrounding the cell.',
        auditoryAnalogy: 'Like tapping on a solid wooden door compared to a soft cushion.',
        tactileAnalogy: 'Imagine a firm cardboard shoebox holding a soft water balloon inside.',
        stepByStepBreakdown: [
          'Plants do not have bones to stand tall.',
          'Instead, every single cell has a stiff outer boundary made of cellulose.',
          'When filled with water, these cells press outward, keeping the entire stem upright.'
        ]
      });
    }

    // Default lesson generation
    return JSON.stringify({
      title: 'Accessible Biology: Plant Cell Architecture',
      summary: 'Explore plant cells through touch and acoustic analogies.',
      simplifiedText: 'Welcome to this audio lesson on plant cells. Picture holding a soft water balloon inside a wooden box.',
      screenReaderTranscript: '[Audio Cue: warm chime] Welcome to plant cell structure. Outer wall provides structural rigidity.',
      concepts: [
        {
          name: 'Rigid Cell Wall',
          description: 'Outer cellulose boundary supporting the plant cell.',
          visualCue: 'Outer rectangular perimeter',
          tactileAnalogy: 'Like a wooden frame supporting a tent against wind.'
        }
      ],
      analogies: [
        {
          targetConcept: 'Rigid Cell Wall',
          sensoryModality: 'tactile',
          analogy: 'A wooden box enclosing a water balloon.',
          physicalAnchor: 'cardboard box'
        }
      ],
      examples: [
        {
          title: 'Wilting Flowers',
          problem: 'Why do flowers droop when they lack water?',
          solution: 'Turgor pressure decreases, so the cell walls lose their internal fluid tension.'
        }
      ],
      takeaways: [
        'Plant cells have rigid cell walls made of cellulose.',
        'The cell wall provides protection, structure, and shape.'
      ]
    });
  }
}

const client = new GeminiClient();
module.exports = client;
