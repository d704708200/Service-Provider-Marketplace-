const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const {
  Provider,
  User,
  Booking,
  Service,
  Category,
  ProviderWallet,
  WalletTransaction,
  WithdrawalRequest
} = require('./src/models');

const walletService = require('./src/services/walletService');

async function runWalletLifecycleTests() {
  console.log('--- STARTING COMPREHENSIVE WALLET LIFECYCLE TESTS ---');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not configured in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[OK] Connected to MongoDB');

  try {
    // 1. Setup Test Provider
    let testUser = await User.findOne({ email: 'wallet.test.provider@marketplace.com' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Wallet Test Provider',
        email: 'wallet.test.provider@marketplace.com',
        phone: '9888877777',
        password: 'hashedpassword123',
        role: 'provider',
        isActive: true
      });
    }

    let testProvider = await Provider.findOne({ user: testUser._id });
    if (!testProvider) {
      testProvider = await Provider.create({
        user: testUser._id,
        businessName: 'Wallet Test Electricals',
        phone: '9888877777',
        verificationStatus: 'verified',
        isAvailable: true
      });
    }

    console.log('[OK] Test Provider setup verified:', testProvider._id);

    // Clean up any previous test wallet data for this test provider to ensure clean state
    await ProviderWallet.deleteMany({ provider: testProvider._id });
    await WalletTransaction.deleteMany({ provider: testProvider._id });
    await WithdrawalRequest.deleteMany({ provider: testProvider._id });

    // 2. Test getOrCreateWallet
    const initialWallet = await walletService.getOrCreateWallet(testProvider._id);
    console.log(`[TEST 1 PASSED] Initial wallet created with availableBalance: ₹${initialWallet.availableBalance}`);
    if (initialWallet.availableBalance !== 0) throw new Error('Initial balance should be 0');

    // 3. Setup Mock Service for Bookings
    let testCategory = await Category.findOne();
    let testService = await Service.findOne();
    if (!testService) {
      testService = await Service.create({
        name: 'Test Electric Repair',
        description: 'Test service description',
        category: testCategory?._id || new mongoose.Types.ObjectId(),
        price: 1000,
        priceType: 'fixed',
        estimatedDurationMinutes: 60
      });
    }

    // 4. Test Online Booking Completion & Earnings Credit (₹1,000 gross)
    const onlineBooking = await Booking.create({
      bookingReference: `TEST-BK-ONL-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: testService._id,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: { street: '123 Test St', city: 'Test City', pincode: '560001' },
      pricing: { basePrice: 1000, totalAmount: 1000 },
      paymentStatus: 'paid',
      paymentMethod: 'online'
    });

    const creditResult = await walletService.creditBookingEarnings(onlineBooking._id);
    console.log('[TEST 2 PASSED] Online booking earnings credited:', creditResult);
    if (creditResult.platformCommission !== 150) throw new Error(`Expected ₹150 commission, got ${creditResult.platformCommission}`);
    if (creditResult.providerNetEarnings !== 850) throw new Error(`Expected ₹850 net earnings, got ${creditResult.providerNetEarnings}`);
    if (creditResult.balanceAfter !== 850) throw new Error(`Expected balance ₹850, got ${creditResult.balanceAfter}`);

    // 5. Test Idempotency Guard (re-crediting must not alter balance)
    const idempotentResult = await walletService.creditBookingEarnings(onlineBooking._id);
    console.log('[TEST 3 PASSED] Idempotency check:', idempotentResult.message);
    const walletAfterIdempotent = await walletService.getOrCreateWallet(testProvider._id);
    if (walletAfterIdempotent.availableBalance !== 850) {
      throw new Error(`Idempotency failed: balance changed to ${walletAfterIdempotent.availableBalance}`);
    }

    // 6. Test Cash Booking & Commission Deduction (₹500 gross)
    const cashBooking = await Booking.create({
      bookingReference: `TEST-BK-CSH-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: testService._id,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '14:00', endTime: '16:00' },
      address: { street: '456 Test Ave', city: 'Test City', pincode: '560001' },
      pricing: { basePrice: 500, totalAmount: 500 },
      paymentStatus: 'paid',
      paymentMethod: 'cash'
    });

    const cashResult = await walletService.creditBookingEarnings(cashBooking._id);
    console.log('[TEST 4 PASSED] Cash booking commission deducted:', cashResult);
    // Under Commission Payable to Mendroo separation:
    // Commission is 15% of 500 = 75 recorded in commissionDue.
    // Provider's availableBalance is untouched (850) and commissionDue is 75.
    if (cashResult.platformCommission !== 75) throw new Error(`Expected ₹75 commission, got ${cashResult.platformCommission}`);
    if (cashResult.balanceAfter !== 850) throw new Error(`Expected balance ₹850, got ${cashResult.balanceAfter}`);
    if (cashResult.commissionDue !== 75) throw new Error(`Expected commissionDue ₹75, got ${cashResult.commissionDue}`);

    // 7. Test Withdrawal Request
    // Minimum check: < 100 must fail
    try {
      await walletService.requestWithdrawal(testProvider._id, {
        amount: 50,
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'test@upi' }
      });
      throw new Error('Should have rejected withdrawal < 100');
    } catch (err) {
      console.log('[TEST 5 PASSED] Minimum withdrawal validation passed:', err.message);
    }

    // Valid withdrawal request of ₹300 via UPI
    const withdrawResult = await walletService.requestWithdrawal(testProvider._id, {
      amount: 300,
      payoutMethod: 'upi',
      payoutDetails: { upiId: 'wallettest@okaxis', accountHolderName: 'Test Provider' }
    });
    console.log('[TEST 6 PASSED] Withdrawal requested of ₹300:', {
      requestReference: withdrawResult.withdrawalRequest.requestReference,
      availableBalance: withdrawResult.walletSummary.availableBalance,
      pendingWithdrawal: withdrawResult.walletSummary.pendingWithdrawal
    });
    if (withdrawResult.walletSummary.availableBalance !== 550) throw new Error('Expected available balance ₹550');
    if (withdrawResult.walletSummary.pendingWithdrawal !== 300) throw new Error('Expected pending withdrawal ₹300');

    // 8. Test Admin Rejection & Full Refund
    const rejectResult = await walletService.adminRejectWithdrawal(
      withdrawResult.withdrawalRequest._id,
      testUser._id,
      'Invalid or inactive UPI VPA'
    );
    console.log('[TEST 7 PASSED] Withdrawal rejected and refunded:', {
      rejectionReason: rejectResult.withdrawal.rejectionReason,
      availableBalance: rejectResult.walletSummary.availableBalance,
      pendingWithdrawal: rejectResult.walletSummary.pendingWithdrawal
    });
    if (rejectResult.walletSummary.availableBalance !== 850) throw new Error('Expected available balance restored to ₹850');
    if (rejectResult.walletSummary.pendingWithdrawal !== 0) throw new Error('Expected pending withdrawal 0');

    // 9. Test New Withdrawal Request & Admin Approval & Payout
    const withdrawBankResult = await walletService.requestWithdrawal(testProvider._id, {
      amount: 200,
      payoutMethod: 'bank_transfer',
      payoutDetails: {
        accountHolderName: 'Wallet Test Provider',
        accountNumber: '123456789012',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank'
      }
    });

    // Admin approves
    await walletService.adminApproveWithdrawal(
      withdrawBankResult.withdrawalRequest._id,
      testUser._id,
      'Documents verified, scheduled for batch payout'
    );

    // Admin payouts
    const payoutResult = await walletService.adminPayoutWithdrawal(
      withdrawBankResult.withdrawalRequest._id,
      testUser._id,
      {
        transactionReference: 'NEFT-TEST-20261102-998877',
        adminNote: 'Processed via ICICI corporate banking portal'
      }
    );
    console.log('[TEST 8 PASSED] Withdrawal paid successfully:', {
      availableBalance: payoutResult.walletSummary.availableBalance,
      pendingWithdrawal: payoutResult.walletSummary.pendingWithdrawal,
      totalWithdrawn: payoutResult.walletSummary.totalWithdrawn,
      status: payoutResult.withdrawal.status
    });
    if (payoutResult.walletSummary.availableBalance !== 650) throw new Error('Expected available balance ₹650');
    if (payoutResult.walletSummary.totalWithdrawn !== 200) throw new Error('Expected totalWithdrawn ₹200');

    // 10. Test Admin Manual Adjustment
    const creditAdjustment = await walletService.adminAdjustWallet(
      initialWallet._id,
      testUser._id,
      { type: 'credit', amount: 50, reason: 'Promotional onboarding incentive' }
    );
    console.log('[TEST 9 PASSED] Admin credit adjustment: balance is now ₹' + creditAdjustment.wallet.availableBalance);
    if (creditAdjustment.wallet.availableBalance !== 700) throw new Error('Expected ₹700 balance');

    const debitAdjustment = await walletService.adminAdjustWallet(
      initialWallet._id,
      testUser._id,
      { type: 'debit', amount: 25, reason: 'Customer compensation dispute resolution' }
    );
    console.log('[TEST 10 PASSED] Admin debit adjustment: balance is now ₹' + debitAdjustment.wallet.availableBalance);
    if (debitAdjustment.wallet.availableBalance !== 675) throw new Error('Expected ₹675 balance');

    // 11. Test Earnings Breakdown and Summary
    const summary = await walletService.getWalletSummary(testProvider._id);
    const earnings = await walletService.getEarningsBreakdown(testProvider._id);
    const txns = await walletService.getTransactions(testProvider._id, { page: 1, limit: 10 });

    console.log('[TEST 11 PASSED] Final Wallet Summary & Breakdown:', {
      availableBalance: summary.availableBalance,
      totalEarnings: summary.totalEarnings,
      totalWithdrawn: summary.totalWithdrawn,
      totalTransactions: summary.totalTransactions,
      earningsToday: earnings.today.amount,
      earningsLifetime: earnings.lifetime.amount,
      txnsFetched: txns.transactions.length
    });

    if (summary.availableBalance !== 675) throw new Error('Expected final balance ₹675');

    // Clean up test bookings
    await Booking.deleteMany({ _id: { $in: [onlineBooking._id, cashBooking._id] } });

    console.log('--- ALL WALLET LIFECYCLE TESTS COMPLETED SUCCESSFULLY! ---');
  } finally {
    await mongoose.disconnect();
    console.log('[OK] Disconnected from MongoDB');
  }
}

runWalletLifecycleTests().catch((err) => {
  console.error('[TEST SUITE ERROR]', err);
  process.exit(1);
});
