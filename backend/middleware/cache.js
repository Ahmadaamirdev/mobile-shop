// In-Memory Server-Side Response Cache for High Performance & Latency Reduction
const cacheStore = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// Middleware to serve cached GET responses in < 1ms
const cacheMiddleware = (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Bypass cache if client requested fresh data
  if (req.headers['cache-control'] === 'no-cache' || req.query._refresh === 'true') {
    return next();
  }

  const key = req.originalUrl || req.url;
  const cached = cacheStore.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Response-Time', '0ms');
    return res.status(200).json(cached.data);
  }

  // Intercept res.json to populate cache
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful 200 responses
    if (res.statusCode === 200 && body && body.success) {
      cacheStore.set(key, {
        timestamp: Date.now(),
        data: body,
      });
    }
    res.setHeader('X-Cache', 'MISS');
    return originalJson(body);
  };

  next();
};

// Invalidation helper for mutations (POST, PUT, DELETE)
const invalidateCache = (prefixOrPatterns = []) => {
  const patterns = Array.isArray(prefixOrPatterns) ? prefixOrPatterns : [prefixOrPatterns];
  for (const key of cacheStore.keys()) {
    for (const pattern of patterns) {
      if (key.includes(pattern)) {
        cacheStore.delete(key);
        break;
      }
    }
  }
};

// Middleware to automatically invalidate caches on write operations
const autoInvalidateMiddleware = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const url = req.originalUrl || req.url;
        if (url.includes('/purchases')) {
          invalidateCache(['/purchases', '/inventory', '/dashboard']);
        } else if (url.includes('/sales')) {
          invalidateCache(['/sales', '/inventory', '/invoices', '/dashboard']);
        } else if (url.includes('/inventory')) {
          invalidateCache(['/inventory', '/sales', '/purchases', '/dashboard']);
        } else if (url.includes('/invoices')) {
          invalidateCache(['/invoices', '/sales', '/dashboard']);
        } else {
          cacheStore.clear();
        }
      }
      return originalJson(body);
    };
  }
  next();
};

module.exports = {
  cacheMiddleware,
  autoInvalidateMiddleware,
  invalidateCache,
};
