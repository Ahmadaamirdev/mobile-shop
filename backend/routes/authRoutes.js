const express = require('express');
const router = express.Router();
const { signToken, requireAuth } = require('../middleware/auth');

// @desc    Sign in to Unity Mobile Management
// @route   POST /api/auth/login
router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};

  const validUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const validPassword = process.env.ADMIN_PASSWORD || 'unitymobile123';

  if (!username.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please enter both username and password.',
    });
  }

  if (username.trim().toLowerCase() !== validUsername || password !== validPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password.',
    });
  }

  const token = signToken({ username: validUsername, role: 'admin' });

  return res.status(200).json({
    success: true,
    token,
    user: { username: validUsername, role: 'admin' },
    message: 'Signed in successfully.',
  });
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
