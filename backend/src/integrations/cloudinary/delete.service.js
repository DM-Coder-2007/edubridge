/**
 * EduBridge Adaptive - Cloudinary Delete Service
 *
 * Safely removes media assets from Cloudinary with optional CDN cache invalidation.
 */

const client = require('./client');
const logger = require('../../utils/logger');

class CloudinaryDeleteService {
  /**
   * Delete an asset from Cloudinary
   *
   * @param {string} publicId - Asset public ID
   * @param {object} [options={}] - Options { resourceType: 'image' | 'video' | 'raw', invalidate: boolean }
   * @returns {Promise<object>} Result { success: boolean, result: string, publicId: string }
   */
  async deleteAsset(publicId, options = {}) {
    if (!publicId) {
      throw new Error('publicId is required to delete an asset');
    }

    const {
      resourceType = 'image',
      invalidate = true
    } = options;

    if (client.isMockMode()) {
      client.deleteMockAsset(publicId);
      logger.info(`[CloudinaryDelete] [MOCK] Deleted asset: ${publicId} (${resourceType})`);
      return {
        success: true,
        result: 'ok',
        publicId
      };
    }

    const cloudinary = client.getClient();
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate
      });

      const isSuccess = res.result === 'ok' || res.result === 'not found';
      logger.info(`[CloudinaryDelete] Deletion response for ${publicId}: ${res.result}`);
      return {
        success: isSuccess,
        result: res.result,
        publicId
      };
    } catch (error) {
      logger.error('[CloudinaryDelete] Failed to delete asset:', { publicId, error: error.message });
      throw new Error(`Cloudinary asset deletion failed for "${publicId}": ${error.message}`);
    }
  }
}

const deleteService = new CloudinaryDeleteService();
module.exports = deleteService;
