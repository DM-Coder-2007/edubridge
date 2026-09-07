/**
 * EduBridge Adaptive - Image Preprocessing Engine (Sharp)
 *
 * Implements non-destructive digital signal processing for textbook scans:
 * 1. Metadata extraction & resolution inspection.
 * 2. EXIF auto-rotation to ensure upright text.
 * 3. Aspect-ratio preserving dimension capping (2048x2048).
 * 4. Grayscale & contrast normalization (histogram stretching).
 * 5. Multi-pass sharpening (unsharp mask) for crisp glyph edges.
 * 6. Adaptive contrast enhancement for low-quality / blurry scans.
 */

const sharp = require('sharp');
const ocrValidator = require('./ocr.validator');
const logger = require('../../utils/logger');

class ImagePreprocessor {
  /**
   * Extract image metadata using Sharp
   *
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<object>} Metadata { width, height, format, size, channels, density }
   */
  async extractMetadata(buffer) {
    try {
      const meta = await sharp(buffer).metadata();
      return {
        width: meta.width || 0,
        height: meta.height || 0,
        format: meta.format || 'unknown',
        size: buffer.length,
        channels: meta.channels || 3,
        density: meta.density || 72,
        hasAlpha: Boolean(meta.hasAlpha)
      };
    } catch (err) {
      logger.error('[ImagePreprocessor] Metadata extraction failed:', err.message);
      throw new Error(`Failed to read image metadata: ${err.message}`);
    }
  }

  /**
   * Preprocess textbook scan for OCR and multimodal extraction
   *
   * @param {Buffer} buffer - Input image buffer
   * @param {object} [options={}] - Processing options
   * @returns {Promise<{ buffer: Buffer, metadata: object }>} Preprocessed image buffer and metadata
   */
  async preprocessForOcr(buffer, options = {}) {
    try {
      const originalMeta = await this.extractMetadata(buffer);

      // Validate dimensions & check quality
      const { isLowQuality, warnings } = ocrValidator.validateImageDimensions(originalMeta);
      if (warnings.length > 0) {
        logger.warn('[ImagePreprocessor] Quality warnings:', { warnings });
      }

      const transformations = ['auto_rotate', 'resize_inside_2048', 'grayscale'];

      // Build Sharp pipeline
      let pipeline = sharp(buffer)
        .rotate() // Auto-orient via EXIF
        .resize({
          width: options.maxWidth || 2048,
          height: options.maxHeight || 2048,
          fit: 'inside',
          withoutEnlargement: true
        })
        .grayscale();

      // Adaptive enhancement for low-quality or low-contrast scans
      if (isLowQuality || options.enhanceLowQuality) {
        transformations.push('adaptive_histogram_equalization', 'heavy_sharpen', 'gamma_boost');
        pipeline = pipeline
          .normalize()
          .gamma(1.2)
          .sharpen({ sigma: 1.8, m1: 1.5, m2: 3.0 });
      } else {
        transformations.push('normalize_histogram', 'unsharp_mask');
        pipeline = pipeline
          .normalize()
          .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 });
      }

      // Output as high-clarity JPEG for OCR
      const processedBuffer = await pipeline
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
        .toBuffer();

      const processedMeta = await this.extractMetadata(processedBuffer);

      logger.info(
        `[ImagePreprocessor] Preprocessed: ${originalMeta.width}x${originalMeta.height} -> ${processedMeta.width}x${processedMeta.height} (Low Quality: ${isLowQuality})`
      );

      return {
        buffer: processedBuffer,
        metadata: {
          original: originalMeta,
          processed: processedMeta,
          isLowQuality,
          transformations
        }
      };
    } catch (err) {
      logger.error('[ImagePreprocessor] OCR preprocessing failed:', err.message);
      throw new Error(`Image preprocessing failed: ${err.message}`);
    }
  }

  /**
   * Generates high-contrast or inverted accessibility views for visually impaired readers
   */
  async generateAccessibilityView(buffer, mode = 'high-contrast') {
    try {
      let pipeline = sharp(buffer).rotate();

      if (mode === 'inverted') {
        pipeline = pipeline
          .grayscale()
          .negate({ alpha: false })
          .normalize();
      } else {
        pipeline = pipeline
          .grayscale()
          .linear(1.4, -(128 * 0.4))
          .sharpen();
      }

      return pipeline.png().toBuffer();
    } catch (err) {
      logger.error(`[ImagePreprocessor] Accessibility view failed (${mode}):`, err.message);
      throw err;
    }
  }

  // Backwards compatibility aliases
  async getImageMetadata(buffer) {
    return this.extractMetadata(buffer);
  }

  async preprocessForOCR(buffer, options = {}) {
    return this.preprocessForOcr(buffer, options);
  }
}

const imagePreprocessor = new ImagePreprocessor();
module.exports = imagePreprocessor;
