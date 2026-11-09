/**
 * COMPREHENSIVE AUTOMATED TEST SUITE:
 * Forgot Password & Reset Password System
 * 
 * Tests all 12 security and functional requirements:
 * 1. Valid registered email generates token & triggers email.
 * 2. Unregistered email returns identical generic 200 message (Enumeration prevention).
 * 3. Invalid email format returns 400 validation error.
 * 4. Expired reset token (> 15 mins) is rejected with 400.
 * 5. Reused reset token is rejected with 400.
 * 6. Invalid / malformed token is rejected with 400.
 * 7. Password confirmation mismatch rejected with 400.
 * 8. Successful password change updates password and invalidates token.
 * 9. Old password can no longer log in.
 * 10. New password logs in successfully.
 * 11. Multiple reset requests replace previous token (old token invalidated).
 * 12. Rate limiting / resend cooldown protection (subsequent requests within 60s suppressed).
 * Bonus: GET /api/auth/reset-password HTML page rendering.
 */

const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
process.env.NODE_ENV = 'test';

const app = require('./src/app');
const User = require('./src/models/User');
const authService = require('./src/services/authService');

function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================================');
  console.log('🔐 RUNNING FORGOT & RESET PASSWORD TEST SUITE');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);

  // Start HTTP server on dynamic port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[SETUP] Test Express server listening on http://127.0.0.1:${port}\n`);

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  // Seed test users
  const testEmailCustomer = `test_customer_forgot_${Date.now()}@example.com`;
  const initialPassword = 'InitialPass123!';
  const hashedPassword = await authService.hashPassword(initialPassword);

  const testCustomer = await User.create({
    name: 'Forgot Test Customer',
    email: testEmailCustomer,
    phone: `+919999${Math.floor(100000 + Math.random() * 900000)}`,
    password: hashedPassword,
    role: 'customer',
    isActive: true
  });

  console.log(`[TEST DATA] Created test user: ${testCustomer.email} (ID: ${testCustomer._id})\n`);

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Valid registered email generates token & triggers email
    // -------------------------------------------------------------------------
    console.log('Scenario 1: Valid registered email generates token & triggers email');
    const res1 = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: testEmailCustomer
    });

    assert(res1.status === 200, `Returns HTTP 200 (received ${res1.status})`);
    assert(res1.body.success === true, 'Response payload has success: true');
    assert(typeof res1.body.message === 'string', 'Response contains descriptive generic message');
    assert(Boolean(res1.body.testToken), 'Test environment receives testToken for assertion');

    const rawToken1 = res1.body.testToken;
    const hashedToken1 = crypto.createHash('sha256').update(rawToken1).digest('hex');

    const dbUser1 = await User.findById(testCustomer._id).select('+passwordResetToken +passwordResetExpires +passwordResetLastRequestedAt');
    assert(dbUser1.passwordResetToken === hashedToken1, 'DB stores SHA-256 hash of token, never the raw token');
    assert(dbUser1.passwordResetExpires instanceof Date, 'DB stores passwordResetExpires Date');
    const expiresInMinutes = (dbUser1.passwordResetExpires.getTime() - Date.now()) / (60 * 1000);
    assert(expiresInMinutes > 14 && expiresInMinutes <= 15, `Token expires in ~15 minutes (calculated: ${expiresInMinutes.toFixed(2)} mins)`);

    // -------------------------------------------------------------------------
    // Scenario 2: Unregistered email returns identical generic 200 message
    // -------------------------------------------------------------------------
    console.log('\nScenario 2: Unregistered email returns identical generic 200 message (Enumeration prevention)');
    const res2 = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: `non_existent_${Date.now()}@example.com`
    });

    assert(res2.status === 200, `Returns HTTP 200 for unregistered email (received ${res2.status})`);
    assert(res2.body.success === true, 'Response has success: true');
    assert(res2.body.message === res1.body.message, 'Returns identical message as registered email to prevent enumeration');
    assert(!res2.body.testToken, 'No token generated for unregistered user');

    // -------------------------------------------------------------------------
    // Scenario 3: Invalid email format returns 400 validation error
    // -------------------------------------------------------------------------
    console.log('\nScenario 3: Invalid email format returns 400 validation error');
    const res3a = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: 'not-an-email'
    });
    assert(res3a.status === 400, `Invalid email string returns HTTP 400 (received ${res3a.status})`);
    assert(res3a.body.success === false, 'Response has success: false');

    const res3b = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: ''
    });
    assert(res3b.status === 400, `Empty email string returns HTTP 400 (received ${res3b.status})`);

    // -------------------------------------------------------------------------
    // Scenario 4: Expired reset token (> 15 mins) is rejected with 400
    // -------------------------------------------------------------------------
    console.log('\nScenario 4: Expired reset token (> 15 mins) is rejected with 400');
    // Set token expiry to 1 minute in the past
    await User.findByIdAndUpdate(testCustomer._id, {
      passwordResetExpires: new Date(Date.now() - 60 * 1000)
    });

    const res4 = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: rawToken1,
      newPassword: 'NewSecurePassword123!',
      confirmPassword: 'NewSecurePassword123!'
    });
    assert(res4.status === 400, `Expired token returns HTTP 400 (received ${res4.status})`);
    assert(res4.body.error?.message?.toLowerCase().includes('expired'), 'Error message specifies token expiration');

    // Generate a fresh valid token for subsequent scenarios
    await User.findByIdAndUpdate(testCustomer._id, { passwordResetLastRequestedAt: null });
    const resFresh = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: testEmailCustomer
    });
    const freshToken = resFresh.body.testToken;
    assert(Boolean(freshToken), 'Generated fresh valid token for functional reset testing');

    // -------------------------------------------------------------------------
    // Scenario 5 & 6: Invalid / malformed token is rejected with 400
    // -------------------------------------------------------------------------
    console.log('\nScenario 5 & 6: Invalid / malformed token is rejected with 400');
    const res6a = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: 'completely_bogus_token_1234567890abcdef',
      newPassword: 'NewSecurePassword123!',
      confirmPassword: 'NewSecurePassword123!'
    });
    assert(res6a.status === 400, `Non-existent token returns HTTP 400 (received ${res6a.status})`);

    const res6b = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: '',
      newPassword: 'NewSecurePassword123!',
      confirmPassword: 'NewSecurePassword123!'
    });
    assert(res6b.status === 400, `Empty token returns HTTP 400 validation error (received ${res6b.status})`);

    // -------------------------------------------------------------------------
    // Scenario 7: Password confirmation mismatch rejected with 400
    // -------------------------------------------------------------------------
    console.log('\nScenario 7: Password confirmation mismatch rejected with 400');
    const res7 = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: freshToken,
      newPassword: 'PasswordOne123!',
      confirmPassword: 'PasswordDifferent456!'
    });
    assert(res7.status === 400, `Password mismatch returns HTTP 400 (received ${res7.status})`);
    assert(res7.body.error?.message?.toLowerCase().includes('match'), 'Error message specifies password mismatch');

    // Password length validation (< 6 chars)
    const res7b = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: freshToken,
      newPassword: '123',
      confirmPassword: '123'
    });
    assert(res7b.status === 400, `Password < 6 chars returns HTTP 400 (received ${res7b.status})`);

    // -------------------------------------------------------------------------
    // Scenario 8: Successful password change updates password and invalidates token
    // -------------------------------------------------------------------------
    console.log('\nScenario 8: Successful password change updates password and invalidates token');
    const brandNewPassword = 'BrandNewPassword#2026';
    const res8 = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: freshToken,
      newPassword: brandNewPassword,
      confirmPassword: brandNewPassword
    });

    assert(res8.status === 200, `Reset returns HTTP 200 (received ${res8.status})`);
    assert(res8.body.success === true, 'Response has success: true');

    const dbUserAfterReset = await User.findById(testCustomer._id).select('+passwordResetToken +passwordResetExpires +password');
    assert(dbUserAfterReset.passwordResetToken === null, 'passwordResetToken is wiped to null in DB');
    assert(dbUserAfterReset.passwordResetExpires === null, 'passwordResetExpires is wiped to null in DB');
    assert(dbUserAfterReset.passwordChangedAt instanceof Date, 'passwordChangedAt timestamp is recorded');

    // -------------------------------------------------------------------------
    // Scenario 5 Check: Reused reset token is rejected with 400
    // -------------------------------------------------------------------------
    console.log('\nScenario 5 Check: Reused reset token is rejected with 400');
    const resReused = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: freshToken,
      newPassword: 'YetAnotherPassword123!',
      confirmPassword: 'YetAnotherPassword123!'
    });
    assert(resReused.status === 400, `Reusing the same token returns HTTP 400 (received ${resReused.status})`);

    // -------------------------------------------------------------------------
    // Scenario 9: Old password can no longer log in
    // -------------------------------------------------------------------------
    console.log('\nScenario 9: Old password can no longer log in');
    const resOldLogin = await makeRequest(port, 'POST', '/api/auth/login/customer', {}, {
      email: testEmailCustomer,
      password: initialPassword
    });
    assert(resOldLogin.status === 401, `Login with old password returns HTTP 401 (received ${resOldLogin.status})`);

    // -------------------------------------------------------------------------
    // Scenario 10: New password logs in successfully
    // -------------------------------------------------------------------------
    console.log('\nScenario 10: New password logs in successfully');
    const resNewLogin = await makeRequest(port, 'POST', '/api/auth/login/customer', {}, {
      email: testEmailCustomer,
      password: brandNewPassword
    });
    assert(resNewLogin.status === 200, `Login with new password returns HTTP 200 (received ${resNewLogin.status})`);
    assert(Boolean(resNewLogin.body.data?.token), 'Login response contains JWT auth token');
    assert(resNewLogin.body.data?.user?.email === testEmailCustomer, 'User email matches in session');

    // -------------------------------------------------------------------------
    // Scenario 11: Multiple reset requests replace previous token (old token invalidated)
    // -------------------------------------------------------------------------
    console.log('\nScenario 11: Multiple reset requests replace previous token (old token invalidated)');
    // First, clear cooldown so we can request token A
    await User.findByIdAndUpdate(testCustomer._id, { passwordResetLastRequestedAt: null });

    const resTokenA = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: testEmailCustomer
    });
    const tokenA = resTokenA.body.testToken;
    assert(Boolean(tokenA), 'Generated Token A');

    // Clear cooldown to allow immediate second request
    await User.findByIdAndUpdate(testCustomer._id, { passwordResetLastRequestedAt: null });

    const resTokenB = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: testEmailCustomer
    });
    const tokenB = resTokenB.body.testToken;
    assert(Boolean(tokenB) && tokenB !== tokenA, 'Generated Token B (different from Token A)');

    // Attempting to use Token A must now FAIL
    const resUseTokenA = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: tokenA,
      newPassword: 'AttemptPassA#123',
      confirmPassword: 'AttemptPassA#123'
    });
    assert(resUseTokenA.status === 400, `Old Token A is rejected with HTTP 400 (received ${resUseTokenA.status})`);

    // Token B must SUCCEED
    const resUseTokenB = await makeRequest(port, 'POST', '/api/auth/reset-password', {}, {
      token: tokenB,
      newPassword: 'FinalPassword#2026',
      confirmPassword: 'FinalPassword#2026'
    });
    assert(resUseTokenB.status === 200, `New Token B succeeds with HTTP 200 (received ${resUseTokenB.status})`);

    // -------------------------------------------------------------------------
    // Scenario 12: Rate limiting / resend cooldown protection
    // -------------------------------------------------------------------------
    console.log('\nScenario 12: Rate limiting / resend cooldown protection');
    // Request a reset link
    await User.findByIdAndUpdate(testCustomer._id, { passwordResetLastRequestedAt: null });
    const resInitialRate = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: testEmailCustomer
    });
    assert(resInitialRate.status === 200 && Boolean(resInitialRate.body.testToken), 'Initial reset request succeeds');

    // Immediately request again (within 60 seconds)
    const resCooldownRate = await makeRequest(port, 'POST', '/api/auth/forgot-password', {}, {
      email: testEmailCustomer
    });
    assert(resCooldownRate.status === 200, 'Returns identical generic 200 during cooldown');
    assert(!resCooldownRate.body.testToken, 'Token generation suppressed during cooldown');

    // -------------------------------------------------------------------------
    // Scenario 13: GET /api/auth/reset-password HTML page rendering
    // -------------------------------------------------------------------------
    console.log('\nScenario 13: GET /api/auth/reset-password HTML page rendering');
    const resHtml = await makeRequest(port, 'GET', `/api/auth/reset-password?token=${resInitialRate.body.testToken}`);
    assert(resHtml.status === 200, `HTML endpoint returns HTTP 200 (received ${resHtml.status})`);
    assert(typeof resHtml.body === 'string' && resHtml.body.includes('<!DOCTYPE html>'), 'Returns valid HTML document');
    assert(resHtml.body.includes('Reset Password') && resHtml.body.includes('Confirm New Password'), 'Contains reset password form elements');

  } finally {
    // Clean up test data
    await User.findByIdAndDelete(testCustomer._id);
    console.log('\n[TEARDOWN] Cleaned up test user');

    server.close();
    await mongoose.disconnect();
    console.log('[TEARDOWN] Closed server and disconnected MongoDB');
  }

  console.log('\n================================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
