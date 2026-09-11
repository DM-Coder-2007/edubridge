/**
 * EduBridge Adaptive - OCR Input & Output Validator
 *
 * Enforces security, file integrity, MIME allowlists, size limits,
 * and canonical schema validation for textbook image processing.
 */

const { ValidationError } = require('../../utils/errors');

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp'
];

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MIN_IMAGE_DIMENSION = 100; // 100px min width/height

class OcrValidator {
  /**
   * Validate incoming textbook image upload before processing
   *
   * @param {Buffer} buffer - File buffer
   * @param {object} params - { mimeType, size, userId, title, subject }
   * @throws {ValidationError} If validation fails
   */
  validateUpload(buffer, params = {}) {
    const { mimeType, userId, title, subject } = params;

    // 1. Buffer verification
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new ValidationError('Textbook image must be a valid non-empty Buffer');
    }

    if (buffer.length === 0) {
      throw new ValidationError('Textbook image buffer cannot be empty (0 bytes)');
    }

    // 2. Size limit check (15MB)
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      const actualMb = (buffer.length / (1024 * 1024)).toFixed(2);
      throw new ValidationError(`Textbook image exceeds maximum permitted size of 15MB (received ${actualMb}MB)`);
    }

    // 3. MIME type check
    if (mimeType) {
      const normalizedMime = mimeType.toLowerCase().trim();
      if (!ALLOWED_IMAGE_MIMES.includes(normalizedMime)) {
        throw new ValidationError(`Unsupported file type "${mimeType}". Allowed formats: JPEG, PNG, WEBP, TIFF, BMP`);
      }
    }

    // 4. Tenancy & Metadata validation
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new ValidationError('userId is mandatory to associate textbook asset ownership');
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new ValidationError('Textbook title is required');
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      throw new ValidationError('Academic subject is required');
    }
  }

  /**
   * Validate image dimensions and inspect image quality
   *
   * @param {object} metadata - Sharp metadata { width, height, format }
   * @returns {{ isValid: boolean, isLowQuality: boolean, warnings: string[] }}
   */
  validateImageDimensions(metadata = {}) {
    const { width = 0, height = 0 } = metadata;
    const warnings = [];

    if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
      throw new ValidationError(
        `Image dimensions (${width}x${height}px) are below the minimum required resolution of ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}px for OCR.`
      );
    }

    // Detect low-quality scans (e.g. less than 500px in either dimension)
    const isLowQuality = width < 500 || height < 500;
    if (isLowQuality) {
      warnings.push(`Low-resolution scan detected (${width}x${height}px). Sharp enhancement will be applied.`);
    }

    return {
      isValid: true,
      isLowQuality,
      warnings
    };
  }

  /**
   * Validate structured OCR result from Gemini
   *
   * @param {object} ocrResult - Normalized OCR output
   * @throws {ValidationError} If required structural elements are missing
   */
  validateStructuredResult(ocrResult) {
    if (!ocrResult || typeof ocrResult !== 'object') {
      throw new ValidationError('Structured OCR result must be an object');
    }

    if (!ocrResult.rawText || typeof ocrResult.rawText !== 'string' || ocrResult.rawText.trim().length === 0) {
      throw new ValidationError('OCR result must contain non-empty rawText');
    }

    if (!Array.isArray(ocrResult.sections)) {
      throw new ValidationError('OCR result must contain an array of sections');
    }

    if (!Array.isArray(ocrResult.concepts)) {
      throw new ValidationError('OCR result must contain an array of concepts');
    }

    if (!Array.isArray(ocrResult.formulas)) {
      throw new ValidationError('OCR result must contain an array of formulas');
    }

    if (!Array.isArray(ocrResult.examples)) {
      throw new ValidationError('OCR result must contain an array of examples');
    }
  }

  /**
   * Distinguishes lesson content from extraneous noise (Section 7)
   * Keeps: headings, subheadings, paragraphs, definitions, formulas, scientific notation
   * Excludes: publisher logos, textbook branding, copyright notices, ISBN, watermarks
   * Preserves unusual scientific notation such as "He === > N to2"
   *
   * @param {object} structuredResult
   * @returns {object} Sanitized result with excludedContent list
   */
  sanitizeAndValidateExtractedContent(structuredResult) {
    if (!structuredResult) return structuredResult;

    const excludedList = [];
    const copyrightPatterns = [
      /\bcopyright\s*(?:©|\(c\))?\s*\d{4}/i,
      /\ball rights reserved\b/i,
      /\bisbn(?:-1[03])?:\s*[0-9-x]+/i,
      /\bprinted in\s+[a-z\s]+/i,
      /\bpublished by\s+[a-z\s]+/i
    ];

    if (Array.isArray(structuredResult.sections)) {
      structuredResult.sections = structuredResult.sections.filter(sec => {
        const headingText = (sec.heading || '').trim();
        const isExcluded = copyrightPatterns.some(pattern => pattern.test(headingText));
        if (isExcluded) {
          excludedList.push(`Header/Branding: ${headingText}`);
          return false;
        }
        return true;
      });
    }

    structuredResult.excludedContent = [
      ...(Array.isArray(structuredResult.excludedContent) ? structuredResult.excludedContent : []),
      ...excludedList
    ];

    return structuredResult;
  }

  /**
   * Validates that the extracted result is grounded in the actual document image (Section 9)
   * Rejects ungrounded synthetic biology placeholders when context or image is unrelated.
   *
   * @param {object} structuredResult
   * @param {object} [context={}]
   * @returns {{ isValid: boolean, groundingScore: number, needsReview: boolean, reason?: string }}
   */
  validateExtractionGrounding(structuredResult, context = {}) {
    if (!structuredResult) {
      return { isValid: false, groundingScore: 0, reason: 'Empty OCR result', needsReview: true };
    }

    const raw = (structuredResult.rawText || '').trim();
    if (raw.length < 15) {
      return {
        isValid: false,
        groundingScore: 0.1,
        reason: 'Extracted text is too short or unreadable (< 15 characters)',
        needsReview: true
      };
    }

    // Check for cellular biology hallucination leak when title/subject is not biology
    const biologyKeywords = [
      'cellular structures consist of distinct membrane-bound compartments',
      'mitochondria are the powerhouse',
      'chloroplasts carry out photosynthesis',
      'endoplasmic reticulum'
    ];

    const lowerRaw = raw.toLowerCase();
    const isSuspectBiology = biologyKeywords.some(kw => lowerRaw.includes(kw));

    const contextTitle = (context.title || structuredResult.title || '').toLowerCase();
    const contextSubject = (context.subject || '').toLowerCase();
    const isLegitBiologyContext = contextTitle.includes('cell') ||
      contextTitle.includes('biology') ||
      contextSubject.includes('biology') ||
      contextSubject.includes('cell');

    if (isSuspectBiology && !isLegitBiologyContext) {
      return {
        isValid: false,
        groundingScore: 0.1,
        reason: 'Grounding failure: Extracted content contains unrelated cellular biology placeholder.',
        needsReview: true
      };
    }

    return {
      isValid: true,
      groundingScore: 0.95,
      needsReview: false
    };
  }
}

const ocrValidator = new OcrValidator();
module.exports = ocrValidator;
