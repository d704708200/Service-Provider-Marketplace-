const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '.env') });

const {
  ProviderWallet,
  WalletTransaction,
  WithdrawalRequest,
  Provider,
  User,
  Customer,
  Service,
  Category,
  Booking
} = require('./src/models');
const walletService = require('./src/services/walletService');

async function runAutoDeductTestSuite() {
  console.log('================================================================================');
  console.log('=== TASK: MENDROO COMMISSION PAYMENT & AUTOMATIC WALLET DEDUCTION TEST SUITE ===');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SECTION 1: ENVIRONMENT SETUP]');
  console.log('1. Database Connected:', mongoose.connection.name);
  console.log('2. Environment:', process.env.NODE_ENV || 'development');
  console.log('3. Razorpay Key ID:', process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 8)}... (TEST MODE)` : 'N/A');

  const testResults = [];
  const timestamp = Date.now().toString().slice(-6);

  let testUser = null;
  let testProvider = null;
  let testCustomer = null;
  let testCustomerUser = null;
  let testCategory = null;
  let testService = null;
  let adminUser = null;
  let wallet = null;

  try {
    // 1. Create Test Admin
    adminUser = await User.create({
      name: `AutoDeduct Admin ${timestamp}`,
      email: `admin.autodeduct.${timestamp}@example.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      password: 'StagingAdminPassword123!',
      role: 'admin',
      isActive: true
    });

    // 2. Create Test Customer
    testCustomerUser = await User.create({
      name: `AutoDeduct Customer ${timestamp}`,
      email: `cust.autodeduct.${timestamp}@example.com`,
      phone: `92${Date.now().toString().slice(-8)}`,
      password: 'StagingCustomerPassword123!',
      role: 'customer',
      isActive: true
    });

    testCustomer = await Customer.create({
      user: testCustomerUser._id,
      name: testCustomerUser.name,
      email: testCustomerUser.email,
      phone: testCustomerUser.phone,
      addresses: [{
        street: '123 Test Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        isDefault: true
      }]
    });

    // 3. Create Test Provider
    testUser = await User.create({
      name: `AutoDeduct Provider ${timestamp}`,
      email: `prov.autodeduct.${timestamp}@example.com`,
      phone: `93${Date.now().toString().slice(-8)}`,
      password: 'StagingProviderPassword123!',
      role: 'provider',
      isActive: true
    });

    testCategory = await Category.create({
      name: `AutoDeduct Cat ${timestamp}`,
      slug: `autodeduct-cat-${timestamp}`,
      description: 'Test Category',
      icon: 'construct',
      isActive: true
    });

    testService = await Service.create({
      name: `AutoDeduct Service ${timestamp}`,
      slug: `autodeduct-srv-${timestamp}`,
      category: testCategory._id,
      price: 1000,
      priceType: 'fixed',
      isActive: true
    });

    testProvider = await Provider.create({
      user: testUser._id,
      businessName: `Mendroo AutoDeduct Pro ${timestamp}`,
      phone: testUser.phone,
      email: testUser.email,
      services: [{
        service: testService._id,
        customPrice: 1000,
        experience: 5
      }],
      status: 'approved',
      verificationStatus: 'verified',
      isAcceptingJobs: true,
      bankAccount: {
        accountHolderName: 'AutoDeduct Provider Test',
        accountNumber: '1122334455667788',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        isVerified: true
      }
    });

    // Initialize Wallet
    wallet = await walletService.getOrCreateWallet(testProvider._id);
    console.log('\n[SETUP COMPLETE] Test Provider ID:', testProvider._id.toString(), '| Wallet ID:', wallet._id.toString());

    // =========================================================================
    // SCENARIO 1: Auto Deduct OFF - No automatic wallet deduction
    // =========================================================================
    console.log('\n--- SCENARIO 1: Auto Deduct OFF - No Automatic Wallet Deduction ---');
    // Set wallet to availableBalance: 1000, commissionDue: 150, autoDeduct: false
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 1000,
      commissionDue: 150,
      autoDeductCommissionFromWallet: false
    });

    const res1 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w1 = await ProviderWallet.findById(wallet._id);
    const pass1 = res1.deducted === false &&
      res1.reason === 'AUTO_DEDUCT_DISABLED' &&
      w1.availableBalance === 1000 &&
      w1.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 1: Auto Deduct OFF',
      expected: 'Zero deduction made, balance & due unchanged',
      actual: `Deducted: ${res1.deducted}, Reason: ${res1.reason}, Bal: ₹${w1.availableBalance}, Due: ₹${w1.commissionDue}`,
      pass: pass1
    });
    console.log(pass1 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 2: Auto Deduct ON with ₹1,000 available & ₹150 due - Full deduction
    // =========================================================================
    console.log('\n--- SCENARIO 2: Auto Deduct ON with ₹1,000 Available & ₹150 Due ---');
    // Provider enables auto-deduct (Trigger 4 fires immediately!)
    const toggleRes2 = await walletService.toggleAutoDeductCommission(testProvider._id, true);
    const w2 = await ProviderWallet.findById(wallet._id);
    const txn2 = await WalletTransaction.findOne({
      wallet: wallet._id,
      type: 'COMMISSION_WALLET_AUTO_DEBIT'
    }).sort({ createdAt: -1 });

    const pass2 = toggleRes2.success === true &&
      w2.autoDeductCommissionFromWallet === true &&
      w2.availableBalance === 850 &&
      w2.commissionDue === 0 &&
      txn2 !== null &&
      txn2.amount === 150 &&
      txn2.balanceAfter === 850;

    testResults.push({
      scenario: 'Scenario 2: Auto Deduct ON (₹1,000 Avail, ₹150 Due)',
      expected: 'Exact ₹150 deducted in 1 txn, Avail: ₹850, Due: ₹0, COMMISSION_WALLET_AUTO_DEBIT created',
      actual: `Avail: ₹${w2.availableBalance}, Due: ₹${w2.commissionDue}, Txn: ${txn2?.type} (₹${txn2?.amount})`,
      pass: pass2
    });
    console.log(pass2 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 3: Auto Deduct ON with ₹100 available & ₹150 due - Zero deduction
    // =========================================================================
    console.log('\n--- SCENARIO 3: Auto Deduct ON with ₹100 Available & ₹150 Due ---');
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 100,
      commissionDue: 150
    });

    const res3 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w3 = await ProviderWallet.findById(wallet._id);
    const pass3 = res3.deducted === false &&
      res3.reason === 'INSUFFICIENT_BALANCE' &&
      w3.availableBalance === 100 &&
      w3.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 3: Insufficient Balance (₹100 Avail, ₹150 Due)',
      expected: 'Zero deduction made, no partial payment, Bal: ₹100, Due: ₹150',
      actual: `Deducted: ${res3.deducted}, Reason: ${res3.reason}, Bal: ₹${w3.availableBalance}, Due: ₹${w3.commissionDue}`,
      pass: pass3
    });
    console.log(pass3 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 4: Available Balance ₹0 - Zero deduction, no negative balance
    // =========================================================================
    console.log('\n--- SCENARIO 4: Available Balance ₹0 - Zero Deduction ---');
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 0,
      commissionDue: 150
    });

    const res4 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w4 = await ProviderWallet.findById(wallet._id);
    const pass4 = res4.deducted === false &&
      res4.reason === 'INSUFFICIENT_BALANCE' &&
      w4.availableBalance === 0 &&
      w4.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 4: Available Balance ₹0',
      expected: 'Zero deduction made, balance remains ₹0, never negative',
      actual: `Deducted: ${res4.deducted}, Reason: ${res4.reason}, Bal: ₹${w4.availableBalance}`,
      pass: pass4
    });
    console.log(pass4 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 5: Legacy Negative Balance (-₹50) - Flagged & Protected
    // =========================================================================
    console.log('\n--- SCENARIO 5: Legacy Negative Balance (-₹50) ---');
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: -50,
      commissionDue: 150,
      reconciliationFlagged: false
    });

    const res5 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w5 = await ProviderWallet.findById(wallet._id);
    const pass5 = res5.deducted === false &&
      res5.reason === 'NEGATIVE_BALANCE_FLAGGED' &&
      w5.availableBalance === -50 &&
      w5.reconciliationFlagged === true &&
      w5.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 5: Legacy Negative Balance (-₹50)',
      expected: 'Deduction blocked, reconciliationFlagged: true, balance stays -₹50',
      actual: `Deducted: ${res5.deducted}, Flagged: ${w5.reconciliationFlagged}, Bal: ₹${w5.availableBalance}`,
      pass: pass5
    });
    console.log(pass5 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // Reset reconciliation flag & balance for subsequent tests
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 0,
      reconciliationFlagged: false,
      reconciliationReason: null
    });

    // =========================================================================
    // SCENARIO 6: Pending Earnings ₹1,000 and Available Balance ₹0
    // =========================================================================
    console.log('\n--- SCENARIO 6: Pending Earnings ₹1,000 and Available Balance ₹0 ---');
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 0,
      pendingBalance: 1000,
      commissionDue: 150
    });

    const res6 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w6 = await ProviderWallet.findById(wallet._id);
    const pass6 = res6.deducted === false &&
      w6.pendingBalance === 1000 &&
      w6.availableBalance === 0 &&
      w6.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 6: Pending Earnings ₹1,000 & Available ₹0',
      expected: 'Zero deduction, pending earnings untouched (₹1,000)',
      actual: `Pending: ₹${w6.pendingBalance}, Avail: ₹${w6.availableBalance}, Due: ₹${w6.commissionDue}`,
      pass: pass6
    });
    console.log(pass6 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 7: Pending Withdrawal ₹500 is never used for commission
    // =========================================================================
    console.log('\n--- SCENARIO 7: Pending Withdrawal ₹500 is Protected ---');
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 0,
      pendingBalance: 0,
      pendingWithdrawal: 500,
      commissionDue: 150
    });

    const res7 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w7 = await ProviderWallet.findById(wallet._id);
    const pass7 = res7.deducted === false &&
      w7.pendingWithdrawal === 500 &&
      w7.availableBalance === 0 &&
      w7.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 7: Pending Withdrawal Protected (₹500)',
      expected: 'Zero deduction, pending withdrawal untouched (₹500)',
      actual: `PendingWithdrawal: ₹${w7.pendingWithdrawal}, Avail: ₹${w7.availableBalance}, Due: ₹${w7.commissionDue}`,
      pass: pass7
    });
    console.log(pass7 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // Reset pendingWithdrawal
    await ProviderWallet.findByIdAndUpdate(wallet._id, { pendingWithdrawal: 0 });

    // =========================================================================
    // SCENARIO 8: Later eligible wallet credit triggers full deduction
    // =========================================================================
    console.log('\n--- SCENARIO 8: Later Eligible Credit Triggers Full Deduction ---');
    // Start with Available: ₹100, Due: ₹150 (autoDeduct ON)
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 100,
      commissionDue: 150,
      autoDeductCommissionFromWallet: true
    });

    // Credit ₹900 via adminAdjustWallet (Trigger 3)
    await walletService.adminAdjustWallet(
      wallet._id,
      adminUser._id,
      {
        type: 'credit',
        amount: 900,
        reason: 'Authorized promotional bonus credit'
      }
    );

    const w8 = await ProviderWallet.findById(wallet._id);
    // Initial ₹100 + credit ₹900 = ₹1,000 available. Trigger 3 immediately deducts ₹150 due!
    // Final availableBalance should be 1000 - 150 = 850, and commissionDue = 0.
    const pass8 = w8.availableBalance === 850 && w8.commissionDue === 0;

    testResults.push({
      scenario: 'Scenario 8: Later Credit Triggers Full Deduction',
      expected: 'Credit ₹900 raised balance to ₹1,000, triggered auto-deduct ₹150 -> Avail: ₹850, Due: ₹0',
      actual: `Avail: ₹${w8.availableBalance}, Due: ₹${w8.commissionDue}`,
      pass: pass8
    });
    console.log(pass8 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 9: Duplicate automatic deduction request is ignored safely
    // =========================================================================
    console.log('\n--- SCENARIO 9: Duplicate Auto-Deduction Ignored Safely ---');
    const res9 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const pass9 = res9.deducted === false &&
      res9.reason === 'NO_COMMISSION_DUE' &&
      res9.isProcessed === true;

    testResults.push({
      scenario: 'Scenario 9: Duplicate Deduction Ignored Safely',
      expected: 'Returns isProcessed: true, deducted: false, reason: NO_COMMISSION_DUE',
      actual: `Deducted: ${res9.deducted}, Reason: ${res9.reason}`,
      pass: pass9
    });
    console.log(pass9 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 10: Concurrent commission deduction & withdrawal safety
    // =========================================================================
    console.log('\n--- SCENARIO 10: Concurrent Commission Deduction & Withdrawal Safety ---');
    // Set wallet to exactly ₹150 available, ₹150 commission due
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 150,
      commissionDue: 150
    });

    // Launch concurrent auto-deduct and withdrawal of ₹150 simultaneously
    const [concurrentDeduct, concurrentWithdraw] = await Promise.allSettled([
      walletService.tryAutoDeductCommissionFromWallet(testProvider._id),
      walletService.requestWithdrawal(testProvider._id, {
        amount: 150,
        payoutMethod: 'bank_transfer',
        payoutDetails: {
          accountHolderName: 'AutoDeduct Provider Test',
          accountNumber: '1122334455667788',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank'
        },
        note: 'Concurrent withdrawal test'
      })
    ]);

    const w10 = await ProviderWallet.findById(wallet._id);
    // At most ONE can take the ₹150; Available balance must NEVER be negative (< 0)
    const pass10 = w10.availableBalance >= 0;

    // Clean up any withdrawal created by the race test so it does not leak into subsequent scenarios
    if (concurrentWithdraw.status === 'fulfilled' && concurrentWithdraw.value?.withdrawalRequest) {
      await WithdrawalRequest.deleteOne({ _id: concurrentWithdraw.value.withdrawalRequest._id });
      await WalletTransaction.deleteOne({ _id: concurrentWithdraw.value.transaction._id });
      await ProviderWallet.findByIdAndUpdate(wallet._id, {
        $set: { pendingWithdrawal: 0 }
      });
    }

    testResults.push({
      scenario: 'Scenario 10: Concurrency Safety (Balance Never Negative)',
      expected: 'Atomic check ensures balance >= 0 under race condition',
      actual: `Final Avail: ₹${w10.availableBalance}, Deduct Status: ${concurrentDeduct.status}, Withdraw Status: ${concurrentWithdraw.status}`,
      pass: pass10
    });
    console.log(pass10 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 11: Auto deduction & Razorpay order conflict protection
    // =========================================================================
    console.log('\n--- SCENARIO 11: Auto Deduction & Razorpay Order Conflict Protection ---');
    // Set activeCommissionOrder to pending
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 500,
      commissionDue: 150,
      autoDeductCommissionFromWallet: true,
      activeCommissionOrder: {
        orderId: 'order_test_conflict_123',
        amountPaise: 15000,
        amountRupees: 150,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    const res11 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w11 = await ProviderWallet.findById(wallet._id);
    const pass11 = res11.deducted === false &&
      res11.reason === 'ACTIVE_RAZORPAY_ORDER_PENDING' &&
      w11.availableBalance === 500 &&
      w11.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 11: Active Razorpay Order Conflict Lock',
      expected: 'Auto-deduct blocked while active Razorpay order is pending',
      actual: `Deducted: ${res11.deducted}, Reason: ${res11.reason}, Bal: ₹${w11.availableBalance}, Due: ₹${w11.commissionDue}`,
      pass: pass11
    });
    console.log(pass11 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // Clear activeCommissionOrder
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      activeCommissionOrder: {
        orderId: null,
        amountPaise: 0,
        amountRupees: 0,
        status: 'none',
        createdAt: null,
        expiresAt: null
      }
    });

    // =========================================================================
    // SCENARIO 12: Razorpay failure leaves commissionDue unchanged
    // =========================================================================
    console.log('\n--- SCENARIO 12: Razorpay Failure Leaves Commission Due Unchanged ---');
    // Provider cancels order
    await walletService.createPayCommissionOrder(testProvider._id);
    const cancelRes = await walletService.cancelPayCommissionOrder(testProvider._id);
    const w12 = await ProviderWallet.findById(wallet._id);
    const pass12 = cancelRes.success === true &&
      w12.commissionDue === 150 &&
      w12.activeCommissionOrder.status === 'cancelled';

    testResults.push({
      scenario: 'Scenario 12: Razorpay Failure / Cancellation',
      expected: 'Order marked cancelled, commissionDue remains ₹150 intact',
      actual: `Status: ${w12.activeCommissionOrder.status}, Due: ₹${w12.commissionDue}`,
      pass: pass12
    });
    console.log(pass12 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 13: Razorpay captured payment clears complete due
    // =========================================================================
    console.log('\n--- SCENARIO 13: Razorpay Captured Payment Clears Complete Due ---');
    // Create new order
    const orderRes13 = await walletService.createPayCommissionOrder(testProvider._id);
    const orderId13 = orderRes13.orderId;
    const fakePaymentId13 = `pay_test_${Date.now()}`;
    const generatedSig13 = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId13}|${fakePaymentId13}`)
      .digest('hex');

    const paymentService = require('./src/services/paymentService');
    const origFetchPayment = paymentService.fetchPayment;
    paymentService.fetchPayment = async (pid) => ({
      id: pid,
      order_id: orderId13,
      amount: 15000,
      currency: 'INR',
      status: 'captured'
    });

    const verifyRes13 = await walletService.verifyCommissionPayment(testProvider._id, {
      razorpayOrderId: orderId13,
      razorpayPaymentId: fakePaymentId13,
      razorpaySignature: generatedSig13
    });

    paymentService.fetchPayment = origFetchPayment;

    const w13 = await ProviderWallet.findById(wallet._id);
    const txn13 = await WalletTransaction.findOne({
      wallet: wallet._id,
      type: 'COMMISSION_PAYMENT',
      'metadata.razorpayPaymentId': fakePaymentId13
    });

    const pass13 = verifyRes13.success === true &&
      w13.commissionDue === 0 &&
      w13.activeCommissionOrder.status === 'settled' &&
      txn13 !== null &&
      txn13.amount === 150;

    testResults.push({
      scenario: 'Scenario 13: Razorpay Captured Payment Clears Full Due',
      expected: 'Verified payment clears commissionDue to ₹0, creates COMMISSION_PAYMENT',
      actual: `Due: ₹${w13.commissionDue}, OrderStatus: ${w13.activeCommissionOrder.status}, Txn: ${txn13?.type} (₹${txn13?.amount})`,
      pass: pass13
    });
    console.log(pass13 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 14: Provider disabling auto deduction prevents future deductions
    // =========================================================================
    console.log('\n--- SCENARIO 14: Provider Disabling Auto Deduction ---');
    await walletService.toggleAutoDeductCommission(testProvider._id, false);
    // Add new commission due of ₹150 with ₹500 available balance
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      availableBalance: 500,
      commissionDue: 150
    });

    const res14 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w14 = await ProviderWallet.findById(wallet._id);
    const pass14 = w14.autoDeductCommissionFromWallet === false &&
      res14.deducted === false &&
      res14.reason === 'AUTO_DEDUCT_DISABLED' &&
      w14.availableBalance === 500 &&
      w14.commissionDue === 150;

    testResults.push({
      scenario: 'Scenario 14: Provider Disables Auto-Deduct',
      expected: 'Auto-deduct is disabled, no deduction occurs on subsequent actions',
      actual: `Enabled: ${w14.autoDeductCommissionFromWallet}, Deducted: ${res14.deducted}, Due: ₹${w14.commissionDue}`,
      pass: pass14
    });
    console.log(pass14 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 15: Existing cash booking accounting remains correct
    // =========================================================================
    console.log('\n--- SCENARIO 15: Existing Cash Booking Accounting Remains Correct ---');
    const cashBooking = await Booking.create({
      bookingReference: `MND-CSH-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      serviceCategory: testCategory._id,
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      address: { street: '123 Staging Lane', city: 'Mumbai', pincode: '400001' },
      status: 'completed',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      pricing: {
        basePrice: 1000,
        totalAmount: 1000,
        providerPayable: 850,
        platformFee: 150
      },
      commission: {
        rate: 15,
        amount: 150,
        status: 'due'
      }
    });

    const initialDue15 = w14.commissionDue;
    await walletService.creditBookingEarnings(cashBooking._id);
    const w15 = await ProviderWallet.findById(wallet._id);
    const cashTxn15 = await WalletTransaction.findOne({
      booking: cashBooking._id,
      type: 'CASH_BOOKING_COMMISSION_DUE'
    });

    const pass15 = w15.commissionDue === initialDue15 + 150 &&
      cashTxn15 !== null &&
      cashTxn15.amount === 150;

    testResults.push({
      scenario: 'Scenario 15: Cash Booking Accounting Invariant',
      expected: 'CASH_BOOKING_COMMISSION_DUE recorded, commissionDue increments without making balance negative',
      actual: `Due: ₹${w15.commissionDue}, Balance: ₹${w15.availableBalance}, Txn: ${cashTxn15?.type}`,
      pass: pass15
    });
    console.log(pass15 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 16: Existing online booking earnings remain correct
    // =========================================================================
    console.log('\n--- SCENARIO 16: Existing Online Booking Earnings Remain Correct ---');
    const initialAvail16 = w15.availableBalance;
    const initialEarnings16 = w15.totalEarnings;

    const onlineBooking = await Booking.create({
      bookingReference: `MND-ONL-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      serviceCategory: testCategory._id,
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '11:00', endTime: '12:00' },
      address: { street: '123 Staging Lane', city: 'Mumbai', pincode: '400001' },
      status: 'completed',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      pricing: {
        basePrice: 1000,
        totalAmount: 1000,
        providerPayable: 850,
        platformFee: 150
      },
      commission: {
        rate: 15,
        amount: 150,
        status: 'collected'
      }
    });

    await walletService.creditBookingEarnings(onlineBooking._id);
    const w16 = await ProviderWallet.findById(wallet._id);
    const earningTxn16 = await WalletTransaction.findOne({
      booking: onlineBooking._id,
      type: 'booking_earning'
    });

    const pass16 = w16.availableBalance === initialAvail16 + 850 &&
      w16.totalEarnings === initialEarnings16 + 850 &&
      earningTxn16 !== null &&
      earningTxn16.amount === 850;

    testResults.push({
      scenario: 'Scenario 16: Online Booking Earnings Credit Invariant',
      expected: 'Online earning ₹850 credited to availableBalance and totalEarnings',
      actual: `Avail: ₹${w16.availableBalance}, TotalEarnings: ₹${w16.totalEarnings}, Txn: ${earningTxn16?.type} (₹${earningTxn16?.amount})`,
      pass: pass16
    });
    console.log(pass16 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 17: Existing withdrawal approval and rejection remain correct
    // =========================================================================
    console.log('\n--- SCENARIO 17: Withdrawal Flow (Request, Reject, Approval) ---');
    // Request withdrawal of ₹500
    const wPre17 = await ProviderWallet.findById(wallet._id);
    const reqRes17 = await walletService.requestWithdrawal(testProvider._id, {
      amount: 500,
      payoutMethod: 'bank_transfer',
      payoutDetails: {
        accountHolderName: 'AutoDeduct Provider Test',
        accountNumber: '1122334455667788',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank'
      },
      note: 'Staging withdrawal test'
    });
    const wReq17 = await ProviderWallet.findById(wallet._id);

    // Reject withdrawal -> funds refund to availableBalance
    await walletService.adminRejectWithdrawal(reqRes17.withdrawalRequest._id, adminUser._id, 'Staging rejection test');
    const wRej17 = await ProviderWallet.findById(wallet._id);

    // Request new withdrawal of ₹400 and disburse -> paid
    const reqRes17b = await walletService.requestWithdrawal(testProvider._id, {
      amount: 400,
      payoutMethod: 'bank_transfer',
      payoutDetails: {
        accountHolderName: 'AutoDeduct Provider Test',
        accountNumber: '1122334455667788',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank'
      },
      note: 'Staging approval test'
    });
    await walletService.adminPayoutWithdrawal(reqRes17b.withdrawalRequest._id, adminUser._id, {
      transactionReference: 'UTR1234567890',
      adminNote: 'Disbursed by test suite'
    });
    const wApp17 = await ProviderWallet.findById(wallet._id);

    const pass17 = wReq17.availableBalance === wPre17.availableBalance - 500 &&
      wReq17.pendingWithdrawal === 500 &&
      wRej17.availableBalance === wPre17.availableBalance &&
      wRej17.pendingWithdrawal === 0 &&
      wApp17.totalWithdrawn >= 400;

    testResults.push({
      scenario: 'Scenario 17: Withdrawal Request, Rejection & Approval Invariant',
      expected: 'Locked funds refund on rejection; disbursed funds increment totalWithdrawn on approval',
      actual: `Avail: ₹${wApp17.availableBalance}, TotalWithdrawn: ₹${wApp17.totalWithdrawn}, PendingWithdrawn: ₹${wApp17.pendingWithdrawal}`,
      pass: pass17
    });
    console.log(pass17 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // =========================================================================
    // SCENARIO 18: Ledger balances reconcile exactly (Delta = 0.00)
    // =========================================================================
    console.log('\n--- SCENARIO 18: Complete Ledger Mathematical Reconciliation ---');
    // Create an isolated staging provider for a pure audited financial lifecycle reconciliation
    const reconUser = await User.create({
      name: `Recon Provider ${timestamp}`,
      email: `recon.${timestamp}@example.com`,
      phone: `94${Date.now().toString().slice(-8)}`,
      password: 'StagingReconPassword123!',
      role: 'provider',
      isActive: true
    });
    const reconProvider = await Provider.create({
      user: reconUser._id,
      businessName: `Recon Pro ${timestamp}`,
      phone: reconUser.phone,
      email: reconUser.email,
      status: 'approved',
      verificationStatus: 'verified',
      isAcceptingJobs: true,
      bankAccount: {
        accountHolderName: 'Recon Provider Test',
        accountNumber: '9988776655443322',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        isVerified: true
      }
    });
    const reconWallet = await walletService.getOrCreateWallet(reconProvider._id);

    // 1. Baseline credit ₹2,000 via audited adminAdjustWallet
    await walletService.adminAdjustWallet(reconWallet._id, adminUser._id, {
      type: 'credit',
      amount: 2000,
      reason: 'Reconciliation test baseline credit'
    });

    // 2. Enable auto-deduction with ₹150 cash commission due
    await ProviderWallet.findByIdAndUpdate(reconWallet._id, { commissionDue: 150 });
    await walletService.toggleAutoDeductCommission(reconProvider._id, true); // Auto-deducts ₹150 -> balance ₹1,850

    // 3. Online booking earning of ₹850
    const reconBooking = await Booking.create({
      bookingReference: `MND-RCN-${timestamp}`,
      customer: testCustomer._id,
      provider: reconProvider._id,
      service: testService._id,
      serviceCategory: testCategory._id,
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '15:00', endTime: '16:00' },
      address: { street: '123 Recon Lane', city: 'Mumbai', pincode: '400001' },
      status: 'completed',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      pricing: { basePrice: 1000, totalAmount: 1000, providerPayable: 850, platformFee: 150 },
      commission: { rate: 15, amount: 150, status: 'collected' }
    });
    await walletService.creditBookingEarnings(reconBooking._id); // +850 -> balance ₹2,700

    // 4. Withdrawal of ₹500, rejected -> refunds ₹500
    const wReq = await walletService.requestWithdrawal(reconProvider._id, {
      amount: 500,
      payoutMethod: 'bank_transfer',
      payoutDetails: { accountHolderName: 'Recon Provider', accountNumber: '9988776655443322', ifscCode: 'HDFC0001234' },
      note: 'Recon withdrawal test'
    });
    await walletService.adminRejectWithdrawal(wReq.withdrawalRequest._id, adminUser._id, 'Recon rejection test');

    // 5. Withdrawal of ₹700, paid
    const wReq2 = await walletService.requestWithdrawal(reconProvider._id, {
      amount: 700,
      payoutMethod: 'bank_transfer',
      payoutDetails: { accountHolderName: 'Recon Provider', accountNumber: '9988776655443322', ifscCode: 'HDFC0001234' },
      note: 'Recon payout test'
    });
    await walletService.adminPayoutWithdrawal(wReq2.withdrawalRequest._id, adminUser._id, {
      transactionReference: 'UTR-RECON-7788',
      adminNote: 'Disbursed by test suite'
    });

    // Reconcile all transactions in ledger for this provider
    const reconTxns = await WalletTransaction.find({ wallet: reconWallet._id });
    let calculatedBalance = 0;
    reconTxns.forEach(t => {
      if (['booking_earning', 'withdrawal_refund', 'adjustment_credit', 'COMMISSION_REFUND'].includes(t.type)) {
        calculatedBalance += t.amount;
      } else if (['withdrawal', 'adjustment_debit', 'penalty', 'COMMISSION_WALLET_AUTO_DEBIT'].includes(t.type)) {
        calculatedBalance -= t.amount;
      }
    });

    const finalReconWallet = await ProviderWallet.findById(reconWallet._id);
    const delta = Math.abs(calculatedBalance - finalReconWallet.availableBalance);
    const pass18 = delta === 0 && finalReconWallet.totalWithdrawn === 700;

    testResults.push({
      scenario: 'Scenario 18: Full Ledger Balance Reconciliation',
      expected: 'Mathematical invariant: Sum(Ledger Debits/Credits) == final availableBalance (Delta = 0.00)',
      actual: `Calculated: ₹${calculatedBalance.toFixed(2)}, Actual: ₹${finalReconWallet.availableBalance.toFixed(2)}, Delta: ₹${delta.toFixed(2)}`,
      pass: pass18
    });
    console.log(pass18 ? '✓ PASS' : '✗ FAIL', testResults[testResults.length - 1]);

    // Cleanup recon provider documents
    await WalletTransaction.deleteMany({ wallet: reconWallet._id });
    await WithdrawalRequest.deleteMany({ wallet: reconWallet._id });
    await ProviderWallet.deleteOne({ _id: reconWallet._id });
    await Provider.deleteOne({ _id: reconProvider._id });
    await User.deleteOne({ _id: reconUser._id });
    await Booking.deleteOne({ _id: reconBooking._id });

    // =========================================================================
    // TEST RESULTS SUMMARY TABLE
    // =========================================================================
    console.log('\n================================================================================');
    console.log('=== TEST SUITE EXECUTION SUMMARY ===');
    console.log('================================================================================');
    console.table(testResults.map(r => ({
      Scenario: r.scenario,
      Status: r.pass ? 'PASS' : 'FAIL',
      Actual: r.actual
    })));

    const passedCount = testResults.filter(r => r.pass).length;
    const totalCount = testResults.length;
    console.log(`\nTOTAL PASSED: ${passedCount} / ${totalCount}`);

    if (passedCount === totalCount) {
      console.log('>>> ALL 18 FINANCIAL SAFETY SCENARIOS PASSED WITH ZERO TOLERANCE <<<\n');
    } else {
      console.error(`>>> ${totalCount - passedCount} TESTS FAILED <<<`);
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('[TEST_SUITE_FATAL_ERROR]', err);
    process.exitCode = 1;
  } finally {
    // Clean up temporary test documents
    console.log('[CLEANUP] Cleaning up staging test documents...');
    try {
      if (wallet) {
        await WalletTransaction.deleteMany({ wallet: wallet._id });
        await WithdrawalRequest.deleteMany({ wallet: wallet._id });
        await ProviderWallet.deleteOne({ _id: wallet._id });
      }
      if (testProvider) await Provider.deleteOne({ _id: testProvider._id });
      if (testUser) await User.deleteOne({ _id: testUser._id });
      if (testCustomer) await Customer.deleteOne({ _id: testCustomer._id });
      if (testCustomerUser) await User.deleteOne({ _id: testCustomerUser._id });
      if (testService) await Service.deleteOne({ _id: testService._id });
      if (testCategory) await Category.deleteOne({ _id: testCategory._id });
      if (adminUser) await User.deleteOne({ _id: adminUser._id });
      await Booking.deleteMany({ bookingNumber: { $regex: new RegExp(`MND-.*-${timestamp}`) } });
      console.log('[CLEANUP] Staging test documents cleaned up successfully.');
    } catch (cleanupErr) {
      console.warn('[CLEANUP_WARN]', cleanupErr.message);
    }
    await mongoose.disconnect();
    console.log('[SECTION: FINISHED]');
  }
}

runAutoDeductTestSuite();
