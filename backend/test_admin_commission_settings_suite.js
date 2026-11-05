/**
 * AUTOMATED TEST SUITE:
 * FEATURE: Admin-Controlled Platform Commission Percentage
 * 
 * Verifies all 12 requested scenarios:
 *  1. Initial 15% configuration (default fallback).
 *  2. Admin changes rate to 20% (with reason & audit log).
 *  3. New booking created after update uses 20%.
 *  4. Existing booking created prior to update remains frozen at original 15%.
 *  5. Cash booking commission uses the saved rate snapshot (15% vs 20%).
 *  6. Online booking commission uses the saved rate snapshot.
 *  7. Additional spare parts remain 100% commission-free (0% parts commission).
 *  8. Auto deduction settles only the outstanding commission.
 *  9. Razorpay full settlement uses the exact outstanding amount.
 * 10. Unauthorized provider cannot change the rate (Role enforcement).
 * 11. Invalid percentages (-5, 150, NaN, missing reason) are strictly rejected.
 * 12. Concurrent Admin rate updates do not corrupt configuration or history.
 */

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
  Customer,
  Service,
  Category,
  Booking,
  SystemSetting
} = require('./src/models');
const walletService = require('./src/services/walletService');
const bookingService = require('./src/services/bookingService');
const settingService = require('./src/services/settingService');
const { calculateBookingCommission, getActiveCommissionRate } = require('./src/utils/commissionCalculator');

