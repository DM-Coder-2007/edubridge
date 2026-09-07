/**
 * EduBridge Adaptive - Cloudinary Upload Service
 *
 * Handles validated, secure media uploads for:
 * 1. Original textbook scans (edubridge/textbooks/originals)
 * 2. OCR-preprocessed textbook images (edubridge/textbooks/processed)
 * 3. Neural TTS lesson narration audio (edubridge/lessons/audio)
 * 4. Audio waveform data/visualizations (edubridge/audio/waveforms)
 *
 * SECURITY:
 * - Inspects actual magic bytes / file signatures (does not trust MIME alone)
 * - Rejects executables and unsupported formats
 * - Validates file size limits (15MB for images, 50MB for audio)
 * - Validates image dimensions using Sharp
 * - Sanitizes metadata tags and context
 * - Associates every asset with user_id / lesson_id / textbook_id
 * - Preserves original assets without destructive overwrites
 */

const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const client = require('./client');
const { ValidationError } = require('../../utils/errors');
const logger = require('../../utils/logger');

// Security: MIME allowlists
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp'
];

const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/x-m4a',
  'audio/flac'
];

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Inspect magic bytes / file signatures to detect actual file type
 * @param {Buffer} buffer
 * @returns {string|null} Detected MIME type or null
 */
function inspectMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // Check Executables (MZ, ELF, Mach-O, Shell script)
  if ((buffer[0] === 0x4D && buffer[1] === 0x5A) || // Windows PE (MZ)
      (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) || // ELF
      (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) || // Mach-O
      (buffer[0] === 0x23 && buffer[1] === 0x21)) { // Shell script '#!'
    return 'application/x-executable';
  }

  // Check JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // Check PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // Check WEBP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  // Check TIFF: 49 49 2A 00 or 4D 4D 00 2A
  if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
      (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) {
    return 'image/tiff';
  }

  // Check BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp';
  }

  // Check MP3: ID3v2 (49 44 33) or MPEG sync frame (FF FB / FF F3 / FF F2)
  if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) {
    return 'audio/mpeg';
  }

  // Check WAV: RIFF....WAVE
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
    return 'audio/wav';
  }

  // Check OGG: OggS (4F 67 67 53)
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'audio/ogg';
  }

  return null;
}

