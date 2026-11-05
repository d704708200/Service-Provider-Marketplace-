/**
 * AUTOMATED TEST SUITE:
 * CRITICAL BUSINESS RULE: Platform Commission Only on Original Service Price, Never on Additional Parts
 * 
 * Tests all 10 scenarios requested by the prompt:
 *  1. ?599 service with no parts.
 *  2. ?599 service + ?400 approved parts.
 *  3. ?599 service + multiple spare parts.
 *  4. Cash booking with additional parts.
 *  5. Online booking with additional parts.
 *  6. Repeated booking completion request (idempotency).
 *  7. Duplicate commission prevention (unique compound index & no parts commission entries).
 *  8. Full Razorpay commission settlement.
 *  9. Full automatic wallet commission deduction.
 * 10. Verify commission is never calculated on parts (diff = ?0, parts commission = ?0).
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '.env') });
process.env.PLATFORM_COMMISSION_RATE = '15'; // Enforce 15% rate

const {
  ProviderWallet,
  WalletTransaction,
  Provider,
  User,
  Customer,
  Service,
  Category,
  Booking
} = require('./src/models');
const walletService = require('./src/services/walletService');
const bookingService = require('./src/services/bookingService');
const { calculateBookingCommission } = require('./src/utils/commissionCalculator');

async function runTestSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING COMMISSION ONLY ON ORIGINAL SERVICE PRICE TEST SUITE');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);
  await WalletTransaction.syncIndexes();
  await Booking.syncIndexes();
  await ProviderWallet.syncIndexes();
  console.log('[SETUP] Synced database indexes');

  let passed = 0;
  let failed = 0;
  const testResults = [];

  function assert(condition, message, details = {}) {
    if (condition) {
      console.log(`  ? PASS: ${message}`);
      passed++;
      testResults.push({ name: message, status: 'PASS', details });
    } else {
      console.error(`  ? FAIL: ${message}`);
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
    // 1. Setup Isolated Staging Provider, Customer, Service
    testProviderUser = await User.create({
      name: `CommTest Provider ${timestamp}`,
      email: `prov.commtest.${timestamp}@example.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      password: 'StagingPassword123!',
      role: 'provider',
      isActive: true
    });

    testProvider = await Provider.create({
      user: testProviderUser._id,
      businessName: `CommTest Services ${timestamp}`,
      phone: testProviderUser.phone,
      isVerified: true,
      serviceRadius: 50,
      baseAddress: {
        street: '123 Test St',
        city: 'Indore',
        state: 'MP',
        zipCode: '452001',
        location: { type: 'Point', coordinates: [75.8577, 22.7196] }
      }
    });

    providerWallet = await walletService.getOrCreateWallet(testProvider._id);

    testCustomerUser = await User.create({
      name: `CommTest Customer ${timestamp}`,
      email: `cust.commtest.${timestamp}@example.com`,
      phone: `92${Date.now().toString().slice(-8)}`,
      password: 'StagingCustomerPassword123!',
      role: 'customer',
      isActive: true
    });

    testCustomer = await Customer.create({
      user: testCustomerUser._id,
      phone: testCustomerUser.phone,
      savedAddresses: [
        {
          label: 'Home',
          street: '456 Customer Ave',
          city: 'Indore',
          state: 'MP',
          zipCode: '452001',
          location: { type: 'Point', coordinates: [75.8577, 22.7196] }
        }
      ]
    });

    testCategory = await Category.create({
      name: `CommTest Category ${timestamp}`,
      slug: `commtest-cat-${timestamp}`,
      isActive: true
    });

    testService = await Service.create({
      name: `AC Deep Cleaning ${timestamp}`,
      category: testCategory._id,
      basePrice: 599,
      price: 599,
      priceType: 'fixed',
      duration: 60,
      isActive: true
    });

    console.log(`[SETUP] Isolated staging test records created. Service Base Price = ?${testService.basePrice}\n`);

    // =========================================================================
    // TEST 1: ?599 service with no parts
    // =========================================================================
    console.log('[TEST 1] ?599 service with no spare parts');
    const booking1 = await Booking.create({
      bookingReference: `BK-TEST1-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      category: testCategory._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      address: { street: '456 Customer Ave', city: 'Indore', location: { type: 'Point', coordinates: [75.8577, 22.7196] } },
      pricing: { basePrice: 599, tax: 0, discount: 0, totalAmount: 599 },
      originalServicePrice: 599,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed'
    });

    const res1 = await walletService.creditBookingEarnings(booking1._id);
    const updatedBooking1 = await Booking.findById(booking1._id);

    assert(res1.success === true, 'Booking 1 earnings processed successfully');
    assert(res1.commissionableAmount === 599, 'Test 1: Commissionable amount is ?599', { got: res1.commissionableAmount });
    assert(res1.platformCommission === 89.85, 'Test 1: Platform commission is ?89.85 (15% of ?599)', { got: res1.platformCommission });
    assert(res1.partsCommission === 0, 'Test 1: Parts commission is ?0', { got: res1.partsCommission });
    assert(res1.totalGrossAmount === 599, 'Test 1: Total gross customer amount is ?599', { got: res1.totalGrossAmount });
    assert(res1.providerNetEarnings === 509.15, 'Test 1: Provider net earnings is ?509.15 (?599 - ?89.85)', { got: res1.providerNetEarnings });
    assert(updatedBooking1.accounting.commissionableAmount === 599, 'Test 1: Saved booking accounting commissionableAmount is ?599');
    assert(updatedBooking1.accounting.platformCommissionAmount === 89.85, 'Test 1: Saved booking accounting platformCommissionAmount is ?89.85');

    // Reset wallet for subsequent tests
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0, totalEarnings: 0 } });
    console.log('');

    // =========================================================================
    // TEST 2: ?599 service + ?400 approved parts (The Critical Prompt Specification)
    // =========================================================================
    console.log('[TEST 2] ?599 service + ?400 approved parts');
    const booking2 = await Booking.create({
      bookingReference: `BK-TEST2-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      category: testCategory._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '11:00', endTime: '12:00' },
      address: { street: '456 Customer Ave', city: 'Indore', location: { type: 'Point', coordinates: [75.8577, 22.7196] } },
      pricing: { basePrice: 599, tax: 0, discount: 0, totalAmount: 599 },
      originalServicePrice: 599,
      paymentMethod: 'cash',
      status: 'in_progress'
    });

    // Provider submits spare parts: 1 part @ ?400
    await bookingService.submitSpareParts(testProviderUser._id, booking2._id, {
      items: [
        { name: 'Copper Pipe & Gas Refill', quantity: 1, unitPrice: 400, labourCharge: 0, notes: 'Genuine part' }
      ]
    });

    // Customer reviews and approves parts
    await bookingService.reviewSpareParts(testCustomerUser._id, booking2._id, { action: 'approve' });

    // Mark cash collected and complete booking
    await bookingService.confirmCashPaymentByProvider(testProviderUser._id, booking2._id);
    const completeRes2 = await bookingService.completeServiceByProvider(testProviderUser._id, booking2._id);
    const b2Final = await Booking.findById(booking2._id);
    const w2Final = await ProviderWallet.findById(providerWallet._id);

    assert(b2Final.status === 'completed', 'Booking 2 completed');
    assert(b2Final.accounting.originalServicePrice === 599, 'Test 2: originalServicePrice is ?599', { got: b2Final.accounting.originalServicePrice });
    assert(b2Final.accounting.customerApprovedPartsAmount === 400, 'Test 2: customerApprovedPartsAmount is ?400', { got: b2Final.accounting.customerApprovedPartsAmount });
    assert(b2Final.accounting.totalCustomerPayable === 999, 'Test 2: Customer Total (totalCustomerPayable) is ?999', { got: b2Final.accounting.totalCustomerPayable });
    assert(b2Final.accounting.commissionableAmount === 599, 'Test 2: Commissionable Amount is strictly ?599 (NOT ?999!)', { got: b2Final.accounting.commissionableAmount });
    assert(b2Final.accounting.platformCommissionRate === 15, 'Test 2: Platform Commission Rate is 15%', { got: b2Final.accounting.platformCommissionRate });
    assert(b2Final.accounting.platformCommissionAmount === 89.85, 'Test 2: Platform Commission is ?89.85 (15% of ?599)', { got: b2Final.accounting.platformCommissionAmount });
    assert(b2Final.accounting.providerNetEarning === 909.15, 'Test 2: Provider Net Earning is ?909.15 (?509.15 service + ?400 parts)', { got: b2Final.accounting.providerNetEarning });
    assert(w2Final.commissionDue === 89.85, 'Test 2: Wallet commissionDue is ?89.85 (NOT ?149.85!)', { got: w2Final.commissionDue });
    assert(w2Final.availableBalance === 0, 'Test 2: Wallet availableBalance is 0 (never negative)', { got: w2Final.availableBalance });

    // Check transaction evidence
    const tx2 = await WalletTransaction.findOne({ booking: booking2._id, type: 'CASH_BOOKING_COMMISSION_DUE' });
    assert(Boolean(tx2), 'Test 2: CASH_BOOKING_COMMISSION_DUE transaction exists');
    assert(tx2.amount === 89.85, 'Test 2: Transaction amount is ?89.85', { got: tx2?.amount });
    assert(tx2.metadata.partsCommission === 0, 'Test 2: Transaction metadata records partsCommission: 0', { got: tx2?.metadata?.partsCommission });
    assert(tx2.metadata.commissionableAmount === 599, 'Test 2: Transaction metadata records commissionableAmount: 599', { got: tx2?.metadata?.commissionableAmount });

    // Reset wallet
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0, totalEarnings: 0 } });
    console.log('');

    // =========================================================================
    // TEST 3: ?599 service + multiple spare parts
    // =========================================================================
    console.log('[TEST 3] ?599 service + multiple spare parts');
    const booking3 = await Booking.create({
      bookingReference: `BK-TEST3-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      category: testCategory._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '12:00', endTime: '13:00' },
      address: { street: '456 Customer Ave', city: 'Indore', location: { type: 'Point', coordinates: [75.8577, 22.7196] } },
      pricing: { basePrice: 599, tax: 0, discount: 0, totalAmount: 599 },
      originalServicePrice: 599,
      paymentMethod: 'cash',
      status: 'in_progress'
    });

    // 3 parts: Part A (qty 2 @ 100 = 200), Part B (qty 1 @ 150 + 20 labour = 170), Part C (qty 1 @ 30 = 30). Total parts = 400
    await bookingService.submitSpareParts(testProviderUser._id, booking3._id, {
      items: [
        { name: 'Capacitor', quantity: 2, unitPrice: 100, labourCharge: 0 },
        { name: 'Compressor Valve', quantity: 1, unitPrice: 150, labourCharge: 20 },
        { name: 'Insulation Tape', quantity: 1, unitPrice: 30, labourCharge: 0 }
      ]
    });
    await bookingService.reviewSpareParts(testCustomerUser._id, booking3._id, { action: 'approve' });
    await bookingService.confirmCashPaymentByProvider(testProviderUser._id, booking3._id);
    await bookingService.completeServiceByProvider(testProviderUser._id, booking3._id);

    const b3Final = await Booking.findById(booking3._id);
    assert(b3Final.accounting.additionalPartsAmount === 400, 'Test 3: Multiple spare parts subtotal is ?400', { got: b3Final.accounting.additionalPartsAmount });
    assert(b3Final.accounting.commissionableAmount === 599, 'Test 3: Commissionable amount is ?599', { got: b3Final.accounting.commissionableAmount });
    assert(b3Final.accounting.platformCommissionAmount === 89.85, 'Test 3: Commission is ?89.85 regardless of multiple line items', { got: b3Final.accounting.platformCommissionAmount });
    assert(b3Final.accounting.totalCustomerPayable === 999, 'Test 3: Customer Total is ?999', { got: b3Final.accounting.totalCustomerPayable });

    // Reset wallet
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0, totalEarnings: 0 } });
    console.log('');

    // =========================================================================
    // TEST 4: Cash booking with additional parts
    // =========================================================================
    console.log('[TEST 4] Cash booking with additional parts');
    const booking4 = await Booking.create({
      bookingReference: `BK-TEST4-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      category: testCategory._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '13:00', endTime: '14:00' },
      address: { street: '456 Customer Ave', city: 'Indore', location: { type: 'Point', coordinates: [75.8577, 22.7196] } },
      pricing: { basePrice: 599, tax: 0, discount: 0, totalAmount: 599 },
      originalServicePrice: 599,
      paymentMethod: 'cash',
      status: 'in_progress'
    });

    await bookingService.submitSpareParts(testProviderUser._id, booking4._id, {
      items: [{ name: 'Replacement Thermostat', quantity: 1, unitPrice: 400, labourCharge: 0 }]
    });
    await bookingService.reviewSpareParts(testCustomerUser._id, booking4._id, { action: 'approve' });
    await bookingService.confirmCashPaymentByProvider(testProviderUser._id, booking4._id);
    await bookingService.completeServiceByProvider(testProviderUser._id, booking4._id);

    const w4 = await ProviderWallet.findById(providerWallet._id);
    const tx4 = await WalletTransaction.findOne({ booking: booking4._id });

    assert(w4.commissionDue === 89.85, 'Test 4: Cash booking adds ?89.85 to commissionDue', { got: w4.commissionDue });
    assert(w4.availableBalance === 0, 'Test 4: Available balance is not made negative', { got: w4.availableBalance });
    assert(tx4.type === 'CASH_BOOKING_COMMISSION_DUE', 'Test 4: Transaction type is CASH_BOOKING_COMMISSION_DUE');
    assert(tx4.amount === 89.85, 'Test 4: Transaction amount is ?89.85', { got: tx4.amount });
    assert(tx4.balanceBefore === 0 && tx4.balanceAfter === 0, 'Test 4: Balance before and after remain 0');

    // Reset wallet
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0, totalEarnings: 0 } });
    console.log('');

    // =========================================================================
    // TEST 5: Online booking with additional parts
    // =========================================================================
    console.log('[TEST 5] Online booking with additional parts');
    const booking5 = await Booking.create({
      bookingReference: `BK-TEST5-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      category: testCategory._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '14:00', endTime: '15:00' },
      address: { street: '456 Customer Ave', city: 'Indore', location: { type: 'Point', coordinates: [75.8577, 22.7196] } },
      pricing: { basePrice: 599, tax: 0, discount: 0, totalAmount: 599 },
      originalServicePrice: 599,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'in_progress'
    });

    // Provider adds ?400 parts
    await bookingService.submitSpareParts(testProviderUser._id, booking5._id, {
      items: [{ name: 'Filter Replacement', quantity: 1, unitPrice: 400, labourCharge: 0 }]
    });
    await bookingService.reviewSpareParts(testCustomerUser._id, booking5._id, { action: 'approve' });

    // Mark parts as paid online
    booking5.spareParts.paymentStatus = 'paid';
    booking5.spareParts.paymentMethod = 'online';
    await booking5.save();

    await bookingService.completeServiceByProvider(testProviderUser._id, booking5._id);
    const w5 = await ProviderWallet.findById(providerWallet._id);
    const tx5 = await WalletTransaction.findOne({ booking: booking5._id, type: 'booking_earning' });

    assert(Boolean(tx5), 'Test 5: booking_earning transaction created');
    assert(tx5.amount === 909.15, 'Test 5: Credited provider earnings = ?909.15 (?509.15 service + ?400 parts)', { got: tx5?.amount });
    assert(w5.availableBalance === 909.15, 'Test 5: Wallet availableBalance credited ?909.15', { got: w5.availableBalance });
    assert(w5.commissionDue === 0, 'Test 5: No commission due created on online booking', { got: w5.commissionDue });
    assert(tx5.metadata.platformCommission === 89.85, 'Test 5: Metadata platformCommission is ?89.85');
    assert(tx5.metadata.partsCommission === 0, 'Test 5: Metadata partsCommission is ?0');

    // Reset wallet
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, { $set: { commissionDue: 0, availableBalance: 0, totalEarnings: 0 } });
    console.log('');

    // =========================================================================
    // TEST 6: Repeated booking completion request (Idempotency)
    // =========================================================================
    console.log('[TEST 6] Repeated booking completion request (Idempotency)');
    const res6a = await walletService.creditBookingEarnings(booking2._id);
    const res6b = await walletService.creditBookingEarnings(booking2._id);
    const res6c = await walletService.creditBookingEarnings(booking2._id);

    const b2Txns = await WalletTransaction.find({ booking: booking2._id });

    assert(res6a.message.includes('already been recorded') || res6a.message.includes('already been credited'), 'Test 6: Repeat call 1 returns idempotent message', { msg: res6a.message });
    assert(res6b.message.includes('already been recorded') || res6b.message.includes('already been credited'), 'Test 6: Repeat call 2 returns idempotent message');
    assert(res6c.message.includes('already been recorded') || res6c.message.includes('already been credited'), 'Test 6: Repeat call 3 returns idempotent message');
    assert(b2Txns.length === 1, 'Test 6: Exactly 1 transaction exists in database for booking 2 (No duplicates)', { count: b2Txns.length });
    console.log('');

    // =========================================================================
    // TEST 7: Duplicate commission prevention
    // =========================================================================
    console.log('[TEST 7] Duplicate commission prevention & no commission on parts actions');
    // Ensure spare parts submissions and reviews NEVER create wallet transactions
    const countBefore = await WalletTransaction.countDocuments({
      type: { $in: ['CASH_BOOKING_COMMISSION_DUE', 'COMMISSION_WALLET_AUTO_DEBIT', 'commission_deduction'] }
    });

    const booking7 = await Booking.create({
      bookingReference: `BK-TEST7-${timestamp}`,
      customer: testCustomer._id,
      provider: testProvider._id,
      service: testService._id,
      category: testCategory._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '15:00', endTime: '16:00' },
      address: { street: '456 Customer Ave', city: 'Indore', location: { type: 'Point', coordinates: [75.8577, 22.7196] } },
      pricing: { basePrice: 599, tax: 0, discount: 0, totalAmount: 599 },
      originalServicePrice: 599,
      paymentMethod: 'cash',
      status: 'in_progress'
    });

    await bookingService.submitSpareParts(testProviderUser._id, booking7._id, {
      items: [{ name: 'Coolant Gas', quantity: 1, unitPrice: 400, labourCharge: 0 }]
    });
    await bookingService.reviewSpareParts(testCustomerUser._id, booking7._id, { action: 'approve' });
    await bookingService.selectSparePartsPaymentMethod(testCustomerUser._id, booking7._id, { paymentMethod: 'cash' });

    const countAfter = await WalletTransaction.countDocuments({
      type: { $in: ['CASH_BOOKING_COMMISSION_DUE', 'COMMISSION_WALLET_AUTO_DEBIT', 'commission_deduction'] }
    });

    assert(countAfter === countBefore, 'Test 7: Adding and approving parts created 0 commission transactions before completion', { before: countBefore, after: countAfter });

    // Compound unique index test: Attempt to insert duplicate CASH_BOOKING_COMMISSION_DUE for booking2
    let duplicateErrorCaught = false;
    try {
      await WalletTransaction.create({
        wallet: providerWallet._id,
        provider: testProvider._id,
        transactionReference: `TXN-DUP-${timestamp}`,
        type: 'CASH_BOOKING_COMMISSION_DUE',
        amount: 89.85,
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'completed',
        booking: booking2._id,
        paymentMethod: 'cash',
        description: 'Duplicate test'
      });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        duplicateErrorCaught = true;
      }
    }
    assert(duplicateErrorCaught === true, 'Test 7: Compound unique index { booking: 1, type: 1 } strictly blocks duplicate commission records');
    console.log('');

    // =========================================================================
    // TEST 8: Full Razorpay commission settlement
    // =========================================================================
    console.log('[TEST 8] Full Razorpay commission settlement');
    // Set commissionDue to ?89.85 (from ?599 base service)
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, {
      $set: { commissionDue: 89.85, availableBalance: 0 }
    });

    // 1. Create Pay Commission Order
    const orderRes = await walletService.createPayCommissionOrder(testProvider._id);
    assert(orderRes.amount === 89.85, 'Test 8: Created commission Razorpay order amount is ?89.85 (in full, no parts comm)', { got: orderRes.amount });
    assert(orderRes.amountInPaise === 8985, 'Test 8: Order amount in paise is 8985', { got: orderRes.amountInPaise });

    // 2. Simulate Razorpay payment verification
    const dummyPaymentId = `pay_test_${timestamp}`;
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

    let settleRes = null;
    try {
      settleRes = await walletService.verifyAndSettleCommissionPayment(testProvider._id, {
        razorpayOrderId: dummyOrderId,
        razorpayPaymentId: dummyPaymentId,
        razorpaySignature: dummySignature
      });
    } finally {
      paymentService.fetchPayment = origFetch;
    }

    const w8Final = await ProviderWallet.findById(providerWallet._id);
    assert(settleRes.success === true, 'Test 8: Commission payment verified and settled successfully');
    assert(w8Final.commissionDue === 0, 'Test 8: commissionDue is 0 after full settlement', { got: w8Final.commissionDue });

    const payTx8 = await WalletTransaction.findOne({ 'metadata.razorpayPaymentId': dummyPaymentId });
    assert(payTx8.type === 'COMMISSION_PAYMENT', 'Test 8: Recorded COMMISSION_PAYMENT transaction');
    assert(payTx8.amount === 89.85, 'Test 8: Settled amount is ?89.85', { got: payTx8.amount });
    console.log('');

    // =========================================================================
    // TEST 9: Full automatic wallet commission deduction
    // =========================================================================
    console.log('[TEST 9] Full automatic wallet commission deduction');
    // Provider enables auto-deduction, has ?500 available balance, and ?89.85 commission due
    await ProviderWallet.findByIdAndUpdate(providerWallet._id, {
      $set: {
        autoDeductCommissionFromWallet: true,
        autoCommissionAdjustment: true,
        availableBalance: 500,
        commissionDue: 89.85
      }
    });

    const autoRes = await walletService.tryAutoDeductCommissionFromWallet(testProvider._id);
    const w9Final = await ProviderWallet.findById(providerWallet._id);

    assert(autoRes.deducted === true, 'Test 9: Auto deduction succeeded');
    const deductedAmt = autoRes.deductionAmount || autoRes.amount;
    assert(deductedAmt === 89.85, 'Test 9: Deducted exactly ₹89.85 (full outstanding commission)', { got: deductedAmt });
    assert(w9Final.commissionDue === 0, 'Test 9: commissionDue is reduced to 0', { got: w9Final.commissionDue });
    assert(w9Final.availableBalance === 410.15, 'Test 9: availableBalance is ?410.15 (?500 - ?89.85)', { got: w9Final.availableBalance });

    const autoTx9 = await WalletTransaction.findOne({
      wallet: providerWallet._id,
      type: 'COMMISSION_WALLET_AUTO_DEBIT'
    });
    assert(Boolean(autoTx9), 'Test 9: COMMISSION_WALLET_AUTO_DEBIT transaction recorded');
    assert(autoTx9.amount === 89.85, 'Test 9: Auto debit amount is ?89.85');
    console.log('');

    // =========================================================================
    // TEST 10: Verify commission is NEVER calculated on parts
    // =========================================================================
    console.log('[TEST 10] Mathematical Verification: Commission on parts is strictly ?0');
    const calcNoParts = calculateBookingCommission({
      originalServicePrice: 599,
      pricing: { basePrice: 599, totalAmount: 599 }
    });

    const calcWithParts = calculateBookingCommission({
      originalServicePrice: 599,
      pricing: { basePrice: 599, totalAmount: 999 },
      spareParts: {
        status: 'approved',
        totalAdditionalAmount: 400,
        items: [{ name: 'Test Part', quantity: 1, totalPrice: 400 }]
      }
    });

    assert(calcNoParts.platformCommissionAmount === 89.85, 'Test 10: Commission on ?599 base without parts is ?89.85', { got: calcNoParts.platformCommissionAmount });
    assert(calcWithParts.platformCommissionAmount === 89.85, 'Test 10: Commission on ?599 base with ?400 parts is ?89.85', { got: calcWithParts.platformCommissionAmount });
    assert(calcWithParts.partsCommission === 0, 'Test 10: partsCommission is explicitly ?0', { got: calcWithParts.partsCommission });

    const commissionDiff = calcWithParts.platformCommissionAmount - calcNoParts.platformCommissionAmount;
    assert(commissionDiff === 0, 'Test 10: Commission difference between having parts vs no parts is ?0.00', { diff: commissionDiff });

    const faultyCommission = 999 * 0.15; // 149.85
    assert(calcWithParts.platformCommissionAmount !== faultyCommission, 'Test 10: Platform commission is NEVER calculated on total bill ?999 (?149.85 ? ?89.85)', {
      correctCommission: calcWithParts.platformCommissionAmount,
      faultyCommission
    });

  } catch (err) {
    console.error('\n? UNHANDLED ERROR IN TEST SUITE:', err);
    failed++;
  } finally {
    // Cleanup isolated test records
    console.log('\n[CLEANUP] Removing isolated staging test records...');
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

runTestSuite();
