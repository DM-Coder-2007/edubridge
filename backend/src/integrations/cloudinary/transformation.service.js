/**
 * EduBridge Adaptive - Cloudinary Transformation Service
 *
 * Implements non-destructive, accessible media transformation pipelines:
 * 1. Textbook Image Pipeline:
 *    original -> preprocessing -> contrast improvement -> grayscale -> trimming/cropping -> quality optimization -> OCR-ready delivery
 * 2. Audio Pipeline:
 *    MP3 delivery, streaming-friendly CDN URLs, and audio waveform visualizations
 *
 * Exposed Reusable Methods:
 * - getOcrImageUrl(publicId, options)
 * - getOptimizedImageUrl(publicId, options)
 * - getThumbnailUrl(publicId, options)
 * - getAudioUrl(publicId, options)
 * - getWaveformUrl(publicId, options)
 * - generateImageTransformation(publicId, options)
 * - generateAccessibleImageUrl(publicId, options)
 *
 * CRITICAL: Never destroys the original asset. Uses Cloudinary URL transformations.
 * All returned URLs are secure HTTPS URLs.
 */

const client = require('./client');

class CloudinaryTransformationService {
  /**
   * Generates dynamic Cloudinary image transformation URLs supporting the EduBridge pipeline
   *
   * @param {string} publicId - Cloudinary asset public ID
   * @param {object} [options={}] - Transformation options
   * @returns {string} Secure HTTPS Transformation URL
   */
  generateImageTransformation(publicId, options = {}) {
    if (!publicId) {
      throw new Error('publicId is required to generate transformation URL');
    }

    const {
      pipelineStage = 'original', // 'original', 'preprocessing', 'contrast', 'grayscale', 'crop', 'quality', 'ocr'
      preset, // 'HIGH_CONTRAST', 'INVERTED', 'GRAYSCALE', 'OCR_READY', 'TACTILE_EDGE'
      width,
      height,
      crop = 'limit',
      contrast,
      sharpen,
      grayscale = false,
      invert = false,
      quality = 'auto',
      format = 'auto'
    } = options;

    const cloudName = client.getCloudName();
    const transformSteps = [];

    // 1. Pipeline stage defaults
    let effectiveContrast = contrast;
    let effectiveSharpen = sharpen;
    let effectiveGrayscale = grayscale;
    let effectiveInvert = invert;
    let effectiveWidth = width || (pipelineStage === 'ocr' || preset === 'OCR_READY' ? 2000 : 1600);

    if (preset === 'OCR_READY' || pipelineStage === 'ocr') {
      effectiveGrayscale = true;
      if (effectiveContrast === undefined) effectiveContrast = 60;
      if (effectiveSharpen === undefined) effectiveSharpen = 120;
    } else if (preset === 'HIGH_CONTRAST' || pipelineStage === 'contrast') {
      if (effectiveContrast === undefined) effectiveContrast = 50;
      if (effectiveSharpen === undefined) effectiveSharpen = 100;
    } else if (preset === 'INVERTED' || preset === 'INVERTED_DARK') {
      effectiveInvert = true;
      if (effectiveContrast === undefined) effectiveContrast = 50;
    } else if (preset === 'GRAYSCALE' || pipelineStage === 'grayscale') {
      effectiveGrayscale = true;
    } else if (preset === 'TACTILE_EDGE') {
      effectiveGrayscale = true;
      if (effectiveContrast === undefined) effectiveContrast = 70;
      if (effectiveSharpen === undefined) effectiveSharpen = 150;
    } else if (pipelineStage === 'preprocessing') {
      if (effectiveSharpen === undefined) effectiveSharpen = 50;
    }

    // 2. Build transformation descriptors
    const sizePart = [];
    if (effectiveWidth) sizePart.push(`w_${effectiveWidth}`);
    if (height) sizePart.push(`h_${height}`);
    if (crop) sizePart.push(`c_${crop}`);
    if (sizePart.length > 0) transformSteps.push(sizePart.join(','));

    const effectPart = [];
    if (effectiveContrast !== undefined && effectiveContrast !== null) {
      effectPart.push(`e_contrast:${effectiveContrast}`);
    }
    if (effectiveSharpen) {
      effectPart.push(`e_sharpen:${effectiveSharpen}`);
    }
    if (effectiveGrayscale) {
      effectPart.push('e_grayscale');
    }
    if (effectiveInvert) {
      effectPart.push('e_negate');
    }
    if (effectPart.length > 0) transformSteps.push(effectPart.join(','));

    if (quality && quality !== 'original') {
      transformSteps.push(`q_${quality}`);
    }
    if (format && format !== 'original') {
      transformSteps.push(`f_${format}`);
    }

    // 3. Construct URL
    const transformSegment = transformSteps.length > 0 ? `${transformSteps.join('/')}/` : '';
    const cleanPublicId = publicId.replace(/^\//, '');

    if (client.isMockMode()) {
      return `https://res.cloudinary.com/${cloudName}/image/upload/${transformSegment}${cleanPublicId}`;
    }

    const cloudinary = client.getClient();
    return cloudinary.url(cleanPublicId, {
      transformation: transformSteps.map(step => {
        const obj = {};
        step.split(',').forEach(param => {
          const [k, v] = param.split('_');
          obj[k] = v;
        });
        return obj;
      }),
      secure: true
    });
  }

  /**
   * Get OCR-ready delivery URL (grayscale, enhanced contrast, sharpened, max clarity)
   * @param {string} publicId
   * @param {object} [options={}]
   * @returns {string} Secure HTTPS URL
   */
  getOcrImageUrl(publicId, options = {}) {
    return this.generateImageTransformation(publicId, {
      preset: 'OCR_READY',
      quality: 'auto:best',
      format: 'png',
      ...options
    });
  }

  /**
   * Get web-optimized delivery URL (responsive width, automatic format, quality compression)
   * @param {string} publicId
   * @param {object} [options={}]
   * @returns {string} Secure HTTPS URL
   */
  getOptimizedImageUrl(publicId, options = {}) {
    return this.generateImageTransformation(publicId, {
      quality: 'auto',
      format: 'auto',
      width: options.width || 1600,
      crop: 'limit',
      ...options
    });
  }

  /**
   * Get thumbnail image URL for dashboards and asset previews
   * @param {string} publicId
   * @param {object} [options={}]
   * @returns {string} Secure HTTPS URL
   */
  getThumbnailUrl(publicId, options = {}) {
    return this.generateImageTransformation(publicId, {
      width: options.width || 300,
      height: options.height || 300,
      crop: 'thumb',
      quality: 'auto',
      format: 'auto',
      ...options
    });
  }

  /**
   * Generate accessible image view (convenience wrapper for backward compatibility)
   */
  generateAccessibleImageUrl(publicId, options = {}) {
    const {
      highContrast = false,
      zoomWidth = 1600,
      grayscale = false,
      invert = false
    } = options;

    return this.generateImageTransformation(publicId, {
      preset: invert ? 'INVERTED' : highContrast ? 'HIGH_CONTRAST' : grayscale ? 'GRAYSCALE' : undefined,
      width: zoomWidth,
      invert,
      grayscale,
      contrast: highContrast ? 50 : undefined
    });
  }

  /**
   * Generates audio waveform visualization URL (PNG) from an audio asset in Cloudinary
   *
   * @param {string} publicId - Cloudinary audio public ID
   * @param {object} [options={}] - Waveform rendering options
   * @returns {string} Waveform visualizer URL (HTTPS)
   */
  generateWaveformUrl(publicId, options = {}) {
    if (!publicId) {
      throw new Error('publicId is required to generate waveform URL');
    }

    const {
      width = 800,
      height = 140,
      color = '0084ff', // Accessible contrast blue
      backgroundColor = 'transparent',
      format = 'png'
    } = options;

    const cloudName = client.getCloudName();
    const cleanPublicId = publicId.replace(/^\//, '').replace(/\.[^/.]+$/, '');

    // Cloudinary waveform transformation: c_scale,h_<height>,w_<width>/fl_waveform,co_rgb:<color>
    const bgParam = backgroundColor === 'transparent' ? '' : `,b_rgb:${backgroundColor}`;
    const waveformParams = `c_scale,h_${height},w_${width}/fl_waveform,co_rgb:${color}${bgParam}`;

    return `https://res.cloudinary.com/${cloudName}/video/upload/${waveformParams}/${cleanPublicId}.${format}`;
  }

  /**
   * Reusable getWaveformUrl alias
   */
  getWaveformUrl(publicId, options = {}) {
    return this.generateWaveformUrl(publicId, options);
  }

  /**
   * Generates streaming-friendly audio delivery URL (MP3 format, progressive download, CDN caching)
   *
   * @param {string} publicId - Cloudinary audio public ID
   * @param {object} [options={}] - Audio streaming options
   * @returns {string} Streaming CDN audio URL (HTTPS)
   */
  generateStreamingAudioUrl(publicId, options = {}) {
    if (!publicId) {
      throw new Error('publicId is required to generate audio streaming URL');
    }

    const {
      bitrate = '128k',
      format = 'mp3'
    } = options;

    const cloudName = client.getCloudName();
    const cleanPublicId = publicId.replace(/^\//, '');

    const streamingParams = `br_${bitrate}`;
    return `https://res.cloudinary.com/${cloudName}/video/upload/${streamingParams}/${cleanPublicId}.${format}`;
  }

  /**
   * Reusable getAudioUrl alias
   */
  getAudioUrl(publicId, options = {}) {
    return this.generateStreamingAudioUrl(publicId, options);
  }
}

const transformationService = new CloudinaryTransformationService();
module.exports = transformationService;
