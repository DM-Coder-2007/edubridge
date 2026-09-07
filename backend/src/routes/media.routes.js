/**
 * EduBridge Adaptive - Media Routes
 *
 * REST Endpoints for Cloudinary Media Infrastructure:
 * - POST   /api/media/textbook
 * - GET    /api/media/textbook/:assetId
 * - DELETE /api/media/textbook/:assetId
 * - GET    /api/media/textbook/:assetId/ocr-url
 * - GET    /api/media/health
 * - POST   /api/media/audio
 * - GET    /api/media/audio/:audioId
 * - GET    /api/media/audio/:audioId/waveform
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { authenticate } = require('../middleware/auth.middleware');
const ApiResponse = require('../utils/apiResponse');

// Multer memory storage configured with 50MB limit
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max (enforced granularly in uploadService)
  }
});

/**
 * Normalizes uploaded file whether sent under 'image', 'audio', or generic 'file' field
 */
function handleMediaUpload(fieldNames = ['image', 'file']) {
  const fieldsConfig = fieldNames.map(name => ({ name, maxCount: 1 }));
  const multerFields = upload.fields(fieldsConfig);

  return (req, res, next) => {
    multerFields(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return ApiResponse.error(res, 400, 'File size exceeds maximum permitted limit.', 'FILE_TOO_LARGE');
        }
        return ApiResponse.error(res, 400, err.message, 'UPLOAD_ERROR');
      }

      if (req.files) {
        for (const field of fieldNames) {
          if (req.files[field] && req.files[field].length > 0) {
            req.file = req.files[field][0];
            break;
          }
        }
      }

      next();
    });
  };
}

// --------------------------------------------------------------------------
// 1. Health Check Endpoint (Public)
// --------------------------------------------------------------------------
router.get('/health', (req, res, next) => mediaController.getHealth(req, res, next));

// --------------------------------------------------------------------------
// 2. Textbook Image Endpoints (Authenticated)
// --------------------------------------------------------------------------
router.post(
  '/textbook',
  authenticate,
  handleMediaUpload(['image', 'file']),
  (req, res, next) => mediaController.uploadTextbook(req, res, next)
);

router.get(
  '/textbook/:assetId',
  authenticate,
  (req, res, next) => mediaController.getTextbook(req, res, next)
);

router.delete(
  '/textbook/:assetId',
  authenticate,
  (req, res, next) => mediaController.deleteTextbook(req, res, next)
);

router.get(
  '/textbook/:assetId/ocr-url',
  authenticate,
  (req, res, next) => mediaController.getOcrUrl(req, res, next)
);

// --------------------------------------------------------------------------
// 3. Audio Infrastructure Endpoints (Authenticated)
// --------------------------------------------------------------------------
router.post(
  '/audio',
  authenticate,
  handleMediaUpload(['audio', 'file']),
  (req, res, next) => mediaController.uploadAudio(req, res, next)
);

router.get(
  '/audio/:audioId',
  authenticate,
  (req, res, next) => mediaController.getAudio(req, res, next)
);

router.get(
  '/audio/:audioId/waveform',
  authenticate,
  (req, res, next) => mediaController.getWaveform(req, res, next)
);

// --------------------------------------------------------------------------
// 4. Backward Compatibility Aliases
// --------------------------------------------------------------------------
router.post(
  '/upload-textbook',
  authenticate,
  handleMediaUpload(['image', 'file']),
  (req, res, next) => mediaController.uploadTextbook(req, res, next)
);

router.post(
  '/upload-audio',
  authenticate,
  handleMediaUpload(['audio', 'file']),
  (req, res, next) => mediaController.uploadAudio(req, res, next)
);

router.get(
  '/accessible-transform',
  (req, res, next) => {
    const { publicId } = req.query;
    if (!publicId) {
      return ApiResponse.error(res, 400, 'publicId query parameter is required', 'MISSING_PARAM');
    }
    const highContrast = req.query.highContrast !== 'false';
    const invert = req.query.invert === 'true';
    const grayscale = req.query.grayscale === 'true';
    const zoomWidth = parseInt(req.query.zoomWidth || '1600', 10);

    const transformUrl = mediaController.generateAccessibleImageUrl ? 
      mediaController.generateAccessibleImageUrl(publicId, { highContrast, invert, grayscale, zoomWidth }) :
      `https://res.cloudinary.com/edubridge/image/upload/w_${zoomWidth},e_contrast:50/${publicId}`;

    return ApiResponse.success(res, 200, 'Accessible transform URL generated', {
      publicId,
      url: transformUrl,
      settings: { highContrast, invert, grayscale, zoomWidth }
    });
  }
);

module.exports = router;
