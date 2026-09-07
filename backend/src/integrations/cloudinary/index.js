/**
 * EduBridge Adaptive - Cloudinary Integration Entrypoint
 *
 * Re-exports core services for modular consumption across the application.
 */

const client = require('./client');
const uploadService = require('./upload.service');
const transformationService = require('./transformation.service');
const assetService = require('./asset.service');
const deleteService = require('./delete.service');
const healthCheck = require('./healthCheck');

module.exports = {
  client,
  uploadService,
  transformationService,
  assetService,
  deleteService,
  healthCheck,

  // Top-level convenience delegates
  uploadTextbookImage: (buffer, opts) => uploadService.uploadTextbookImage(buffer, opts),
  uploadImage: (buffer, opts) => uploadService.uploadImage(buffer, opts),
  uploadAudio: (buffer, opts) => uploadService.uploadAudio(buffer, opts),
  uploadWaveform: (buffer, opts) => uploadService.uploadWaveform(buffer, opts),
  getOcrImageUrl: (id, opts) => transformationService.getOcrImageUrl(id, opts),
  getOptimizedImageUrl: (id, opts) => transformationService.getOptimizedImageUrl(id, opts),
  getThumbnailUrl: (id, opts) => transformationService.getThumbnailUrl(id, opts),
  getAudioUrl: (id, opts) => transformationService.getAudioUrl(id, opts),
  getWaveformUrl: (id, opts) => transformationService.getWaveformUrl(id, opts),
  generateImageTransformation: (id, opts) => transformationService.generateImageTransformation(id, opts),
  generateAccessibleImageUrl: (id, opts) => transformationService.generateAccessibleImageUrl(id, opts),
  generateWaveformUrl: (id, opts) => transformationService.generateWaveformUrl(id, opts),
  generateStreamingAudioUrl: (id, opts) => transformationService.generateStreamingAudioUrl(id, opts),
  getAssetMetadata: (id, opts) => assetService.getAssetMetadata(id, opts),
  assetExists: (id, opts) => assetService.assetExists(id, opts),
  deleteAsset: (id, opts) => deleteService.deleteAsset(id, opts),
  checkCloudinaryHealth: () => healthCheck.checkHealth()
};
