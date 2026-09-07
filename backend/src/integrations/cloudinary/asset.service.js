/**
 * EduBridge Adaptive - Cloudinary Asset Service
 *
 * Retrieves media metadata, checks asset existence, and lists resources.
 * Sanitizes all output to prevent secret leakage.
 */

const client = require('./client');
const logger = require('../../utils/logger');

class CloudinaryAssetService {
  /**
   * Retrieve asset metadata by public ID
   *
   * @param {string} publicId - Cloudinary asset public ID
   * @param {object} [options={}] - Options { resourceType: 'image' | 'video' | 'raw' }
   * @returns {Promise<object>} Sanitized asset metadata
   */
  async getAssetMetadata(publicId, options = {}) {
    if (!publicId) {
      throw new Error('publicId is required to retrieve asset metadata');
    }

    const resourceType = options.resourceType || 'image';

    // 1. Mock mode lookup
    if (client.isMockMode()) {
      const mockAsset = client.getMockAsset(publicId);
      if (mockAsset) {
        return {
          publicId: mockAsset.publicId,
          url: mockAsset.url,
          secureUrl: mockAsset.secureUrl,
          resourceType: mockAsset.resourceType || resourceType,
          format: mockAsset.format || 'jpg',
          bytes: mockAsset.bytes || 10240,
          width: mockAsset.width || (resourceType === 'image' ? 1600 : null),
          height: mockAsset.height || (resourceType === 'image' ? 2200 : null),
          duration: mockAsset.duration || (resourceType === 'video' ? 120.0 : null),
          context: mockAsset.context || {},
          tags: mockAsset.tags || [],
          createdAt: mockAsset.createdAt || new Date().toISOString()
        };
      }

      // Generated synthetic metadata for mock asset if not pre-stored
      const ext = resourceType === 'video' ? 'mp3' : 'jpg';
      return {
        publicId,
        url: `https://res.cloudinary.com/${client.getCloudName()}/${resourceType}/upload/${publicId}.${ext}`,
        secureUrl: `https://res.cloudinary.com/${client.getCloudName()}/${resourceType}/upload/${publicId}.${ext}`,
        resourceType,
        format: ext,
        bytes: 10240,
        width: resourceType === 'image' ? 1600 : null,
        height: resourceType === 'image' ? 2200 : null,
        duration: resourceType === 'video' ? 120.0 : null,
        context: {},
        tags: ['edubridge'],
        createdAt: new Date().toISOString()
      };
    }

    // 2. Live Cloudinary API call
    const cloudinary = client.getClient();
    try {
      const res = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        context: true,
        tags: true
      });

      return {
        publicId: res.public_id,
        url: res.url,
        secureUrl: res.secure_url,
        resourceType: res.resource_type,
        format: res.format,
        bytes: res.bytes,
        width: res.width,
        height: res.height,
        duration: res.duration,
        context: res.context ? res.context.custom || res.context : {},
        tags: res.tags || [],
        createdAt: res.created_at
      };
    } catch (error) {
      logger.error('[CloudinaryAsset] Failed to fetch asset metadata:', { publicId, error: error.message });
      throw new Error(`Cloudinary metadata retrieval failed for "${publicId}": ${error.message}`);
    }
  }

  /**
   * Check if an asset exists in Cloudinary
   */
  async assetExists(publicId, options = {}) {
    try {
      await this.getAssetMetadata(publicId, options);
      return true;
    } catch {
      return false;
    }
  }
}

const assetService = new CloudinaryAssetService();
module.exports = assetService;
