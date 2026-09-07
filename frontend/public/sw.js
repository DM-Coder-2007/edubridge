/**
 * EduBridge Adaptive - Offline Audio Service Worker
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Do NOT cache everything automatically.
 * 2. Do NOT cache private user data indiscriminately.
 * 3. Do NOT store authentication credentials in the service worker.
 * 4. Do NOT cache API responses containing sensitive personal information.
 *
 * SCOPE:
 * Caches and serves only explicitly requested lesson audio assets
 * (e.g. Cloudinary media URLs) to enable accessible offline listening.
 */

const AUDIO_CACHE_NAME = 'edubridge-audio-cache-v1';

// Install event: claim immediately without delay
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: clean up outdated audio cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('edubridge-audio-') && name !== AUDIO_CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event: Strictly intercepts explicit audio stream requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Mandatory Guardrail: NEVER intercept or cache auth or API calls
  if (
    url.pathname.startsWith('/api/') ||
    request.headers.has('Authorization') ||
    request.method !== 'GET'
  ) {
    return; // Pass through directly to standard network
  }

  // 2. Only intercept audio streams (Cloudinary audio, .mp3, .wav, audio destination)
  const isCloudinaryAudio =
    url.hostname.includes('cloudinary.com') &&
    (url.pathname.includes('/audio/') ||
      url.pathname.endsWith('.mp3') ||
      url.pathname.endsWith('.wav') ||
      url.pathname.endsWith('.ogg'));

  const isAudioDestination = request.destination === 'audio';

  if (!isCloudinaryAudio && !isAudioDestination) {
    return; // Pass through untouched
  }

  // 3. Audio caching pipeline: Check CacheStorage first, fallback to network
  event.respondWith(
    caches.open(AUDIO_CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not yet explicitly cached, try fetching over network
      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch (err) {
        // When disconnected and not in cache, return an accessible offline notice
        return new Response('Audio stream unavailable while offline. Please download audio while connected.', {
          status: 503,
          statusText: 'Offline Audio Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })
  );
});
