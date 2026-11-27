const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { signToken, requireAuth } = require('../middleware/auth');

// Sliding-window rate limiter for login brute-force protection
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const getClientIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const safeEqual = (a, b) => {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

// @desc    Sign in to Unity Mobile Management
// @route   POST /api/auth/login
router.post('/login', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now - entry.windowStart < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      message: 'Too many failed sign-in attempts. Please try again later.',
    });
  }

  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  if (isProd && (!envUser || !envPass)) {
    return res.status(503).json({
      success: false,
      message: 'Authentication service is not configured.',
    });
  }

  const validUsername = (envUser || 'admin').trim().toLowerCase();
  const validPassword = envPass || 'unitymobile123';

  const { username = '', password = '' } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please enter both username and password.',
    });
  }

  const userMatch = safeEqual(username.trim().toLowerCase(), validUsername);
  const passMatch = safeEqual(password, validPassword);

  if (!userMatch || !passMatch) {
    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      loginAttempts.set(ip, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password.',
    });
  }

  // Clear failed attempts on successful login
  loginAttempts.delete(ip);

  try {
    const token = signToken({ username: validUsername, role: 'admin' });
    return res.status(200).json({
      success: true,
      token,
      user: { username: validUsername, role: 'admin' },
      message: 'Signed in successfully.',
    });
  } catch {
    return res.status(503).json({
      success: false,
      message: 'Authentication service is not configured.',
    });
  }
});

// @desc    Verify active session token
// @route   GET /api/auth/verify
router.get('/verify', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: { username: req.user.username, role: req.user.role },
  });
});

module.exports = router;
