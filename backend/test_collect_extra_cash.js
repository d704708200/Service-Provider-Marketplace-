/**
 * Regression & Unit/Integration Test Suite: Collect Extra Cash Workflow
 */

const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Booking = require('./src/models/Booking');
const Provider = require('./src/models/Provider');
const Customer = require('./src/models/Customer');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const bookingService = require('./src/services/bookingService');

let passed = 0;
let total = 0;

async function test(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`✓ Test ${total}: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ Test ${total} FAILED: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function run() {
  console.log('--- RUNNING COLLECT EXTRA CASH TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  await Booking.deleteMany({ bookingReference: /^BK-TEST-EXTRA-/ });
  await Booking.deleteMany({ bookingReference: /^BK-TEST-COMPLETE-/ });

  const mockProviderUserId = new mongoose.Types.ObjectId();
  const mockOtherProviderUserId = new mongoose.Types.ObjectId();
  const mockCustomerUserId = new mongoose.Types.ObjectId();

  const mockProvider = await Provider.create({
    user: mockProviderUserId,
    businessName: 'Test Extra Cash Provider',
    categories: [],
    phone: '9999999991',
    address: { street: '123 Tech St', city: 'Testville', state: 'TS', pincode: '123456' },
    isAvailable: true,
    verificationStatus: 'verified'
  });

  const mockOtherProvider = await Provider.create({
    user: mockOtherProviderUserId,
    businessName: 'Other Provider',
    categories: [],
    phone: '9999999992',
    address: { street: '124 Tech St', city: 'Testville', state: 'TS', pincode: '123456' },
    isAvailable: true,
    verificationStatus: 'verified'
  });

  const mockCustomer = await Customer.create({
    user: mockCustomerUserId,
    addresses: [{ street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456', isDefault: true }]
  });

  const mockCategory = await Category.create({
    name: 'Test Category Extra ' + Date.now(),
    slug: 'test-cat-extra-' + Date.now(),
    isActive: true
  });

  const mockService = await Service.create({
    name: 'Test Extra Cash Service',
    category: mockCategory._id,
    price: 50,
    priceType: 'fixed',
    isActive: true
  });

  const uid = Date.now();

  try {
    // 1. Online booking with approved cash spare parts (₹210)
    let booking1 = await Booking.create({
      bookingReference: `BK-TEST-EXTRA-CASH-1-${uid}`,
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'online',
      paymentStatus: 'paid', // base paid online
      pricing: {
        basePrice: 50,
        tax: 0,
        discount: 0,
        totalAmount: 260
      },
      spareParts: {
        status: 'approved',
        partsSubtotal: 180,
        labourSubtotal: 30,
        totalAdditionalAmount: 210,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        items: [
          { name: 'Capacitor', quantity: 1, unitPrice: 180, labourCharge: 30, totalPrice: 210 }
        ]
      },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('Provider successfully collects extra cash for approved materials', async () => {
      const updated = await bookingService.confirmCashPaymentByProvider(mockProviderUserId, booking1._id);
      assert.strictEqual(updated.spareParts.paymentStatus, 'paid');
      assert.strictEqual(updated.spareParts.paymentMethod, 'cash');
      assert.ok(updated.spareParts.paymentDetails?.paidAt, 'spareParts.paymentDetails.paidAt should be set');
      assert.strictEqual(updated.paymentDetails.cashConfirmedByProvider, true);
      assert.strictEqual(updated.paymentDetails.cashCollectedAmount, 210);
      assert.strictEqual(updated.paymentStatus, 'paid'); // base was already paid online
    });

    await test('Duplicate collection attempt is rejected with 400', async () => {
      try {
        await bookingService.confirmCashPaymentByProvider(mockProviderUserId, booking1._id);
        assert.fail('Should have thrown an error for duplicate collection');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('already been collected'));
      }
    });

    // 2. Security: Unauthorized provider cannot collect cash
    await test('Unauthorized provider cannot collect cash', async () => {
      try {
        await bookingService.confirmCashPaymentByProvider(mockOtherProviderUserId, booking1._id);
        assert.fail('Should have thrown 403');
      } catch (err) {
        assert.strictEqual(err.statusCode, 403);
      }
    });

    // 3. Status check: Booking in pending status cannot have cash collected
    let bookingPending = await Booking.create({
      bookingReference: 'BK-TEST-EXTRA-CASH-PENDING',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'pending',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 50 },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('Cash collection rejected when booking is in pending status', async () => {
      try {
        await bookingService.confirmCashPaymentByProvider(mockProviderUserId, bookingPending._id);
        assert.fail('Should have rejected pending booking');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('status'));
      }
    });

    // 4. Pending proposal check: Cannot collect cash while proposal is awaiting customer review
    let bookingProposed = await Booking.create({
      bookingReference: 'BK-TEST-EXTRA-CASH-PROPOSED',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'online',
      paymentStatus: 'paid',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 50 },
      spareParts: {
        status: 'pending_approval',
        totalAdditionalAmount: 200,
        paymentStatus: 'pending',
        paymentMethod: 'cash'
      },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('Cash collection rejected while extra materials proposal is awaiting approval', async () => {
      try {
        await bookingService.confirmCashPaymentByProvider(mockProviderUserId, bookingProposed._id);
        assert.fail('Should have rejected unapproved proposal');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('awaiting customer approval'));
      }
    });

    // 5. Zero balance check
    let bookingZeroExtra = await Booking.create({
      bookingReference: 'BK-TEST-EXTRA-CASH-ZERO',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'online',
      paymentStatus: 'paid',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 50 },
      spareParts: {
        status: 'approved',
        totalAdditionalAmount: 0,
        paymentStatus: 'pending',
        paymentMethod: 'cash'
      },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('Cash collection rejected when outstanding cash balance is 0', async () => {
      try {
        await bookingService.confirmCashPaymentByProvider(mockProviderUserId, bookingZeroExtra._id);
        assert.fail('Should have rejected zero extra cash');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('No outstanding cash balance'));
      }
    });

    // 6. Online extra parts (not cash) cannot be marked cash received
    let bookingOnlineParts = await Booking.create({
      bookingReference: 'BK-TEST-EXTRA-ONLINE-PARTS',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'online',
      paymentStatus: 'paid',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 250 },
      spareParts: {
        status: 'approved',
        totalAdditionalAmount: 200,
        paymentStatus: 'pending',
        paymentMethod: 'online'
      },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('Cannot collect cash if customer opted to pay spare parts online', async () => {
      try {
        await bookingService.confirmCashPaymentByProvider(mockProviderUserId, bookingOnlineParts._id);
        assert.fail('Should have rejected online payment method');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
      }
    });

    // 7. CompleteServiceByProvider interaction test:
    // When extra cash is pending, completeServiceByProvider must block completion!
    let bookingCompleteFlow = await Booking.create({
      bookingReference: 'BK-TEST-COMPLETE-FLOW',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'online',
      paymentStatus: 'paid',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 200 },
      spareParts: {
        status: 'approved',
        partsSubtotal: 150,
        labourSubtotal: 0,
        totalAdditionalAmount: 150,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        items: [{ name: 'Wire', quantity: 1, unitPrice: 150, totalPrice: 150 }]
      },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('completeServiceByProvider blocks completion while extra cash is uncollected', async () => {
      try {
        await bookingService.completeServiceByProvider(mockProviderUserId, bookingCompleteFlow._id);
        assert.fail('Should have blocked completion');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Provider must mark cash collected for the approved extra materials'));
      }
    });

    await test('completeServiceByProvider succeeds after extra cash is collected', async () => {
      const collected = await bookingService.confirmCashPaymentByProvider(mockProviderUserId, bookingCompleteFlow._id);
      assert.strictEqual(collected.spareParts.paymentStatus, 'paid');

      const completed = await bookingService.completeServiceByProvider(mockProviderUserId, bookingCompleteFlow._id);
      assert.strictEqual(completed.status, 'completed');
      assert.ok(completed.statusTimestamps?.completedAt, 'completedAt timestamp should be set');
    });

    await test('Repeated completion request does not corrupt booking or payment data and is rejected safely', async () => {
      try {
        await bookingService.completeServiceByProvider(mockProviderUserId, bookingCompleteFlow._id);
        assert.fail('Should have rejected completion on already completed booking');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Must be in \'in_progress\' status'));
      }
    });

    // 8. Base booking unpaid rejection tests
    let bookingBaseCashUnpaid = await Booking.create({
      bookingReference: 'BK-TEST-BASE-UNPAID',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 50 },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('completeServiceByProvider blocks completion if base cash payment is unpaid', async () => {
      try {
        await bookingService.completeServiceByProvider(mockProviderUserId, bookingBaseCashUnpaid._id);
        assert.fail('Should have blocked completion');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Provider must collect cash and mark cash received'));
      }
    });

    let bookingBaseOnlineUnpaid = await Booking.create({
      bookingReference: 'BK-TEST-BASE-ONLINE-UNPAID',
      customer: mockCustomer._id,
      provider: mockProvider._id,
      service: mockService._id,
      status: 'in_progress',
      bookingType: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
      paymentMethod: 'online',
      paymentStatus: 'pending',
      pricing: { basePrice: 50, tax: 0, discount: 0, totalAmount: 50 },
      address: { street: '456 Main St', city: 'Testville', state: 'TS', pincode: '123456' }
    });

    await test('completeServiceByProvider blocks completion if base online payment is pending', async () => {
      try {
        await bookingService.completeServiceByProvider(mockProviderUserId, bookingBaseOnlineUnpaid._id);
        assert.fail('Should have blocked completion');
      } catch (err) {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Online payment for base service is pending'));
      }
    });

  } finally {
    // Cleanup test records
    await Booking.deleteMany({ bookingReference: /^BK-TEST-EXTRA-/ });
    await Booking.deleteMany({ bookingReference: /^BK-TEST-COMPLETE-/ });
    await Booking.deleteMany({ bookingReference: /^BK-TEST-BASE-/ });
    await Provider.deleteMany({ _id: { $in: [mockProvider._id, mockOtherProvider._id] } });
    await Customer.deleteMany({ _id: mockCustomer._id });
    await Service.deleteMany({ _id: mockService._id });
    await Category.deleteMany({ _id: mockCategory._id });
    await mongoose.disconnect();
  }

  console.log(`\nALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
