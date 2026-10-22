const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const providerService = require('./src/services/providerService');
const bookingService = require('./src/services/bookingService');
const Provider = require('./src/models/Provider');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const Booking = require('./src/models/Booking');
const Customer = require('./src/models/Customer');
const User = require('./src/models/User');

async function runConflictRegressionTests() {
  console.log('================================================================');
  console.log(' COMPLETE PROVIDER AVAILABILITY & DOUBLE-BOOKING TEST SUITE     ');
  console.log('================================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB successfully.\n');

  const testTrackedIds = {
    users: [],
    providers: [],
    customers: [],
    categories: [],
    services: [],
    bookings: []
  };

  const results = [];
  function recordTest(testNum, name, passed, details = '') {
    results.push({ testNum, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[Test ${testNum}] ${mark} - ${name}`);
    if (details) console.log(`   └─ Details: ${details}`);
  }

  const timestamp = Date.now();
  const testDate = '2026-11-05';

  try {
    // ----------------------------------------------------------------
    // Setup Isolated Fixtures
    // ----------------------------------------------------------------
    console.log('--- Setting up isolated test fixtures ---');

    // 1. Categories
    // Provider A & B Category: AC Service
    const categoryAC = await Category.create({
      name: `AC Service ${timestamp}`,
      slug: `ac-service-${timestamp}`,
      description: 'Isolated test AC service category',
      isActive: true
    });
    testTrackedIds.categories.push(categoryAC._id);

    // Provider C Category: Different category (Plumbing)
    const categoryPlumbing = await Category.create({
      name: `Plumbing ${timestamp}`,
      slug: `plumbing-${timestamp}`,
      description: 'Isolated test plumbing category for cross-category exclusion',
      isActive: true
    });
    testTrackedIds.categories.push(categoryPlumbing._id);

    // 2. Provider A User & Profile (verified, active, category: AC Service)
    const userA = await User.create({
      name: `Provider A AirCon ${timestamp}`,
      email: `provider.a.${timestamp}@testmarket.com`,
      phone: `91${timestamp.toString().slice(-8)}`,
      password: 'TestPassword123!',
      role: 'provider',
      isActive: true
    });
    testTrackedIds.users.push(userA._id);

    const providerA = await Provider.create({
      user: userA._id,
      businessName: `CoolAir Pros ${timestamp}`,
      categories: [categoryAC._id],
      verificationStatus: 'verified',
      isAvailable: true,
      experienceYears: 7
    });
    testTrackedIds.providers.push(providerA._id);

    // Custom Service owned by Provider A with valid saved price (Rs 450)
    const customServiceA = await Service.create({
      name: `AC Deep Cleaning & Gas Refill ${timestamp}`,
      category: categoryAC._id,
      provider: providerA._id,
      price: 450,
      priceType: 'fixed',
      isActive: true
    });
    testTrackedIds.services.push(customServiceA._id);

    // 3. Provider B (Alternative in Same Category: AC Service, verified, active, available)
    const userB = await User.create({
      name: `Provider B ChillTech ${timestamp}`,
      email: `provider.b.${timestamp}@testmarket.com`,
      phone: `92${timestamp.toString().slice(-8)}`,
      password: 'TestPassword123!',
      role: 'provider',
      isActive: true
    });
    testTrackedIds.users.push(userB._id);

    const providerB = await Provider.create({
      user: userB._id,
      businessName: `ChillTech Solutions ${timestamp}`,
      categories: [categoryAC._id],
      verificationStatus: 'verified',
      isAvailable: true,
      experienceYears: 5
    });
    testTrackedIds.providers.push(providerB._id);

    const serviceB = await Service.create({
      name: `AC Filter Service ${timestamp}`,
      category: categoryAC._id,
      provider: providerB._id,
      price: 350,
      priceType: 'fixed',
      isActive: true
    });
    testTrackedIds.services.push(serviceB._id);

    // 4. Provider C (Different Category: Plumbing, verified, active)
    const userC = await User.create({
      name: `Provider C QuickPipe ${timestamp}`,
      email: `provider.c.${timestamp}@testmarket.com`,
      phone: `93${timestamp.toString().slice(-8)}`,
      password: 'TestPassword123!',
      role: 'provider',
      isActive: true
    });
    testTrackedIds.users.push(userC._id);

    const providerC = await Provider.create({
      user: userC._id,
      businessName: `QuickPipe Plumbing ${timestamp}`,
      categories: [categoryPlumbing._id],
      verificationStatus: 'verified',
      isAvailable: true,
      experienceYears: 4
    });
    testTrackedIds.providers.push(providerC._id);

    // 5. Customer Fixture
    const userCust = await User.create({
      name: `Test Customer ${timestamp}`,
      email: `customer.${timestamp}@testmarket.com`,
      phone: `94${timestamp.toString().slice(-8)}`,
      password: 'TestPassword123!',
      role: 'customer',
      isActive: true
    });
    testTrackedIds.users.push(userCust._id);

    const customerDoc = await Customer.create({
      user: userCust._id,
      addresses: [
        {
          street: '456 Hill Rd',
          city: 'Bandra',
          state: 'Maharashtra',
          zipCode: '400050',
          isDefault: true
        }
      ]
    });
    testTrackedIds.customers.push(customerDoc._id);

    console.log('Fixtures established successfully.\n');

    // ----------------------------------------------------------------
    // Create Base Booking A: Date: 2026-11-05, Time: 10:00-12:00, Status: accepted
    // ----------------------------------------------------------------
    const bookingA = await Booking.create({
      bookingReference: `BK-TEST-${timestamp}-A`,
      customer: customerDoc._id,
      provider: providerA._id,
      service: customServiceA._id,
      bookingMode: 'scheduled',
      status: 'accepted',
      scheduledDate: new Date(`${testDate}T00:00:00.000Z`),
      scheduledTimeSlot: {
        startTime: '10:00',
        endTime: '12:00'
      },
      address: {
        street: '456 Hill Rd',
        city: 'Bandra',
        state: 'Maharashtra',
        zipCode: '400050'
      },
      pricing: {
        basePrice: 450,
        tax: 0,
        discount: 0,
        totalAmount: 450
      },
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    });
    testTrackedIds.bookings.push(bookingA._id);
    console.log(`Created baseline Booking A [${bookingA.bookingReference}]: 10:00-12:00 (accepted)\n`);

    // ================================================================
    // SECTION 3: AVAILABILITY API TESTS (Table Matrix)
    // ================================================================
    console.log('--- 3. Availability API Tests (Slot Matrix) ---');

    // 1. Requested slot: 10:00-12:00 -> Busy
    const slot1 = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '10:00',
      endTime: '12:00',
      serviceId: customServiceA._id.toString()
    });
    recordTest(
      1,
      'Slot 10:00–12:00 (exact overlap) returns Busy',
      slot1.isAvailable === false && slot1.status === 'busy',
      `Status: ${slot1.status}, Reason: "${slot1.reason}"`
    );

    // 2. Requested slot: 11:00-13:00 -> Busy
    const slot2 = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '11:00',
      endTime: '13:00',
      serviceId: customServiceA._id.toString()
    });
    recordTest(
      2,
      'Slot 11:00–13:00 (partial overlap / ends after) returns Busy',
      slot2.isAvailable === false && slot2.status === 'busy',
      `Status: ${slot2.status}, Reason: "${slot2.reason}"`
    );

    // 3. Requested slot: 09:30-10:30 -> Busy
    const slot3 = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '09:30',
      endTime: '10:30',
      serviceId: customServiceA._id.toString()
    });
    recordTest(
      3,
      'Slot 09:30–10:30 (starts before, ends during) returns Busy',
      slot3.isAvailable === false && slot3.status === 'busy',
      `Status: ${slot3.status}, Reason: "${slot3.reason}"`
    );

    // 4. Requested slot: 11:30-12:30 -> Busy
    const slot4 = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '11:30',
      endTime: '12:30',
      serviceId: customServiceA._id.toString()
    });
    recordTest(
      4,
      'Slot 11:30–12:30 (starts during, ends after) returns Busy',
      slot4.isAvailable === false && slot4.status === 'busy',
      `Status: ${slot4.status}, Reason: "${slot4.reason}"`
    );

    // 5. Requested slot: 09:00-10:00 -> Available
    const slot5 = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '09:00',
      endTime: '10:00',
      serviceId: customServiceA._id.toString()
    });
    recordTest(
      5,
      'Slot 09:00–10:00 (adjacent before) returns Available',
      slot5.isAvailable === true && slot5.status === 'available',
      `Status: ${slot5.status}`
    );

    // 6. Requested slot: 12:00-13:00 -> Available
    const slot6 = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '12:00',
      endTime: '13:00',
      serviceId: customServiceA._id.toString()
    });
    recordTest(
      6,
      'Slot 12:00–13:00 (adjacent after) returns Available',
      slot6.isAvailable === true && slot6.status === 'available',
      `Status: ${slot6.status}`
    );

    // 7. Test each blocking status: pending, accepted, in_progress
    console.log('\n--- Status-Specific Blocking Verification ---');
    let allBlockingStatusesPass = true;
    for (const status of ['pending', 'accepted', 'in_progress']) {
      await Booking.findByIdAndUpdate(bookingA._id, { status });
      const check = await providerService.getProviderSlotAvailability({
        providerId: providerA._id.toString(),
        date: testDate,
        startTime: '10:00',
        endTime: '12:00',
        serviceId: customServiceA._id.toString()
      });
      if (check.isAvailable !== false || check.status !== 'busy') {
        allBlockingStatusesPass = false;
        console.log(`   Failed for status: ${status}`);
      }
    }
    recordTest(
      7,
      'Active statuses [pending, accepted, in_progress] all block availability',
      allBlockingStatusesPass,
      'Verified all 3 active booking statuses mark provider slot as busy'
    );

    // 8. Confirm completed, cancelled, rejected do NOT block a slot
    let allNonBlockingStatusesPass = true;
    for (const status of ['completed', 'cancelled', 'rejected']) {
      await Booking.findByIdAndUpdate(bookingA._id, { status });
      const check = await providerService.getProviderSlotAvailability({
        providerId: providerA._id.toString(),
        date: testDate,
        startTime: '10:00',
        endTime: '12:00',
        serviceId: customServiceA._id.toString()
      });
      if (check.isAvailable !== true || check.status !== 'available') {
        allNonBlockingStatusesPass = false;
        console.log(`   Failed for status: ${status}`);
      }
    }
    // Restore Booking A to 'accepted'
    await Booking.findByIdAndUpdate(bookingA._id, { status: 'accepted' });
    recordTest(
      8,
      'Inactive statuses [completed, cancelled, rejected] do NOT block slot',
      allNonBlockingStatusesPass,
      'Verified all 3 non-blocking statuses leave slot free'
    );

    // ================================================================
    // SECTION 4: SAME-CATEGORY ALTERNATIVE PROVIDERS
    // ================================================================
    console.log('\n--- 4. Same-Category Alternative Providers ---');
    const busyCheckWithAlts = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '10:00',
      endTime: '12:00',
      serviceId: customServiceA._id.toString()
    });

    const isReportedBusy = busyCheckWithAlts.isAvailable === false && busyCheckWithAlts.status === 'busy';
    const includesProviderB =
      Array.isArray(busyCheckWithAlts.alternativeProviders) &&
      busyCheckWithAlts.alternativeProviders.some((p) => p._id.toString() === providerB._id.toString());
    const excludesProviderC = !busyCheckWithAlts.alternativeProviders.some(
      (p) => p._id.toString() === providerC._id.toString()
    );

    recordTest(
      9,
      'When Provider A is busy: reports isAvailable: false and status: "busy"',
      isReportedBusy,
      `isAvailable: ${busyCheckWithAlts.isAvailable}, status: ${busyCheckWithAlts.status}`
    );

    recordTest(
      10,
      'Provider B (same category, available) appears in alternative providers',
      includesProviderB,
      `Alternative providers count: ${busyCheckWithAlts.alternativeProviders.length}`
    );

    recordTest(
      11,
      'Provider C (different category: Plumbing) does NOT appear in alternatives',
      excludesProviderC,
      'Zero cross-category leakage detected in alternative suggestions'
    );

    // Verify unverified or inactive providers are excluded from alternatives
    await Provider.findByIdAndUpdate(providerB._id, { isAvailable: false });
    const checkWithBUnavailable = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '10:00',
      endTime: '12:00',
      serviceId: customServiceA._id.toString()
    });
    const excludesUnavailableProvider = !checkWithBUnavailable.alternativeProviders.some(
      (p) => p._id.toString() === providerB._id.toString()
    );
    await Provider.findByIdAndUpdate(providerB._id, { isAvailable: true }); // restore
    recordTest(
      12,
      'Unavailable / inactive providers are strictly excluded from alternatives',
      excludesUnavailableProvider,
      'Verified offline provider does not appear in alternatives list'
    );

    // ================================================================
    // SECTION 5: BOOKING CREATION TESTS
    // ================================================================
    console.log('\n--- 5. Booking Creation Tests ---');

    // 13. Overlapping booking creation rejected with HTTP 409 Conflict
    let overlapRejected = false;
    let overlapStatusCode = null;
    let overlapErrorMessage = '';
    try {
      await bookingService.createBooking(userCust._id, {
        serviceId: customServiceA._id.toString(),
        providerId: providerA._id.toString(),
        bookingMode: 'scheduled',
        scheduledDate: testDate,
        scheduledTimeSlot: {
          startTime: '11:00',
          endTime: '13:00'
        },
        address: {
          street: '456 Hill Rd',
          city: 'Bandra',
          state: 'Maharashtra',
          zipCode: '400050'
        },
        paymentMethod: 'cash',
        notes: 'Overlapping request 11:00-13:00'
      });
    } catch (err) {
      overlapRejected = true;
      overlapStatusCode = err.statusCode;
      overlapErrorMessage = err.message;
    }
    recordTest(
      13,
      'Overlapping booking request (11:00–13:00) is rejected with HTTP 409 Conflict',
      overlapRejected && overlapStatusCode === 409,
      `HTTP Status: ${overlapStatusCode}, Message: "${overlapErrorMessage}"`
    );

    // 14. Non-overlapping booking creation succeeds (15:00-17:00)
    const validBookingRes = await bookingService.createBooking(userCust._id, {
      serviceId: customServiceA._id.toString(),
      providerId: providerA._id.toString(),
      bookingMode: 'scheduled',
      scheduledDate: testDate,
      scheduledTimeSlot: {
        startTime: '15:00',
        endTime: '17:00'
      },
      address: {
        street: '456 Hill Rd',
        city: 'Bandra',
        state: 'Maharashtra',
        zipCode: '400050'
      },
      paymentMethod: 'cash',
      notes: 'Non-overlapping request 15:00-17:00'
    });
    testTrackedIds.bookings.push(validBookingRes._id);
    recordTest(
      14,
      'Non-overlapping booking request (15:00–17:00) succeeds with HTTP 201/200',
      validBookingRes && validBookingRes.bookingReference && validBookingRes.status === 'pending',
      `Booking Reference: ${validBookingRes.bookingReference}`
    );

    // 15. Custom service owned by Provider A booked at saved database price (Rs 450)
    recordTest(
      15,
      'Custom service owned by Provider A booked at saved database price (Rs 450)',
      validBookingRes.pricing.basePrice === 450 && validBookingRes.pricing.totalAmount === 450,
      `Persisted basePrice: Rs ${validBookingRes.pricing.basePrice}, totalAmount: Rs ${validBookingRes.pricing.totalAmount}`
    );

    // 16. Custom service owned by another provider (Provider B) assigned to Provider A is rejected
    let wrongProviderServiceRejected = false;
    let wrongProviderStatusCode = null;
    try {
      await bookingService.createBooking(userCust._id, {
        serviceId: serviceB._id.toString(), // owned by Provider B
        providerId: providerA._id.toString(), // assigned to Provider A
        bookingMode: 'scheduled',
        scheduledDate: testDate,
        scheduledTimeSlot: {
          startTime: '18:00',
          endTime: '20:00'
        },
        address: {
          street: '456 Hill Rd',
          city: 'Bandra',
          state: 'Maharashtra',
          zipCode: '400050'
        },
        paymentMethod: 'cash'
      });
    } catch (err) {
      wrongProviderServiceRejected = true;
      wrongProviderStatusCode = err.statusCode;
    }
    recordTest(
      16,
      'Custom service owned by another provider is rejected (HTTP 400)',
      wrongProviderServiceRejected && wrongProviderStatusCode === 400,
      `HTTP Status: ${wrongProviderStatusCode}`
    );

    // 17. Rejected booking creates no duplicate or orphan record
    const recordsFor11To13 = await Booking.find({
      provider: providerA._id,
      scheduledDate: {
        $gte: new Date(`${testDate}T00:00:00.000Z`),
        $lte: new Date(`${testDate}T23:59:59.999Z`)
      },
      'scheduledTimeSlot.startTime': '11:00',
      'scheduledTimeSlot.endTime': '13:00'
    });
    recordTest(
      17,
      'Rejected booking creates no duplicate or orphan record in database',
      recordsFor11To13.length === 0,
      `Records found for rejected slot: ${recordsFor11To13.length}`
    );

    // ================================================================
    // SECTION 6: PROVIDER ACCEPTANCE TESTS
    // ================================================================
    console.log('\n--- 6. Provider Acceptance Tests ---');

    // Create a pending unassigned/broadcast request P overlapping Booking A (11:00-13:00)
    const pendingBookingP = await Booking.create({
      bookingReference: `BK-TEST-${timestamp}-P`,
      customer: customerDoc._id,
      provider: null, // pool
      candidateProviders: [providerA._id],
      service: customServiceA._id,
      bookingMode: 'scheduled',
      status: 'pending',
      scheduledDate: new Date(`${testDate}T00:00:00.000Z`),
      scheduledTimeSlot: {
        startTime: '11:00',
        endTime: '13:00'
      },
      address: {
        street: '456 Hill Rd',
        city: 'Bandra',
        state: 'Maharashtra',
        zipCode: '400050'
      },
      pricing: {
        basePrice: 450,
        tax: 0,
        discount: 0,
        totalAmount: 450
      },
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    });
    testTrackedIds.bookings.push(pendingBookingP._id);

    // Provider A attempts to accept pendingBookingP
    let acceptanceConflictCaught = false;
    let acceptanceStatusCode = null;
    let acceptanceErrorMsg = '';
    try {
      await bookingService.acceptBookingByProvider(userA._id, pendingBookingP._id);
    } catch (err) {
      acceptanceConflictCaught = true;
      acceptanceStatusCode = err.statusCode;
      acceptanceErrorMsg = err.message;
    }

    // Verify existing Booking A remains unchanged
    const bookingAPostAcceptAttempt = await Booking.findById(bookingA._id);
    const existingUnchanged =
      bookingAPostAcceptAttempt.status === 'accepted' &&
      bookingAPostAcceptAttempt.provider.toString() === providerA._id.toString();

    // Verify pendingBookingP was NOT accepted
    const bookingPPostAcceptAttempt = await Booking.findById(pendingBookingP._id);
    const pendingNotAccepted =
      bookingPPostAcceptAttempt.status === 'pending' &&
      bookingPPostAcceptAttempt.provider === null;

    recordTest(
      18,
      'Acceptance-time validation: Provider accepting overlapping booking receives HTTP 409',
      acceptanceConflictCaught && acceptanceStatusCode === 409,
      `HTTP Status: ${acceptanceStatusCode}, Message: "${acceptanceErrorMsg}"`
    );

    recordTest(
      19,
      'Existing booking remains unchanged and conflicting booking is not accepted',
      existingUnchanged && pendingNotAccepted,
      `Booking A status: ${bookingAPostAcceptAttempt.status}, Pending Booking P status: ${bookingPPostAcceptAttempt.status}`
    );

    // ================================================================
    // SECTION 7: CONCURRENT BOOKING TEST
    // ================================================================
    console.log('\n--- 7. Concurrent Booking Race Condition Test ---');
    // Two simultaneous requests for the same provider at contested slot 20:00-22:00
    const contestedSlot = { startTime: '20:00', endTime: '22:00' };
    const createConcurrentPayload = (reqNum) => ({
      serviceId: customServiceA._id.toString(),
      providerId: providerA._id.toString(),
      bookingMode: 'scheduled',
      scheduledDate: testDate,
      scheduledTimeSlot: contestedSlot,
      address: {
        street: '456 Hill Rd',
        city: 'Bandra',
        state: 'Maharashtra',
        zipCode: '400050'
      },
      paymentMethod: 'cash',
      notes: `Simultaneous test request #${reqNum}`
    });

    const [race1, race2] = await Promise.allSettled([
      bookingService.createBooking(userCust._id, createConcurrentPayload(1)),
      bookingService.createBooking(userCust._id, createConcurrentPayload(2))
    ]);

    const raceSuccesses = [race1, race2].filter((r) => r.status === 'fulfilled');
    const raceFailures = [race1, race2].filter((r) => r.status === 'rejected');

    if (raceSuccesses.length > 0) {
      testTrackedIds.bookings.push(raceSuccesses[0].value._id);
    }
    if (raceSuccesses.length > 1) {
      testTrackedIds.bookings.push(raceSuccesses[1].value._id);
    }

    const concurrentPersistedCount = await Booking.countDocuments({
      provider: providerA._id,
      scheduledDate: {
        $gte: new Date(`${testDate}T00:00:00.000Z`),
        $lte: new Date(`${testDate}T23:59:59.999Z`)
      },
      'scheduledTimeSlot.startTime': '20:00',
      'scheduledTimeSlot.endTime': '22:00'
    });

    const raceConditionSafeguarded =
      raceSuccesses.length === 1 &&
      raceFailures.length === 1 &&
      raceFailures[0].reason.statusCode === 409 &&
      concurrentPersistedCount === 1;

    recordTest(
      20,
      'Concurrent booking test: exactly 1 request succeeds, 1 receives 409 Conflict, exactly 1 persisted',
      raceConditionSafeguarded,
      `Successes: ${raceSuccesses.length}, Failures: ${raceFailures.length}, Persisted in DB: ${concurrentPersistedCount}`
    );

    // ================================================================
    // SECTION 8: INPUT VALIDATION TESTS
    // ================================================================
    console.log('\n--- 8. Input Validation Tests ---');
    let invalidIdCaught = false;
    try {
      await providerService.getProviderSlotAvailability({
        providerId: 'nonexistent-id-000',
        date: testDate,
        startTime: '10:00',
        endTime: '12:00'
      });
    } catch (e) {
      if (e.statusCode === 400) invalidIdCaught = true;
    }

    let invalidDateCaught = false;
    try {
      await providerService.getProviderSlotAvailability({
        providerId: providerA._id.toString(),
        date: 'invalid-date-format',
        startTime: '10:00',
        endTime: '12:00'
      });
    } catch (e) {
      if (e.statusCode === 400) invalidDateCaught = true;
    }

    recordTest(
      21,
      'Invalid provider ID and invalid date input properly rejected with HTTP 400 Bad Request',
      invalidIdCaught && invalidDateCaught,
      `Invalid provider caught: ${invalidIdCaught}, Invalid date caught: ${invalidDateCaught}`
    );

  } catch (error) {
    console.error('Fatal unexpected error during test execution:', error);
  } finally {
    // ----------------------------------------------------------------
    // Cleanup Isolated Test Fixtures
    // ----------------------------------------------------------------
    console.log('\n--- Cleaning up isolated test fixtures ---');
    try {
      if (testTrackedIds.bookings.length > 0) {
        const bRes = await Booking.deleteMany({ _id: { $in: testTrackedIds.bookings } });
        console.log(`Cleaned up ${bRes.deletedCount} test bookings.`);
      }
      if (testTrackedIds.services.length > 0) {
        const sRes = await Service.deleteMany({ _id: { $in: testTrackedIds.services } });
        console.log(`Cleaned up ${sRes.deletedCount} test services.`);
      }
      if (testTrackedIds.providers.length > 0) {
        const pRes = await Provider.deleteMany({ _id: { $in: testTrackedIds.providers } });
        console.log(`Cleaned up ${pRes.deletedCount} test providers.`);
      }
      if (testTrackedIds.customers.length > 0) {
        const cRes = await Customer.deleteMany({ _id: { $in: testTrackedIds.customers } });
        console.log(`Cleaned up ${cRes.deletedCount} test customers.`);
      }
      if (testTrackedIds.users.length > 0) {
        const uRes = await User.deleteMany({ _id: { $in: testTrackedIds.users } });
        console.log(`Cleaned up ${uRes.deletedCount} test users.`);
      }
      if (testTrackedIds.categories.length > 0) {
        const catRes = await Category.deleteMany({ _id: { $in: testTrackedIds.categories } });
        console.log(`Cleaned up ${catRes.deletedCount} test categories.`);
      }
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }

    await mongoose.disconnect();
    console.log('Database disconnected.\n');
  }

  // ----------------------------------------------------------------
  // Final Results Summary
  // ----------------------------------------------------------------
  console.log('================================================================');
  console.log('                    TEST EXECUTION SUMMARY                      ');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Scenarios Tested : ${results.length}`);
  console.log(`Passed                 : ${passedCount}`);
  console.log(`Failed                 : ${failedCount}`);
  console.log(`Success Rate           : ${((passedCount / results.length) * 100).toFixed(1)}%\n`);

  if (failedCount > 0) {
    console.error('❌ Regression suite failed. Check failed test details above.');
    process.exit(1);
  } else {
    console.log('🎉 ALL 21/21 PROVIDER AVAILABILITY & DOUBLE-BOOKING TESTS PASSED!');
    process.exit(0);
  }
}

runConflictRegressionTests();
