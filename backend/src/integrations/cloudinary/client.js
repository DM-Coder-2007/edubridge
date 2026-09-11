/**
 * EduBridge Adaptive - Cloudinary Client & Connection Manager
 *
 * CRITICAL ARCHITECTURE RULE:
 * Cloudinary is the MANDATORY canonical media storage and delivery platform.
 * Stores original & processed textbook scans, Piper TTS narration, and audio waveforms.
 * Never stores binary media in Snowflake.
 *
 * SECURITY:
 * Never exposes CLOUDINARY_API_SECRET in logs, exported objects, or responses.
 */

const cloudinary = require('cloudinary').v2;
const logger = require('../../utils/logger');

class CloudinaryClient {
  constructor() {
    this._mockStore = new Map();
    this._init();
  }

  _init() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
    this.baseFolder = process.env.CLOUDINARY_FOLDER || 'edubridge';

    const forceMock = process.env.CLOUDINARY_MOCK_FALLBACK === 'true';
    const hasCredentials = Boolean(this.cloudName && this.apiKey && this.apiSecret);

    this._isMock = forceMock || !hasCredentials;

    if (!this._isMock) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true
      });
      logger.info(`[CloudinaryClient] Live Cloudinary client initialized for cloud: "${this.cloudName}"`);
    } else {
      logger.info('[CloudinaryClient] Initialized in MOCK/SIMULATION mode. Cloudinary is the mandatory media delivery platform.');
    }
  }

  /**
   * Get configured Cloudinary SDK instance
   */
  getClient() {
    return cloudinary;
  }

  /**
   * Whether running in mock/emulation mode
   */
  isMockMode() {
    return this._isMock;
  }

  /**
   * Set mock mode (useful for testing)
   */
  setMockMode(mock) {
    this._isMock = Boolean(mock);
  }

  getCloudName() {
    return this.cloudName || 'edubridge-cloud';
  }

  getBaseFolder() {
    return this.baseFolder;
  }

  /**
   * Return safe configuration sanitized of all credentials
   */
  getSafeConfig() {
    const rawKey = this.apiKey || process.env.CLOUDINARY_API_KEY || 'mock_api_key';
    return {
      cloudName: this.getCloudName(),
      apiKey: `${rawKey.slice(0, 4)}****`,
      baseFolder: this.baseFolder,
      secure: true,
      mode: this._isMock ? 'MOCK_EMULATION' : 'LIVE_CLOUDINARY'
    };
  }

  /**
   * Generate signed upload parameters for Cloudinary Upload Widget
   * @param {object} paramsToSign
   * @returns {{ signature: string, timestamp: number, apiKey: string, cloudName: string }}
   */
  generateSignature(paramsToSign = {}) {
    const timestamp = paramsToSign.timestamp || Math.round(Date.now() / 1000);
    const params = { ...paramsToSign, timestamp };
    const apiSecret = this.apiSecret || process.env.CLOUDINARY_API_SECRET || 'mock_secret';
    const apiKey = this.apiKey || process.env.CLOUDINARY_API_KEY || 'mock_api_key';

    // Cloudinary signature calculation via SDK
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    return {
      signature,
      timestamp,
      apiKey,
      cloudName: this.getCloudName()
    };
  }

  /**
   * Test connection to Cloudinary
   */
  async ping() {
    const startTime = Date.now();
    if (this._isMock) {
      return {
        status: 'ok',
        connected: true,
        mode: 'MOCK_EMULATION',
        latencyMs: Date.now() - startTime
      };
    }

    try {
      const pingResult = await cloudinary.api.ping();
      return {
        status: pingResult.status || 'ok',
        connected: true,
        mode: 'LIVE_CLOUDINARY',
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      logger.error('[CloudinaryClient] Ping failed:', { error: err.message });
      return {
        status: 'error',
        connected: false,
        mode: 'LIVE_CLOUDINARY',
        error: err.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  // --- Mock Store Accessors (isolated for testing and offline development) ---
  resetMockStore() {
    this._mockStore.clear();
  }

  saveMockAsset(publicId, asset) {
    this._mockStore.set(publicId, asset);
  }

  getMockAsset(publicId) {
    return this._mockStore.get(publicId);
  }

  deleteMockAsset(publicId) {
    return this._mockStore.delete(publicId);
  }

  listMockAssets() {
    return Array.from(this._mockStore.values());
  }
}

const client = new CloudinaryClient();
module.exports = client;
