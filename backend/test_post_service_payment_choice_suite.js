/**
 * AUTOMATED TEST SUITE:
 * FEATURE: Post-Service Payment Choice (Cash vs Online Settlement)
 * 
 * Verifies all 15 scenarios:
 *  1. Initial booking creation with Cash on Service (initialPaymentMethod: 'cash', pending payment).
 *  2. Provider completes service while cash payment is pending (no premature blocker).
 *  3. Wallet is NOT credited when service completed with pending payment.
 *  4. Customer selects post-service cash choice (postServicePaymentChoice: 'cash').
 *  5. Provider confirms cash on completed booking (paymentStatus: 'paid', cashConfirmedByProvider: true).
 *  6. Cash commission due is properly recorded in provider wallet (availableBalance NOT negative).
 *  7. Service completion with approved spare parts settled in Cash (0% parts commission).
 *  8. Customer selects post-service online choice & creates Razorpay order.
 *  9. Online payment verification settles completed booking (paymentMethod: 'online', postServicePaymentChoice: 'online').
 * 10. Online payment credits provider wallet with net earnings (commission retained online).
 * 11. Online payment with approved spare parts (base commission only, 100% parts to provider).
 * 12. Race condition protection: Cash confirmed first blocks subsequent online order/verification.
 * 13. Race condition protection: Online verified first blocks subsequent cash confirmation.
 * 14. Idempotency: Duplicate settlement attempts do not double credit or corrupt wallet balances.
 * 15. Auto-deduct integration: Post-service online earning automatically clears outstanding commission due.
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
  Booking
} = require('./src/models');
const walletService = require('./src/services/walletService');
const bookingService = require('./src/services/bookingService');
const paymentService = require('./src/services/paymentService');
const { calculateBookingCommission } = require('./src/utils/commissionCalculator');

// Mock paymentService.verifyPaymentSignature for deterministic unit tests
const originalVerifySignature = paymentService.verifyPaymentSignature;

async function runPostServicePaymentChoiceSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING POST-SERVICE PAYMENT CHOICE TEST SUITE');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);
  await WalletTransaction.syncIndexes();
  await Booking.syncIndexes();
  await ProviderWallet.syncIndexes();

  let passed = 0;
  let failed = 0;
  const testResults = [];

  function assert(condition, message, details = {}) {
    if (condition) {
      passed++;
      console.log(`  ✅ PASS: ${message}`);
      testResults.push({ status: 'PASS', message });
    } else {
      failed++;
      console.error(`  ❌ FAIL: ${message}`, details);
      testResults.push({ status: 'FAIL', message, details });
    }
  }

  // Helper mock for signature verification
  let mockSignatureValid = true;
  paymentService.verifyPaymentSignature = (params) => {
    if (params.signature === 'invalid_signature') return false;
    return mockSignatureValid;
  };

  const createdCleanup = {
    users: [],
    providers: [],
    customers: [],
    services: [],
    categories: [],
    bookings: [],
    wallets: [],
    transactions: []
  };

  // Helper factory
  const createTestFixtures = async (prefix = 'PSP') => {
    const timestamp = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);

    const cat = await Category.create({
      name: `Cat_${prefix}_${timestamp}`,
      slug: `cat-${prefix}-${timestamp}`,
      description: 'Test Category',
      isActive: true
    });
    createdCleanup.categories.push(cat._id);

    const srv = await Service.create({
      name: `Service_${prefix}_${timestamp}`,
      slug: `srv-${prefix}-${timestamp}`,
      category: cat._id,
      price: 599,
      priceType: 'fixed',
      estimatedDurationMinutes: 60,
      isActive: true
    });
    createdCleanup.services.push(srv._id);

    // Customer
    const custUser = await User.create({
      name: `Cust_${prefix}_${timestamp}`,
      email: `cust_${prefix}_${timestamp}@test.com`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'customer',
      password: 'hashedPassword123',
      isActive: true
    });
    createdCleanup.users.push(custUser._id);

    const customer = await Customer.create({
      user: custUser._id,
      address: [{ street: '123 Main St', city: 'Test City', state: 'TS', zipCode: '12345' }]
    });
    createdCleanup.customers.push(customer._id);

    // Provider
    const provUser = await User.create({
      name: `Prov_${prefix}_${timestamp}`,
      email: `prov_${prefix}_${timestamp}@test.com`,
      phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'provider',
      password: 'hashedPassword123',
      isActive: true
    });
    createdCleanup.users.push(provUser._id);

    const provider = await Provider.create({
      user: provUser._id,
      businessName: `Biz_${prefix}_${timestamp}`,
      categories: [cat._id],
      isApproved: true,
      verificationStatus: 'verified',
      isAvailable: true,
      serviceRadiusKm: 25
    });
    createdCleanup.providers.push(provider._id);

    const wallet = await walletService.getOrCreateWallet(provider._id);
    createdCleanup.wallets.push(wallet._id);

    return { cat, srv, custUser, customer, provUser, provider, wallet };
  };

  try {
    // =========================================================================
    // Scenario 1: Initial Booking Creation with Cash on Service
    // =========================================================================
    console.log('\n--- Scenario 1: Initial Booking Creation with Cash on Service ---');
    const f1 = await createTestFixtures('SC1');
    const b1 = await bookingService.createBooking(f1.custUser._id, {
      serviceId: f1.srv._id,
      providerId: f1.provider._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(Date.now() + 86400000),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: { street: '456 Test Ave', city: 'Test City' },
      paymentMethod: 'cash'
    });
    createdCleanup.bookings.push(b1._id);

    assert(b1.initialPaymentMethod === 'cash', 'Booking has initialPaymentMethod === "cash"', { initial: b1.initialPaymentMethod });
    assert(b1.paymentMethod === 'cash', 'Booking has paymentMethod === "cash"', { method: b1.paymentMethod });
    assert(b1.paymentStatus === 'pending', 'Booking has paymentStatus === "pending"', { status: b1.paymentStatus });
    assert(b1.postServicePaymentChoice === null || b1.postServicePaymentChoice === undefined, 'postServicePaymentChoice is initially null');
    assert(b1.status === 'accepted' || b1.status === 'pending', 'Booking is in accepted/pending status', { status: b1.status });

    // =========================================================================
    // Scenario 2: Provider Completes Service While Cash Payment is Pending
    // =========================================================================
    console.log('\n--- Scenario 2: Provider Completes Service While Cash Payment is Pending ---');
    await bookingService.acceptBookingByProvider(f1.provUser._id, b1._id);
    await bookingService.startServiceByProvider(f1.provUser._id, b1._id);
    const completedB1 = await bookingService.completeServiceByProvider(f1.provUser._id, b1._id);

    assert(completedB1.status === 'completed', 'Service transitions to "completed" even when paymentStatus is pending');
    assert(completedB1.paymentStatus === 'pending', 'Payment status remains "pending" upon service completion');

    // =========================================================================
    // Scenario 3: Wallet NOT Credited Prematurely for Unpaid Completed Job
    // =========================================================================
    console.log('\n--- Scenario 3: Wallet NOT Credited Prematurely for Unpaid Completed Job ---');
    const walletCheck1 = await ProviderWallet.findById(f1.wallet._id);
    const txnCount1 = await WalletTransaction.countDocuments({ booking: b1._id });

    assert(walletCheck1.availableBalance === 0, 'Wallet availableBalance remains 0 (not credited prematurely)');
    assert((walletCheck1.commissionDue || 0) === 0, 'Wallet commissionDue remains 0 (no premature commission charged)');
    assert(txnCount1 === 0, 'No wallet transactions created while payment is pending');

    // =========================================================================
    // Scenario 4: Customer Selects Post-Service Cash Choice
    // =========================================================================
    console.log('\n--- Scenario 4: Customer Selects Post-Service Cash Choice ---');
    const chosenB1 = await bookingService.selectPostServicePaymentChoice(f1.custUser._id, b1._id, 'cash');
    assert(chosenB1.postServicePaymentChoice === 'cash', 'postServicePaymentChoice updated to "cash"');
    assert(chosenB1.paymentMethod === 'cash', 'paymentMethod confirmed as "cash"');

    // =========================================================================
    // Scenario 5: Provider Confirms Cash on Completed Booking
    // =========================================================================
    console.log('\n--- Scenario 5: Provider Confirms Cash on Completed Booking ---');
    const cashConfirmedB1 = await bookingService.confirmCashPaymentByProvider(f1.provUser._id, b1._id);
    assert(cashConfirmedB1.paymentStatus === 'paid', 'Booking paymentStatus updated to "paid"');
    assert(cashConfirmedB1.paymentDetails?.cashConfirmedByProvider === true, 'cashConfirmedByProvider is true');
    assert(cashConfirmedB1.paymentDetails?.cashCollectedAmount === 599, 'cashCollectedAmount matches total payable ₹599');

    // =========================================================================
    // Scenario 6: Cash Commission Due Recorded in Wallet
    // =========================================================================
    console.log('\n--- Scenario 6: Cash Commission Due Recorded in Wallet ---');
    const walletAfterCash = await ProviderWallet.findById(f1.wallet._id);
    const expectedCommission = Math.round(599 * 0.15 * 100) / 100; // ₹89.85

    assert(walletAfterCash.commissionDue === expectedCommission, `commissionDue is exact platform commission ₹${expectedCommission}`, { due: walletAfterCash.commissionDue });
    assert(walletAfterCash.availableBalance === 0, 'availableBalance is NOT negative (kept at 0)', { balance: walletAfterCash.availableBalance });

    const cashTxn = await WalletTransaction.findOne({ booking: b1._id, type: 'CASH_BOOKING_COMMISSION_DUE' });
    assert(Boolean(cashTxn), 'CASH_BOOKING_COMMISSION_DUE transaction recorded in ledger');
    assert(cashTxn.amount === expectedCommission, `Transaction amount is ₹${expectedCommission}`);

    // =========================================================================
    // Scenario 7: Service Completion with Approved Spare Parts (Cash Settlement)
    // =========================================================================
    console.log('\n--- Scenario 7: Service Completion with Approved Spare Parts (Cash Settlement) ---');
    const f7 = await createTestFixtures('SC7');
    const b7 = await bookingService.createBooking(f7.custUser._id, {
      serviceId: f7.srv._id,
      providerId: f7.provider._id,
      bookingMode: 'instant',
      address: { street: '123 Parts Ln', city: 'Test City' },
      paymentMethod: 'cash'
    });
    createdCleanup.bookings.push(b7._id);

    // Accept & start
    await bookingService.acceptBookingByProvider(f7.provUser._id, b7._id);
    await bookingService.startServiceByProvider(f7.provUser._id, b7._id);

    // Provider submits spare parts ₹400
    await bookingService.submitSpareParts(f7.provUser._id, b7._id, {
      items: [{ name: 'Replacement Capacitor', quantity: 1, unitPrice: 350, labourCharge: 50, notes: 'Heavy duty' }]
    });

    // Customer approves parts
    await bookingService.reviewSpareParts(f7.custUser._id, b7._id, { action: 'approve' });

    // Verify pricing total is now ₹599 + ₹400 = ₹999
    const b7AfterApproval = await Booking.findById(b7._id);
    assert(b7AfterApproval.pricing.totalAmount === 999, 'totalAmount is ₹999 (599 base + 400 parts)');

    // Provider completes service
    const completedB7 = await bookingService.completeServiceByProvider(f7.provUser._id, b7._id);
    assert(completedB7.status === 'completed', 'Job with approved parts completed successfully');
    assert(completedB7.paymentStatus === 'pending', 'Payment status is pending post-service');

    // Provider confirms ₹999 cash collected
    await bookingService.confirmCashPaymentByProvider(f7.provUser._id, b7._id);
    const wallet7 = await ProviderWallet.findById(f7.wallet._id);

    // CRITICAL: Platform commission ONLY on ₹599 base (15% = 89.85), parts carry 0%
    assert(wallet7.commissionDue === 89.85, 'Commission due is ₹89.85 (15% of ₹599 base price, ₹0 on ₹400 spare parts)', { due: wallet7.commissionDue });

    // =========================================================================
    // Scenario 8: Customer Selects Online Post-Service Payment Choice
    // =========================================================================
    console.log('\n--- Scenario 8: Customer Selects Online Post-Service Payment Choice ---');
    const f8 = await createTestFixtures('SC8');
    const b8 = await bookingService.createBooking(f8.custUser._id, {
      serviceId: f8.srv._id,
      providerId: f8.provider._id,
      bookingMode: 'instant',
      address: { street: '99 Online Blvd', city: 'Test City' },
      paymentMethod: 'cash' // Initial choice cash
    });
    createdCleanup.bookings.push(b8._id);

    await bookingService.acceptBookingByProvider(f8.provUser._id, b8._id);
    await bookingService.startServiceByProvider(f8.provUser._id, b8._id);
    await bookingService.completeServiceByProvider(f8.provUser._id, b8._id);

    // Customer selects online payment
    const orderRes = await bookingService.createPaymentOrder(f8.custUser._id, b8._id);
    assert(Boolean(orderRes?.orderId), 'Razorpay order created for completed booking', { orderId: orderRes?.orderId });
    assert(orderRes.amount === 59900, 'Order amount in paise is 59900 (₹599.00)');

    const b8AfterOrder = await Booking.findById(b8._id);
    assert(b8AfterOrder.postServicePaymentChoice === 'online', 'postServicePaymentChoice set to "online"');

    // =========================================================================
    // Scenario 9 & 10: Online Payment Verification & Net Earnings Wallet Credit
    // =========================================================================
    console.log('\n--- Scenario 9 & 10: Online Payment Verification & Net Earnings Wallet Credit ---');
    const verifiedB8 = await bookingService.verifyPayment(f8.custUser._id, b8._id, {
      razorpayOrderId: orderRes.orderId,
      razorpayPaymentId: 'pay_test_' + Date.now(),
      razorpaySignature: 'valid_signature'
    });

    assert(verifiedB8.paymentStatus === 'paid', 'Booking paymentStatus is "paid"');
    assert(verifiedB8.paymentMethod === 'online', 'Booking paymentMethod updated to "online"');
    assert(verifiedB8.postServicePaymentChoice === 'online', 'Booking postServicePaymentChoice is "online"');

    const wallet8 = await ProviderWallet.findById(f8.wallet._id);
    const expectedNetEarning = 599 - 89.85; // ₹509.15
    assert(wallet8.availableBalance === expectedNetEarning, `availableBalance credited with exact net earning ₹${expectedNetEarning}`, { bal: wallet8.availableBalance });
    assert((wallet8.commissionDue || 0) === 0, 'commissionDue is 0 (platform commission retained upfront online)');

    const onlineTxn = await WalletTransaction.findOne({ booking: b8._id, type: 'booking_earning' });
    assert(Boolean(onlineTxn), 'booking_earning transaction recorded in wallet');
    assert(onlineTxn.amount === expectedNetEarning, `Transaction credited ₹${expectedNetEarning}`);

    // =========================================================================
    // Scenario 11: Online Post-Service Payment with Spare Parts
    // =========================================================================
    console.log('\n--- Scenario 11: Online Post-Service Payment with Spare Parts ---');
    const f11 = await createTestFixtures('SC11');
    const b11 = await bookingService.createBooking(f11.custUser._id, {
      serviceId: f11.srv._id,
      providerId: f11.provider._id,
      bookingMode: 'instant',
      address: { street: '77 Parts Rd', city: 'Test City' },
      paymentMethod: 'cash'
    });
    createdCleanup.bookings.push(b11._id);

    await bookingService.acceptBookingByProvider(f11.provUser._id, b11._id);
    await bookingService.startServiceByProvider(f11.provUser._id, b11._id);

    // Add spare parts ₹300 (total ₹599 + ₹300 = ₹899)
    await bookingService.submitSpareParts(f11.provUser._id, b11._id, {
      items: [{ name: 'Replacement Pipe', quantity: 1, unitPrice: 250, labourCharge: 50 }]
    });
    await bookingService.reviewSpareParts(f11.custUser._id, b11._id, { action: 'approve' });
    await bookingService.completeServiceByProvider(f11.provUser._id, b11._id);

    // Customer pays ₹899 online
    const order11 = await bookingService.createPaymentOrder(f11.custUser._id, b11._id);
    assert(order11.amount === 89900, 'Order amount in paise is 89900 (₹899.00)');

    await bookingService.verifyPayment(f11.custUser._id, b11._id, {
      razorpayOrderId: order11.orderId,
      razorpayPaymentId: 'pay_test_' + Date.now(),
      razorpaySignature: 'valid_signature'
    });

    const wallet11 = await ProviderWallet.findById(f11.wallet._id);
    // Platform commission is 15% of ₹599 = ₹89.85. Spare parts ₹300 has ₹0 commission.
    // Provider Net = ₹899 - ₹89.85 = ₹809.15
    const expectedNet11 = 899 - 89.85;
    assert(wallet11.availableBalance === expectedNet11, `availableBalance is ₹${expectedNet11} (₹300 parts 100% to provider + ₹509.15 net service)`, { bal: wallet11.availableBalance });
    assert((wallet11.commissionDue || 0) === 0, 'No commission due recorded');

    // =========================================================================
    // Scenario 12: Race Condition - Cash Confirmed First Blocks Online Verification
    // =========================================================================
    console.log('\n--- Scenario 12: Race Condition - Cash Confirmed First Blocks Online Verification ---');
    const f12 = await createTestFixtures('SC12');
    const b12 = await bookingService.createBooking(f12.custUser._id, {
      serviceId: f12.srv._id,
      providerId: f12.provider._id,
      bookingMode: 'instant',
      address: { street: '12 Race Way', city: 'Test City' },
      paymentMethod: 'cash'
    });
    createdCleanup.bookings.push(b12._id);
    await bookingService.acceptBookingByProvider(f12.provUser._id, b12._id);
    await bookingService.startServiceByProvider(f12.provUser._id, b12._id);
    await bookingService.completeServiceByProvider(f12.provUser._id, b12._id);

    // Provider confirms cash
    await bookingService.confirmCashPaymentByProvider(f12.provUser._id, b12._id);

    // Customer attempts to initiate online payment
    let orderErr = null;
    try {
      await bookingService.createPaymentOrder(f12.custUser._id, b12._id);
    } catch (e) {
      orderErr = e;
    }
    assert(Boolean(orderErr), 'createPaymentOrder blocked after cash already confirmed');

    // Customer attempts to verify payment directly
    let verifyErr = null;
    try {
      await bookingService.verifyPayment(f12.custUser._id, b12._id, {
        razorpayOrderId: 'order_fake',
        razorpayPaymentId: 'pay_fake',
        razorpaySignature: 'valid_signature'
      });
    } catch (e) {
      verifyErr = e;
    }
    assert(Boolean(verifyErr), 'verifyPayment blocked with conflict error after cash confirmed');

    // =========================================================================
    // Scenario 13: Race Condition - Online Paid First Blocks Cash Confirmation
    // =========================================================================
    console.log('\n--- Scenario 13: Race Condition - Online Paid First Blocks Cash Confirmation ---');
    const f13 = await createTestFixtures('SC13');
    const b13 = await bookingService.createBooking(f13.custUser._id, {
      serviceId: f13.srv._id,
      providerId: f13.provider._id,
      bookingMode: 'instant',
      address: { street: '13 Race Way', city: 'Test City' },
      paymentMethod: 'cash'
    });
    createdCleanup.bookings.push(b13._id);
    await bookingService.acceptBookingByProvider(f13.provUser._id, b13._id);
    await bookingService.startServiceByProvider(f13.provUser._id, b13._id);
    await bookingService.completeServiceByProvider(f13.provUser._id, b13._id);

    // Customer pays online
    const order13 = await bookingService.createPaymentOrder(f13.custUser._id, b13._id);
    await bookingService.verifyPayment(f13.custUser._id, b13._id, {
      razorpayOrderId: order13.orderId,
      razorpayPaymentId: 'pay_test_' + Date.now(),
      razorpaySignature: 'valid_signature'
    });

    // Provider tries to mark cash received
    let cashErr = null;
    try {
      await bookingService.confirmCashPaymentByProvider(f13.provUser._id, b13._id);
    } catch (e) {
      cashErr = e;
    }
    assert(Boolean(cashErr), 'confirmCashPaymentByProvider blocked after booking already paid online');

    // =========================================================================
    // Scenario 14: Idempotency - Duplicate Confirmations Do Not Double Credit/Charge
    // =========================================================================
    console.log('\n--- Scenario 14: Idempotency - Duplicate Confirmations Do Not Double Credit/Charge ---');
    const initialBal13 = (await ProviderWallet.findById(f13.wallet._id)).availableBalance;

    // Retry verify payment with same details
    const retryRes = await bookingService.verifyPayment(f13.custUser._id, b13._id, {
      razorpayOrderId: order13.orderId,
      razorpayPaymentId: 'pay_test_' + Date.now(),
      razorpaySignature: 'valid_signature'
    });
    assert(retryRes.paymentStatus === 'paid', 'Idempotent verify returns paid booking');

    const balAfterRetry = (await ProviderWallet.findById(f13.wallet._id)).availableBalance;
    assert(balAfterRetry === initialBal13, 'Wallet balance remained strictly identical (no double credit)');

    // =========================================================================
    // Scenario 15: Auto-Deduct Integration on Post-Service Online Settlement
    // =========================================================================
    console.log('\n--- Scenario 15: Auto-Deduct Integration on Post-Service Online Settlement ---');
    const f15 = await createTestFixtures('SC15');

    // Set provider wallet with autoDeduct: true and outstanding commissionDue: ₹50
    await ProviderWallet.findByIdAndUpdate(f15.wallet._id, {
      autoDeductCommissionFromWallet: true,
      commissionDue: 50
    });

    const b15 = await bookingService.createBooking(f15.custUser._id, {
      serviceId: f15.srv._id,
      providerId: f15.provider._id,
      bookingMode: 'instant',
      address: { street: '15 Auto Deduct St', city: 'Test City' },
      paymentMethod: 'cash'
    });
    createdCleanup.bookings.push(b15._id);
    await bookingService.acceptBookingByProvider(f15.provUser._id, b15._id);
    await bookingService.startServiceByProvider(f15.provUser._id, b15._id);
    await bookingService.completeServiceByProvider(f15.provUser._id, b15._id);

    // Customer pays ₹599 online. Net earning = ₹509.15
    const order15 = await bookingService.createPaymentOrder(f15.custUser._id, b15._id);
    await bookingService.verifyPayment(f15.custUser._id, b15._id, {
      razorpayOrderId: order15.orderId,
      razorpayPaymentId: 'pay_test_' + Date.now(),
      razorpaySignature: 'valid_signature'
    });

    const wallet15 = await ProviderWallet.findById(f15.wallet._id);
    // Net earning: 509.15. Auto-deduct took full 50 outstanding commission.
    // Final balance: 509.15 - 50 = 459.15. Final commissionDue: 0.
    assert(wallet15.commissionDue === 0, 'Auto-deduction cleared all outstanding commission due', { due: wallet15.commissionDue });
    assert(wallet15.availableBalance === 459.15, `Final availableBalance is ₹459.15 (509.15 earning - 50 auto-deduct)`, { bal: wallet15.availableBalance });

    const deductTxn = await WalletTransaction.findOne({
      wallet: f15.wallet._id,
      type: { $in: ['commission_deduction', 'COMMISSION_WALLET_AUTO_DEBIT', 'COMMISSION_ADJUSTMENT'] }
    });
    assert(Boolean(deductTxn), 'Auto-deduction transaction recorded in ledger');
    assert(deductTxn.amount === 50, 'Auto-deduction transaction amount is ₹50');

  } catch (err) {
    console.error('💥 Unhandled error in test suite:', err);
    failed++;
  } finally {
    // Restore original method
    paymentService.verifyPaymentSignature = originalVerifySignature;

    console.log('\n[CLEANUP] Cleaning up test fixtures...');
    try {
      await Booking.deleteMany({ _id: { $in: createdCleanup.bookings } });
      await WalletTransaction.deleteMany({
        $or: [
          { booking: { $in: createdCleanup.bookings } },
          { wallet: { $in: createdCleanup.wallets } }
        ]
      });
      await ProviderWallet.deleteMany({ _id: { $in: createdCleanup.wallets } });
      await Provider.deleteMany({ _id: { $in: createdCleanup.providers } });
      await Customer.deleteMany({ _id: { $in: createdCleanup.customers } });
      await Service.deleteMany({ _id: { $in: createdCleanup.services } });
      await Category.deleteMany({ _id: { $in: createdCleanup.categories } });
      await User.deleteMany({ _id: { $in: createdCleanup.users } });
      console.log('[CLEANUP] Done.');
    } catch (cleanupErr) {
      console.warn('[CLEANUP_WARN]', cleanupErr.message);
    }

    await mongoose.disconnect();
    console.log('[TEARDOWN] Disconnected from MongoDB.\n');

    console.log('================================================================================');
    console.log(`🏁 TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
    console.log('================================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPostServicePaymentChoiceSuite();
