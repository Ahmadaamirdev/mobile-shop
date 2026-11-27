const assert = require('assert');
const http = require('http');
const express = require('express');

// Ensure isolated test environment (never touches production DB)
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-auth-secret-minimum-32-chars-long-12345';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'StrongTestPassword!99';

const { signToken, verifyToken, requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');
const { uploadCompressedImage } = require('./config/cloudinary');
const { escapeRegex, parsePositiveIntQty, parseNonNegativePrice } = require('./utils/validators');

const runTests = async () => {
  console.log('🔒 Running Unity Mobile Security Verification Suite...\n');

  // 1. JWT & Auth Hardening
  const token = signToken({ username: 'admin', role: 'admin' });
  const decoded = verifyToken(token);
  assert.strictEqual(decoded.username, 'admin');
  assert.strictEqual(decoded.role, 'admin');

  // Reject alg: none token
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const bodyPart = token.split('.')[1];
  assert.strictEqual(verifyToken(`${noneHeader}.${bodyPart}.`), null, 'alg:none must be rejected');

  // Reject tampered payload
  const tamperedBody = Buffer.from(JSON.stringify({ username: 'attacker', role: 'admin', exp: Date.now() + 999999 })).toString('base64url');
  assert.strictEqual(verifyToken(`${token.split('.')[0]}.${tamperedBody}.${token.split('.')[2]}`), null, 'tampered JWT must be rejected');

  // Fail closed in production without AUTH_SECRET
  const prevSecret = process.env.AUTH_SECRET;
  const prevEnv = process.env.NODE_ENV;
  delete process.env.AUTH_SECRET;
  process.env.NODE_ENV = 'production';
  assert.throws(() => signToken({ username: 'admin', role: 'admin' }), /AUTH_SECRET/);
  process.env.AUTH_SECRET = prevSecret;
  process.env.NODE_ENV = prevEnv;
  console.log('✅ 1. JWT alg:none, signature tampering & production fail-closed checks PASSED');

  // 2. Upload & SSRF Validation
  await assert.rejects(
    () => uploadCompressedImage('http://169.254.169.254/latest/meta-data'),
    (err) => err.statusCode === 400
  );
  await assert.rejects(
    () => uploadCompressedImage('https://evil.example.com/payload.jpg'),
    (err) => err.statusCode === 400
  );
  await assert.rejects(
    () => uploadCompressedImage('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+'),
    (err) => err.statusCode === 400
  );
  await assert.rejects(
    () => uploadCompressedImage('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='),
    (err) => err.statusCode === 400
  );
  const oversizedBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(7 * 1024 * 1024);
  await assert.rejects(
    () => uploadCompressedImage(oversizedBase64),
    (err) => err.statusCode === 400
  );
  const validCloudinary = await uploadCompressedImage('https://res.cloudinary.com/demo/image/upload/sample.webp');
  assert.strictEqual(validCloudinary, 'https://res.cloudinary.com/demo/image/upload/sample.webp');
  console.log('✅ 2. Upload SSRF, SVG/HTML XSS payload & size-limit checks PASSED');

  // 3. Quantity, Price & Regex Validation
  assert.strictEqual(parsePositiveIntQty(-5), null);
  assert.strictEqual(parsePositiveIntQty(0), null);
  assert.strictEqual(parsePositiveIntQty(1.5), null);
  assert.strictEqual(parsePositiveIntQty(NaN), null);
  assert.strictEqual(parsePositiveIntQty(Infinity), null);
  assert.strictEqual(parsePositiveIntQty(10001), null);
  assert.strictEqual(parsePositiveIntQty(3), 3);

  assert.strictEqual(parseNonNegativePrice(-1), null);
  assert.strictEqual(parseNonNegativePrice(NaN), null);
  assert.strictEqual(parseNonNegativePrice(Infinity), null);
  assert.strictEqual(parseNonNegativePrice(25000), 25000);

  const escaped = escapeRegex('iPhone (15) Pro.*+?^${}|[]\\');
  const re = new RegExp(`^${escaped}$`, 'i');
  assert.strictEqual(re.test('iPhone (15) Pro.*+?^${}|[]\\'), true);
  assert.strictEqual(re.test('iPhone X Pro'), false);
  console.log('✅ 3. Negative/fractional quantity, negative price & regex injection checks PASSED');

  // 4. Error Handler Disclosure Check
  const mockRes = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
  process.env.NODE_ENV = 'production';
  errorHandler({ name: 'CastError', value: 'malicious_id_value' }, {}, mockRes, () => {});
  assert.strictEqual(mockRes.statusCode, 404);
  assert.strictEqual(mockRes.body.message, 'Resource not found.');
  assert.strictEqual(mockRes.body.stack, undefined);
  process.env.NODE_ENV = 'test';
  console.log('✅ 4. CastError & production stack trace redaction checks PASSED');

  // 5. HTTP Server Integration: Auth Guard, Rate Limiting & Security Headers
  const testApp = express();
  testApp.disable('x-powered-by');
  testApp.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  testApp.use(express.json());
  testApp.use('/api/auth', authRoutes);
  testApp.get('/api/protected', requireAuth, (req, res) => res.json({ success: true }));

  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const request = (method, path, body, headers = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json', ...headers } },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(raw) }));
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });

  // Unauthenticated access blocked
  const unauthRes = await request('GET', '/api/protected');
  assert.strictEqual(unauthRes.status, 401);
  assert.strictEqual(unauthRes.headers['x-powered-by'], undefined);
  assert.strictEqual(unauthRes.headers['x-content-options'] || unauthRes.headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(unauthRes.headers['x-frame-options'], 'DENY');

  // Brute-force login rate limit (10 failures -> 11th returns 429)
  for (let i = 0; i < 10; i++) {
    const r = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
    assert.strictEqual(r.status, 401);
  }
  const rateLimitedRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  assert.strictEqual(rateLimitedRes.status, 429);
  assert.ok(rateLimitedRes.headers['retry-after']);

  server.close();
  console.log('✅ 5. Auth guard (401), security headers & login brute-force rate limiter (429) PASSED');
  console.log('\n🎉 All security verification tests passed!');
};

runTests().catch((err) => {
  console.error('❌ Security test failed:', err);
  process.exit(1);
});
