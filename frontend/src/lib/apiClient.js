import { API_BASE_URL } from '../config/api.js';

/**
 * In-memory response cache for safe GET endpoints.
 * Never caches sensitive authentication or credential endpoints.
 * Bounded with max 100 entries to prevent memory leaks.
 */
const apiCache = new Map();
const MAX_CACHE_ENTRIES = 100;
const DEFAULT_CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * In-flight promise map for deduplicating concurrent identical GET requests.
 */
const inFlightRequests = new Map();

/**
 * Endpoints that should never be cached due to security or real-time requirement.
 */
const SENSITIVE_ENDPOINTS = [
  '/api/auth',
  '/auth',
  '/login',
  '/signup',
  '/logout'
];

function isCacheable(endpoint, method, options) {
  if (method !== 'GET') return false;
  if (options.noCache || options.bypassCache) return false;
  const isSensitive = SENSITIVE_ENDPOINTS.some((prefix) => endpoint.includes(prefix));
  return !isSensitive;
}

function enforceMaxCacheEntries() {
  if (apiCache.size > MAX_CACHE_ENTRIES) {
    // Evict oldest entries (FIFO)
    const keysToRemove = Array.from(apiCache.keys()).slice(0, 20);
    keysToRemove.forEach((k) => apiCache.delete(k));
  }
}

/**
 * Standardized API client for communicating with the Express backend.
 * Never connects directly to Snowflake, Gemini, Cloudinary private keys, Piper, or Whisper.
 * Always passes credentials: 'include' for HttpOnly JWT session cookies.
 */
class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Clear in-memory response cache
   */
  clearCache(pattern) {
    if (!pattern) {
      apiCache.clear();
      return;
    }
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of apiCache.keys()) {
      if (regex.test(key)) {
        apiCache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache on mutations (POST, PUT, PATCH, DELETE)
   */
  invalidateCacheForMutation(endpoint) {
    // Invalidate related caches when data changes
    if (endpoint.includes('/progress')) {
      this.clearCache(/progress|lessons/);
    } else if (endpoint.includes('/lessons')) {
      this.clearCache(/lessons|progress/);
    } else if (endpoint.includes('/textbooks')) {
      this.clearCache(/textbooks|lessons/);
    } else {
      // General mutation: clear cache to guarantee consistency
      this.clearCache();
    }
  }

  /**
   * Internal request handler with deduplication and caching
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();

    // 1. Check in-memory cache for safe GET requests
    if (isCacheable(url, method, options)) {
      const cacheKey = `GET:${url}`;
      const cached = apiCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return typeof structuredClone === 'function'
          ? structuredClone(cached.data)
          : JSON.parse(JSON.stringify(cached.data));
      }
      if (cached) {
        apiCache.delete(cacheKey);
      }
    }

    // 2. Check in-flight request deduplication for GET requests
    if (method === 'GET' && !options.bypassDeduplication) {
      const inFlightKey = `IN_FLIGHT:${url}`;
      if (inFlightRequests.has(inFlightKey)) {
        return inFlightRequests.get(inFlightKey);
      }

      const requestPromise = this._executeRequest(url, endpoint, method, options);
      inFlightRequests.set(inFlightKey, requestPromise);

      try {
        return await requestPromise;
      } finally {
        inFlightRequests.delete(inFlightKey);
      }
    }

    return this._executeRequest(url, endpoint, method, options);
  }

  /**
   * Raw request executor
   */
  async _executeRequest(url, endpoint, method, options) {
    const headers = {
      Accept: 'application/json',
      ...options.headers
    };

    // If body is not FormData, default to JSON
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    let body = options.body;
    if (!isFormData && body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const config = {
      ...options,
      method,
      headers,
      body,
      credentials: 'include' // Mandatory for HttpOnly JWT cookie authentication
    };

    try {
      const response = await fetch(url, config);

      let json = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        json = await response.json();
      }

      if (!response.ok) {
        // Handle 401 Unauthorized: invalidate session caches and notify auth listeners
        if (response.status === 401) {
          this.clearCache();
          if (typeof window !== 'undefined' && !endpoint.includes('/auth/me')) {
            window.dispatchEvent(new CustomEvent('edubridge:unauthorized', {
              detail: { status: 401, endpoint }
            }));
          }
        }

        const errorMessage = json?.message || json?.error?.message || `HTTP ${response.status} Request failed`;
        const errorCode = json?.error?.code || (response.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR');
        const errorDetails = json?.error?.details || null;

        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = errorCode;
        error.details = errorDetails;
        throw error;
      }

      const result = json?.data !== undefined ? json.data : json;

      // Invalidate cache on mutations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        this.invalidateCacheForMutation(endpoint);
      }

      // Populate cache for cacheable GET requests
      if (isCacheable(url, method, options)) {
        const cacheKey = `GET:${url}`;
        const ttl = options.cacheTTL || DEFAULT_CACHE_TTL_MS;
        enforceMaxCacheEntries();
        apiCache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + ttl
        });
      }

      return result;
    } catch (err) {
      if (!err.status && err.name === 'TypeError') {
        err.message = 'Unable to connect to EduBridge server. Please ensure the backend is running.';
        err.code = 'NETWORK_ERROR';
      }
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Helper for file/audio uploads using multipart/form-data
   */
  upload(endpoint, formData, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: formData
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
