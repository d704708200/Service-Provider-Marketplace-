const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

const CommissionLedger = require('./src/models/CommissionLedger');
const { adminAdjustCommissionLedger } = require('./src/services/commissionLedgerService');
const jwt = require('jsonwebtoken');

let testBookingId = null;
let testProviderId = null;
let testAdminId = null;
let testLedgerEntryId = null;

async function runTests() {
  console.log('================================================================================');
  console.log('🧪 RUNNING COMMISSION ADJUSTMENT & RECONCILED AUDIT REGRESSION TEST SUITE');
  console.log('================================================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  testBookingId = new mongoose.Types.ObjectId();
  testProviderId = new mongoose.Types.ObjectId();
  testAdminId = new mongoose.Types.ObjectId();

  let passed = 0;
  let failed = 0;

  try {
    // -------------------------------------------------------------
    // TEST 1: Historical reconciliation with action RECONCILED
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Historical reconciliation with action RECONCILED ---');
    const reconciledEntry = new CommissionLedger({
      booking: testBookingId,
      bookingReference: 'TEST-RECON-BK-001',
      provider: testProviderId,
      providerName: 'Test Reconciliation Provider',
      commissionType: 'service',
      eligibleAmount: 500,
      appliedPercentage: 15,
      calculatedAmount: 75,
      deductedAmount: 0,
      status: 'PENDING',
      paymentMode: 'cash',
      auditTrail: [
        {
          action: 'RECONCILED',
          performedByRole: 'system',
          previousStatus: 'NOT_CALCULATED',
          newStatus: 'PENDING',
          reason: 'Historical cash booking liability outstanding in provider wallet',
          details: { outstandingAmount: 75 },
          timestamp: new Date()
        }
      ]
    });

    await reconciledEntry.save();
    testLedgerEntryId = reconciledEntry._id;

    if (reconciledEntry.auditTrail[0].action === 'RECONCILED') {
      console.log('  ✅ PASS: CommissionLedger document successfully saved with action RECONCILED in auditTrail');
      passed++;
    } else {
      throw new Error('auditTrail[0].action was not RECONCILED');
    }

    // -------------------------------------------------------------
    // TEST 2: Admin PENDING -> REVERSED on record with RECONCILED auditTrail
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Admin PENDING -> REVERSED on document with existing RECONCILED action ---');
    const reversedEntry = await adminAdjustCommissionLedger(
      testLedgerEntryId,
      {
        newStatus: 'REVERSED',
        reason: 'Authorized business waiver for disputed cash booking',
        adminUserId: testAdminId
      }
    );

    if (
      reversedEntry.status === 'REVERSED' &&
      reversedEntry.reversalReason === 'Authorized business waiver for disputed cash booking' &&
      reversedEntry.auditTrail.length === 2 &&
      reversedEntry.auditTrail[0].action === 'RECONCILED' &&
      reversedEntry.auditTrail[1].action === 'REVERSED' &&
      reversedEntry.auditTrail[1].performedByRole === 'admin'
    ) {
      console.log('  ✅ PASS: Transition from PENDING to REVERSED succeeded with full audit trail preserved');
      passed++;
    } else {
      throw new Error(`Reversal assertion failed: status=${reversedEntry.status}, auditCount=${reversedEntry.auditTrail.length}`);
    }

    // -------------------------------------------------------------
    // TEST 3: Duplicate adjustment prevention
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Duplicate adjustment prevention ---');
    let duplicateCaught = false;
    try {
      await adminAdjustCommissionLedger(
        testLedgerEntryId,
        {
          newStatus: 'REVERSED',
          reason: 'Duplicate call attempting to re-reverse an already reversed transaction',
          adminUserId: testAdminId
        }
      );
    } catch (dupErr) {
      if (dupErr.statusCode === 400 && dupErr.message.includes('already in status')) {
        duplicateCaught = true;
      }
    }

    if (duplicateCaught) {
      console.log('  ✅ PASS: Duplicate adjustment to the same status correctly rejected with HTTP 400');
      passed++;
    } else {
      throw new Error('Duplicate adjustment was not rejected');
    }

    // -------------------------------------------------------------
    // TEST 4: Admin PENDING -> REFUNDED
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Admin PENDING -> REFUNDED ---');
    const testRefundBookingId = new mongoose.Types.ObjectId();
    const refundPendingEntry = await CommissionLedger.create({
      booking: testRefundBookingId,
      bookingReference: 'TEST-REFUND-BK-002',
      provider: testProviderId,
      providerName: 'Test Refund Provider',
      commissionType: 'service',
      eligibleAmount: 1000,
      appliedPercentage: 15,
      calculatedAmount: 150,
      deductedAmount: 0,
      status: 'PENDING',
      paymentMode: 'cash',
      auditTrail: [
        {
          action: 'RECONCILED',
          performedByRole: 'system',
          newStatus: 'PENDING',
          reason: 'Initial backfill',
          timestamp: new Date()
        }
      ]
    });

    const refundedEntry = await adminAdjustCommissionLedger(
      refundPendingEntry._id,
      {
        newStatus: 'REFUNDED',
        reason: 'Customer dispute resolution refund granted by admin',
        adminUserId: testAdminId
      }
    );

    if (
      refundedEntry.status === 'REFUNDED' &&
      refundedEntry.auditTrail.length === 2 &&
      refundedEntry.auditTrail[1].action === 'REFUNDED' &&
      refundedEntry.refundReference
    ) {
      console.log('  ✅ PASS: Transition from PENDING to REFUNDED succeeded with refundReference and REFUNDED action');
      passed++;
    } else {
      throw new Error(`Refund assertion failed: status=${refundedEntry.status}`);
    }

    // -------------------------------------------------------------
    // TEST 5: Invalid audit action rejection
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Invalid audit action rejection ---');
    let invalidActionCaught = false;
    try {
      const invalidEntry = new CommissionLedger({
        booking: new mongoose.Types.ObjectId(),
        bookingReference: 'TEST-INVALID-001',
        provider: testProviderId,
        commissionType: 'service',
        eligibleAmount: 100,
        appliedPercentage: 10,
        calculatedAmount: 10,
        status: 'PENDING',
        auditTrail: [
          {
            action: 'BOGUS_INVALID_ACTION_123',
            performedByRole: 'system',
            newStatus: 'PENDING'
          }
        ]
      });
      await invalidEntry.save();
    } catch (valErr) {
      if (valErr.name === 'ValidationError' && valErr.message.includes('not a valid enum value for path `action`')) {
        invalidActionCaught = true;
      }
    }

    if (invalidActionCaught) {
      console.log('  ✅ PASS: Arbitrary/bogus audit actions strictly rejected by Mongoose enum validation');
      passed++;
    } else {
      throw new Error('Invalid audit action was unexpectedly accepted');
    }

    // -------------------------------------------------------------
    // TEST 6: Unauthorized admin rejection
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Unauthorized non-admin role rejection ---');
    // Simulate auth middleware checks
    const nonAdminUser = { _id: new mongoose.Types.ObjectId(), role: 'provider' };
    const adminUser = { _id: new mongoose.Types.ObjectId(), role: 'admin' };

    const { requireRole } = require('./src/middleware/auth');
    const adminCheck = requireRole('admin');

    let nonAdminRejected = false;
    const mockReq = { user: nonAdminUser };
    const mockRes = {
      status(code) {
        if (code === 403) nonAdminRejected = true;
        return this;
      },
      json() { return this; }
    };
    const mockNext = (err) => {
      if (err && (err.statusCode === 403 || err.message.includes('Access denied'))) {
        nonAdminRejected = true;
      }
    };
    adminCheck(mockReq, mockRes, mockNext);

    let adminAccepted = false;
    const mockReqAdmin = { user: adminUser };
    const mockResAdmin = {
      status(code) { return this; },
      json() { return this; }
    };
    const mockNextAdmin = (err) => {
      if (!err) adminAccepted = true;
    };
    adminCheck(mockReqAdmin, mockResAdmin, mockNextAdmin);

    if (nonAdminRejected && adminAccepted) {
      console.log('  ✅ PASS: Non-admin users strictly denied access (403), while admin users permitted');
      passed++;
    } else {
      throw new Error(`Unauthorized check failed: nonAdminRejected=${nonAdminRejected}, adminAccepted=${adminAccepted}`);
    }

  } finally {
    // Teardown test documents
    console.log('\n[TEARDOWN] Cleaning up test records...');
    await CommissionLedger.deleteMany({ bookingReference: { $regex: /^TEST-(RECON|REFUND|INVALID)/ } });
    await mongoose.disconnect();
    console.log('[TEARDOWN] Complete and disconnected from MongoDB.');
  }

  console.log('\n================================================================================');
  console.log(`📊 REGRESSION TEST SUMMARY: ${passed} PASSED | ${failed} FAILED | TOTAL: ${passed + failed}`);
  console.log('================================================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
