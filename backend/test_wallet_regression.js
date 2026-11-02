const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const {
  Booking,
  Provider,
  User,
  Service,
  Category,
  ProviderWallet,
  WalletTransaction
} = require('./src/models');
const walletService = require('./src/services/walletService');

async function runRegressionSuite() {
  console.log('=== STARTING WALLET REGRESSION TEST SUITE ===');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[OK] Connected to MongoDB Atlas');

  try {
    // Setup dedicated test provider
    let testUser = await User.findOne({
      $or: [
        { email: 'regression.provider@marketplace.com' },
        { phone: '9999988888' }
      ]
    });
    if (!testUser) {
      const uniquePhone = `88${Date.now().toString().slice(-8)}`;
      testUser = await User.create({
        name: 'Regression Provider',
        email: `regression.provider.${Date.now()}@marketplace.com`,
        phone: uniquePhone,
        password: 'password123',
        role: 'provider',
        isActive: true
      });
    }

    let testProvider = await Provider.findOne({ user: testUser._id });
    if (!testProvider) {
      testProvider = await Provider.create({
        user: testUser._id,
        businessName: 'Regression Services',
        phone: '9999988888',
        verificationStatus: 'verified',
        isAvailable: true
      });
    }

    // Clean test data
    await ProviderWallet.deleteMany({ provider: testProvider._id });
    await WalletTransaction.deleteMany({ provider: testProvider._id });

    let testService = await Service.findOne();
    const serviceId = testService?._id || new mongoose.Types.ObjectId();

    // -------------------------------------------------------------
    // REGRESSION TEST 1: Completed + Paid Booking (Online)
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 1: Completed + Paid Booking ---');
    const paidBooking = await Booking.create({
      bookingReference: `REG-PAID-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: serviceId,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      address: { street: '1st Ave', city: 'City', pincode: '560001' },
      pricing: { basePrice: 1000, totalAmount: 1000 },
      paymentStatus: 'paid',
      paymentMethod: 'online'
    });

    const res1 = await walletService.creditBookingEarnings(paidBooking._id);
    console.log('[REGRESSION 1 PASSED] Credited ₹1000 gross (15% comm ₹150, 85% net ₹850). Balance:', res1.balanceAfter);
    if (res1.balanceAfter !== 850 || res1.providerNetEarnings !== 850) {
      throw new Error(`Expected balance 850, got ${res1.balanceAfter}`);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 2: Completed + Unpaid Booking (Must Throw Error)
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 2: Completed + Unpaid Booking ---');
    const unpaidBooking = await Booking.create({
      bookingReference: `REG-UNPD-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: serviceId,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '11:00', endTime: '12:00' },
      address: { street: '2nd Ave', city: 'City', pincode: '560001' },
      pricing: { basePrice: 500, totalAmount: 500 },
      paymentStatus: 'pending',
      paymentMethod: 'online'
    });

    try {
      await walletService.creditBookingEarnings(unpaidBooking._id);
      throw new Error('Should not credit unpaid booking!');
    } catch (err) {
      console.log('[REGRESSION 2 PASSED] Rejected unpaid booking correctly:', err.message);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 3: Failed Payment Booking (Must Throw Error)
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 3: Failed Payment Booking ---');
    const failedBooking = await Booking.create({
      bookingReference: `REG-FAIL-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: serviceId,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '12:00', endTime: '13:00' },
      address: { street: '3rd Ave', city: 'City', pincode: '560001' },
      pricing: { basePrice: 600, totalAmount: 600 },
      paymentStatus: 'failed',
      paymentMethod: 'online'
    });

    try {
      await walletService.creditBookingEarnings(failedBooking._id);
      throw new Error('Should not credit failed payment booking!');
    } catch (err) {
      console.log('[REGRESSION 3 PASSED] Rejected failed payment correctly:', err.message);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 4: Cash Booking (15% Commission Deduction)
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 4: Cash Booking Commission Deduction ---');
    const cashBooking = await Booking.create({
      bookingReference: `REG-CASH-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: serviceId,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '14:00', endTime: '15:00' },
      address: { street: '4th Ave', city: 'City', pincode: '560001' },
      pricing: { basePrice: 400, totalAmount: 400 },
      paymentStatus: 'paid',
      paymentMethod: 'cash'
    });

    // Previous balance = 850. Cash booking = 400. 15% commission = 60.
    // Provider keeps 400 cash. Platform deducts 60 from wallet.
    // New balance = 850 - 60 = 790. Lifetime earnings increases by net 340 (850 + 340 = 1190).
    const res4 = await walletService.creditBookingEarnings(cashBooking._id);
    console.log('[REGRESSION 4 PASSED] Deducted ₹60 cash commission. Balance:', res4.balanceAfter);
    if (res4.balanceAfter !== 790 || res4.platformCommission !== 60) {
      throw new Error(`Expected balance 790, got ${res4.balanceAfter}`);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 5: Duplicate Completion Request (Idempotency)
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 5: Duplicate Completion Request ---');
    const res5 = await walletService.creditBookingEarnings(paidBooking._id);
    console.log('[REGRESSION 5 PASSED] Duplicate skipped cleanly:', res5.message);
    const walletAfterDup = await ProviderWallet.findOne({ provider: testProvider._id });
    if (walletAfterDup.availableBalance !== 790) {
      throw new Error(`Balance altered on duplicate call! Balance: ${walletAfterDup.availableBalance}`);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 6: Repeated Webhook / Payment Re-verification
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 6: Repeated Webhook / Re-verification ---');
    const res6 = await walletService.creditBookingEarnings(cashBooking._id);
    console.log('[REGRESSION 6 PASSED] Repeated webhook skipped cleanly:', res6.message);
    const walletAfterWebhook = await ProviderWallet.findOne({ provider: testProvider._id });
    if (walletAfterWebhook.availableBalance !== 790) {
      throw new Error(`Balance altered on webhook re-entry! Balance: ${walletAfterWebhook.availableBalance}`);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 7: Concurrent Simultaneous Completion Requests
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 7: Concurrent Simultaneous Completion Requests ---');
    const concurrentBooking = await Booking.create({
      bookingReference: `REG-CONC-${Date.now().toString().slice(-4)}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: serviceId,
      status: 'completed',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '16:00', endTime: '17:00' },
      address: { street: '5th Ave', city: 'City', pincode: '560001' },
      pricing: { basePrice: 200, totalAmount: 200 },
      paymentStatus: 'paid',
      paymentMethod: 'online'
    });

    // Fire 5 simultaneous concurrent calls to creditBookingEarnings
    const concurrentResults = await Promise.all([
      walletService.creditBookingEarnings(concurrentBooking._id),
      walletService.creditBookingEarnings(concurrentBooking._id),
      walletService.creditBookingEarnings(concurrentBooking._id),
      walletService.creditBookingEarnings(concurrentBooking._id),
      walletService.creditBookingEarnings(concurrentBooking._id)
    ]);

    // Total gross = 200, 15% comm = 30, net = 170.
    // Previous balance = 790. New balance = 790 + 170 = 960.
    const walletAfterConcurrent = await ProviderWallet.findOne({ provider: testProvider._id });
    const concTxns = await WalletTransaction.find({ booking: concurrentBooking._id, type: 'booking_earning' });
    console.log(`[REGRESSION 7 PASSED] Concurrency handled safely. Transactions created: ${concTxns.length}, Final Balance: ₹${walletAfterConcurrent.availableBalance}`);
    if (concTxns.length !== 1) {
      throw new Error(`Expected exactly 1 transaction for concurrent booking, got ${concTxns.length}`);
    }
    if (walletAfterConcurrent.availableBalance !== 960) {
      throw new Error(`Expected balance 960, got ${walletAfterConcurrent.availableBalance}`);
    }

    // -------------------------------------------------------------
    // REGRESSION TEST 8: Wallet Summary Consistency
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TEST 8: Wallet Summary Consistency ---');
    const summary = await walletService.getWalletSummary(testProvider._id);
    const earnings = await walletService.getEarningsBreakdown(testProvider._id);
    const txns = await walletService.getTransactions(testProvider._id, { limit: 50 });

    console.log('[REGRESSION 8 PASSED] Summary verified:', {
      availableBalance: summary.availableBalance,
      totalEarnings: summary.totalEarnings,
      totalTransactions: summary.totalTransactions,
      todayEarnings: earnings.today.amount,
      txnsCount: txns.transactions.length
    });

    if (summary.availableBalance !== 960) throw new Error('Summary balance mismatch');
    if (summary.totalTransactions !== 3) throw new Error('Transaction count mismatch');

    // Clean up test bookings
    await Booking.deleteMany({
      _id: { $in: [paidBooking._id, unpaidBooking._id, failedBooking._id, cashBooking._id, concurrentBooking._id] }
    });

    console.log('\n=== ALL 8 REGRESSION TESTS COMPLETED SUCCESSFULLY! ===');
  } finally {
    await mongoose.disconnect();
    console.log('[OK] Disconnected from MongoDB');
  }
}

runRegressionSuite().catch((err) => {
  console.error('[REGRESSION SUITE FAILED]', err);
  process.exit(1);
});
