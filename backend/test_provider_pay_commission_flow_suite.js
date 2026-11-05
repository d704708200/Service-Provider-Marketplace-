/**
 * End-to-End Test Suite for Provider "Pay Full Commission" Razorpay Flow
 * 
 * Verifies:
 * 1. Order creation for exact outstanding amount (₹60 = 6000 paise).
 * 2. Financial safety: commissionDue and availableBalance are NOT deducted on order creation.
 * 3. Lock management & cancellation leaves commissionDue intact.
 * 4. Fake/invalid signature rejection (commissionDue stays intact).
 * 5. Valid signature verification: settles commissionDue to 0, creates COMMISSION_PAYMENT txn.
 * 6. Idempotency: repeated verify requests cannot create duplicate settlements.
 * 7. Zero commission due & invalid amounts rejected.
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

async function runSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING PROVIDER "PAY FULL COMMISSION" COMPLETE VERIFICATION SUITE');
  console.log('================================================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[SETUP] Connected to MongoDB');
    await WalletTransaction.syncIndexes();

    // Setup isolated test provider
    const uniqueEmail = `test_pay_comm_${Date.now()}@example.com`;
    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    testUser = await User.create({
      name: 'Staging Test Provider',
      email: uniqueEmail,
      phone: uniquePhone,
      password: 'Password123!',
      role: 'provider',
      isPhoneVerified: true
    });

    testProvider = await Provider.create({
      user: testUser._id,
      businessName: 'Staging Test Repairs',
      category: new mongoose.Types.ObjectId(),
      status: 'approved',
      commissionRate: 15
    });

    // Create wallet with exactly ₹60.00 commissionDue and ₹500 availableBalance
    testWallet = await ProviderWallet.create({
      provider: testProvider._id,
      availableBalance: 500,
      totalEarnings: 1000,
      totalWithdrawn: 500,
      pendingWithdrawal: 0,
      commissionDue: 60.00,
      autoDeductCommissionFromWallet: false
    });

    console.log(`[SETUP] Isolated Provider Created: ${testProvider._id} | Wallet: ${testWallet._id} | Due: ₹60.00\n`);

    // --------------------------------------------------------------------------
    // TEST 1: Create Pay Commission Order for ₹60
    // --------------------------------------------------------------------------
    console.log('[TEST 1] Create Pay Commission Order for exact ₹60.00');

    // Stub paymentService.createOrder to simulate server-side Razorpay order
    const originalCreateOrder = paymentService.createOrder;
    const dummyOrderId = `order_test_${Date.now()}`;
    paymentService.createOrder = async ({ amountInRupees, receipt, notes }) => {
      return {
        id: dummyOrderId,
        entity: 'order',
        amount: Math.round(Number(amountInRupees) * 100),
        amount_paid: 0,
        amount_due: Math.round(Number(amountInRupees) * 100),
        currency: 'INR',
        receipt,
        status: 'created',
        notes
      };
    };

    const orderRes = await walletService.createPayCommissionOrder(testProvider._id, 60.00);

    assert(orderRes.orderId === dummyOrderId, 'Test 1: Returned Razorpay Order ID matches generated order');
    assert(orderRes.amount === 60.00, 'Test 1: Order amount in Rupees is ₹60.00');
    assert(orderRes.amountInPaise === 6000, 'Test 1: Order amount in paise is 6000 paise (₹60 * 100)');
    assert(orderRes.currency === 'INR', 'Test 1: Currency is INR');
    assert(orderRes.status === 'pending', 'Test 1: Order status is pending');

    // Verify financial safety: commissionDue and availableBalance are NOT changed yet!
    const walletCheck1 = await ProviderWallet.findById(testWallet._id);
    assert(walletCheck1.commissionDue === 60.00, 'Test 1 (Financial Safety): commissionDue remains ₹60.00 on order creation');
    assert(walletCheck1.availableBalance === 500.00, 'Test 1 (Financial Safety): availableBalance remains ₹500.00 untouched');
    assert(walletCheck1.activeCommissionOrder.status === 'pending', 'Test 1: activeCommissionOrder is tracked as pending');

    // --------------------------------------------------------------------------
    // TEST 2: Re-requesting Order Returns the Existing Active Order (Idempotency)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Duplicate Click / In-Flight Order Re-use');
    const duplicateOrderRes = await walletService.createPayCommissionOrder(testProvider._id, 60.00);
    assert(duplicateOrderRes.orderId === dummyOrderId, 'Test 2: Re-used existing pending order instead of creating new one');
    assert(duplicateOrderRes.amountInPaise === 6000, 'Test 2: Re-used order maintains 6000 paise');

    // --------------------------------------------------------------------------
    // TEST 3: User Cancels Checkout
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] User Cancels Checkout');
    const cancelRes = await walletService.cancelActiveCommissionOrder(testProvider._id);
    assert(cancelRes.success === true, 'Test 3: cancelActiveCommissionOrder succeeded');

    const walletCheck3 = await ProviderWallet.findById(testWallet._id);
    assert(walletCheck3.commissionDue === 60.00, 'Test 3: commissionDue remains ₹60.00 intact after cancellation');
    assert(walletCheck3.availableBalance === 500.00, 'Test 3: availableBalance remains ₹500.00 intact after cancellation');
    assert(walletCheck3.activeCommissionOrder.status === 'cancelled', 'Test 3: Order marked cancelled, releasing lock');

    // --------------------------------------------------------------------------
    // TEST 4: New Order Creation after Cancellation
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] New Order Creation after Cancellation');
    const dummyOrderId2 = `order_test2_${Date.now()}`;
    paymentService.createOrder = async ({ amountInRupees, receipt, notes }) => {
      return {
        id: dummyOrderId2,
        entity: 'order',
        amount: Math.round(Number(amountInRupees) * 100),
        amount_paid: 0,
        amount_due: Math.round(Number(amountInRupees) * 100),
        currency: 'INR',
        receipt,
        status: 'created',
        notes
      };
    };

    const orderRes2 = await walletService.createPayCommissionOrder(testProvider._id, 60.00);
    assert(orderRes2.orderId === dummyOrderId2, 'Test 4: Successfully created new order after cancellation');

    // --------------------------------------------------------------------------
    // TEST 5: Fraudulent / Bogus Signature Verification Rejected
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Reject Bogus Payment Signature');
    let verifyError = null;
    try {
      await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
        razorpayOrderId: dummyOrderId2,
        razorpayPaymentId: 'pay_fake_123',
        razorpaySignature: 'bogus_forged_signature_xyz'
      });
    } catch (err) {
      verifyError = err;
    }

    assert(verifyError !== null, 'Test 5: Fake signature threw an error');
    assert(verifyError?.statusCode === 400 || /signature/i.test(verifyError?.message || ''), 'Test 5: Error indicates invalid signature');

    const walletCheck5 = await ProviderWallet.findById(testWallet._id);
    assert(walletCheck5.commissionDue === 60.00, 'Test 5: commissionDue remains strictly ₹60.00 after signature rejection');
    assert(walletCheck5.availableBalance === 500.00, 'Test 5: availableBalance remains ₹500.00');

    // --------------------------------------------------------------------------
    // TEST 6: Genuine Signature Verification & Complete Settlement
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Genuine Signature Verification & Settlement');
    const dummyPaymentId = `pay_real_${Date.now()}`;
    const rawSecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_placeholder';
    const validSignature = crypto
      .createHmac('sha256', rawSecret.trim())
      .update(`${dummyOrderId2}|${dummyPaymentId}`)
      .digest('hex');

    // Stub fetchPayment to return captured payment in test environment
    const originalFetchPayment = paymentService.fetchPayment;
    paymentService.fetchPayment = async () => ({
      id: dummyPaymentId,
      order_id: dummyOrderId2,
      status: 'captured',
      amount: 6000,
      currency: 'INR'
    });

    const verifyResult = await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
      razorpayOrderId: dummyOrderId2,
      razorpayPaymentId: dummyPaymentId,
      razorpaySignature: validSignature
    });

    assert(verifyResult.settled === true, 'Test 6: verifyAndSettleCommissionPayment returned settled: true');
    assert(verifyResult.commissionSettled === 60.00, 'Test 6: Exactly ₹60.00 commission settled');

    const walletCheck6 = await ProviderWallet.findById(testWallet._id);
    assert(walletCheck6.commissionDue === 0.00, 'Test 6: Wallet commissionDue is now ₹0.00');
    assert(walletCheck6.availableBalance === 500.00, 'Test 6: Available balance was NOT deducted, remains ₹500.00');
    assert(walletCheck6.activeCommissionOrder.status === 'settled', 'Test 6: Order status updated to settled');

    // Verify ledger transaction
    const txn = await WalletTransaction.findOne({
      wallet: testWallet._id,
      type: 'COMMISSION_PAYMENT',
      'metadata.razorpayPaymentId': dummyPaymentId
    });
    assert(txn !== null, 'Test 6: COMMISSION_PAYMENT transaction recorded in ledger');
    assert(txn?.amount === 60.00, 'Test 6: Transaction amount is ₹60.00');
    assert(txn?.balanceBefore === 500.00 && txn?.balanceAfter === 500.00, 'Test 6: Transaction does not modify availableBalance');

    // --------------------------------------------------------------------------
    // TEST 7: Idempotent Double Verify (Duplicate Callback / Double-Click)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Idempotent Double Verification Safety');
    const repeatVerify = await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
      razorpayOrderId: dummyOrderId2,
      razorpayPaymentId: dummyPaymentId,
      razorpaySignature: validSignature
    });

    assert(repeatVerify.settled === true, 'Test 7: Repeat verify returned successful idempotency');
    assert(repeatVerify.alreadySettled === true, 'Test 7: Marked alreadySettled: true');

    const txnCount = await WalletTransaction.countDocuments({
      wallet: testWallet._id,
      type: 'COMMISSION_PAYMENT'
    });
    assert(txnCount === 1, 'Test 7: Exactly 1 transaction exists in ledger (ZERO duplicates)');

    // --------------------------------------------------------------------------
    // TEST 8: Zero Due Rejection
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Zero Commission Due Order Rejection');
    let zeroDueErr = null;
    try {
      await walletService.createPayCommissionOrder(testProvider._id);
    } catch (e) {
      zeroDueErr = e;
    }
    assert(zeroDueErr !== null, 'Test 8: Order creation rejected when commissionDue is 0');
    assert(zeroDueErr?.statusCode === 400, 'Test 8: Returned HTTP 400 Bad Request');

    // Restore original stubs
    paymentService.createOrder = originalCreateOrder;
    paymentService.fetchPayment = originalFetchPayment;

    // --------------------------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------------------------
    console.log('\n[CLEANUP] Removing isolated test staging records...');
    await WalletTransaction.deleteMany({ wallet: testWallet._id });
    await ProviderWallet.findByIdAndDelete(testWallet._id);
    await Provider.findByIdAndDelete(testProvider._id);
    await User.findByIdAndDelete(testUser._id);
    console.log('[CLEANUP] Disconnected from MongoDB');
    await mongoose.disconnect();

  } catch (fatal) {
    console.error('Fatal Suite Error:', fatal);
    failCount++;
  }

  console.log('\n================================================================================');
  console.log(`TEST SUITE COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================================\n');

  if (failCount > 0) process.exit(1);
}

runSuite();