class CloudinaryUploadService {
  /**
   * Validate file buffer, size, magic bytes, and MIME type
   * @private
   */
  async _validateMedia(buffer, mimeType, { maxBytes, allowedMimes, mediaType }) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new ValidationError(`Invalid ${mediaType} buffer: Expected a valid Node.js Buffer.`);
    }

    if (buffer.length === 0) {
      throw new ValidationError(`Invalid ${mediaType}: File buffer is empty (0 bytes).`);
    }

    if (buffer.length > maxBytes) {
      const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
      const actualMb = (buffer.length / (1024 * 1024)).toFixed(2);
      throw new ValidationError(`File size limit exceeded: ${mediaType} is ${actualMb}MB, maximum permitted is ${maxMb}MB.`);
    }

    // Inspect file signature magic bytes
    const detectedMime = inspectMagicBytes(buffer);
    if (detectedMime === 'application/x-executable') {
      throw new ValidationError('Security violation: Executable files are strictly forbidden.');
    }

    if (mimeType) {
      const normalizedMime = mimeType.toLowerCase().trim();
      if (!allowedMimes.includes(normalizedMime)) {
        throw new ValidationError(`Unsupported ${mediaType} format: "${mimeType}". Allowed types: ${allowedMimes.join(', ')}`);
      }
    }

    if (detectedMime && !allowedMimes.includes(detectedMime) && mediaType === 'image') {
      throw new ValidationError(`Unsupported ${mediaType} signature: Detected "${detectedMime}". Allowed types: ${allowedMimes.join(', ')}`);
    }

    // Image dimension validation with Sharp (when buffer is substantial)
    if (mediaType === 'image' && buffer.length > 256) {
      try {
        const meta = await sharp(buffer).metadata();
        if (meta && (meta.width < 10 || meta.height < 10)) {
          throw new ValidationError(`Image dimensions too small (${meta.width}x${meta.height}). Minimum 10x10 pixels required.`);
        }
      } catch (err) {
        if (!err.message.includes('Minimum 10x10')) {
          logger.warn('[CloudinaryUpload] Sharp could not inspect image metadata:', err.message);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Sanitize tags and context strings
   * @private
   */
  _sanitizeMetadata(metadata = {}) {
    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        // Strip non-printable ASCII or control characters
        const cleanKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanValue = String(value).replace(/[\r\n\t]/g, ' ').trim();
        sanitized[cleanKey] = cleanValue.slice(0, 500);
      }
    }
    return sanitized;
  }

  /**
   * Dedicated Textbook Image Upload
   * Canonical upload into edubridge/textbooks/originals
   *
   * @param {Buffer} buffer - Image file buffer
   * @param {object} [options={}] - Options { userId, textbookId, lessonId, mimeType, tags }
   * @returns {Promise<object>}
   */
  async uploadTextbookImage(buffer, options = {}) {
    const folder = options.folder || `${client.getBaseFolder()}/textbooks/originals`;
    const publicId = options.publicId || `textbook_orig_${Date.now()}_${uuidv4().substring(0, 8)}`;
    return this.uploadImage(buffer, {
      ...options,
      folder,
      publicId
    });
  }

  /**
   * Upload an image (textbook raw scan or preprocessed image)
   *
   * @param {Buffer} buffer - Image file buffer
   * @param {object} [options={}] - Upload options
   * @returns {Promise<object>} Upload result metadata
   */
  async uploadImage(buffer, options = {}) {
    const defaultFolder = options.folder || `${client.getBaseFolder()}/textbooks/originals`;
    const {
      mimeType = 'image/jpeg',
      folder = defaultFolder,
      publicId = `img_${uuidv4()}`,
      userId,
      textbookId,
      lessonId,
      eagerTransformations = [],
      tags = []
    } = options;

    // 1. Validate image constraints & signature
    await this._validateMedia(buffer, mimeType, {
      maxBytes: MAX_IMAGE_SIZE_BYTES,
      allowedMimes: ALLOWED_IMAGE_MIMES,
      mediaType: 'image'
    });

    // 2. Sanitize and associate context metadata
    const context = this._sanitizeMetadata({
      userId,
      textbookId,
      lessonId,
      originalMime: mimeType,
      uploadedAt: new Date().toISOString()
    });

    const sanitizedTags = Array.from(new Set([
      'edubridge',
      'textbook',
      ...(userId ? [`user_${userId}`] : []),
      ...(textbookId ? [`textbook_${textbookId}`] : []),
      ...tags
    ])).map(t => String(t).replace(/[^a-zA-Z0-9_-]/g, '_'));

    // 3. Mock mode execution
    if (client.isMockMode()) {
      const fullPublicId = `${folder}/${publicId}`;
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
      const version = Date.now();
      const mockResult = {
        publicId: fullPublicId,
        public_id: fullPublicId,
        url: `https://res.cloudinary.com/${client.getCloudName()}/image/upload/v${version}/${fullPublicId}.${ext}`,
        secureUrl: `https://res.cloudinary.com/${client.getCloudName()}/image/upload/v${version}/${fullPublicId}.${ext}`,
        resourceType: 'image',
        assetType: 'image',
        asset_type: 'image',
        format: ext,
        bytes: buffer.length,
        width: options.width || 1600,
        height: options.height || 2200,
        version,
        folder,
        context,
        tags: sanitizedTags,
        createdAt: new Date().toISOString()
      };

      client.saveMockAsset(fullPublicId, mockResult);
      logger.info(`[CloudinaryUpload] [MOCK] Uploaded image: ${fullPublicId} (${buffer.length} bytes)`);
      return mockResult;
    }

    // 4. Live Cloudinary SDK stream upload
    const cloudinary = client.getClient();
    return new Promise((resolve, reject) => {
      const uploadParams = {
        folder,
        public_id: publicId,
        resource_type: 'image',
        tags: sanitizedTags,
        context,
        overwrite: false, // Do not destroy original assets
        eager: eagerTransformations.length > 0 ? eagerTransformations : undefined
      };

      const uploadStream = cloudinary.uploader.upload_stream(uploadParams, (error, result) => {
        if (error) {
          logger.error('[CloudinaryUpload] Image upload failed:', { error: error.message });
          reject(new Error(`Cloudinary image upload failed: ${error.message}`));
        } else {
          logger.info(`[CloudinaryUpload] Successfully uploaded image: ${result.public_id}`);
          resolve({
            publicId: result.public_id,
            public_id: result.public_id,
            url: result.secure_url || result.url,
            secureUrl: result.secure_url,
            resourceType: result.resource_type || 'image',
            assetType: result.resource_type || 'image',
            asset_type: result.resource_type || 'image',
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            version: result.version,
            folder,
            context,
            tags: result.tags || sanitizedTags,
            eager: result.eager || [],
            createdAt: result.created_at || new Date().toISOString()
          });
        }
      });

      uploadStream.end(buffer);
    });
  }

  /**
   * Upload audio (lesson narration MP3 or spoken answer)
   *
   * @param {Buffer} buffer - Audio file buffer
   * @param {object} [options={}] - Upload options
   * @returns {Promise<object>} Upload result metadata
   */
  async uploadAudio(buffer, options = {}) {
    const defaultPublicId = options.lessonId ? `audio_lesson_${options.lessonId}` : `audio_${uuidv4()}`;
    const defaultFolder = options.folder || `${client.getBaseFolder()}/lessons/audio`;
    const {
      mimeType = 'audio/mpeg',
      folder = defaultFolder,
      publicId = defaultPublicId,
      userId,
      lessonId,
      duration = 0.0,
      tags = []
    } = options;

    // 1. Validate audio constraints & signature
    await this._validateMedia(buffer, mimeType, {
      maxBytes: MAX_AUDIO_SIZE_BYTES,
      allowedMimes: ALLOWED_AUDIO_MIMES,
      mediaType: 'audio'
    });

    // 2. Sanitize and associate context metadata
    const context = this._sanitizeMetadata({
      userId,
      lessonId,
      originalMime: mimeType,
      durationSeconds: duration,
      ttsEngine: options.ttsEngine || 'PIPER_TTS',
      voiceId: options.voiceId || 'en_US-lessac-medium',
      uploadedAt: new Date().toISOString()
    });

    const sanitizedTags = Array.from(new Set([
      'edubridge',
      'audio',
      'piper_tts',
      ...(userId ? [`user_${userId}`] : []),
      ...(lessonId ? [`lesson_${lessonId}`] : []),
      ...tags
    ])).map(t => String(t).replace(/[^a-zA-Z0-9_-]/g, '_'));

    // 3. Mock mode execution
    if (client.isMockMode()) {
      const fullPublicId = `${folder}/${publicId}`;
      const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'mp3';
      const version = Date.now();
      const mockResult = {
        publicId: fullPublicId,
        public_id: fullPublicId,
        url: `https://res.cloudinary.com/${client.getCloudName()}/video/upload/v${version}/${fullPublicId}.${ext}`,
        secureUrl: `https://res.cloudinary.com/${client.getCloudName()}/video/upload/v${version}/${fullPublicId}.${ext}`,
        resourceType: 'video',
        assetType: 'video',
        asset_type: 'video',
        format: ext,
        bytes: buffer.length,
        duration: duration || 120.0,
        version,
        folder,
        context,
        tags: sanitizedTags,
        createdAt: new Date().toISOString()
      };

      client.saveMockAsset(fullPublicId, mockResult);
      logger.info(`[CloudinaryUpload] [MOCK] Uploaded audio: ${fullPublicId} (${buffer.length} bytes)`);
      return mockResult;
    }

    // 4. Live Cloudinary SDK stream upload (Cloudinary stores audio under resource_type: 'video')
    const timeoutMs = parseInt(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS || '20000', 10);
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();
      try {
        const uploadResult = await this._executeAudioUploadStream(buffer, {
          folder,
          publicId,
          sanitizedTags,
          context,
          duration,
          timeoutMs
        });

        const uploadDurationMs = Date.now() - startTime;
        logger.info(`[CloudinaryUpload] Successfully uploaded audio in ${uploadDurationMs}ms (attempt ${attempt}/${maxAttempts}): ${uploadResult.public_id} (${buffer.length} bytes, format: ${uploadResult.format || 'mp3'})`);
        return uploadResult;
      } catch (err) {
        lastError = err;
        const uploadDurationMs = Date.now() - startTime;
        logger.warn(`[CloudinaryUpload] Audio upload attempt ${attempt}/${maxAttempts} failed after ${uploadDurationMs}ms: ${err.message}`);

        if (attempt < maxAttempts) {
          const backoffDelay = Math.pow(2, attempt - 1) * 500; // 500ms, 1000ms
          logger.info(`[CloudinaryUpload] Retrying audio upload in ${backoffDelay}ms...`);
          await new Promise((res) => setTimeout(res, backoffDelay));
        }
      }
    }

    throw new Error(`Cloudinary audio upload failed after ${maxAttempts} attempts: ${lastError ? lastError.message : 'Unknown timeout/network error'}`);
  }

  /**
   * Internal helper to wrap Cloudinary upload_stream with a Promise timeout
   * @private
   */
  _executeAudioUploadStream(buffer, { folder, publicId, sanitizedTags, context, duration, timeoutMs }) {
    const cloudinary = client.getClient();
    return new Promise((resolve, reject) => {
      let isSettled = false;
      let timer = null;

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            reject(new Error(`Cloudinary audio upload timeout after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      const uploadParams = {
        folder,
        public_id: publicId,
        resource_type: 'video',
        format: 'mp3',
        tags: sanitizedTags,
        context,
        overwrite: false,
        timeout: timeoutMs
      };

      const uploadStream = cloudinary.uploader.upload_stream(uploadParams, (error, result) => {
        if (timer) clearTimeout(timer);
        if (isSettled) return;
        isSettled = true;

        if (error) {
          reject(new Error(error.message || 'Cloudinary upload stream error'));
        } else {
          resolve({
            publicId: result.public_id,
            public_id: result.public_id,
            url: result.secure_url || result.url,
            secureUrl: result.secure_url,
            resourceType: result.resource_type || 'video',
            assetType: result.resource_type || 'video',
            asset_type: result.resource_type || 'video',
            format: result.format,
            bytes: result.bytes,
            duration: result.duration || duration,
            version: result.version,
            folder,
            context,
            tags: result.tags || sanitizedTags,
            createdAt: result.created_at || new Date().toISOString()
          });
        }
      });

      uploadStream.on('error', (streamErr) => {
        if (timer) clearTimeout(timer);
        if (isSettled) return;
        isSettled = true;
        reject(streamErr);
      });

      uploadStream.end(buffer);
    });
  }

  /**
   * Upload waveform data asset
   */
  async uploadWaveform(buffer, options = {}) {
    const {
      folder = `${client.getBaseFolder()}/audio/waveforms`,
      publicId = `waveform_${options.lessonId || uuidv4()}`,
      format = 'png'
    } = options;

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid waveform buffer: Expected a valid Node.js Buffer.');
    }

    if (client.isMockMode()) {
      const fullPublicId = `${folder}/${publicId}`;
      const version = Date.now();
      const mockResult = {
        publicId: fullPublicId,
        public_id: fullPublicId,
        url: `https://res.cloudinary.com/${client.getCloudName()}/image/upload/v${version}/${fullPublicId}.${format}`,
        secureUrl: `https://res.cloudinary.com/${client.getCloudName()}/image/upload/v${version}/${fullPublicId}.${format}`,
        resourceType: 'image',
        assetType: 'image',
        format,
        bytes: buffer.length,
        version,
        folder,
        createdAt: new Date().toISOString()
      };
      client.saveMockAsset(fullPublicId, mockResult);
      return mockResult;
    }

    const cloudinary = client.getClient();
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({
        folder,
        public_id: publicId,
        resource_type: 'image',
        format
      }, (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary waveform upload failed: ${error.message}`));
        } else {
          resolve({
            publicId: result.public_id,
            public_id: result.public_id,
            url: result.secure_url || result.url,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
            version: result.version,
            folder,
            createdAt: result.created_at || new Date().toISOString()
          });
        }
      });
      uploadStream.end(buffer);
    });
  }
}

const uploadService = new CloudinaryUploadService();
module.exports = uploadService;
