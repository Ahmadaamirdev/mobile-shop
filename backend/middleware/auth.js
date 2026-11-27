const crypto = require('crypto');

// Ephemeral per-process fallback only for local non-production dev when AUTH_SECRET is unset
let devFallbackSecret = null;

const getAuthSecret = () => {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim().length >= 8) {
    return process.env.AUTH_SECRET.trim();
  }
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isProd) {
    throw new Error('AUTH_SECRET environment variable must be configured in production.');
  }
  if (!devFallbackSecret) {
    devFallbackSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ AUTH_SECRET is not set. Using an ephemeral dev-only secret for this process.');
  }
  return devFallbackSecret;
};

const signToken = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
};

const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  // Enforce strict HS256 JWT header
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (!parsedHeader || parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') {
      return null;
    }
  } catch {
    return null;
  }

  let expectedSig;
  try {
    expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(`${header}.${body}`)
      .digest('base64url');
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!decoded.exp || Date.now() > decoded.exp) return null;
    if (!decoded.role || decoded.role !== 'admin') return null;
    return decoded;
  } catch {
    return null;
  }
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.',
    });
  }

  req.user = decoded;
  next();
};

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
};
