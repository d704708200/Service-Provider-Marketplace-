/**
 * AUTOMATED TEST SUITE: DUAL COMMISSION DEDUCTION MONITORING
 * Validates all 17 scenarios for independent Service & Labour commission deduction tracking.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const {
  Booking,
  Provider,
  Customer,
  Service,
  Category,
  User,
  ProviderWallet,
  WalletTransaction,
  CommissionLedger
} = require('./src/models');

const walletService = require('./src/services/walletService');
const commissionLedgerService = require('./src/services/commissionLedgerService');
const { calculateBookingCommission } = require('./src/utils/commissionCalculator');

async function runMonitoringSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING DUAL COMMISSION DEDUCTION MONITORING TEST SUITE (17 SCENARIOS)');
  console.log('================================================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);

  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, testName, details = {}) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
      results.push({ name: testName, status: 'PASS', details });
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      console.error('     Details:', JSON.stringify(details, null, 2));
      failed++;
      results.push({ name: testName, status: 'FAIL', details });
    }
  }

  const PREFIX = `COMM_TEST_${Date.now()}`;
  let testUser, testProvider, testCustomer, testCategory, testService, testWallet;
  const createdBookingIds = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP TEST FIXTURES
    // -------------------------------------------------------------------------
    testUser = await User.create({
      name: `${PREFIX}_ProviderUser`,
      email: `${PREFIX.toLowerCase()}@example.com`,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      role: 'provider',
      password: 'TestPassword123!',
      isActive: true
    });

    testProvider = await Provider.create({
      user: testUser._id,
      businessName: `${PREFIX}_Business`,
      phone: testUser.phone,
      serviceRadiusKm: 25,
      isProfileComplete: true,
      approvalStatus: 'approved'
    });

    testWallet = await walletService.getOrCreateWallet(testProvider._id);

    const custUser = await User.create({
      name: `${PREFIX}_CustomerUser`,
      email: `${PREFIX.toLowerCase()}_cust@example.com`,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      role: 'customer',
      password: 'TestPassword123!',
      isActive: true
    });

    testCustomer = await Customer.create({
      user: custUser._id,
      phone: custUser.phone,
      savedAddresses: [{ street: '123 Test St', city: 'Kolkata', state: 'WB', zipCode: '700001' }]
    });

    testCategory = await Category.create({
      name: `${PREFIX}_Cat`,
      slug: `${PREFIX.toLowerCase()}-cat`,
      description: 'Test Category'
    });

    testService = await Service.create({
      name: `${PREFIX}_AC_Repair`,
      slug: `${PREFIX.toLowerCase()}-ac-repair`,
      category: testCategory._id,
      price: 1000,
      priceType: 'fixed',
      estimatedDurationMinutes: 60
    });

    console.log('[SETUP] Test fixtures created successfully.\n');

    // Helper: Create an isolated booking
    async function createTestBooking(overrides = {}) {
      const bRef = `BK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const basePrice = overrides.basePrice || 1000;
      const b = await Booking.create({
        bookingReference: bRef,
        bookingMode: overrides.bookingMode || 'instant',
        customer: testCustomer._id,
        provider: testProvider._id,
        service: testService._id,
        category: testCategory._id,
        status: overrides.status || 'in_progress',
        paymentStatus: overrides.paymentStatus || 'pending',
        paymentMethod: overrides.paymentMethod || 'online',
        pricing: {
          basePrice,
          tax: 0,
          discount: 0,
          totalAmount: basePrice
        },
        originalServicePrice: basePrice,
        platformCommissionRate: overrides.platformCommissionRate || 15,
        labourCommissionRate: overrides.labourCommissionRate !== undefined ? overrides.labourCommissionRate : 10,
        accounting: {
          originalServicePrice: basePrice,
          platformCommissionRate: overrides.platformCommissionRate || 15,
          labourCommissionRate: overrides.labourCommissionRate !== undefined ? overrides.labourCommissionRate : 10,
          commissionableAmount: basePrice
        },
        address: {
          street: '123 Test St',
          city: 'Kolkata',
          state: 'WB',
          zipCode: '700001'
        },
        scheduledDate: new Date(),
        scheduledTimeSlot: {
          startTime: '10:00',
          endTime: '12:00'
        },
        timeSlot: '10:00 - 12:00',
        ...overrides
      });
      createdBookingIds.push(b._id);
      return b;
    }

    // -------------------------------------------------------------------------
    // SCENARIO 1: Both commissions successfully deducted (Online payment + approved labour)
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: Both commissions successfully deducted ---');
    const b1 = await createTestBooking({
      basePrice: 1000,
      paymentMethod: 'online',
      status: 'completed',
      paymentStatus: 'paid',
      approvedLabourCharge: 500,
      spareParts: {
        status: 'approved',
        labourSubtotal: 500,
        partsSubtotal: 300,
        totalAdditionalAmount: 800
      }
    });

    // Credit earnings through walletService
    const creditResult1 = await walletService.creditBookingEarnings(b1._id);
    const s1Ledger = await CommissionLedger.findOne({ booking: b1._id, commissionType: 'service' });
    const l1Ledger = await CommissionLedger.findOne({ booking: b1._id, commissionType: 'labour' });

    assert(
      s1Ledger && s1Ledger.status === 'DEDUCTED' && s1Ledger.deductedAmount === 150 &&
      l1Ledger && l1Ledger.status === 'DEDUCTED' && l1Ledger.deductedAmount === 50,
      'Scenario 1: Both Service (₹150) and Labour (₹50) commissions independently marked DEDUCTED on confirmed online settlement',
      { sStatus: s1Ledger?.status, sDeducted: s1Ledger?.deductedAmount, lStatus: l1Ledger?.status, lDeducted: l1Ledger?.deductedAmount }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 2: Service Commission deducted, Labour Commission pending
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Service Commission deducted, Labour Commission pending ---');
    const b2 = await createTestBooking({ basePrice: 2000, paymentMethod: 'online' });
    // Manually register independent ledger where service is confirmed deducted and labour is pending dispute
    await CommissionLedger.create({
      booking: b2._id,
      bookingReference: b2.bookingReference,
      provider: testProvider._id,
      commissionType: 'service',
      eligibleAmount: 2000,
      appliedPercentage: 15,
      calculatedAmount: 300,
      deductedAmount: 300,
      status: 'DEDUCTED',
      paymentMode: 'online',
      deductionTimestamp: new Date()
    });
    await CommissionLedger.create({
      booking: b2._id,
      bookingReference: b2.bookingReference,
      provider: testProvider._id,
      commissionType: 'labour',
      eligibleAmount: 400,
      appliedPercentage: 10,
      calculatedAmount: 40,
      deductedAmount: 0,
      status: 'PENDING',
      paymentMode: 'online'
    });
    const b2Breakdown = await commissionLedgerService.getBookingCommissionBreakdown(b2._id);
    assert(
      b2Breakdown.serviceCommission.status === 'DEDUCTED' && b2Breakdown.labourCommission.status === 'PENDING',
      'Scenario 2: Service Commission DEDUCTED while Labour Commission is independently PENDING',
      { serviceStatus: b2Breakdown.serviceCommission.status, labourStatus: b2Breakdown.labourCommission.status }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: Labour Commission deducted, Service Commission pending
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Labour Commission deducted, Service Commission pending ---');
    const b3 = await createTestBooking({ basePrice: 1500 });
    await CommissionLedger.create({
      booking: b3._id,
      bookingReference: b3.bookingReference,
      provider: testProvider._id,
      commissionType: 'service',
      eligibleAmount: 1500,
      appliedPercentage: 15,
      calculatedAmount: 225,
      deductedAmount: 0,
      status: 'PENDING',
      paymentMode: 'cash'
    });
    await CommissionLedger.create({
      booking: b3._id,
      bookingReference: b3.bookingReference,
      provider: testProvider._id,
      commissionType: 'labour',
      eligibleAmount: 300,
      appliedPercentage: 10,
      calculatedAmount: 30,
      deductedAmount: 30,
      status: 'DEDUCTED',
      paymentMode: 'online',
      deductionTimestamp: new Date()
    });
    const b3Breakdown = await commissionLedgerService.getBookingCommissionBreakdown(b3._id);
    assert(
      b3Breakdown.serviceCommission.status === 'PENDING' && b3Breakdown.labourCommission.status === 'DEDUCTED',
      'Scenario 3: Labour Commission DEDUCTED while Service Commission is independently PENDING',
      { serviceStatus: b3Breakdown.serviceCommission.status, labourStatus: b3Breakdown.labourCommission.status }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 4: Both commissions pending (Cash booking completion)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Both commissions pending ---');
    const b4 = await createTestBooking({
      basePrice: 1200,
      paymentMethod: 'cash',
      status: 'completed',
      paymentStatus: 'paid',
      approvedLabourCharge: 400,
      spareParts: {
        status: 'approved',
        labourSubtotal: 400,
        partsSubtotal: 200,
        totalAdditionalAmount: 600
      }
    });
    // Credit cash booking earnings
    await walletService.creditBookingEarnings(b4._id);
    const s4Ledger = await CommissionLedger.findOne({ booking: b4._id, commissionType: 'service' });
    const l4Ledger = await CommissionLedger.findOne({ booking: b4._id, commissionType: 'labour' });
    assert(
      s4Ledger && s4Ledger.status === 'PENDING' && s4Ledger.deductedAmount === 0 &&
      l4Ledger && l4Ledger.status === 'PENDING' && l4Ledger.deductedAmount === 0,
      'Scenario 4: Cash booking completed records BOTH commissions as PENDING with zero deductedAmount',
      { sStatus: s4Ledger?.status, sDeducted: s4Ledger?.deductedAmount, lStatus: l4Ledger?.status, lDeducted: l4Ledger?.deductedAmount }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 5: Service deduction fails
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Service deduction fails ---');
    const b5 = await createTestBooking({ basePrice: 1000 });
    await commissionLedgerService.recordBookingCommissions(b5);
    await commissionLedgerService.markCommissionFailed(b5._id, 'service', 'Payment gateway debit failure');
    const s5Ledger = await CommissionLedger.findOne({ booking: b5._id, commissionType: 'service' });
    assert(
      s5Ledger && s5Ledger.status === 'FAILED' && s5Ledger.failureReason === 'Payment gateway debit failure',
      'Scenario 5: Service deduction failure accurately marked as FAILED with error reason',
      { status: s5Ledger?.status, failureReason: s5Ledger?.failureReason }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 6: Labour deduction fails
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Labour deduction fails ---');
    const b6 = await createTestBooking({
      basePrice: 1000,
      approvedLabourCharge: 600,
      spareParts: { status: 'approved', labourSubtotal: 600, partsSubtotal: 0, totalAdditionalAmount: 600 }
    });
    await commissionLedgerService.recordBookingCommissions(b6);
    await commissionLedgerService.markCommissionFailed(b6._id, 'labour', 'Labour charge disputed during settlement');
    const l6Ledger = await CommissionLedger.findOne({ booking: b6._id, commissionType: 'labour' });
    assert(
      l6Ledger && l6Ledger.status === 'FAILED' && l6Ledger.failureReason === 'Labour charge disputed during settlement',
      'Scenario 6: Labour deduction failure accurately marked as FAILED with error reason',
      { status: l6Ledger?.status, failureReason: l6Ledger?.failureReason }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 7: Online booking settlement
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Online booking settlement ---');
    const b7 = await createTestBooking({
      basePrice: 3000,
      paymentMethod: 'online',
      status: 'completed',
      paymentStatus: 'paid'
    });
    const credit7 = await walletService.creditBookingEarnings(b7._id);
    const s7 = await CommissionLedger.findOne({ booking: b7._id, commissionType: 'service' });
    assert(
      credit7.success && s7.status === 'DEDUCTED' && s7.deductedAmount === 450 && s7.transactionReference !== null,
      'Scenario 7: Online booking settlement retains 15% platform commission at source and confirms ledger deduction',
      { netCredit: credit7.providerNetEarnings, deducted: s7.deductedAmount, txnRef: s7.transactionReference }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 8: Cash booking settlement (Creates liability)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Cash booking settlement ---');
    const walletBefore8 = await ProviderWallet.findById(testWallet._id);
    const dueBefore8 = walletBefore8.commissionDue;
    const b8 = await createTestBooking({
      basePrice: 2000,
      paymentMethod: 'cash',
      status: 'completed',
      paymentStatus: 'paid'
    });
    await walletService.creditBookingEarnings(b8._id);
    const walletAfter8 = await ProviderWallet.findById(testWallet._id);
    const s8 = await CommissionLedger.findOne({ booking: b8._id, commissionType: 'service' });
    assert(
      walletAfter8.commissionDue === dueBefore8 + 300 && s8.status === 'PENDING',
      'Scenario 8: Cash booking increments provider commissionDue and records liability as PENDING in ledger',
      { dueBefore: dueBefore8, dueAfter: walletAfter8.commissionDue, sStatus: s8.status }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 9: Insufficient provider wallet balance
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Insufficient provider wallet balance ---');
    // Ensure availableBalance is 0 and commissionDue > 0
    await ProviderWallet.findByIdAndUpdate(testWallet._id, {
      $set: { availableBalance: 0, autoDeductCommissionFromWallet: true }
    });
    const autoDeductRes9 = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    assert(
      autoDeductRes9.deducted === false && autoDeductRes9.reason === 'INSUFFICIENT_BALANCE',
      'Scenario 9: Insufficient wallet balance safely aborts auto-debit; commissions remain pending without negative balance',
      { deducted: autoDeductRes9.deducted, reason: autoDeductRes9.reason }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 10: Duplicate webhook delivery
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Duplicate webhook delivery ---');
    // Simulate duplicate credit call for b1
    const dupCredit = await walletService.creditBookingEarnings(b1._id);
    const s1Entries = await CommissionLedger.find({ booking: b1._id, commissionType: 'service' });
    assert(
      dupCredit.success && dupCredit.message.includes('already been recorded') && s1Entries.length === 1,
      'Scenario 10: Duplicate delivery safely handled idempotently without duplicate credit or ledger entry',
      { ledgerCount: s1Entries.length, message: dupCredit.message }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 11: Duplicate booking-completion request
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 11: Duplicate booking-completion request ---');
    const rec11A = await commissionLedgerService.recordBookingCommissions(b1);
    const rec11B = await commissionLedgerService.recordBookingCommissions(b1);
    const totalCount11 = await CommissionLedger.countDocuments({ booking: b1._id });
    assert(
      totalCount11 === 2, // exactly 1 service, 1 labour
      'Scenario 11: Duplicate booking-completion / calculation calls maintain exactly 1 service and 1 labour ledger record',
      { totalCount: totalCount11 }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 12: Booking cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 12: Booking cancellation ---');
    const b12 = await createTestBooking({ basePrice: 1000 });
    await commissionLedgerService.recordBookingCommissions(b12);
    await commissionLedgerService.reverseOrRefundBookingCommissions(b12._id, {
      reason: 'Customer cancelled prior to dispatch',
      isRefund: false,
      role: 'customer'
    });
    const s12 = await CommissionLedger.findOne({ booking: b12._id, commissionType: 'service' });
    assert(
      s12.status === 'REVERSED' && s12.reversalReason === 'Customer cancelled prior to dispatch',
      'Scenario 12: Booking cancellation transitions commission status to REVERSED with audit reason',
      { status: s12.status, reason: s12.reversalReason }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 13: Customer refund
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 13: Customer refund ---');
    const b13 = await createTestBooking({ basePrice: 1000 });
    await commissionLedgerService.recordBookingCommissions(b13);
    await commissionLedgerService.reverseOrRefundBookingCommissions(b13._id, {
      reason: 'Dissatisfied service full refund',
      isRefund: true,
      reference: 'RFND-9921',
      role: 'admin'
    });
    const s13 = await CommissionLedger.findOne({ booking: b13._id, commissionType: 'service' });
    assert(
      s13.status === 'REFUNDED' && s13.refundReference === 'RFND-9921',
      'Scenario 13: Customer refund transitions commission status to REFUNDED with refund reference',
      { status: s13.status, refundReference: s13.refundReference }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 14: Commission reversal
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 14: Commission reversal ---');
    const b14 = await createTestBooking({ basePrice: 800 });
    await commissionLedgerService.recordBookingCommissions(b14);
    const s14Before = await CommissionLedger.findOne({ booking: b14._id, commissionType: 'service' });
    const s14Adjusted = await commissionLedgerService.adminAdjustCommissionLedger(s14Before._id, {
      newStatus: 'REVERSED',
      reason: 'Administrative promotional commission waiver',
      adminUserId: testUser._id
    });
    assert(
      s14Adjusted.status === 'REVERSED' && s14Adjusted.auditTrail.length > 0,
      'Scenario 14: Commission reversal successfully creates auditable ledger transition to REVERSED',
      { status: s14Adjusted.status, auditEntries: s14Adjusted.auditTrail.length }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 15: Manual adjustment audit
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 15: Manual adjustment audit ---');
    let rejectedBypass = false;
    try {
      // Attempt to bypass ledger by marking DEDUCTED without financial transaction
      await commissionLedgerService.adminAdjustCommissionLedger(s14Before._id, {
        newStatus: 'DEDUCTED',
        reason: 'Illegal bypass attempt',
        adminUserId: testUser._id
      });
    } catch (err) {
      rejectedBypass = err.message.includes('cannot bypass financial ledger verification');
    }
    assert(
      rejectedBypass === true,
      'Scenario 15: Strict security rule blocks manual "Mark as Deducted" bypass without financial confirmation',
      { rejectedBypass }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 16: Admin dashboard totals match ledger
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 16: Admin dashboard totals match ledger ---');
    const dashStats = await commissionLedgerService.getCommissionDashboardStats();
    // Verify aggregation totals match direct DB count
    const actualDeductedCount = await CommissionLedger.countDocuments({ status: 'DEDUCTED' });
    const actualPendingCount = await CommissionLedger.countDocuments({ status: 'PENDING' });
    assert(
      dashStats.counts.deducted === actualDeductedCount && dashStats.counts.pending === actualPendingCount,
      'Scenario 16: Admin dashboard KPI metrics accurately aggregate real CommissionLedger data',
      { kpis: dashStats.kpis, counts: dashStats.counts, actualDeducted: actualDeductedCount, actualPending: actualPendingCount }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 17: Provider wallet matches Admin financial records
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 17: Provider wallet matches Admin financial records ---');
    const providerSummary = await walletService.getWalletSummary(testProvider._id);
    assert(
      providerSummary.financials !== undefined &&
      providerSummary.financials.withdrawableBalance === providerSummary.availableBalance &&
      providerSummary.financials.pendingCommissionLiability === providerSummary.commissionDue,
      'Scenario 17: Provider wallet overview matches Admin financial ledger consistently',
      { financials: providerSummary.financials }
    );

  } catch (err) {
    console.error('[TEST_ERROR]', err);
    failed++;
  } finally {
    // Clean up test data
    console.log('\n[TEARDOWN] Cleaning up test data...');
    try {
      if (createdBookingIds.length > 0) {
        await Booking.deleteMany({ _id: { $in: createdBookingIds } });
        await CommissionLedger.deleteMany({ booking: { $in: createdBookingIds } });
        await WalletTransaction.deleteMany({ booking: { $in: createdBookingIds } });
      }
      if (testProvider) {
        await Provider.findByIdAndDelete(testProvider._id);
        await ProviderWallet.deleteOne({ provider: testProvider._id });
        await WalletTransaction.deleteMany({ provider: testProvider._id });
        await CommissionLedger.deleteMany({ provider: testProvider._id });
      }
      if (testUser) await User.findByIdAndDelete(testUser._id);
      if (testCustomer) {
        await Customer.findByIdAndDelete(testCustomer._id);
        await User.findByIdAndDelete(testCustomer.user);
      }
      if (testService) await Service.findByIdAndDelete(testService._id);
      if (testCategory) await Category.findByIdAndDelete(testCategory._id);
      console.log('[TEARDOWN] Cleanup complete.');
    } catch (cleanErr) {
      console.warn('[TEARDOWN_WARN]', cleanErr.message);
    }

    await mongoose.disconnect();
    console.log('[TEARDOWN] Disconnected from MongoDB.');
  }

  console.log('\n================================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED | TOTAL: ${passed + failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMonitoringSuite().catch((err) => {
  console.error('[FATAL_ERROR]', err);
  process.exit(1);
});
