const assert = require('assert');
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken, getJwtSecret } = require('./src/utils/jwt');
const { hashPassword, comparePassword, formatSafeUser } = require('./src/services/authService');
const { authenticate, requireRole } = require('./src/middleware/auth');

console.log('--- RUNNING PHASE 3 AUTHENTICATION UNIT TESTS ---');

async function runTests() {
  // 1. Password Hashing & Safe Comparison
  const rawPass = 'SecretP@ssword123';
  const hashed = await hashPassword(rawPass);
  assert.notStrictEqual(hashed, rawPass, 'Hash must not match raw password');
  assert.ok(hashed.startsWith('$2'), 'Hash must be valid bcrypt hash');
  
  const isMatch = await comparePassword(rawPass, hashed);
  assert.strictEqual(isMatch, true, 'Valid password must match hash');

  const isBadMatch = await comparePassword('WrongPassword!', hashed);
  assert.strictEqual(isBadMatch, false, 'Invalid password must not match hash');
  console.log('✓ Password hashing and verification passed');

  // 2. formatSafeUser must NEVER return password or __v
  const mockUser = {
    _id: 'mock_id_1',
    name: 'Alice',
    email: 'alice@example.com',
    password: '$2a$10$hashedpasswordhere',
    role: 'customer',
    __v: 0
  };
  const mockCustomer = {
    _id: 'cust_id_1',
    user: 'mock_id_1',
    addresses: [],
    __v: 0
  };
  const safeFormatted = formatSafeUser(mockUser, mockCustomer);
  assert.strictEqual(safeFormatted.user.password, undefined, 'Password must be completely stripped');
  assert.strictEqual(safeFormatted.user.__v, undefined, '__v must be stripped');
  assert.strictEqual(safeFormatted.profile.__v, undefined, 'profile __v must be stripped');
  assert.strictEqual(safeFormatted.user.email, 'alice@example.com');
  console.log('✓ Sensitive field stripping (password hash exclusion) passed');

  // 3. JWT Generation, Verification & Expiry
  const payload = { userId: 'user_123', email: 'test@example.com', role: 'customer' };
  const token = generateToken(payload, '1h');
  assert.ok(typeof token === 'string' && token.length > 20, 'Token must be valid JWT string');

  const decoded = verifyToken(token);
  assert.strictEqual(decoded.userId, 'user_123');
  assert.strictEqual(decoded.email, 'test@example.com');
  assert.strictEqual(decoded.role, 'customer');
  console.log('✓ JWT token generation and verification passed');

  // Expired token test
  const expiredToken = jwt.sign(payload, getJwtSecret(), { expiresIn: '1ms' });
  await new Promise(r => setTimeout(r, 20));
  let threwExpired = false;
  try {
    verifyToken(expiredToken);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      threwExpired = true;
    }
  }
  assert.strictEqual(threwExpired, true, 'Expired token must throw TokenExpiredError');
  console.log('✓ Expired JWT rejection passed');

  // Invalid signature test
  let threwBadSig = false;
  try {
    jwt.verify(token, 'wrong-secret-key');
  } catch (err) {
    threwBadSig = true;
  }
  assert.strictEqual(threwBadSig, true, 'Invalid signature must be rejected');
  console.log('✓ Invalid signature JWT rejection passed');

  // 4. Role Authorization Middleware Factory Unit Tests
  const customerUser = { role: 'customer' };
  const providerUser = { role: 'provider' };
  const adminUser = { role: 'admin' };

  let nextCalled = false;
  const mockNext = () => { nextCalled = true; };
  let resStatus = 0;
  let resJson = null;
  const mockRes = {
    status: (code) => { resStatus = code; return mockRes; },
    json: (obj) => { resJson = obj; }
  };

  // Test Admin Access with Customer User -> Should be 403 Forbidden
  nextCalled = false;
  resStatus = 0;
  const adminGuard = requireRole('admin');
  adminGuard({ user: customerUser }, mockRes, mockNext);
  assert.strictEqual(nextCalled, false, 'Customer must not pass admin guard');
  assert.strictEqual(resStatus, 403, 'Should respond with 403 Forbidden');
  console.log('✓ Role authorization: Customer denied admin access passed (403)');

  // Test Customer Access with Provider User -> Should be 403 Forbidden
  nextCalled = false;
  resStatus = 0;
  const customerGuard = requireRole('customer');
  customerGuard({ user: providerUser }, mockRes, mockNext);
  assert.strictEqual(nextCalled, false, 'Provider must not pass customer guard');
  assert.strictEqual(resStatus, 403, 'Should respond with 403 Forbidden');
  console.log('✓ Role authorization: Provider denied customer access passed (403)');

  // Test Admin Access with Admin User -> Should succeed
  nextCalled = false;
  resStatus = 0;
  adminGuard({ user: adminUser }, mockRes, mockNext);
  assert.strictEqual(nextCalled, true, 'Admin user must pass admin guard');
  console.log('✓ Role authorization: Admin granted admin access passed');

  // 5. Authenticate Middleware without Token -> Should be 401 Unauthorized
  let authStatus = 0;
  let authJson = null;
  const authRes = {
    status: (code) => { authStatus = code; return authRes; },
    json: (obj) => { authJson = obj; }
  };
  let authNextCalled = false;
  await authenticate({ headers: {} }, authRes, () => { authNextCalled = true; });
  assert.strictEqual(authNextCalled, false, 'Missing token must not call next()');
  assert.strictEqual(authStatus, 401, 'Missing token must return 401');
  console.log('✓ Protected route without token rejected passed (401)');

  console.log('--- ALL PHASE 3 UNIT TESTS COMPLETED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
