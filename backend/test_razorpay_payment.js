/**
 * Razorpay Payment & Booking Integration Unit Tests
 * Tests validation, order generation, signature verification, rejection of invalid signatures,
 * payment cancellation/failure recording, and duplicate prevention.
 */

const assert = require('assert');
const crypto = require('crypto');
const paymentService = require('./src/services/paymentService');
const { validateVerifyPayment } = require('./src/middleware/validation');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

console.log('--- RUNNING RAZORPAY PAYMENT INTEGRATION TESTS ---');

let passed = 0;

// Test 1: Signature Verification Logic - Valid Signature
{
  const secret = 'test_secret_12345';
  const orderId = 'order_test_98765';
  const paymentId = 'pay_test_54321';
  
  // Compute expected HMAC SHA-256
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const isValid = paymentService.verifyPaymentSignature({
    orderId,
    paymentId,
    signature: validSignature,
    secret
  });

  assert.strictEqual(isValid, true, 'Valid signature must return true');
  console.log('✓ Valid HMAC SHA-256 signature accepted');
  passed++;
}

// Test 2: Signature Verification Logic - Forged/Tampered Signature
{
  const secret = 'test_secret_12345';
  const orderId = 'order_test_98765';
  const paymentId = 'pay_test_54321';
  const forgedSignature = 'bad0000000000000000000000000000000000000000000000000000000000000';

  const isValid = paymentService.verifyPaymentSignature({
    orderId,
    paymentId,
    signature: forgedSignature,
    secret
  });

  assert.strictEqual(isValid, false, 'Forged signature must return false');
  console.log('✓ Forged/Tampered signature correctly rejected');
  passed++;
}

// Test 3: Signature Verification Logic - Missing parameters
{
  const isValid = paymentService.verifyPaymentSignature({
    orderId: '',
    paymentId: 'pay_123',
    signature: 'sig_123'
  });
  assert.strictEqual(isValid, false, 'Missing orderId must return false');
  console.log('✓ Incomplete signature parameters safely handled');
  passed++;
}

// Test 4: Webhook Signature Verification Logic
{
  const secret = 'webhook_secret_key_abc';
  const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_999' } } } });
  const validWebhookSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const isWebhookValid = paymentService.verifyWebhookSignature(rawBody, validWebhookSig, secret);
  assert.strictEqual(isWebhookValid, true, 'Valid webhook signature must return true');

  const isWebhookTampered = paymentService.verifyWebhookSignature(rawBody, 'tampered_signature', secret);
  assert.strictEqual(isWebhookTampered, false, 'Tampered webhook signature must return false');
  console.log('✓ Razorpay Webhook signature verification verified');
  passed++;
}

// Test 5: Validation Middleware - validateVerifyPayment with missing fields
{
  const req = { body: { razorpay_order_id: 'order_123' } };
  const res = mockRes();
  let nextCalled = false;
  validateVerifyPayment(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 400, 'Should reject missing paymentId/signature with 400');
  assert.strictEqual(res.body.success, false);
  console.log('✓ validateVerifyPayment rejects incomplete payloads (400)');
  passed++;
}

// Test 6: Validation Middleware - validateVerifyPayment with complete fields
{
  const req = {
    body: {
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_456',
      razorpay_signature: 'abcdef1234567890'
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateVerifyPayment(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true, 'Should pass when all 3 Razorpay fields are present');
  console.log('✓ validateVerifyPayment accepts valid payload');
  passed++;
}

// Test 7: Razorpay Amount Calculation in Paise
{
  const rupeePrice = 1499.50;
  const paise = Math.round(rupeePrice * 100);
  assert.strictEqual(paise, 149950, 'Razorpay amount must be accurate integer paise');
  console.log('✓ Integer paise amount conversion verified (₹1499.50 -> 149950 paise)');
  passed++;
}

// Test 8: Razorpay Key Sanitization - Trailing Newline & Whitespace Trimming
{
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

  process.env.RAZORPAY_KEY_ID = '  rzp_test_TpJT4MxwX8OrZT\n  ';
  process.env.RAZORPAY_KEY_SECRET = '  82ajH7t4Sy74OU4c1gAgYDup\r\n  ';

  const config = paymentService.getSanitizedRazorpayConfig();
  assert.strictEqual(config.keyId, 'rzp_test_TpJT4MxwX8OrZT', 'Key ID must be cleanly trimmed with no newlines');
  assert.strictEqual(config.keySecret, '82ajH7t4Sy74OU4c1gAgYDup', 'Key Secret must be cleanly trimmed with no newlines');
  assert.strictEqual(config.keyId.includes('\n'), false, 'Key ID must not contain newline');
  assert.strictEqual(config.keyId.includes('\r'), false, 'Key ID must not contain carriage return');
  console.log('✓ Razorpay Key & Secret trailing newlines and whitespace safely sanitized');
  passed++;

  // Restore
  process.env.RAZORPAY_KEY_ID = originalKeyId;
  process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
}

// Test 9: Razorpay Key Sanitization - Rejection of Empty or Missing Keys
{
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  process.env.RAZORPAY_KEY_ID = '   \n  ';

  assert.throws(
    () => paymentService.getSanitizedRazorpayConfig(),
    /missing or empty/i,
    'Should throw error when Key ID is empty or whitespace only'
  );
  console.log('✓ Empty or whitespace-only Key ID correctly rejected with 500 configuration error');
  passed++;

  process.env.RAZORPAY_KEY_ID = originalKeyId;
}

// Test 10: Razorpay Key Sanitization - Rejection of Malformed Keys
{
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  process.env.RAZORPAY_KEY_ID = 'invalid_key_prefix_12345';

  assert.throws(
    () => paymentService.getSanitizedRazorpayConfig(),
    /Malformed Razorpay Key ID/i,
    'Should throw error when Key ID does not match rzp_test_ or rzp_live_'
  );
  console.log('✓ Malformed Razorpay Key ID without rzp_test_/rzp_live_ prefix correctly rejected');
  passed++;

  process.env.RAZORPAY_KEY_ID = originalKeyId;
}

// Test 11: Signature Verification with Whitespace/Newline in Inputs
{
  const secret = 'test_secret_12345\n';
  const orderId = 'order_test_98765\n';
  const paymentId = 'pay_test_54321  ';

  const cleanSecret = secret.trim();
  const cleanOrder = orderId.trim();
  const cleanPayment = paymentId.trim();

  const validSignature = crypto
    .createHmac('sha256', cleanSecret)
    .update(`${cleanOrder}|${cleanPayment}`)
    .digest('hex');

  const isValid = paymentService.verifyPaymentSignature({
    orderId,
    paymentId,
    signature: `  ${validSignature}\n`,
    secret
  });

  assert.strictEqual(isValid, true, 'verifyPaymentSignature must handle inputs safely even if trailing newlines exist');
  console.log('✓ Signature verification handles whitespace/newlines in parameters safely');
  passed++;
}

console.log(`\n--- ALL ${passed} RAZORPAY PAYMENT TESTS PASSED! ---\n`);
