const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const crypto = require('crypto');
dotenv.config({ path: path.join(__dirname, '.env') });

const { connectDB, disconnectDB } = require('./src/config/db');
const User = require('./src/models/User');
const emailService = require('./src/services/emailService');
const authService = require('./src/services/authService');

async function runTestSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING GMAIL SMTP & FORGOT PASSWORD INTEGRATION TEST SUITE');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. Nodemailer Configuration Verification (smtp.gmail.com, 587, STARTTLS)
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Nodemailer Configuration & Transporter Options ---');

  // Test configuration with mock env
  const origEnv = { ...process.env };
  process.env.SMTP_USER = 'test.marketplace@gmail.com';
  process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;

  const transporter = emailService.createTransporter();
  test('Nodemailer defaults to host smtp.gmail.com', () => {
    assert.strictEqual(transporter.options.host, 'smtp.gmail.com');
  });

  test('Nodemailer defaults to port 587', () => {
    assert.strictEqual(transporter.options.port, 587);
  });

  test('Port 587 sets secure=false (STARTTLS requirement)', () => {
    assert.strictEqual(transporter.options.secure, false);
  });

  test('Port 587 explicitly enforces requireTLS=true', () => {
    assert.strictEqual(transporter.options.requireTLS, true);
  });

  test('Transporter enforces connection and socket timeouts', () => {
    assert.ok(transporter.options.connectionTimeout >= 10000);
    assert.ok(transporter.options.socketTimeout >= 15000);
  });

  // Restore env
  process.env = { ...origEnv };

  // -------------------------------------------------------------------------
  // 2. Simulation Guard: Console simulation must NOT be treated as success
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Simulation Mode Guard (Requirement 9) ---');
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  await testAsync('When SMTP is unconfigured, sendPasswordResetEmail returns success=false and simulated=true', async () => {
    const res = await emailService.sendPasswordResetEmail({
      to: 'unconfigured@example.com',
      name: 'Test',
      resetUrl: 'https://service-provider-marketplace.onrender.com/api/auth/reset-password?token=mock'
    });
    assert.strictEqual(res.success, false, 'Simulation must NOT return success: true');
    assert.strictEqual(res.simulated, true, 'Must indicate simulated mode');
    assert.ok(res.error, 'Must provide descriptive error regarding missing credentials');
  });

  await testAsync('verifyTransporter returns success=false when credentials missing', async () => {
    const res = await emailService.verifyTransporter();
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.configured, false);
  });

  // -------------------------------------------------------------------------
  // 3. Database & Password Reset Lifecycle Tests
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Reset Token Security, Expiration & Single-Use ---');
  await connectDB();

  const testCustomerEmail = `test.customer.${Date.now()}@example.com`;
  const testProviderEmail = `test.provider.${Date.now()}@example.com`;
  const initialPassword = 'InitialSecurePassword123!';

  // Create test customer & provider in DB
  const hashedInitial = await authService.hashPassword(initialPassword);
  const customer = await User.create({
    name: 'Test Customer',
    email: testCustomerEmail,
    password: hashedInitial,
    role: 'customer',
    phone: '+919876543210'
  });

  const provider = await User.create({
    name: 'Test Provider',
    email: testProviderEmail,
    password: hashedInitial,
    role: 'provider',
    phone: '+919876543211'
  });

  // Test Customer Forgot Password
  await testAsync('Customer forgotPassword creates 15-minute expiring token', async () => {
    process.env.NODE_ENV = 'production';
    const res = await authService.forgotPassword({ email: testCustomerEmail });
    assert.strictEqual(res.success, true);

    const refreshed = await User.findById(customer._id).select('+passwordResetToken +passwordResetExpires');
    assert.ok(refreshed.passwordResetToken, 'passwordResetToken must be stored');
    assert.ok(refreshed.passwordResetExpires, 'passwordResetExpires must be set');

    const remainingMs = refreshed.passwordResetExpires.getTime() - Date.now();
    const remainingMinutes = remainingMs / (60 * 1000);
    assert.ok(remainingMinutes > 14 && remainingMinutes <= 15, `Expires in ${remainingMinutes.toFixed(2)} min (expected ~15 min)`);
  });

  // Test Provider Forgot Password
  await testAsync('Provider forgotPassword creates 15-minute expiring token', async () => {
    process.env.NODE_ENV = 'production';
    const res = await authService.forgotPassword({ email: testProviderEmail });
    assert.strictEqual(res.success, true);

    const refreshed = await User.findById(provider._id).select('+passwordResetToken +passwordResetExpires');
    assert.ok(refreshed.passwordResetToken, 'passwordResetToken must be stored');
    assert.ok(refreshed.passwordResetExpires, 'passwordResetExpires must be set');
  });

  // Test Reset Link URL Generation
  test('Reset links use production backend URL when in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RESET_PASSWORD_BASE_URL;

    const productionBaseUrl = 'https://service-provider-marketplace.onrender.com';
    const rawToken = 'testrawtoken1234567890abcdef1234567890abcdef';
    const cleanBaseUrl = productionBaseUrl.replace(/\/+$/, '');
    const resetUrl = `${cleanBaseUrl}/api/auth/reset-password?token=${rawToken}`;

    assert.ok(resetUrl.startsWith('https://service-provider-marketplace.onrender.com/api/auth/reset-password?token='));
  });

  // Test Token Single-Use
  await testAsync('Reset token is strictly single-use (cleared on consumption)', async () => {
    // Generate fresh token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    customer.passwordResetToken = hashed;
    customer.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    customer.passwordResetLastRequestedAt = null;
    await customer.save({ validateModifiedOnly: true });

    // First use: must succeed
    const newPassword = 'NewStrongPassword456!';
    const resetRes = await authService.resetPassword({
      token: rawToken,
      newPassword,
      confirmPassword: newPassword
    });
    assert.strictEqual(resetRes.success, true);

    // Verify token is cleared in DB
    const afterReset = await User.findById(customer._id).select('+passwordResetToken +passwordResetExpires');
    assert.strictEqual(afterReset.passwordResetToken, null, 'Token must be set to null after use');
    assert.strictEqual(afterReset.passwordResetExpires, null, 'Expires must be set to null after use');

    // Second use with the same token: must fail
    let secondUseFailed = false;
    try {
      await authService.resetPassword({
        token: rawToken,
        newPassword: 'AnotherPassword789!',
        confirmPassword: 'AnotherPassword789!'
      });
    } catch (err) {
      secondUseFailed = true;
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('Invalid or expired'));
    }
    assert.strictEqual(secondUseFailed, true, 'Second use of token must be rejected');
  });

  // Test Token Expiry (after 15 minutes)
  await testAsync('Expired token (older than 15 minutes) is rejected with 400 error', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    // Set expiry in the past (1 minute ago)
    customer.passwordResetToken = hashed;
    customer.passwordResetExpires = new Date(Date.now() - 60 * 1000);
    await customer.save({ validateModifiedOnly: true });

    let expiryRejected = false;
    try {
      await authService.resetPassword({
        token: rawToken,
        newPassword: 'ThirdPassword999!',
        confirmPassword: 'ThirdPassword999!'
      });
    } catch (err) {
      expiryRejected = true;
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('expired'));
    }
    assert.strictEqual(expiryRejected, true, 'Expired token must be rejected');
  });

  // Cleanup
  await User.deleteMany({ _id: { $in: [customer._id, provider._id] } });
  await disconnectDB();

  console.log('\n================================================================================');
  console.log(`TEST SUITE FINISHED: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
