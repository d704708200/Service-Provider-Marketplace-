const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '.env') });

const {
  ProviderWallet,
  WalletTransaction,
  Provider,
  User,
  Booking
} = require('./src/models');
const walletService = require('./src/services/walletService');
const paymentService = require('./src/services/paymentService');

async function runEdgeCaseSuite() {
  console.log('================================================================');
  console.log('=== STARTING FINAL RELEASE GATE – COMMISSION PAYMENT EDGE CASES ===');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[INIT] Connected to MongoDB Atlas successfully.');

  let testUser = null;
  let testProvider = null;

  try {
    // 1. Setup isolated test provider
    const uniqueSuffix = Date.now().toString().slice(-6);
    testUser = await User.create({
      name: `EdgeCase TestUser ${uniqueSuffix}`,
      email: `edgecase.${uniqueSuffix}@example.com`,
      phone: `98${Date.now().toString().slice(-8)}`,
      password: 'password123',
      role: 'provider',
      isActive: true
    });

    testProvider = await Provider.create({
      user: testUser._id,
      businessName: `EdgeCase Services ${uniqueSuffix}`,
      phone: testUser.phone,
      verificationStatus: 'verified',
      isAvailable: true
    });

    const providerId = testProvider._id;
    console.log(`[INIT] Created isolated test provider: ${providerId}\n`);

    // Helper to generate HMAC signature
    const testSecret = 'edgecase_test_secret_12345';
    process.env.RAZORPAY_KEY_SECRET = testSecret;

    const generateSignature = (orderId, paymentId) => {
      return crypto
        .createHmac('sha256', testSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    };

    // Store original paymentService functions to mock and restore
    const originalFetchPayment = paymentService.fetchPayment;
    const originalCapturePayment = paymentService.capturePayment;
    const originalFetchOrderPayments = paymentService.fetchOrderPayments;
    const originalCreateOrder = paymentService.createOrder;

    // -------------------------------------------------------------------------
    // TEST 1: PLATFORM_COMMISSION_RATE Environment Variable Convention
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: PLATFORM_COMMISSION_RATE Convention Normalization ---');
    const originalEnvRate = process.env.PLATFORM_COMMISSION_RATE;

    // Subtest A: Decimal string '0.15'
    process.env.PLATFORM_COMMISSION_RATE = '0.15';
    let conf = walletService.getPlatformCommissionConfig();
    if (conf.rateDecimal !== 0.15 || conf.ratePercentage !== 15 || conf.rateFormatted !== '15%') {
      throw new Error(`Failed on '0.15': ${JSON.stringify(conf)}`);
    }

    // Subtest B: Integer string '15'
    process.env.PLATFORM_COMMISSION_RATE = '15';
    conf = walletService.getPlatformCommissionConfig();
    if (conf.rateDecimal !== 0.15 || conf.ratePercentage !== 15 || conf.rateFormatted !== '15%') {
      throw new Error(`Failed on '15': ${JSON.stringify(conf)}`);
    }

    // Subtest C: Decimal string '0.20'
    process.env.PLATFORM_COMMISSION_RATE = '0.20';
    conf = walletService.getPlatformCommissionConfig();
    if (conf.rateDecimal !== 0.20 || conf.ratePercentage !== 20 || conf.rateFormatted !== '20%') {
      throw new Error(`Failed on '0.20': ${JSON.stringify(conf)}`);
    }

    // Subtest D: Integer string '20'
    process.env.PLATFORM_COMMISSION_RATE = '20';
    conf = walletService.getPlatformCommissionConfig();
    if (conf.rateDecimal !== 0.20 || conf.ratePercentage !== 20 || conf.rateFormatted !== '20%') {
      throw new Error(`Failed on '20': ${JSON.stringify(conf)}`);
    }

    // Subtest E: Empty / Default
    delete process.env.PLATFORM_COMMISSION_RATE;
    conf = walletService.getPlatformCommissionConfig();
    if (conf.rateDecimal !== 0.15 || conf.ratePercentage !== 15 || conf.rateFormatted !== '15%') {
      throw new Error(`Failed on default/empty: ${JSON.stringify(conf)}`);
    }

    process.env.PLATFORM_COMMISSION_RATE = originalEnvRate || '15';
    console.log('[PASSED] TEST 1: PLATFORM_COMMISSION_RATE supports both 0.15 and 15 conventions with consistent 15% take-rate.');

    // -------------------------------------------------------------------------
    // TEST 2: Payment in 'authorized' status MUST NOT settle if capture fails
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Authorized Payment - Capture Failure Must Reject Settlement ---');
    // Initialize wallet with 200 commission due
    let wallet = await ProviderWallet.create({
      provider: providerId,
      availableBalance: 500,
      commissionDue: 200,
      activeCommissionOrder: {
        orderId: 'order_test_auth_fail_1',
        amount: 200,
        amountInPaise: 20000,
        currency: 'INR',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    const paymentIdAuthFail = 'pay_test_auth_fail_1';
    const sigAuthFail = generateSignature('order_test_auth_fail_1', paymentIdAuthFail);

    // Mock fetchPayment returning authorized status
    paymentService.fetchPayment = async () => ({
      id: paymentIdAuthFail,
      order_id: 'order_test_auth_fail_1',
      amount: 20000,
      currency: 'INR',
      status: 'authorized'
    });

    // Mock capturePayment failing
    paymentService.capturePayment = async () => {
      throw new Error('Razorpay gateway timeout during capture');
    };

    let test2FailedAsExpected = false;
    try {
      await walletService.verifyAndSettleCommissionPayment(providerId, {
        razorpayOrderId: 'order_test_auth_fail_1',
        razorpayPaymentId: paymentIdAuthFail,
        razorpaySignature: sigAuthFail
      });
    } catch (err) {
      if (err.message.includes('backend capture failed') || err.message.includes('timeout')) {
        test2FailedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!test2FailedAsExpected) {
      throw new Error('Expected authorized payment without successful capture to throw an error!');
    }

    // Verify wallet commissionDue is still exactly 200
    const walletAfterAuthFail = await ProviderWallet.findById(wallet._id);
    if (walletAfterAuthFail.commissionDue !== 200) {
      throw new Error(`commissionDue was altered despite capture failure: ${walletAfterAuthFail.commissionDue}`);
    }
    console.log('[PASSED] TEST 2: Authorized payment that fails capture was rejected; commissionDue remains ₹200.');

    // -------------------------------------------------------------------------
    // TEST 3: Payment in 'authorized' status SUCCEEDS when captured by backend
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Authorized Payment Captured by Backend Settles Commission ---');
    const paymentIdAuthSuccess = 'pay_test_auth_success_1';
    const sigAuthSuccess = generateSignature('order_test_auth_fail_1', paymentIdAuthSuccess);

    // Mock fetchPayment returning authorized initially
    paymentService.fetchPayment = async () => ({
      id: paymentIdAuthSuccess,
      order_id: 'order_test_auth_fail_1',
      amount: 20000,
      currency: 'INR',
      status: 'authorized'
    });

    // Mock capturePayment returning captured
    paymentService.capturePayment = async () => ({
      id: paymentIdAuthSuccess,
      order_id: 'order_test_auth_fail_1',
      amount: 20000,
      currency: 'INR',
      status: 'captured'
    });

    const settleRes = await walletService.verifyAndSettleCommissionPayment(providerId, {
      razorpayOrderId: 'order_test_auth_fail_1',
      razorpayPaymentId: paymentIdAuthSuccess,
      razorpaySignature: sigAuthSuccess
    });

    if (settleRes.wallet.commissionDue !== 0) {
      throw new Error(`Expected commissionDue to be 0 after successful capture, got ${settleRes.wallet.commissionDue}`);
    }

    const txnAuthSuccess = await WalletTransaction.findOne({
      provider: providerId,
      'metadata.razorpayPaymentId': paymentIdAuthSuccess
    });
    if (!txnAuthSuccess || txnAuthSuccess.type !== 'COMMISSION_PAYMENT') {
      throw new Error('COMMISSION_PAYMENT transaction was not created for captured payment');
    }
    console.log('[PASSED] TEST 3: Authorized payment successfully captured by backend, commissionDue set to ₹0, transaction logged.');

    // -------------------------------------------------------------------------
    // TEST 4: Only verified 'captured' payment can settle commission; 'failed' is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Non-captured status (failed/created) rejected ---');
    // Set commission due back to 150
    wallet = await ProviderWallet.findByIdAndUpdate(
      wallet._id,
      {
        $set: {
          commissionDue: 150,
          activeCommissionOrder: {
            orderId: 'order_test_failed_status',
            amount: 150,
            amountInPaise: 15000,
            currency: 'INR',
            status: 'pending',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          }
        }
      },
      { new: true }
    );

    const paymentIdFailed = 'pay_test_failed_1';
    const sigFailed = generateSignature('order_test_failed_status', paymentIdFailed);

    paymentService.fetchPayment = async () => ({
      id: paymentIdFailed,
      order_id: 'order_test_failed_status',
      amount: 15000,
      currency: 'INR',
      status: 'failed'
    });

    let test4FailedAsExpected = false;
    try {
      await walletService.verifyAndSettleCommissionPayment(providerId, {
        razorpayOrderId: 'order_test_failed_status',
        razorpayPaymentId: paymentIdFailed,
        razorpaySignature: sigFailed
      });
    } catch (err) {
      if (err.message.includes("Payment status is 'failed'") || err.message.includes('Only verified captured')) {
        test4FailedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!test4FailedAsExpected) {
      throw new Error('Failed status should have been rejected by verifyAndSettleCommissionPayment');
    }

    const walletAfterFailed = await ProviderWallet.findById(wallet._id);
    if (walletAfterFailed.commissionDue !== 150) {
      throw new Error(`commissionDue altered on failed payment: ${walletAfterFailed.commissionDue}`);
    }
    console.log('[PASSED] TEST 4: Failed payment status strictly rejected; commissionDue remains ₹150.');

    // -------------------------------------------------------------------------
    // TEST 5: Provider closes checkout - Release active order lock safely
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Provider Closes Checkout - Release Active Order Lock Safely ---');
    // Mock fetchOrderPayments showing no payments made
    paymentService.fetchOrderPayments = async () => ({ count: 0, items: [] });

    const cancelRes = await walletService.cancelActiveCommissionOrder(providerId);
    if (!cancelRes.success) {
      throw new Error('cancelActiveCommissionOrder returned failure');
    }

    const walletAfterCancel = await ProviderWallet.findById(wallet._id);
    if (walletAfterCancel.activeCommissionOrder.status !== 'cancelled') {
      throw new Error(`Expected active order status 'cancelled', got ${walletAfterCancel.activeCommissionOrder.status}`);
    }
    console.log('[PASSED] TEST 5: Active order lock released cleanly to status "cancelled".');

    // -------------------------------------------------------------------------
    // TEST 6: Payment succeeds just before or during checkout cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Cancellation Race Condition - Payment Succeeded Prior to Cancel ---');
    // Reset order to pending with 150 commission
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      $set: {
        commissionDue: 150,
        activeCommissionOrder: {
          orderId: 'order_race_cancel_1',
          amount: 150,
          amountInPaise: 15000,
          currency: 'INR',
          status: 'pending',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      }
    });

    const paymentIdRace = 'pay_race_1';
    // fetchOrderPayments returns a captured payment that arrived just as user clicked cancel
    paymentService.fetchOrderPayments = async (orderId) => ({
      count: 1,
      items: [
        {
          id: paymentIdRace,
          order_id: orderId,
          amount: 15000,
          currency: 'INR',
          status: 'captured'
        }
      ]
    });

    paymentService.fetchPayment = async () => ({
      id: paymentIdRace,
      order_id: 'order_race_cancel_1',
      amount: 15000,
      currency: 'INR',
      status: 'captured'
    });

    const raceCancelRes = await walletService.cancelActiveCommissionOrder(providerId);
    if (!raceCancelRes.settled) {
      throw new Error(`Expected cancel to detect payment and settle, got: ${JSON.stringify(raceCancelRes)}`);
    }

    const walletAfterRaceCancel = await ProviderWallet.findById(wallet._id);
    if (walletAfterRaceCancel.commissionDue !== 0) {
      throw new Error(`Expected commissionDue to be 0 after race condition payment auto-settlement, got ${walletAfterRaceCancel.commissionDue}`);
    }
    console.log('[PASSED] TEST 6: Payment received right before cancellation was auto-settled in full without loss.');

    // -------------------------------------------------------------------------
    // TEST 7: Late successful payment on cancelled/expired order revives and settles
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Late Successful Payment On Cancelled/Expired Order ---');
    // Mark order as cancelled, but outstanding commission exists
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      $set: {
        commissionDue: 300,
        activeCommissionOrder: {
          orderId: 'order_late_payment_1',
          amount: 300,
          amountInPaise: 30000,
          currency: 'INR',
          status: 'cancelled',
          expiresAt: new Date(Date.now() - 5 * 60 * 1000) // expired
        }
      }
    });

    const paymentIdLate = 'pay_late_1';
    const sigLate = generateSignature('order_late_payment_1', paymentIdLate);

    paymentService.fetchPayment = async () => ({
      id: paymentIdLate,
      order_id: 'order_late_payment_1',
      amount: 30000,
      currency: 'INR',
      status: 'captured'
    });

    // Late payment arrives via webhook or client retry
    const lateSettleRes = await walletService.verifyAndSettleCommissionPayment(providerId, {
      razorpayOrderId: 'order_late_payment_1',
      razorpayPaymentId: paymentIdLate,
      razorpaySignature: sigLate
    });

    if (lateSettleRes.wallet.commissionDue !== 0) {
      throw new Error(`Expected commissionDue to be 0 after late payment revival, got ${lateSettleRes.wallet.commissionDue}`);
    }

    const walletAfterLate = await ProviderWallet.findById(wallet._id);
    if (walletAfterLate.activeCommissionOrder.status !== 'settled') {
      throw new Error(`Expected active order status 'settled', got ${walletAfterLate.activeCommissionOrder.status}`);
    }
    console.log('[PASSED] TEST 7: Late payment on cancelled/expired order was revived, accounted for, and settled to ₹0.');

    // -------------------------------------------------------------------------
    // TEST 8: Block creating new order when earlier order has in-flight/unresolved payment
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Block New Order Creation With Unresolved In-Flight Payment ---');
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      $set: {
        commissionDue: 400,
        activeCommissionOrder: {
          orderId: 'order_inflight_1',
          amount: 400,
          amountInPaise: 40000,
          currency: 'INR',
          status: 'pending',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      }
    });

    // fetchOrderPayments returns an 'authorized' payment in-flight
    paymentService.fetchOrderPayments = async () => ({
      count: 1,
      items: [
        {
          id: 'pay_inflight_1',
          order_id: 'order_inflight_1',
          amount: 40000,
          currency: 'INR',
          status: 'authorized'
        }
      ]
    });

    let test8BlockedAsExpected = false;
    try {
      await walletService.createPayCommissionOrder(providerId);
    } catch (err) {
      if (err.statusCode === 409 && err.message.includes('currently authorized and being processed')) {
        test8BlockedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!test8BlockedAsExpected) {
      throw new Error('Expected createPayCommissionOrder to block when in-flight authorized payment exists!');
    }
    console.log('[PASSED] TEST 8: Prevented duplicate order creation while unresolved in-flight payment is processing.');

    // -------------------------------------------------------------------------
    // TEST 9: Admin Strict Full Settlement & Auditable Waiver
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Strict Admin Operations (No Partial Payments, Mandatory Waiver Audit) ---');
    // Subtest 9A: Partial amount adjustment rejected
    let test9APartialBlocked = false;
    try {
      await walletService.adminAdjustCommission(providerId, {
        action: 'settle',
        amount: 200, // Provider owes 400, trying partial 200
        reason: 'Partial settlement attempt',
        adminId: 'admin_test_1'
      });
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('Strict Full Settlement Rule')) {
        test9APartialBlocked = true;
      } else {
        throw err;
      }
    }
    if (!test9APartialBlocked) throw new Error('Expected partial admin settlement to be rejected!');

    // Subtest 9B: Waiver without audit reason rejected
    let test9BWaiverNoReasonBlocked = false;
    try {
      await walletService.adminWaiveFullCommission(providerId, {
        reason: 'bad', // < 5 chars
        adminId: 'admin_test_1'
      });
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('min 5 characters')) {
        test9BWaiverNoReasonBlocked = true;
      } else {
        throw err;
      }
    }
    if (!test9BWaiverNoReasonBlocked) throw new Error('Expected waiver without audit reason to be rejected!');

    // Subtest 9C: Full waiver with authorized audit reason
    const waiveRes = await walletService.adminWaiveFullCommission(providerId, {
      reason: 'Dispute resolved in customer favour; platform waived commission.',
      adminId: 'admin_test_1'
    });

    if (waiveRes.wallet.commissionDue !== 0) {
      throw new Error(`Expected commissionDue 0 after waiver, got ${waiveRes.wallet.commissionDue}`);
    }

    const waiverTxn = await WalletTransaction.findOne({
      provider: providerId,
      type: 'COMMISSION_WAIVER'
    });
    if (!waiverTxn || waiverTxn.amount !== 400) {
      throw new Error('COMMISSION_WAIVER ledger transaction with exact amount was not created');
    }
    console.log('[PASSED] TEST 9: Admin partial adjustment strictly blocked; waiver requires mandatory audit reason & logs COMMISSION_WAIVER.');

    // Restore original paymentService methods
    paymentService.fetchPayment = originalFetchPayment;
    paymentService.capturePayment = originalCapturePayment;
    paymentService.fetchOrderPayments = originalFetchOrderPayments;
    paymentService.createOrder = originalCreateOrder;

    console.log('\n================================================================');
    console.log('=== ALL 9 RELEASE GATE FINANCIAL EDGE CASES VERIFIED & PASSED ===');
    console.log('================================================================\n');

  } finally {
    // Clean up isolated test entities
    if (testProvider) {
      await ProviderWallet.deleteMany({ provider: testProvider._id });
      await WalletTransaction.deleteMany({ provider: testProvider._id });
      await Provider.deleteOne({ _id: testProvider._id });
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.disconnect();
    console.log('[CLEANUP] Isolated test data removed. Disconnected from MongoDB.');
  }
}

runEdgeCaseSuite().catch((err) => {
  console.error('[EDGE CASE SUITE FAILED]', err);
  process.exit(1);
});
