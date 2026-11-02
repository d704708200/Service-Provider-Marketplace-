const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const {
  Provider,
  User,
  ProviderWallet,
  WalletTransaction,
  WithdrawalRequest
} = require('./src/models');
const walletService = require('./src/services/walletService');

async function runWithdrawalRegressionSuite() {
  console.log('=== STARTING WITHDRAWAL REGRESSION TEST SUITE ===');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[OK] Connected to MongoDB Atlas');

  try {
    // 1. Setup dedicated test provider
    const uniqueEmail = `wdr.test.${Date.now()}@marketplace.com`;
    const uniquePhone = `87${Date.now().toString().slice(-8)}`;
    const testUser = await User.create({
      name: 'Withdrawal Test Provider',
      email: uniqueEmail,
      phone: uniquePhone,
      password: 'password123',
      role: 'provider',
      isActive: true
    });

    const testProvider = await Provider.create({
      user: testUser._id,
      businessName: 'Withdrawal Test Electricals',
      phone: uniquePhone,
      verificationStatus: 'verified',
      isAvailable: true
    });

    // Initialize wallet with exactly ₹680 balance and ₹680 totalEarnings
    const initialWallet = await ProviderWallet.create({
      provider: testProvider._id,
      availableBalance: 680,
      pendingBalance: 0,
      pendingWithdrawal: 0,
      totalEarnings: 680,
      totalWithdrawn: 0,
      status: 'active'
    });

    console.log('[SETUP] Initial wallet created with availableBalance: ₹680, totalEarnings: ₹680');

    // -------------------------------------------------------------
    // TEST 1: ₹680 balance with ₹100 withdrawal
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: ₹680 Balance with ₹100 Withdrawal ---');
    const wdr1 = await walletService.requestWithdrawal(testProvider._id, {
      amount: 100,
      payoutMethod: 'bank_transfer',
      payoutDetails: {
        accountHolderName: 'Test Tech',
        accountNumber: '987654321012',
        ifscCode: 'SBIN0001234',
        bankName: 'SBI'
      }
    });

    const walletAfterWdr1 = await ProviderWallet.findById(initialWallet._id);
    console.log('[TEST 1 RESULT]:', {
      availableBalance: walletAfterWdr1.availableBalance,
      pendingWithdrawal: walletAfterWdr1.pendingWithdrawal,
      totalEarnings: walletAfterWdr1.totalEarnings,
      status: wdr1.withdrawalRequest.status
    });

    if (walletAfterWdr1.availableBalance !== 580) {
      throw new Error(`Expected availableBalance 580, got ${walletAfterWdr1.availableBalance}`);
    }
    if (walletAfterWdr1.pendingWithdrawal !== 100) {
      throw new Error(`Expected pendingWithdrawal 100, got ${walletAfterWdr1.pendingWithdrawal}`);
    }
    if (walletAfterWdr1.totalEarnings !== 680) {
      throw new Error(`Expected totalEarnings 680, got ${walletAfterWdr1.totalEarnings}`);
    }
    console.log('[TEST 1 PASSED] Available balance became ₹580, pending became ₹100, earnings preserved at ₹680.');

    // -------------------------------------------------------------
    // TEST 2: Overdraft Prevention (Cannot become negative)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Overdraft & Negative Balance Prevention ---');
    try {
      await walletService.requestWithdrawal(testProvider._id, {
        amount: 600, // Available is only 580
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'test@upi' }
      });
      throw new Error('Should have rejected withdrawal exceeding available balance!');
    } catch (err) {
      console.log('[TEST 2 PASSED] Overdraft rejected correctly:', err.message);
    }

    const walletAfterOverdraft = await ProviderWallet.findById(initialWallet._id);
    if (walletAfterOverdraft.availableBalance !== 580) {
      throw new Error(`Balance altered on overdraft attempt! Got ${walletAfterOverdraft.availableBalance}`);
    }

    // -------------------------------------------------------------
    // TEST 3: Concurrency Protection (Never allow negative balance)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Concurrent Withdrawal Requests ---');
    // Balance is 580. Try 4 simultaneous withdrawals of ₹200 each (total ₹800 requested).
    // Only 2 requests should succeed (2 * 200 = 400, leaving 180). 2 must fail.
    const concurrentWithdrawals = await Promise.allSettled([
      walletService.requestWithdrawal(testProvider._id, {
        amount: 200,
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'c1@upi' }
      }),
      walletService.requestWithdrawal(testProvider._id, {
        amount: 200,
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'c2@upi' }
      }),
      walletService.requestWithdrawal(testProvider._id, {
        amount: 200,
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'c3@upi' }
      }),
      walletService.requestWithdrawal(testProvider._id, {
        amount: 200,
        payoutMethod: 'upi',
        payoutDetails: { upiId: 'c4@upi' }
      })
    ]);

    const succeeded = concurrentWithdrawals.filter((r) => r.status === 'fulfilled');
    const failed = concurrentWithdrawals.filter((r) => r.status === 'rejected');

    console.log(`Concurrent results: ${succeeded.length} succeeded, ${failed.length} rejected.`);
    const walletAfterConcurrent = await ProviderWallet.findById(initialWallet._id);
    console.log('Balance after concurrent attempts:', {
      availableBalance: walletAfterConcurrent.availableBalance,
      pendingWithdrawal: walletAfterConcurrent.pendingWithdrawal
    });

    if (succeeded.length !== 2 || failed.length !== 2) {
      throw new Error(`Expected exactly 2 succeeded and 2 rejected, got ${succeeded.length} / ${failed.length}`);
    }
    if (walletAfterConcurrent.availableBalance !== 180) {
      throw new Error(`Expected balance 180, got ${walletAfterConcurrent.availableBalance}`);
    }
    if (walletAfterConcurrent.pendingWithdrawal !== 500) {
      throw new Error(`Expected pending 500 (100 + 400), got ${walletAfterConcurrent.pendingWithdrawal}`);
    }
    console.log('[TEST 3 PASSED] Concurrent requests safely handled without overdraft.');

    // -------------------------------------------------------------
    // TEST 4: Rejection and Exactly-Once Refund
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Rejection & Exactly-Once Refund ---');
    const rejResult = await walletService.adminRejectWithdrawal(
      wdr1.withdrawalRequest._id,
      testUser._id,
      'Invalid bank account details'
    );

    console.log('[TEST 4 RESULT]:', {
      availableBalance: rejResult.walletSummary.availableBalance,
      pendingWithdrawal: rejResult.walletSummary.pendingWithdrawal,
      status: rejResult.withdrawal.status
    });

    // Available was 180, refunded 100 -> 280. Pending was 500 -> 400.
    if (rejResult.walletSummary.availableBalance !== 280) {
      throw new Error(`Expected balance 280, got ${rejResult.walletSummary.availableBalance}`);
    }
    if (rejResult.walletSummary.pendingWithdrawal !== 400) {
      throw new Error(`Expected pending 400, got ${rejResult.walletSummary.pendingWithdrawal}`);
    }

    // Try rejecting AGAIN (Duplicate rejection attack / race condition)
    try {
      await walletService.adminRejectWithdrawal(
        wdr1.withdrawalRequest._id,
        testUser._id,
        'Duplicate rejection attempt'
      );
      throw new Error('Should have rejected second rejection attempt!');
    } catch (err) {
      console.log('Duplicate rejection blocked correctly:', err.message);
    }

    const walletAfterDupRej = await ProviderWallet.findById(initialWallet._id);
    if (walletAfterDupRej.availableBalance !== 280) {
      throw new Error(`Double refund occurred! Balance changed to ${walletAfterDupRej.availableBalance}`);
    }
    console.log('[TEST 4 PASSED] Refunded ₹100 exactly once. Duplicate rejection prevented.');

    // -------------------------------------------------------------
    // TEST 5: Approval and Payout Disbursement
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Approval & Payout Disbursement ---');
    const successfulWdr = succeeded[0].value.withdrawalRequest;

    await walletService.adminApproveWithdrawal(successfulWdr._id, testUser._id, 'Approved for transfer');
    const payoutResult = await walletService.adminPayoutWithdrawal(
      successfulWdr._id,
      testUser._id,
      { transactionReference: 'UTR-REG-998877', adminNote: 'NEFT transfer complete' }
    );

    console.log('[TEST 5 RESULT]:', {
      availableBalance: payoutResult.walletSummary.availableBalance,
      pendingWithdrawal: payoutResult.walletSummary.pendingWithdrawal,
      totalWithdrawn: payoutResult.walletSummary.totalWithdrawn,
      status: payoutResult.withdrawal.status
    });

    // Pending was 400, disbursed 200 -> 200. Total withdrawn becomes 200.
    if (payoutResult.walletSummary.availableBalance !== 280) {
      throw new Error(`Expected available balance 280, got ${payoutResult.walletSummary.availableBalance}`);
    }
    if (payoutResult.walletSummary.pendingWithdrawal !== 200) {
      throw new Error(`Expected pending withdrawal 200, got ${payoutResult.walletSummary.pendingWithdrawal}`);
    }
    if (payoutResult.walletSummary.totalWithdrawn !== 200) {
      throw new Error(`Expected totalWithdrawn 200, got ${payoutResult.walletSummary.totalWithdrawn}`);
    }

    // Try paying AGAIN (Duplicate payout attack)
    try {
      await walletService.adminPayoutWithdrawal(
        successfulWdr._id,
        testUser._id,
        { transactionReference: 'UTR-DUP-1111', adminNote: 'Duplicate payout' }
      );
      throw new Error('Should have rejected duplicate payout attempt!');
    } catch (err) {
      console.log('Duplicate payout blocked correctly:', err.message);
    }

    const walletAfterDupPay = await ProviderWallet.findById(initialWallet._id);
    if (walletAfterDupPay.totalWithdrawn !== 200) {
      throw new Error(`Double payout occurred! Total withdrawn changed to ${walletAfterDupPay.totalWithdrawn}`);
    }
    console.log('[TEST 5 PASSED] Disbursed ₹200 payout correctly. Duplicate payout blocked.');

    // Clean up test data
    await ProviderWallet.deleteMany({ provider: testProvider._id });
    await WalletTransaction.deleteMany({ provider: testProvider._id });
    await WithdrawalRequest.deleteMany({ provider: testProvider._id });
    await Provider.deleteOne({ _id: testProvider._id });
    await User.deleteOne({ _id: testUser._id });

    console.log('\n=== ALL WITHDRAWAL REGRESSION TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await mongoose.disconnect();
    console.log('[OK] Disconnected from MongoDB');
  }
}

runWithdrawalRegressionSuite().catch((err) => {
  console.error('[WITHDRAWAL REGRESSION TEST FAILED]', err);
  process.exit(1);
});

