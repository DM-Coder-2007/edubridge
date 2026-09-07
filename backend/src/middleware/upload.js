/**
 * EduBridge Adaptive - Multer File Upload Middleware
 */

const multer = require('multer');

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp'
];

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();
  const isImage = mime.startsWith('image/') || ALLOWED_IMAGE_TYPES.includes(mime);
  const isAudio = mime.startsWith('audio/') || 
                  ALLOWED_AUDIO_TYPES.includes(mime) || 
                  mime === 'video/webm' || 
                  mime.includes('webm') || 
                  mime.includes('wav') || 
                  mime.includes('mp3') || 
                  mime.includes('ogg');

  if (isImage || isAudio) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: ${file.mimetype}. Allowed types: images (JPEG, PNG, WEBP) and audio (MP3, WAV, WEBM, OGG).`);
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max
  }
});

module.exports = upload;
