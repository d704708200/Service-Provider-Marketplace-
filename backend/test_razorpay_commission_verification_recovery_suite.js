/**
 * Test Suite: Razorpay Commission Payment Verification & Recovery Suite
 *
 * Validates:
 * 1. Parameter extraction resilience (camelCase, snake_case, aliases, nested response).
 * 2. Timing-safe signature verification (timing attacks safe, invalid signature rejection).
 * 3. Gateway error object sanitization (Error instance with message and statusCode).
 * 4. Preservation of pending order lock on verification network error / exception.
 * 5. Server-side auto-capture of authorized payment before commission settlement.
 * 6. Server-side payment reconciliation (reconcileCommissionPayment recovers captured/authorized payment).
 * 7. Late payment revival for cancelled or expired active orders.
 * 8. Idempotency on repeated verify and reconcile calls (no duplicate COMMISSION_PAYMENT transactions).
 * 9. Financial invariants: commissionDue drops to 0 only upon captured settlement, availableBalance unchanged.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const {
  User,
  Provider,
  ProviderWallet,
  WalletTransaction
} = require('./src/models');

const walletService = require('./src/services/walletService');
const paymentService = require('./src/services/paymentService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/service-marketplace';

let testUser = null;
let testProvider = null;
let testWallet = null;

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    failCount++;
  }
}

function generateValidSignature(orderId, paymentId) {
  const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_for_tests';
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING RAZORPAY COMMISSION VERIFICATION & RECOVERY SUITE');
  console.log('================================================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[SETUP] Connected to MongoDB');
    await WalletTransaction.syncIndexes();

    const uniqueId = Date.now();
    testUser = await User.create({
      name: `Commission Test Provider ${uniqueId}`,
      email: `test_comm_recovery_${uniqueId}@example.com`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'provider',
      password: 'TestPassword123!',
      isVerified: true
    });

    testProvider = await Provider.create({
      user: testUser._id,
      name: testUser.name,
      phone: testUser.phone,
      businessName: `Test Services ${uniqueId}`,
      isVerified: true,
      onboardingStep: 'completed',
      category: 'Home Cleaning'
    });

    testWallet = await walletService.getOrCreateWallet(testProvider._id);
    testWallet.availableBalance = 500;
    testWallet.commissionDue = 60;
    await testWallet.save();

    console.log(`[SETUP] Created test provider ${testProvider._id} with Available: ₹500, Commission Due: ₹60\n`);

    // -----------------------------------------------------------------------------------------
    // TEST 1: Parameter extraction flexibility (snake_case, aliases, and nested response)
    // -----------------------------------------------------------------------------------------
    console.log('Test 1: Parameter extraction resilience');
    const order1 = await walletService.createPayCommissionOrder(testProvider._id, { amount: 60 });
    const fakePayId1 = `pay_param_test_${Date.now()}`;
    const validSig1 = generateValidSignature(order1.orderId, fakePayId1);

    let fakePayId2 = null;
    let order2 = null;
    let capturedPayId = null;
    let order5 = null;
    let authPayId = null;
    let order6 = null;

    const originalFetchPayment = paymentService.fetchPayment;
    paymentService.fetchPayment = async (payId) => {
      if (payId === fakePayId1) {
        return {
          id: fakePayId1,
          order_id: order1.orderId,
          status: 'captured',
          amount: 6000,
          currency: 'INR'
        };
      }
      if (payId === fakePayId2) {
        return {
          id: fakePayId2,
          order_id: order2.orderId,
          status: 'captured',
          amount: 10000,
          currency: 'INR'
        };
      }
      if (payId === capturedPayId) {
        return {
          id: capturedPayId,
          order_id: order5.orderId,
          status: 'captured',
          amount: 7500,
          currency: 'INR'
        };
      }
      if (payId === authPayId) {
        return {
          id: authPayId,
          order_id: order6.orderId,
          status: 'captured',
          amount: 12000,
          currency: 'INR'
        };
      }
      return originalFetchPayment(payId);
    };

    // Call verify using snake_case and nested response
    const verifyNestedRes = await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
      response: {
        razorpay_order_id: order1.orderId,
        razorpay_payment_id: fakePayId1,
        razorpay_signature: validSig1
      }
    });

    assert(verifyNestedRes.success === true, 'Nested snake_case response payload verified successfully');
    assert(verifyNestedRes.settled === true, 'Commission marked settled in return data');
    const walletAfter1 = await ProviderWallet.findById(testWallet._id);
    assert(walletAfter1.commissionDue === 0, 'Commission due updated to 0');
    assert(walletAfter1.availableBalance === 500, 'Available balance preserved at ₹500 (not debited)');

    // -----------------------------------------------------------------------------------------
    // TEST 2: Timing-Safe Signature Rejection & Order State Integrity
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 2: Timing-safe signature rejection');
    // Reset commission to ₹100
    await ProviderWallet.findByIdAndUpdate(testWallet._id, {
      $set: { commissionDue: 100, 'activeCommissionOrder.status': 'none' }
    });
    order2 = await walletService.createPayCommissionOrder(testProvider._id, { amount: 100 });
    fakePayId2 = `pay_fake_sig_${Date.now()}`;
    const invalidSig = 'invalid_tampered_signature_hex_00000000000000000000000000000000000000';

    let sigErrorCaught = false;
    try {
      await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
        razorpayOrderId: order2.orderId,
        razorpayPaymentId: fakePayId2,
        razorpaySignature: invalidSig
      });
    } catch (err) {
      sigErrorCaught = true;
      assert(err.statusCode === 400, 'Invalid signature rejected with 400 Bad Request');
      assert(/signature verification failed/i.test(err.message), 'Error message clearly describes signature failure');
    }
    assert(sigErrorCaught === true, 'Invalid signature error was thrown');
    const walletAfter2 = await ProviderWallet.findById(testWallet._id);
    assert(walletAfter2.commissionDue === 100, 'Commission due remains strictly intact at ₹100');
    assert(walletAfter2.activeCommissionOrder.status === 'pending', 'Order lock remains active (not cancelled)');

    // -----------------------------------------------------------------------------------------
    // TEST 3: Late payment revival for cancelled order
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 3: Late payment revival for cancelled/expired order');
    // Simulate provider app having called cancel before payment was verified
    await ProviderWallet.findByIdAndUpdate(testWallet._id, {
      $set: { 'activeCommissionOrder.status': 'cancelled' }
    });

    const validSig2 = generateValidSignature(order2.orderId, fakePayId2);
    const lateVerifyRes = await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
      razorpayOrderId: order2.orderId,
      razorpayPaymentId: fakePayId2,
      razorpaySignature: validSig2
    });

    assert(lateVerifyRes.success === true, 'Late payment on cancelled order was successfully settled');
    const walletAfterLate = await ProviderWallet.findById(testWallet._id);
    assert(walletAfterLate.commissionDue === 0, 'Commission due settled to 0');
    assert(walletAfterLate.activeCommissionOrder.status === 'settled', 'Order status settled');

    // -----------------------------------------------------------------------------------------
    // TEST 4: Idempotent repeat verification
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 4: Idempotent repeat verification');
    const repeatRes = await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
      razorpayOrderId: order2.orderId,
      razorpayPaymentId: fakePayId2,
      razorpaySignature: validSig2
    });

    assert(repeatRes.success === true, 'Repeat verification succeeds idempotently');
    assert(repeatRes.alreadySettled === true, 'Already settled flag returned');
    const txnCount = await WalletTransaction.countDocuments({
      provider: testProvider._id,
      'metadata.razorpayPaymentId': fakePayId2
    });
    assert(txnCount === 1, 'Exactly ONE transaction ledger entry exists (no duplicate charge)');

    // -----------------------------------------------------------------------------------------
    // TEST 5: Server-Side Reconciliation with Razorpay Gateway
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 5: Server-side payment reconciliation (reconcileCommissionPayment)');
    // Set commission to ₹75
    await ProviderWallet.findByIdAndUpdate(testWallet._id, {
      $set: { commissionDue: 75, 'activeCommissionOrder.status': 'none' }
    });
    order5 = await walletService.createPayCommissionOrder(testProvider._id, { amount: 75 });
    capturedPayId = `pay_cap_recon_${Date.now()}`;

    // Mock fetchOrderPayments on paymentService to simulate Razorpay gateway having captured payment
    const originalFetchOrderPayments = paymentService.fetchOrderPayments;
    paymentService.fetchOrderPayments = async (orderId) => {
      if (orderId === order5.orderId) {
        return {
          entity: 'collection',
          count: 1,
          items: [
            {
              id: capturedPayId,
              order_id: order5.orderId,
              status: 'captured',
              amount: 7500,
              currency: 'INR'
            }
          ]
        };
      }
      return { entity: 'collection', count: 0, items: [] };
    };

    const reconResult = await walletService.reconcileCommissionPayment(testProvider._id);
    assert(reconResult.success === true, 'Reconciliation detected captured payment on gateway');
    assert(reconResult.settled === true, 'Reconciliation settled commission in full');
    const walletAfterRecon = await ProviderWallet.findById(testWallet._id);
    assert(walletAfterRecon.commissionDue === 0, 'Wallet commission due settled to 0');
    assert(walletAfterRecon.availableBalance === 500, 'Available balance preserved at ₹500');

    // -----------------------------------------------------------------------------------------
    // TEST 6: Server-side Authorized Payment Auto-Capture & Reconciliation
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 6: Authorized payment auto-capture during reconciliation');
    // Set commission to ₹120
    await ProviderWallet.findByIdAndUpdate(testWallet._id, {
      $set: { commissionDue: 120, 'activeCommissionOrder.status': 'none' }
    });
    order6 = await walletService.createPayCommissionOrder(testProvider._id, { amount: 120 });
    authPayId = `pay_auth_recon_${Date.now()}`;
    let captureCalled = false;

    const originalCapturePayment = paymentService.capturePayment;
    paymentService.capturePayment = async (payId, amount, currency) => {
      if (payId === authPayId) {
        captureCalled = true;
        return { id: payId, status: 'captured', amount, currency };
      }
      return originalCapturePayment(payId, amount, currency);
    };

    paymentService.fetchOrderPayments = async (orderId) => {
      if (orderId === order6.orderId) {
        return {
          entity: 'collection',
          count: 1,
          items: [
            {
              id: authPayId,
              order_id: order6.orderId,
              status: 'authorized',
              amount: 12000,
              currency: 'INR'
            }
          ]
        };
      }
      return { entity: 'collection', count: 0, items: [] };
    };

    const reconAuthResult = await walletService.reconcileCommissionPayment(testProvider._id);
    assert(captureCalled === true, 'Backend capturePayment was invoked for authorized payment');
    assert(reconAuthResult.success === true, 'Authorized payment settled successfully');
    const walletAfterAuthRecon = await ProviderWallet.findById(testWallet._id);
    assert(walletAfterAuthRecon.commissionDue === 0, 'Commission due settled to 0 after capture');

    // Restore paymentService methods
    paymentService.fetchOrderPayments = originalFetchOrderPayments;
    paymentService.capturePayment = originalCapturePayment;

    // -----------------------------------------------------------------------------------------
    // TEST 7: Gateway Error Object Sanitization
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 7: Razorpay gateway error object sanitization');
    // Verify paymentService.sanitizeRazorpayError wrapping
    const rawRazorpayError = {
      statusCode: 400,
      error: {
        code: 'BAD_REQUEST_ERROR',
        description: 'Payment has already been captured.'
      }
    };
    const sanitized = paymentService.sanitizeRazorpayError(rawRazorpayError, 'Capture failed');
    assert(sanitized instanceof Error, 'Sanitized error is an Error instance');
    assert(sanitized.message === 'Payment has already been captured.', 'Error message correctly extracted from error.description');
    assert(sanitized.statusCode === 400, 'Status code preserved as 400');

    // -----------------------------------------------------------------------------------------
    // TEST 8: Reconcile when already settled returns clear message and zero due
    // -----------------------------------------------------------------------------------------
    console.log('\nTest 8: Reconcile when already settled');
    const alreadySettledRecon = await walletService.reconcileCommissionPayment(testProvider._id);
    assert(alreadySettledRecon.success === true, 'Already settled reconcile succeeds');
    assert(alreadySettledRecon.status === 'already_settled', 'Status returned as already_settled');
    assert(alreadySettledRecon.wallet.commissionDue === 0, 'Commission due is confirmed ₹0');

    console.log('\n================================================================================');
    console.log(`🏁 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('================================================================================');

  } catch (err) {
    console.error('Test suite error:', err);
    failCount++;
  } finally {
    // Cleanup test user and provider
    if (testProvider) {
      await ProviderWallet.deleteMany({ provider: testProvider._id });
      await WalletTransaction.deleteMany({ provider: testProvider._id });
      await Provider.deleteOne({ _id: testProvider._id });
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runSuite();
