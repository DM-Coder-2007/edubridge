/**
 * EduBridge Adaptive - OCR Module Entrypoint
 */

const ocrService = require('./ocr.service');
const imagePreprocessor = require('./imagePreprocessor');
const ocrValidator = require('./ocr.validator');
const { normalizeOcrResult, createDefaultOcrResult } = require('./ocr.schema');

module.exports = {
  ocrService,
  imagePreprocessor,
  ocrValidator,
  normalizeOcrResult,
  createDefaultOcrResult
};
