/**
 * EduBridge Adaptive - Cloudinary Delivery URL Optimizer
 *
 * Transforms raw Cloudinary image and audio URLs into optimized delivery URLs:
 * - f_auto: Serves modern formats (AVIF / WebP / WebM) automatically based on browser capabilities
 * - q_auto: Intelligent perceptual compression reducing bandwidth by up to 70% with zero visible artifacting
 * - w_{width}, c_limit: Dynamically downscales raw high-res camera scans to display dimensions
 */

import { isSafeUrl } from './security.js';

export function getOptimizedCloudinaryUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;

  // Validate URL protocol safety (blocks javascript:, data:, vbscript:)
  if (!isSafeUrl(url)) {
    return null;
  }

  // Only transform Cloudinary asset URLs
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }

  // If transformations are already configured, return URL as-is
  if (url.includes('/f_auto') || url.includes('/q_auto')) {
    return url;
  }

  const { width = 800, height = null, quality = 'auto', format = 'auto' } = options;

  const transforms = [];
  if (format) transforms.push(`f_${format}`);
  if (quality) transforms.push(`q_${quality}`);
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  transforms.push('c_limit');

  const transformString = transforms.join(',');
  return url.replace('/upload/', `/upload/${transformString}/`);
}

/**
 * Specifically optimizes thumbnail scans for cards and grid displays (max width 500px)
 */
export function getOptimizedThumbnailUrl(url, width = 500) {
  return getOptimizedCloudinaryUrl(url, { width, quality: 'auto', format: 'auto' });
}

/**
 * Optimizes high-res diagram illustrations and scan overlays (max width 1200px)
 */
export function getOptimizedDiagramUrl(url, width = 1200) {
  return getOptimizedCloudinaryUrl(url, { width, quality: 'auto', format: 'auto' });
}
