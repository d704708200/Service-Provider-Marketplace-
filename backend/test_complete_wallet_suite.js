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
const paymentService = require('./src/services/paymentService');

async function runCompleteFinancialTestSuite() {
  console.log('================================================================================');
  console.log('=== TASK: COMPLETE MENDROO PROVIDER WALLET, COMMISSION & WITHDRAWAL TESTING ===');
  console.log('================================================================================\n');

  // Verify MongoDB Connection
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SECTION 1: ENVIRONMENT SETUP]');
  console.log('1. Database Connected:', mongoose.connection.name);
  console.log('2. Environment:', process.env.NODE_ENV || 'development');
  console.log('3. Razorpay Key ID:', process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 8)}... (TEST MODE)` : 'N/A');
  const isTestMode = (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test');
  if (!isTestMode) {
    console.warn('[WARN] Razorpay key does not start with rzp_test. Ensuring mock/test safety.');
  }

  const resultsTable = [];
  const auditLog = {
    testAccountId: null,
    initialBalances: {},
    finalBalances: {},
    bookingIds: [],
    transactionIds: [],
    withdrawalReferences: [],
    commissionSettlementReferences: []
  };

  let testUser = null;
  let testProvider = null;
  let testCustomer = null;
  let testCustomerUser = null;
  let testCategory = null;
  let testService = null;
  let adminUser = null;

  try {
    const timestamp = Date.now().toString().slice(-6);

    // Create Admin User for audit operations
    adminUser = await User.create({
      name: `Staging Admin ${timestamp}`,
      email: `admin.staging.${timestamp}@example.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      password: 'StagingAdminPassword123!',
      role: 'admin',
      isActive: true
    });

    // Create Customer for Bookings
    testCustomerUser = await User.create({
      name: `Staging Customer ${timestamp}`,
      email: `customer.staging.${timestamp}@example.com`,
      phone: `92${Date.now().toString().slice(-8)}`,
      password: 'StagingCustomerPassword123!',
      role: 'customer',
      isActive: true
    });

    testCustomer = await Customer.create({
      user: testCustomerUser._id,
      name: testCustomerUser.name,
      phone: testCustomerUser.phone,
      email: testCustomerUser.email
    });

    // Create Dedicated Staging Provider Account
    testUser = await User.create({
      name: `Mendroo Test Provider ${timestamp}`,
      email: `staging.provider.${timestamp}@example.com`,
      phone: `93${Date.now().toString().slice(-8)}`,
      password: 'StagingProviderPassword123!',
      role: 'provider',
      isActive: true
    });

    testProvider = await Provider.create({
      user: testUser._id,
      businessName: `Mendroo Elite Services ${timestamp}`,
      phone: testUser.phone,
      verificationStatus: 'verified',
      isAvailable: true
    });

    const providerId = testProvider._id;
    auditLog.testAccountId = providerId.toString();
    console.log(`[SETUP] Dedicated Staging Test Provider Created: ${providerId} (${testUser.phone})`);

    // Ensure category and service exist
    testCategory = await Category.findOne({ isActive: true });
    if (!testCategory) {
      testCategory = await Category.create({
        name: `Test Cat ${timestamp}`,
        slug: `test-cat-${timestamp}`,
        isActive: true
      });
    }

    testService = await Service.findOne({ isActive: true });
    if (!testService) {
      testService = await Service.create({
        name: `Electrical Diagnostic ${timestamp}`,
        category: testCategory._id,
        price: 1000,
        priceType: 'fixed',
        isActive: true
      });
    }

    // 1. Initial Provider Wallet setup
    let initialWallet = await walletService.getOrCreateWallet(providerId);
    auditLog.initialBalances = {
      availableBalance: initialWallet.availableBalance,
      pendingBalance: initialWallet.pendingBalance,
      pendingWithdrawal: initialWallet.pendingWithdrawal,
      commissionDue: initialWallet.commissionDue || 0,
      totalEarnings: initialWallet.totalEarnings,
      totalWithdrawn: initialWallet.totalWithdrawn
    };
    console.log('4. Initial Balances:', auditLog.initialBalances);

    // Apply temporary test credit of ₹2,000 with mandatory audit reason
    console.log('\n[APPLYING TEMPORARY TEST CREDIT: ₹2,000]');
    const testCreditRes = await walletService.adminAdjustWallet(
      initialWallet._id,
      adminUser._id,
      {
        type: 'credit',
        amount: 2000,
        reason: 'Staging Test Environment Wallet Credit Verification for Provider Payout Testing'
      }
    );
    auditLog.transactionIds.push(testCreditRes.transaction.transactionReference);
    console.log(`[OK] Test Credit Applied. Reference: ${testCreditRes.transaction.transactionReference}`);
    console.log(`[OK] Available Balance: ₹${testCreditRes.wallet.availableBalance}, Total Earnings: ₹${testCreditRes.wallet.totalEarnings}`);

    resultsTable.push({
      test: 'Test wallet credit (₹2,000)',
      expected: '₹2,000 Available Balance, Audit transaction created',
      actual: `₹${testCreditRes.wallet.availableBalance} Balance (${testCreditRes.transaction.transactionReference})`,
      status: testCreditRes.wallet.availableBalance === 2000 ? 'PASS' : 'FAIL'
    });

    // Helper for mock HMAC signatures
    const testSecret = 'staging_mock_razorpay_secret_12345';
    process.env.RAZORPAY_KEY_SECRET = testSecret;
    const generateSignature = (orderId, paymentId) => {
      return crypto.createHmac('sha256', testSecret).update(`${orderId}|${paymentId}`).digest('hex');
    };

    // Store original payment methods
    const originalFetchPayment = paymentService.fetchPayment;
    const originalCapturePayment = paymentService.capturePayment;
    const originalFetchOrderPayments = paymentService.fetchOrderPayments;
    const originalCreateOrder = paymentService.createOrder;

    // =========================================================================
    // SECTION 2: TEST CASH / OFFLINE BOOKING
    // =========================================================================
    console.log('\n================================================================');
    console.log('[SECTION 2: TEST CASH / OFFLINE BOOKING]');
    console.log('================================================================');
    // Cash Booking: ₹1,000 total. Configured commission rate: 15% -> ₹150 due.
    const cashBooking = await Booking.create({
      bookingReference: `STG-CSH-${Date.now().toString().slice(-4)}`,
      customer: testCustomer._id,
      provider: providerId,
      service: testService._id,
      status: 'in_progress',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      address: { street: '123 Staging Lane', city: 'Bengaluru', pincode: '560001' },
      pricing: { basePrice: 1000, totalAmount: 1000 },
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    });
    auditLog.bookingIds.push(cashBooking.bookingReference);

    // 1. Customer pays provider directly in cash
    // 2. Provider marks cash received and completes service
    cashBooking.paymentStatus = 'paid';
    cashBooking.status = 'completed';
    cashBooking.completedAt = new Date();
    cashBooking.paymentDetails = {
      cashCollectedByProvider: true,
      cashCollectedAt: new Date(),
      cashConfirmedByCustomer: true,
      cashConfirmedByCustomerAt: new Date()
    };
    await cashBooking.save();

    // 3. Process cash booking accounting
    const cashWalletRes = await walletService.creditBookingEarnings(cashBooking._id);
    auditLog.transactionIds.push(cashWalletRes.transaction.transactionReference);

    console.log('[CASH BOOKING COMPLETED]');
    console.log(`- Booking Ref: ${cashBooking.bookingReference}`);
    console.log(`- Gross Cash Collected: ₹1,000`);
    console.log(`- Commission Added to Commission Due: ₹${cashWalletRes.platformCommission}`);
    console.log(`- Available Balance: ₹${cashWalletRes.balanceAfter}`);
    console.log(`- Commission Due: ₹${cashWalletRes.commissionDue}`);

    // Verify Available Balance was NOT reduced by gross cash amount or commission
    const cashOk = cashWalletRes.balanceAfter === 2000 &&
                   cashWalletRes.commissionDue === 150 &&
                   cashWalletRes.platformCommission === 150;

    resultsTable.push({
      test: 'Cash booking (₹1,000)',
      expected: 'Commission Due = ₹150, Available Balance untouched (₹2,000)',
      actual: `Commission Due = ₹${cashWalletRes.commissionDue}, Balance = ₹${cashWalletRes.balanceAfter}`,
      status: cashOk ? 'PASS' : 'FAIL'
    });

    // Verify Idempotency: Duplicate cash completion request
    const duplicateCashRes = await walletService.creditBookingEarnings(cashBooking._id);
    const dupCashWallet = await ProviderWallet.findOne({ provider: providerId });
    const dupCashOk = duplicateCashRes.message.includes('already been recorded') &&
                      dupCashWallet.availableBalance === 2000 &&
                      dupCashWallet.commissionDue === 150;

    resultsTable.push({
      test: 'Duplicate cash booking completion (Idempotency)',
      expected: 'Skipped cleanly, zero balance change, zero duplicate commission',
      actual: `Message: "${duplicateCashRes.message}", Balance: ₹${dupCashWallet.availableBalance}, CommDue: ₹${dupCashWallet.commissionDue}`,
      status: dupCashOk ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // SECTION 3: TEST ONLINE BOOKING COMMISSION & ALL-OR-NOTHING RULE
    // =========================================================================
    console.log('\n================================================================');
    console.log('[SECTION 3: TEST ONLINE BOOKING COMMISSION & ALL-OR-NOTHING]');
    console.log('================================================================');

    // Case A: Commission Due = ₹500, Online earning = ₹300 (< ₹500)
    // Expected: Zero deduction. Commission Due remains ₹500.
    console.log('\n--- CASE A: Commission Due ₹500, Single Eligible Online Earning ₹300 ---');
    // Set wallet commissionDue to ₹500 and enable autoCommissionAdjustment
    await ProviderWallet.findByIdAndUpdate(initialWallet._id, {
      $set: { commissionDue: 500, autoCommissionAdjustment: true }
    });

    // Gross amount = 353. 15% commission = 53. Net earning = 300.
    const onlineBookingCaseA = await Booking.create({
      bookingReference: `STG-ONL-A-${Date.now().toString().slice(-4)}`,
      customer: testCustomer._id,
      provider: providerId,
      service: testService._id,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '12:00', endTime: '13:00' },
      address: { street: '123 Staging Lane', city: 'Bengaluru', pincode: '560001' },
      pricing: { basePrice: 353, totalAmount: 353 },
      paymentStatus: 'paid',
      paymentMethod: 'online'
    });
    auditLog.bookingIds.push(onlineBookingCaseA.bookingReference);

    const onlineResA = await walletService.creditBookingEarnings(onlineBookingCaseA._id);
    const walletAfterCaseA = await ProviderWallet.findById(initialWallet._id);

    console.log(`[CASE A RESULT]`);
    console.log(`- Credited Net Earning: ₹${onlineResA.providerNetEarnings}`);
    console.log(`- Platform Commission on Booking: ₹${onlineResA.platformCommission}`);
    console.log(`- Commission Due: ₹${walletAfterCaseA.commissionDue} (Must remain ₹500)`);
    console.log(`- Available Balance: ₹${walletAfterCaseA.availableBalance} (₹2,000 + ₹300 = ₹2,300)`);

    const caseAOk = walletAfterCaseA.commissionDue === 500 &&
                    onlineResA.providerNetEarnings === 300 &&
                    walletAfterCaseA.availableBalance === 2300;

    resultsTable.push({
      test: 'Insufficient earnings (Earning ₹300 < CommDue ₹500)',
      expected: 'Zero deduction. CommDue remains ₹500, Balance increases by ₹300 to ₹2,300',
      actual: `CommDue = ₹${walletAfterCaseA.commissionDue}, Balance = ₹${walletAfterCaseA.availableBalance}`,
      status: caseAOk ? 'PASS' : 'FAIL'
    });

    // Case B: Commission Due = ₹500, Single Eligible Online Earning = ₹800 (>= ₹500)
    // Expected: Exact ₹500 adjusted in ONE single transaction. Commission Due becomes ₹0.
    // Remaining net added to balance = ₹800 - ₹500 = ₹300.
    // Previous balance = ₹2,300. Final balance = ₹2,300 + ₹300 = ₹2,600.
    console.log('\n--- CASE B: Commission Due ₹500, Single Eligible Online Earning ₹800 ---');
    // Gross amount = 941. 15% commission = 141. Net earning = 800.
    const onlineBookingCaseB = await Booking.create({
      bookingReference: `STG-ONL-B-${Date.now().toString().slice(-4)}`,
      customer: testCustomer._id,
      provider: providerId,
      service: testService._id,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '14:00', endTime: '15:00' },
      address: { street: '123 Staging Lane', city: 'Bengaluru', pincode: '560001' },
      pricing: { basePrice: 941, totalAmount: 941 },
      paymentStatus: 'paid',
      paymentMethod: 'online'
    });
    auditLog.bookingIds.push(onlineBookingCaseB.bookingReference);

    const onlineResB = await walletService.creditBookingEarnings(onlineBookingCaseB._id);
    const walletAfterCaseB = await ProviderWallet.findById(initialWallet._id);

    console.log(`[CASE B RESULT]`);
    console.log(`- Credited Net Earning: ₹${onlineResB.providerNetEarnings}`);
    console.log(`- Auto-Adjustment Performed: Full settlement in ONE transaction`);
    console.log(`- Commission Due: ₹${walletAfterCaseB.commissionDue} (Must be ₹0)`);
    console.log(`- Available Balance: ₹${walletAfterCaseB.availableBalance} (Must be ₹2,600)`);

    // Verify COMMISSION_ADJUSTMENT transaction exists
    const adjTxn = await WalletTransaction.findOne({
      provider: providerId,
      booking: onlineBookingCaseB._id,
      type: 'COMMISSION_ADJUSTMENT'
    });
    if (adjTxn) auditLog.transactionIds.push(adjTxn.transactionReference);

    const caseBOk = walletAfterCaseB.commissionDue === 0 &&
                    walletAfterCaseB.availableBalance === 2600 &&
                    adjTxn !== null &&
                    adjTxn.amount === 500;

    resultsTable.push({
      test: 'Full commission auto-adjustment (Earning ₹800 >= CommDue ₹500)',
      expected: 'One-time ₹500 deduction. CommDue becomes ₹0, Balance becomes ₹2,600',
      actual: `CommDue = ₹${walletAfterCaseB.commissionDue}, Balance = ₹${walletAfterCaseB.availableBalance}, AdjTxn: ${adjTxn?.transactionReference}`,
      status: caseBOk ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // SECTION 4: TEST COMMISSION PAYABLE TO MENDROO (PAY FULL COMMISSION)
    // =========================================================================
    console.log('\n================================================================');
    console.log('[SECTION 4: TEST COMMISSION PAYABLE TO MENDROO (PAY FULL COMMISSION)]');
    console.log('================================================================');
    // Set commission due to ₹350
    await ProviderWallet.findByIdAndUpdate(initialWallet._id, {
      $set: { commissionDue: 350 }
    });

    // 1. Create Pay Commission Order
    paymentService.createOrder = async ({ amountInRupees }) => ({
      id: `order_stg_comm_${Date.now()}`,
      amount: Math.round(amountInRupees * 100),
      currency: 'INR',
      status: 'created'
    });

    const orderRes = await walletService.createPayCommissionOrder(providerId);
    auditLog.commissionSettlementReferences.push(orderRes.orderId);
    console.log(`- Created Razorpay Settlement Order: ${orderRes.orderId} for exact ₹${orderRes.amount} (${orderRes.amountInPaise} paise)`);

    // 2. Test Failed Payment
    const failPaymentId = `pay_stg_fail_${Date.now()}`;
    const failSig = generateSignature(orderRes.orderId, failPaymentId);
    paymentService.fetchPayment = async () => ({
      id: failPaymentId,
      order_id: orderRes.orderId,
      amount: 35000,
      currency: 'INR',
      status: 'failed'
    });

    let failRejected = false;
    try {
      await walletService.verifyAndSettleCommissionPayment(providerId, {
        razorpayOrderId: orderRes.orderId,
        razorpayPaymentId: failPaymentId,
        razorpaySignature: failSig
      });
    } catch (err) {
      failRejected = err.message.includes("Payment status is 'failed'");
    }

    const walletAfterFail = await ProviderWallet.findById(initialWallet._id);
    const failOk = failRejected && walletAfterFail.commissionDue === 350;

    resultsTable.push({
      test: 'Failed commission payment',
      expected: 'Rejected with 400, Commission Due remains ₹350',
      actual: `Rejected: ${failRejected}, CommDue = ₹${walletAfterFail.commissionDue}`,
      status: failOk ? 'PASS' : 'FAIL'
    });

    // 3. Test Successful Captured Payment
    const successPaymentId = `pay_stg_succ_${Date.now()}`;
    const successSig = generateSignature(orderRes.orderId, successPaymentId);
    paymentService.fetchPayment = async () => ({
      id: successPaymentId,
      order_id: orderRes.orderId,
      amount: 35000,
      currency: 'INR',
      status: 'captured'
    });

    const settleRes = await walletService.verifyAndSettleCommissionPayment(providerId, {
      razorpayOrderId: orderRes.orderId,
      razorpayPaymentId: successPaymentId,
      razorpaySignature: successSig
    });
    auditLog.transactionIds.push(settleRes.transaction.transactionReference);
    auditLog.commissionSettlementReferences.push(successPaymentId);

    const walletAfterSettle = await ProviderWallet.findById(initialWallet._id);
    const settleOk = walletAfterSettle.commissionDue === 0 &&
                     settleRes.wallet.commissionDue === 0 &&
                     walletAfterSettle.availableBalance === 2600;

    resultsTable.push({
      test: 'Pay Full Commission captured payment',
      expected: 'Commission Due = ₹0, Available Balance untouched (₹2,600), COMMISSION_PAYMENT logged',
      actual: `CommDue = ₹${walletAfterSettle.commissionDue}, Balance = ₹${walletAfterSettle.availableBalance}, Txn: ${settleRes.transaction.transactionReference}`,
      status: settleOk ? 'PASS' : 'FAIL'
    });

    // 4. Test Duplicate Payment / Webhook Idempotency
    const dupSettleRes = await walletService.verifyAndSettleCommissionPayment(providerId, {
      razorpayOrderId: orderRes.orderId,
      razorpayPaymentId: successPaymentId,
      razorpaySignature: successSig
    });
    const dupSettleWallet = await ProviderWallet.findById(initialWallet._id);
    const dupSettleOk = dupSettleRes.message.includes('already settled') &&
                        dupSettleWallet.commissionDue === 0 &&
                        dupSettleWallet.availableBalance === 2600;

    resultsTable.push({
      test: 'Duplicate commission payment webhook (Idempotency)',
      expected: 'Skipped cleanly, zero balance change, zero duplicate settlement',
      actual: `Message: "${dupSettleRes.message}", CommDue: ₹${dupSettleWallet.commissionDue}, Balance: ₹${dupSettleWallet.availableBalance}`,
      status: dupSettleOk ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // SECTION 5: TEST MAIN WALLET WITHDRAWAL (REQUEST, APPROVAL, REJECTION, OVERDRAW)
    // =========================================================================
    console.log('\n================================================================');
    console.log('[SECTION 5: TEST MAIN WALLET WITHDRAWAL]');
    console.log('================================================================');
    // Balance is ₹2,600.
    // 5A. Request withdrawal of ₹500
    const wdr1 = await walletService.requestWithdrawal(providerId, {
      amount: 500,
      payoutMethod: 'upi',
      payoutDetails: { upiId: 'provider@okaxis', accountHolderName: 'Mendroo Provider' }
    });
    auditLog.withdrawalReferences.push(wdr1.withdrawalRequest.requestReference);
    auditLog.transactionIds.push(wdr1.transaction.transactionReference);

    const walletAfterWdr1 = await ProviderWallet.findById(initialWallet._id);
    const wdr1Ok = walletAfterWdr1.availableBalance === 2100 &&
                   walletAfterWdr1.pendingWithdrawal === 500;

    resultsTable.push({
      test: 'Withdrawal request (₹500)',
      expected: 'Available Balance = ₹2,100, Pending Withdrawal = ₹500 reserved',
      actual: `Balance = ₹${walletAfterWdr1.availableBalance}, PendingWdr = ₹${walletAfterWdr1.pendingWithdrawal}`,
      status: wdr1Ok ? 'PASS' : 'FAIL'
    });

    // 5B. Request withdrawal exceeding available balance (e.g. ₹2,500 > ₹2,100)
    let overdrawRejected = false;
    try {
      await walletService.requestWithdrawal(providerId, {
        amount: 2500,
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'provider@okaxis', accountHolderName: 'Mendroo Provider' }
      });
    } catch (err) {
      overdrawRejected = err.message.includes('Insufficient available balance');
    }
    const walletAfterOverdraw = await ProviderWallet.findById(initialWallet._id);
    const overdrawOk = overdrawRejected && walletAfterOverdraw.availableBalance === 2100;

    resultsTable.push({
      test: 'Withdrawal exceeding available balance (₹2,500 > ₹2,100)',
      expected: 'Rejected with 400 error, Balance strictly unchanged (₹2,100)',
      actual: `Rejected: ${overdrawRejected}, Balance = ₹${walletAfterOverdraw.availableBalance}`,
      status: overdrawOk ? 'PASS' : 'FAIL'
    });

    // 5C. Admin approves ₹500 withdrawal and disburses payout
    await walletService.adminApproveWithdrawal(
      wdr1.withdrawalRequest._id,
      adminUser._id,
      'Documents verified, approved for payout'
    );
    const payoutRes = await walletService.adminPayoutWithdrawal(
      wdr1.withdrawalRequest._id,
      adminUser._id,
      {
        transactionReference: `NEFT-UTR-${Date.now()}`,
        adminNote: 'Processed via ICICI corporate banking API'
      }
    );
    const walletAfterPayout = await ProviderWallet.findById(initialWallet._id);
    const payoutOk = walletAfterPayout.availableBalance === 2100 &&
                     walletAfterPayout.pendingWithdrawal === 0 &&
                     walletAfterPayout.totalWithdrawn === 500 &&
                     payoutRes.withdrawal.status === 'paid';

    resultsTable.push({
      test: 'Withdrawal approval & payout (₹500)',
      expected: 'Status = paid, Pending cleared (₹0), Total Withdrawn = ₹500, Balance = ₹2,100',
      actual: `Status = ${payoutRes.withdrawal.status}, Pending = ₹${walletAfterPayout.pendingWithdrawal}, Withdrawn = ₹${walletAfterPayout.totalWithdrawn}, Balance = ₹${walletAfterPayout.availableBalance}`,
      status: payoutOk ? 'PASS' : 'FAIL'
    });

    // 5D. Admin rejects a pending withdrawal (Tests full refund back to available)
    const wdr2 = await walletService.requestWithdrawal(providerId, {
      amount: 300,
      payoutMethod: 'bank_transfer',
      payoutDetails: {
        accountHolderName: 'Mendroo Provider',
        accountNumber: '1234567890',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC'
      }
    });
    auditLog.withdrawalReferences.push(wdr2.withdrawalRequest.requestReference);
    auditLog.transactionIds.push(wdr2.transaction.transactionReference);

    const rejectRes = await walletService.adminRejectWithdrawal(
      wdr2.withdrawalRequest._id,
      adminUser._id,
      'Invalid IFSC code provided by provider'
    );
    auditLog.transactionIds.push(rejectRes.refundTransaction.transactionReference);

    const walletAfterReject = await ProviderWallet.findById(initialWallet._id);
    const rejectOk = walletAfterReject.availableBalance === 2100 &&
                     walletAfterReject.pendingWithdrawal === 0 &&
                     rejectRes.withdrawal.status === 'rejected';

    resultsTable.push({
      test: 'Withdrawal rejection & refund (₹300)',
      expected: 'Status = rejected, Reserved ₹300 returned to Available Balance (₹2,100)',
      actual: `Status = ${rejectRes.withdrawal.status}, Balance = ₹${walletAfterReject.availableBalance}, RefundTxn: ${rejectRes.refundTransaction.transactionReference}`,
      status: rejectOk ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // SECTION 6: COMBINED SCENARIO & FULL LEDGER RECONCILIATION AUDIT
    // =========================================================================
    console.log('\n================================================================');
    console.log('[SECTION 6: FULL LEDGER RECONCILIATION AUDIT]');
    console.log('================================================================');

    const finalWallet = await ProviderWallet.findById(initialWallet._id);
    const allTransactions = await WalletTransaction.find({ wallet: initialWallet._id }).sort({ createdAt: 1 });

    auditLog.finalBalances = {
      availableBalance: finalWallet.availableBalance,
      pendingBalance: finalWallet.pendingBalance,
      pendingWithdrawal: finalWallet.pendingWithdrawal,
      commissionDue: finalWallet.commissionDue || 0,
      totalEarnings: finalWallet.totalEarnings,
      totalWithdrawn: finalWallet.totalWithdrawn
    };

    console.log('Final Database Balances:', auditLog.finalBalances);
    console.log(`Total Transactions in Ledger: ${allTransactions.length}`);

    // Reconcile Available Balance from ledger transactions:
    // Credits: adjustment_credit (+2000), booking_earning (+300 net A), booking_earning (+800 net B), withdrawal_refund (+300)
    // Debits: COMMISSION_ADJUSTMENT (-500), withdrawal (-500), withdrawal (-300)
    // Net Available Balance Expected: 2000 + 300 + 800 + 300 - 500 - 500 - 300 = 2100.
    let calculatedBalance = 0;
    for (const txn of allTransactions) {
      if (txn.status === 'completed' || txn.status === 'pending' || txn.status === 'reversed') {
        if (txn.type === 'adjustment_credit' || txn.type === 'booking_earning' || txn.type === 'withdrawal_refund') {
          calculatedBalance += txn.amount;
        } else if (txn.type === 'adjustment_debit' || txn.type === 'withdrawal' || txn.type === 'COMMISSION_ADJUSTMENT') {
          calculatedBalance -= txn.amount;
        }
      }
    }

    const reconciliationDelta = Math.abs(finalWallet.availableBalance - calculatedBalance);
    const ledgerReconciled = reconciliationDelta === 0;

    console.log(`- Sum of Ledger Debits & Credits: ₹${calculatedBalance}`);
    console.log(`- Current Wallet Available Balance: ₹${finalWallet.availableBalance}`);
    console.log(`- Ledger Reconciliation Discrepancy: ₹${reconciliationDelta}`);

    resultsTable.push({
      test: 'Combined scenario ledger reconciliation',
      expected: 'Ledger calculated balance matches database available balance (Delta = 0)',
      actual: `Calculated: ₹${calculatedBalance}, Stored: ₹${finalWallet.availableBalance}, Delta: ₹${reconciliationDelta}`,
      status: ledgerReconciled ? 'PASS' : 'FAIL'
    });

    // =========================================================================
    // SECTION 7: CRITICAL NEGATIVE BALANCE PROTECTION
    // =========================================================================
    console.log('\n================================================================');
    console.log('[SECTION 7: CRITICAL NEGATIVE BALANCE TESTS]');
    console.log('================================================================');
    const negativeBalancePassed = finalWallet.availableBalance >= 0 && (finalWallet.commissionDue || 0) >= 0;

    resultsTable.push({
      test: 'Negative balance protection',
      expected: 'availableBalance >= 0 and commissionDue >= 0 at all times',
      actual: `availableBalance = ₹${finalWallet.availableBalance}, commissionDue = ₹${finalWallet.commissionDue || 0}`,
      status: negativeBalancePassed ? 'PASS' : 'FAIL'
    });

    // Restore original payment methods
    paymentService.fetchPayment = originalFetchPayment;
    paymentService.capturePayment = originalCapturePayment;
    paymentService.fetchOrderPayments = originalFetchOrderPayments;
    paymentService.createOrder = originalCreateOrder;

    console.log('\n================================================================');
    console.log('=== TEST REPORT SUMMARY TABLE ===');
    console.log('================================================================');
    console.table(resultsTable);

    console.log('\n=== AUDIT RECORD LOGS ===');
    console.log(JSON.stringify(auditLog, null, 2));

  } finally {
    // Cleanup isolated test data
    if (testProvider) {
      await ProviderWallet.deleteMany({ provider: testProvider._id });
      await WalletTransaction.deleteMany({ provider: testProvider._id });
      await WithdrawalRequest.deleteMany({ provider: testProvider._id });
      await Booking.deleteMany({ provider: testProvider._id });
      await Provider.deleteOne({ _id: testProvider._id });
    }
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (testCustomer) await Customer.deleteOne({ _id: testCustomer._id });
    if (testCustomerUser) await User.deleteOne({ _id: testCustomerUser._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (testService && testService.name.includes('Electrical Diagnostic')) await Service.deleteOne({ _id: testService._id });
    if (testCategory && testCategory.name.includes('Test Cat')) await Category.deleteOne({ _id: testCategory._id });

    await mongoose.disconnect();
    console.log('\n[CLEANUP] Dedicated isolated staging test fixtures removed cleanly. Disconnected from MongoDB.');
  }
}

runCompleteFinancialTestSuite().catch((err) => {
  console.error('[SUITE EXECUTION ERROR]', err);
  process.exit(1);
});