async function runAdminCommissionTestSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING ADMIN-CONTROLLED PLATFORM COMMISSION PERCENTAGE TEST SUITE');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);
  await WalletTransaction.syncIndexes();
  await Booking.syncIndexes();
  await ProviderWallet.syncIndexes();
  await SystemSetting.syncIndexes();

  let passed = 0;
  let failed = 0;
  const testResults = [];

  function assert(condition, message, details = {}) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passed++;
      testResults.push({ name: message, status: 'PASS', details });
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      console.error('    Details:', details);
      failed++;
      testResults.push({ name: message, status: 'FAIL', details });
    }
  }

  const timestamp = Date.now().toString().slice(-6);
  let testAdminUser = null;
  let testProviderUser = null;
  let testProvider = null;
  let testCustomerUser = null;
  let testCustomer = null;
  let testCategory = null;
  let testService = null;
  let providerWallet = null;

  try {
    // 0. Setup Isolated Staging Users & Data
    testAdminUser = await User.create({
      name: `Admin Commissioner ${timestamp}`,
      email: `admin.comm.${timestamp}@example.com`,
      phone: `90${Date.now().toString().slice(-8)}`,
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true
    });

    testProviderUser = await User.create({
      name: `Provider CommTest ${timestamp}`,
      email: `prov.commtest.${timestamp}@example.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      password: 'ProviderPassword123!',
      role: 'provider',
      isActive: true
    });

    testProvider = await Provider.create({
      user: testProviderUser._id,
      businessName: `Admin Comm Provider ${timestamp}`,
      phone: testProviderUser.phone,
      isVerified: true,
      serviceRadius: 50,
      baseAddress: {
        street: '100 Market St',
        city: 'Indore',
        state: 'MP',
        zipCode: '452001',
        location: { type: 'Point', coordinates: [75.8577, 22.7196] }
      }
    });

    providerWallet = await walletService.getOrCreateWallet(testProvider._id);

    testCustomerUser = await User.create({
      name: `Customer CommTest ${timestamp}`,
      email: `cust.commtest.${timestamp}@example.com`,
      phone: `92${Date.now().toString().slice(-8)}`,
      password: 'CustomerPassword123!',
      role: 'customer',
      isActive: true
    });

    testCustomer = await Customer.create({
      user: testCustomerUser._id,
      phone: testCustomerUser.phone,
      savedAddresses: [
        {
          label: 'Home',
          street: '200 Customer Rd',
          city: 'Indore',
          state: 'MP',
          zipCode: '452001',
          location: { type: 'Point', coordinates: [75.8577, 22.7196] }
        }
      ]
    });

    testCategory = await Category.create({
      name: `Admin Comm Category ${timestamp}`,
      slug: `admin-comm-cat-${timestamp}`,
      isActive: true
    });

    testService = await Service.create({
      name: `Appliance Repair ${timestamp}`,
      category: testCategory._id,
      basePrice: 599,
      price: 599,
      priceType: 'fixed',
      duration: 60,
      isActive: true
    });

    // Ensure clean initial setting state for test
    await SystemSetting.deleteOne({ key: 'platform_commission' });
    settingService.invalidateCommissionCache();

    // =========================================================================
    // TEST 1: Initial 15% configuration
    // =========================================================================
    console.log('[TEST 1] Initial 15% configuration');
    const initialConfig = await settingService.getPlatformCommissionSetting();
    assert(initialConfig.percentage === 15, 'Test 1: Initial default commission rate is 15%', { got: initialConfig.percentage });
    assert(initialConfig.rateDecimal === 0.15, 'Test 1: Initial rateDecimal is 0.15', { got: initialConfig.rateDecimal });
    assert(initialConfig.rateFormatted === '15%', 'Test 1: Initial rateFormatted is "15%"', { got: initialConfig.rateFormatted });

    // Create Booking 1 under 15% rate
    const booking1 = await bookingService.createBooking(testCustomerUser._id, {
      serviceId: testService._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      address: { street: '200 Customer Rd', city: 'Indore' },
      paymentMethod: 'cash'
    });

    assert(booking1.platformCommissionRate === 15, 'Test 1: Booking 1 froze 15% platformCommissionRate snapshot', { got: booking1.platformCommissionRate });
    assert(booking1.accounting.platformCommissionRate === 15, 'Test 1: Booking 1 accounting has 15% rate');
    assert(booking1.accounting.platformCommissionAmount === 89.85, 'Test 1: Booking 1 commission amount is ₹89.85 (15% of ₹599)', { got: booking1.accounting.platformCommissionAmount });
    console.log('');

    // =========================================================================
    // TEST 2: Admin changes rate to 20%
    // =========================================================================
    console.log('[TEST 2] Admin changes rate to 20% (with reason & audit log)');
    const updateRes2 = await settingService.updatePlatformCommissionSetting(testAdminUser._id, {
      percentage: 20,
      reason: 'Approved annual platform rate revision'
    });

    assert(updateRes2.percentage === 20, 'Test 2: Updated percentage is 20%', { got: updateRes2.percentage });
    assert(updateRes2.rateDecimal === 0.20, 'Test 2: Updated rateDecimal is 0.20');
    assert(updateRes2.history.length === 1, 'Test 2: Audit history entry created');
    assert(updateRes2.history[0].previousPercentage === 15, 'Test 2: Audit history records previousPercentage: 15');
    assert(updateRes2.history[0].newPercentage === 20, 'Test 2: Audit history records newPercentage: 20');
    assert(updateRes2.history[0].changedBy === testAdminUser.name, 'Test 2: Audit history records Admin name');
    assert(updateRes2.history[0].reason === 'Approved annual platform rate revision', 'Test 2: Audit history records reason');

    const dbSetting2 = await SystemSetting.findOne({ key: 'platform_commission' });
    assert(dbSetting2.value.percentage === 20, 'Test 2: Persisted in MongoDB SystemSetting as 20%');
    console.log('');

    // =========================================================================
    // TEST 3: New booking uses 20%
    // =========================================================================
    console.log('[TEST 3] New booking created after update uses 20%');
    const booking2 = await bookingService.createBooking(testCustomerUser._id, {
      serviceId: testService._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '11:00', endTime: '12:00' },
      address: { street: '200 Customer Rd', city: 'Indore' },
      paymentMethod: 'cash'
    });

    assert(booking2.platformCommissionRate === 20, 'Test 3: Booking 2 created after rate change uses 20%', { got: booking2.platformCommissionRate });
    assert(booking2.accounting.platformCommissionRate === 20, 'Test 3: Booking 2 accounting platformCommissionRate is 20%');
    assert(booking2.accounting.commissionableAmount === 599, 'Test 3: Booking 2 commissionableAmount is ₹599');
    assert(booking2.accounting.platformCommissionAmount === 119.80, 'Test 3: Booking 2 platformCommissionAmount is ₹119.80 (20% of ₹599)', { got: booking2.accounting.platformCommissionAmount });
    console.log('');

    // =========================================================================
    // TEST 4: Existing booking remains at its original 15%
    // =========================================================================
    console.log('[TEST 4] Existing booking remains frozen at its original 15%');
    const b1Fresh = await Booking.findById(booking1._id);
    assert(b1Fresh.platformCommissionRate === 15, 'Test 4: Booking 1 remains strictly at 15% (immutable snapshot)', { got: b1Fresh.platformCommissionRate });
    assert(b1Fresh.accounting.platformCommissionRate === 15, 'Test 4: Booking 1 accounting rate remains 15%');
    assert(b1Fresh.accounting.platformCommissionAmount === 89.85, 'Test 4: Booking 1 commission amount remains ₹89.85 (NOT ₹119.80!)', { got: b1Fresh.accounting.platformCommissionAmount });
    console.log('');

    // =========================================================================
    // TEST 5: Cash booking commission uses the saved rate snapshot
    // =========================================================================
    console.log('[TEST 5] Cash booking commission uses the saved rate snapshot (15% vs 20%)');
    // Assign provider and complete Booking 1 (15% snapshot)
    await Booking.findByIdAndUpdate(booking1._id, {
      $set: { provider: testProvider._id, status: 'in_progress' }
    });
    await bookingService.confirmCashPaymentByProvider(testProviderUser._id, booking1._id);
    await bookingService.completeServiceByProvider(testProviderUser._id, booking1._id);

    const tx1 = await WalletTransaction.findOne({ booking: booking1._id, type: 'CASH_BOOKING_COMMISSION_DUE' });
    const w1 = await ProviderWallet.findById(providerWallet._id);

    assert(tx1.amount === 89.85, 'Test 5: Booking 1 recorded CASH_BOOKING_COMMISSION_DUE at ₹89.85 (15% snapshot)', { got: tx1.amount });
    assert(tx1.metadata.commissionRate === '15%', 'Test 5: Transaction metadata reflects 15% rate');
    assert(w1.commissionDue === 89.85, 'Test 5: Wallet commissionDue is ₹89.85');

    // Reset wallet commission due for clean test of Booking 2
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0 } });

    // Assign provider and complete Booking 2 (20% snapshot)
    await Booking.findByIdAndUpdate(booking2._id, {
      $set: { provider: testProvider._id, status: 'in_progress' }
    });
    await bookingService.confirmCashPaymentByProvider(testProviderUser._id, booking2._id);
    await bookingService.completeServiceByProvider(testProviderUser._id, booking2._id);

    const tx2 = await WalletTransaction.findOne({ booking: booking2._id, type: 'CASH_BOOKING_COMMISSION_DUE' });
    const w2 = await ProviderWallet.findById(providerWallet._id);

    assert(tx2.amount === 119.80, 'Test 5: Booking 2 recorded CASH_BOOKING_COMMISSION_DUE at ₹119.80 (20% snapshot)', { got: tx2.amount });
    assert(tx2.metadata.commissionRate === '20%', 'Test 5: Transaction metadata reflects 20% rate');
    assert(w2.commissionDue === 119.80, 'Test 5: Wallet commissionDue is ₹119.80');

    // Reset wallet
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0 } });
    console.log('');

    // =========================================================================
    // TEST 6 & 7: Online booking commission & Spare parts remain commission-free
    // =========================================================================
    console.log('[TEST 6 & 7] Online booking at 20% with ₹400 spare parts (Parts @ 0% comm)');
    const booking3 = await bookingService.createBooking(testCustomerUser._id, {
      serviceId: testService._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '13:00', endTime: '14:00' },
      address: { street: '200 Customer Rd', city: 'Indore' },
      paymentMethod: 'online'
    });

    await Booking.findByIdAndUpdate(booking3._id, {
      $set: { provider: testProvider._id, status: 'in_progress', paymentStatus: 'paid' }
    });

    // Provider adds ₹400 spare parts
    await bookingService.submitSpareParts(testProviderUser._id, booking3._id, {
      items: [{ name: 'PCB Board', quantity: 1, unitPrice: 400, labourCharge: 0 }]
    });
    await bookingService.reviewSpareParts(testCustomerUser._id, booking3._id, { action: 'approve' });

    // Mark parts paid online
    await Booking.findByIdAndUpdate(booking3._id, {
      $set: { 'spareParts.paymentStatus': 'paid', 'spareParts.paymentMethod': 'online' }
    });

    await bookingService.completeServiceByProvider(testProviderUser._id, booking3._id);

    const tx3 = await WalletTransaction.findOne({ booking: booking3._id, type: 'booking_earning' });
    const b3Final = await Booking.findById(booking3._id);

    // Math at 20%:
    // Base = 599. Comm @ 20% = 119.80. Net Service = 479.20.
    // Parts = 400. Parts Comm = 0.
    // Total Provider Net = 479.20 + 400 = 879.20
    assert(b3Final.accounting.platformCommissionRate === 20, 'Test 6: Booking 3 rate is 20%');
    assert(b3Final.accounting.platformCommissionAmount === 119.80, 'Test 6: Booking 3 platformCommissionAmount is ₹119.80');
    assert(b3Final.accounting.customerApprovedPartsAmount === 400, 'Test 7: customerApprovedPartsAmount is ₹400');
    assert(b3Final.accounting.providerNetEarning === 879.20, 'Test 7: Provider Net Earning is ₹879.20 (₹479.20 service + ₹400 parts)', { got: b3Final.accounting.providerNetEarning });
    assert(tx3.amount === 879.20, 'Test 7: booking_earning credited ₹879.20 (Provider keeps 100% of parts)', { got: tx3.amount });
    assert(tx3.metadata.partsCommission === 0, 'Test 7: Metadata records partsCommission: 0');
    console.log('');

    // =========================================================================
    // TEST 8: Auto deduction settles only the outstanding commission
    // =========================================================================
    console.log('[TEST 8] Auto deduction settles only the outstanding commission');
    // Setup provider with ₹119.80 commission due and ₹500 balance, auto-deduct enabled
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, {
      $set: {
        commissionDue: 119.80,
        availableBalance: 500,
        autoDeductCommissionFromWallet: true,
        autoCommissionAdjustment: true
      }
    });

    const autoRes = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w8 = await ProviderWallet.findById(providerWallet._id);

    assert(autoRes.deducted === true, 'Test 8: Auto deduction executed');
    assert(autoRes.deductionAmount === 119.80 || autoRes.amount === 119.80, 'Test 8: Exact ₹119.80 commission deducted in full', { got: autoRes.deductionAmount });
    assert(w8.commissionDue === 0, 'Test 8: commissionDue is reduced to 0');
    assert(w8.availableBalance === 380.20, 'Test 8: availableBalance is ₹380.20 (₹500 - ₹119.80, never negative)', { got: w8.availableBalance });
    console.log('');

    // =========================================================================
    // TEST 9: Full Razorpay settlement uses the exact outstanding amount
    // =========================================================================
    console.log('[TEST 9] Full Razorpay settlement uses the exact outstanding amount');
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, {
      $set: { commissionDue: 119.80, availableBalance: 0 }
    });

    const orderRes = await walletService.createPayCommissionOrder(testProvider._id);
    assert(orderRes.amount === 119.80, 'Test 9: Created Razorpay order amount is exact outstanding ₹119.80', { got: orderRes.amount });
    assert(orderRes.amountInPaise === 11980, 'Test 9: Order amount in paise is 11980', { got: orderRes.amountInPaise });

    const dummyPaymentId = `pay_admin_comm_${timestamp}`;
    const dummyOrderId = orderRes.orderId;
    const dummySignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret_key')
      .update(`${dummyOrderId}|${dummyPaymentId}`)
      .digest('hex');

    const paymentService = require('./src/services/paymentService');
    const origFetch = paymentService.fetchPayment;
    paymentService.fetchPayment = async (pid) => ({
      id: pid,
      order_id: dummyOrderId,
      amount: orderRes.amountInPaise,
      currency: 'INR',
      status: 'captured'
    });

    try {
      await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
        razorpayOrderId: dummyOrderId,
        razorpayPaymentId: dummyPaymentId,
        razorpaySignature: dummySignature
      });
    } finally {
      paymentService.fetchPayment = origFetch;
    }

    const w9 = await ProviderWallet.findById(providerWallet._id);
    assert(w9.commissionDue === 0, 'Test 9: commissionDue is settled to 0 via Razorpay');
    console.log('');

    // =========================================================================
    // TEST 10: Unauthorized provider cannot change the rate
    // =========================================================================
    console.log('[TEST 10] Unauthorized provider cannot change the rate');
    // Verify that attempting update from a non-admin throws or is blocked by role guard
    const isProviderRole = testProviderUser.role === 'provider';
    assert(isProviderRole === true, 'Test 10: Verified provider user has role="provider", not "admin"');

    // Simulate route middleware requireRole('admin')
    const { requireRole } = require('./src/middleware/auth');
    const middleware = requireRole('admin');
    let rejectedByAuth = false;
    const mockReq = { user: testProviderUser };
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 403) rejectedByAuth = true;
        }
      })
    };
    middleware(mockReq, mockRes, () => {});
    assert(rejectedByAuth === true, 'Test 10: requireRole("admin") rejected provider with HTTP 403 Forbidden');
    console.log('');

    // =========================================================================
    // TEST 11: Invalid percentages are strictly rejected
    // =========================================================================
    console.log('[TEST 11] Invalid percentages (-5, 150, non-numeric, no reason) rejected');
    let negErr = false;
    try {
      await settingService.updatePlatformCommissionSetting(testAdminUser._id, { percentage: -5, reason: 'Test' });
    } catch (e) {
      negErr = e.message.includes('between 0% and 100%');
    }
    assert(negErr === true, 'Test 11: Negative percentage (-5) rejected');

    let overErr = false;
    try {
      await settingService.updatePlatformCommissionSetting(testAdminUser._id, { percentage: 150, reason: 'Test' });
    } catch (e) {
      overErr = e.message.includes('between 0% and 100%');
    }
    assert(overErr === true, 'Test 11: Percentage above 100 (150) rejected');

    let nanErr = false;
    try {
      await settingService.updatePlatformCommissionSetting(testAdminUser._id, { percentage: 'not-a-number', reason: 'Test' });
    } catch (e) {
      nanErr = e.message.includes('valid numeric');
    }
    assert(nanErr === true, 'Test 11: Non-numeric percentage rejected');

    let reasonErr = false;
    try {
      await settingService.updatePlatformCommissionSetting(testAdminUser._id, { percentage: 18, reason: ' ' });
    } catch (e) {
      reasonErr = e.message.includes('reason for change is required');
    }
    assert(reasonErr === true, 'Test 11: Empty audit reason rejected');
    console.log('');

    // =========================================================================
    // TEST 12: Concurrent Admin rate updates do not corrupt configuration
    // =========================================================================
    console.log('[TEST 12] Concurrent Admin rate updates do not corrupt configuration');
    const rates = [18, 22, 25, 19, 21];
    const updatePromises = rates.map((r, i) =>
      settingService.updatePlatformCommissionSetting(testAdminUser._id, {
        percentage: r,
        reason: `Concurrent test update #${i + 1} to ${r}%`
      })
    );

    const concurrentResults = await Promise.all(updatePromises);
    assert(concurrentResults.length === 5, 'Test 12: All 5 concurrent rate updates resolved');

    const finalSetting = await SystemSetting.findOne({ key: 'platform_commission' });
    assert(typeof finalSetting.value.percentage === 'number', 'Test 12: Final setting percentage is valid number', { final: finalSetting.value.percentage });
    assert(finalSetting.value.percentage >= 0 && finalSetting.value.percentage <= 100, 'Test 12: Final percentage within bounds');
    assert(finalSetting.history.length >= 6, 'Test 12: Audit history correctly preserved all changes', { historyCount: finalSetting.history.length });

  } catch (err) {
    console.error('\n❌ UNHANDLED ERROR IN TEST SUITE:', err);
    failed++;
  } finally {
    console.log('\n[CLEANUP] Cleaning up isolated test records...');
    if (testProvider) {
      await Booking.deleteMany({ provider: testProvider._id });
      await WalletTransaction.deleteMany({ provider: testProvider._id });
      await ProviderWallet.deleteMany({ provider: testProvider._id });
      await Provider.deleteOne({ _id: testProvider._id });
    }
    if (testProviderUser) await User.deleteOne({ _id: testProviderUser._id });
    if (testCustomer) await Customer.deleteOne({ _id: testCustomer._id });
    if (testCustomerUser) await User.deleteOne({ _id: testCustomerUser._id });
    if (testService) await Service.deleteOne({ _id: testService._id });
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });
    if (testAdminUser) await User.deleteOne({ _id: testAdminUser._id });

    // Restore standard setting
    await SystemSetting.deleteOne({ key: 'platform_commission' });
    settingService.invalidateCommissionCache();

    await mongoose.disconnect();
    console.log('[CLEANUP] Disconnected from MongoDB');

    console.log('\n================================================================================');
    console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAdminCommissionTestSuite();

