/**
 * EduBridge Adaptive - Frontend Security Utilities
 *
 * Implements defensive validation and sanitization:
 * - URL scheme whitelisting (prevents javascript:, data:, and file: XSS vectors)
 * - Path traversal prevention & filename sanitization
 * - Strict client-side file upload inspection (disallowing SVG scripts & dangerous executables)
 */

const ALLOWED_PROTOCOLS = ['https:', 'http:', 'blob:'];
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp'
];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp'];
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Validates that a URL is safe for rendering in href or src attributes.
 * Prevents javascript: pseudo-protocol, vbscript:, data:text/html, and control characters.
 *
 * @param {string} url - Target URL to inspect
 * @returns {boolean} True if safe, false otherwise
 */
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();

  // Allow relative URLs starting with / or # (internal navigation)
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    // Disallow protocol-relative URLs like '//evil.com'
    if (trimmed.startsWith('//')) return false;
    // Disallow control characters
    if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) return false;
    return true;
  }

  try {
    const parsed = new URL(trimmed, 'https://edubridge.invalid');
    const protocol = parsed.protocol.toLowerCase();

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(protocol)) {
      return false;
    }

    // In production, block plain http: unless it's localhost
    if (
      protocol === 'http:' &&
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      !parsed.hostname.includes('localhost')
    ) {
      // In production enforce HTTPS for external media
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL, returning a fallback if the URL fails safety checks.
 */
export function sanitizeUrl(url, fallback = '') {
  return isSafeUrl(url) ? url.trim() : fallback;
}

/**
 * Sanitizes filenames to prevent path traversal and shell injection
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'unnamed_file';
  // Remove directory traversals, backslashes, control characters
  return filename
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim()
    .slice(0, 200) || 'unnamed_file';
}

/**
 * Validates an uploaded File object before sending to Express backend.
 * Rejects untrusted MIME types, disallowed extensions, oversized files, and SVG scripts.
 */
export function validateUploadFile(file) {
  if (!file) {
    throw new Error('No file selected.');
  }

  // 1. File size check
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`File size (${sizeMb} MB) exceeds maximum permitted limit of 25 MB.`);
  }

  // 2. MIME type check
  const mimeType = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Unsupported file format (${file.type || 'unknown'}). Please upload a JPEG, PNG, WEBP, TIFF, or BMP image.`
    );
  }

  // 3. Extension check (prevent extension spoofing e.g. malicious.svg renamed with image/png MIME)
  const name = (file.name || '').toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!hasValidExt) {
    throw new Error('File extension does not match permitted image formats (.jpg, .jpeg, .png, .webp, .tiff, .bmp).');
  }

  // 4. Strict SVG prohibition
  if (mimeType.includes('svg') || name.endsWith('.svg')) {
    throw new Error('SVG format is not supported for textbook scans due to script security policies.');
  }

  return true;
}
