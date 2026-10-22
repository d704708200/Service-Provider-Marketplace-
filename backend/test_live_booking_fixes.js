/**
 * Test Suite: Live Booking Errors & Availability Route Fixes
 * 
 * Verifies:
 * 1. Task A: GET /api/providers/:id/availability-check and :providerId/availability-check
 *    - Validates ObjectId (invalid ID returns 400)
 *    - Validates missing params (missing date/startTime/endTime returns 400)
 *    - Checks provider by Provider._id and User._id
 *    - Checks slot availability for real provider harshs carpanter (6ad9cbc3e1194ef6040caca0)
 * 2. Task B: POST /api/bookings with Provider Custom Service
 *    - Verifies custom service (6ad9fd185da68d494257f54e, Rs 300) belonging to harshs carpanter
 *    - Verifies category mismatch no longer causes 400 when provider owns the custom service
 *    - Verifies exact saved price (Rs 300) is enforced server-side
 *    - Verifies server-side availability revalidation prevents conflicting bookings (409)
 *    - Verifies provider cannot be booked for another provider's custom service
 */

const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');
const Provider = require('./src/models/Provider');
const Customer = require('./src/models/Customer');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const Booking = require('./src/models/Booking');

const providerService = require('./src/services/providerService');
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
  console.log('=== RUNNING LIVE BOOKING FIXES VALIDATION SUITE ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  const realProviderId = '6ad9cbc3e1194ef6040caca0'; // harshs carpanter
  const realCustomServiceId = '6ad9fd185da68d494257f54e'; // edrgre geg e (Rs 300)

  // 1. Verify Provider and Custom Service exist in DB
  const provider = await Provider.findById(realProviderId).populate('user').lean();
  assert(provider, 'Real provider harshs carpanter must exist in DB');
  console.log(`Verified DB provider: ${provider.businessName} (ID: ${provider._id})`);

  const customService = await Service.findById(realCustomServiceId).populate('category').lean();
  assert(customService, 'Real custom service must exist in DB');
  assert.strictEqual(Number(customService.price), 300, 'Custom service price must be 300');
  console.log(`Verified DB custom service: ${customService.name} (Price: Rs ${customService.price}, Category: ${customService.category?.name})`);

  // Clean up any test bookings
  await Booking.deleteMany({ bookingReference: /^BK-LIVE-FIX-/ });

  // -------------------------------------------------------------
  // TASK A: AVAILABILITY ENDPOINT TESTS
  // -------------------------------------------------------------
  console.log('\n--- Task A: Availability Endpoint Verification ---');

  await test('Rejects invalid provider ObjectId with 400', async () => {
    try {
      await providerService.getProviderSlotAvailability({
        providerId: 'invalid-object-id',
        date: '2026-10-25',
        startTime: '09:00',
        endTime: '11:00'
      });
      assert.fail('Should have thrown 400 for invalid ObjectId');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert(err.message.includes('valid providerId is required'));
    }
  });

  await test('Rejects missing date/time params with 400', async () => {
    try {
      await providerService.getProviderSlotAvailability({
        providerId: realProviderId,
        date: null,
        startTime: '09:00',
        endTime: '11:00'
      });
      assert.fail('Should have thrown 400 for missing date');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert(err.message.includes('Date, startTime, and endTime are required'));
    }
  });

  await test('Availability check works with Provider._id', async () => {
    const res = await providerService.getProviderSlotAvailability({
      providerId: realProviderId,
      date: '2026-10-25',
      startTime: '09:00',
      endTime: '11:00',
      serviceId: realCustomServiceId
    });
    assert(res, 'Response should exist');
    assert.strictEqual(String(res.providerId), realProviderId);
    assert(typeof res.isAvailable === 'boolean');
    assert(['available', 'busy'].includes(res.status));
    console.log(`Provider availability on 2026-10-25 (09:00-11:00): ${res.status}`);
  });

  await test('Availability check works with User._id (backward compatibility)', async () => {
    const userRes = await providerService.getProviderSlotAvailability({
      providerId: provider.user._id.toString(),
      date: '2026-10-25',
      startTime: '09:00',
      endTime: '11:00'
    });
    assert(userRes, 'Response should exist');
    assert.strictEqual(String(userRes.providerId), realProviderId);
  });

  // -------------------------------------------------------------
  // TASK B: BOOKING CREATION TESTS (CUSTOM SERVICE & PRICING)
  // -------------------------------------------------------------
  console.log('\n--- Task B: Booking Creation Verification ---');

  // Find or create test customer
  let testCustomerUser = await User.findOne({ email: 'test_live_fix_cust@example.com' });
  if (!testCustomerUser) {
    testCustomerUser = await User.create({
      name: 'Test Customer LiveFix',
      email: 'test_live_fix_cust@example.com',
      phone: '9998887771',
      password: 'password123',
      role: 'customer',
      isActive: true
    });
  }

  let testCustomer = await Customer.findOne({ user: testCustomerUser._id });
  if (!testCustomer) {
    testCustomer = await Customer.create({
      user: testCustomerUser._id,
      phone: '9998887771'
    });
  }

  const bookingPayload = {
    serviceId: realCustomServiceId,
    providerId: realProviderId,
    bookingMode: 'scheduled',
    scheduledDate: '2026-10-28',
    scheduledTimeSlot: {
      startTime: '10:00',
      endTime: '12:00'
    },
    address: {
      street: '789 Market Lane',
      city: 'Delhi',
      state: 'Delhi',
      zipCode: '110001'
    },
    paymentMethod: 'cash',
    notes: 'Please bring carpentry tools for custom service'
  };

  let createdBooking = null;

  await test('Customer successfully books custom service at exact saved price (Rs 300) without 400 category mismatch', async () => {
    createdBooking = await bookingService.createBooking(testCustomerUser._id, bookingPayload);

    assert(createdBooking, 'Booking must be created');
    assert.strictEqual(String(createdBooking.service._id || createdBooking.service), realCustomServiceId);
    assert.strictEqual(String(createdBooking.provider._id || createdBooking.provider), realProviderId);
    assert.strictEqual(createdBooking.pricing.basePrice, 300, 'Base price must be exactly 300');
    assert.strictEqual(createdBooking.pricing.totalAmount, 300, 'Total amount must be exactly 300');
    assert.strictEqual(createdBooking.paymentMethod, 'cash');
    assert.strictEqual(createdBooking.status, 'pending');

    console.log(`Created booking reference: ${createdBooking.bookingReference} with totalAmount: Rs ${createdBooking.pricing.totalAmount}`);
  });

  await test('Server revalidates availability and rejects overlapping slot with 409 conflict', async () => {
    const overlappingPayload = {
      ...bookingPayload,
      scheduledTimeSlot: {
        startTime: '11:00', // overlaps with 10:00 - 12:00
        endTime: '13:00'
      }
    };

    try {
      await bookingService.createBooking(testCustomerUser._id, overlappingPayload);
      assert.fail('Should have rejected conflicting time slot with 409');
    } catch (err) {
      assert.strictEqual(err.statusCode, 409, 'Must return 409 Conflict for overlapping booking');
      assert(err.message.includes('already booked for this time slot'), `Expected conflict message, got: ${err.message}`);
      console.log(`Conflict correctly caught with 409: "${err.message}"`);
    }
  });

  await test('Rejects custom service booking if another provider is assigned', async () => {
    // Create a temporary second provider
    const secondUser = await User.create({
      name: 'Provider Other',
      email: `other-prov-${Date.now()}@example.com`,
      phone: `91888${Date.now().toString().slice(-5)}`,
      password: 'password123',
      role: 'provider',
      isActive: true
    });

    const secondProvider = await Provider.create({
      user: secondUser._id,
      businessName: 'Other Services',
      categories: provider.categories,
      verificationStatus: 'verified',
      isAvailable: true
    });

    const wrongProviderPayload = {
      ...bookingPayload,
      providerId: secondProvider._id.toString(),
      scheduledDate: '2026-10-29'
    };

    try {
      await bookingService.createBooking(testCustomerUser._id, wrongProviderPayload);
      assert.fail('Should reject booking when service belongs to a different provider');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert(err.message.includes('does not offer this specific service'), `Expected ownership error, got: ${err.message}`);
      console.log(`Ownership validation caught: "${err.message}"`);
    }

    // Clean up temporary provider
    await Provider.findByIdAndDelete(secondProvider._id);
    await User.findByIdAndDelete(secondUser._id);
  });

  // Clean up created booking
  if (createdBooking && createdBooking._id) {
    await Booking.findByIdAndDelete(createdBooking._id);
  }
  await Booking.deleteMany({ bookingReference: /^BK-LIVE-FIX-/ });

  console.log(`\n========================================`);
  console.log(`ALL ${passed}/${total} LIVE BOOKING TESTS PASSED!`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
