/**
 * EduBridge Adaptive - Image Preprocessing Service (Sharp)
 */

const sharp = require('sharp');
const logger = require('../utils/logger');

class ImageService {
  async getImageMetadata(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        channels: metadata.channels,
        density: metadata.density || 72,
        hasAlpha: metadata.hasAlpha || false
      };
    } catch (error) {
      logger.error('[ImageService] Failed to extract metadata:', error.message);
      throw new Error(`Failed to extract image metadata: ${error.message}`);
    }
  }

  async preprocessForOCR(buffer) {
    try {
      const originalMeta = await this.getImageMetadata(buffer);

      const processedBuffer = await sharp(buffer)
        .rotate()
        .resize({
          width: 2048,
          height: 2048,
          fit: 'inside',
          withoutEnlargement: true
        })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 })
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
        .toBuffer();

      const processedMeta = await this.getImageMetadata(processedBuffer);

      logger.info(`[ImageService] Preprocessed image for OCR: Original (${originalMeta.width}x${originalMeta.height}) -> Processed (${processedMeta.width}x${processedMeta.height})`);

      return {
        buffer: processedBuffer,
        metadata: {
          original: originalMeta,
          processed: processedMeta,
          transformations: ['auto_rotate', 'resize_inside_2048', 'grayscale', 'normalize_histogram', 'sharpen']
        }
      };
    } catch (error) {
      logger.error('[ImageService] Preprocessing for OCR failed:', error.message);
      throw new Error(`Image preprocessing failed: ${error.message}`);
    }
  }

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

      const result = await pipeline.png().toBuffer();
      logger.info(`[ImageService] Generated accessible image view in mode: ${mode}`);
      return result;
    } catch (error) {
      logger.error(`[ImageService] Accessibility image generation failed for mode ${mode}:`, error.message);
      throw error;
    }
  }
}

module.exports = new ImageService();
