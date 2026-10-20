const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/db');
const Booking = require('./src/models/Booking');
const Provider = require('./src/models/Provider');
const User = require('./src/models/User');
const Service = require('./src/models/Service');
const bookingService = require('./src/services/bookingService');

async function runAcceptanceTests() {
  console.log('Connecting to MongoDB...');
  await connectDB();

  try {
    let customer = await User.findOne({ role: 'customer' });
    if (!customer) {
      customer = await User.create({
        name: 'Test Customer Acceptance',
        email: 'test_cust_acc@example.com',
        phone: '9999900001',
        password: 'Password@123',
        role: 'customer',
      });
    }

    const testUsers = await User.find({ role: 'provider' }).limit(2);
    let pUser1 = testUsers[0];
    let pUser2 = testUsers[1];

    if (!pUser1) {
      pUser1 = await User.create({
        name: 'Test Provider 1',
        email: 'test_p1_acc@example.com',
        phone: '9999900002',
        password: 'Password@123',
        role: 'provider',
      });
    }
    if (!pUser2) {
      pUser2 = await User.create({
        name: 'Test Provider 2',
        email: 'test_p2_acc@example.com',
        phone: '9999900003',
        role: 'provider',
      });
    }

    let provider1 = await Provider.findOne({ user: pUser1._id });
    if (!provider1) {
      provider1 = await Provider.create({
        user: pUser1._id,
        businessName: 'Provider 1 Services',
        isVerified: true,
        isAvailable: true,
        verificationStatus: 'verified',
        rating: { average: 5, count: 1 }
      });
    }

    let provider2 = await Provider.findOne({ user: pUser2._id });
    if (!provider2) {
      provider2 = await Provider.create({
        user: pUser2._id,
        businessName: 'Provider 2 Services',
        isVerified: true,
        isAvailable: true,
        verificationStatus: 'verified',
        rating: { average: 5, count: 1 }
      });
    }

    const service = await Service.findOne();
    if (!service) {
      throw new Error('No service found in DB to attach booking');
    }

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    // Create an instant pending booking (unassigned)
    const booking = await Booking.create({
      bookingReference: `TEST-REF-${randomSuffix}`,
      customer: customer._id,
      service: service._id,
      bookingMode: 'instant',
      status: 'pending',
      scheduledDate: new Date(),
      address: {
        street: '123 Test St',
        city: 'Bengaluru',
        postalCode: '560001',
      },
      pricing: {
        basePrice: 500,
        totalAmount: 500,
      },
      payment: {
        status: 'pending',
        method: 'online',
      },
    });

    console.log(`Created test booking: ${booking._id}`);

    // TEST 1: Provider 1 accepts pending booking -> Should succeed (200 OK)
    console.log('\n--- TEST 1: Initial claim by Provider 1 ---');
    const accepted1 = await bookingService.acceptBookingByProvider(pUser1._id.toString(), booking._id.toString());
    console.log(`Test 1 Result: Status = ${accepted1.status}`);
    if (accepted1.status !== 'accepted') {
      throw new Error(`Expected status 'accepted', got '${accepted1.status}'`);
    }
    console.log('PASS: Test 1');

    // TEST 2: Provider 1 attempts to accept AGAIN -> Must return 409 Booking is no longer pending
    console.log('\n--- TEST 2: Duplicate claim attempt by same Provider 1 (Backend 409 Contract) ---');
    let duplicateRejected = false;
    try {
      await bookingService.acceptBookingByProvider(pUser1._id.toString(), booking._id.toString());
    } catch (err) {
      console.log(`Test 2 caught expected 409: ${err.message} (status: ${err.statusCode || err.status})`);
      if (err.statusCode === 409 || err.status === 409 || err.message.includes('no longer pending')) {
        duplicateRejected = true;
      }
    }
    if (!duplicateRejected) {
      throw new Error('Test 2 FAILED: Expected 409 when booking is no longer pending!');
    }
    console.log('PASS: Test 2 (409 conflict returned for already accepted booking)');

    // TEST 3: Provider 2 attempts to claim already accepted booking -> Must reject with 409
    console.log('\n--- TEST 3: Competing claim by Provider 2 ---');
    let rejected = false;
    try {
      await bookingService.acceptBookingByProvider(pUser2._id.toString(), booking._id.toString());
    } catch (err) {
      console.log(`Test 3 caught expected error: ${err.message} (status: ${err.statusCode || err.status})`);
      if (err.statusCode === 409 || err.status === 409 || err.message.includes('no longer pending')) {
        rejected = true;
      } else {
        throw new Error(`Expected 409 error, got: ${err.message}`);
      }
    }
    if (!rejected) {
      throw new Error('Test 3 FAILED: Provider 2 was able to claim an already accepted booking!');
    }
    console.log('PASS: Test 3 (Locking & Authorization verified)');

    // TEST 4: Race condition simulation on a new booking
    console.log('\n--- TEST 4: Concurrent Race Condition ---');
    const raceBooking = await Booking.create({
      bookingReference: `TEST-RACE-${randomSuffix}`,
      customer: customer._id,
      service: service._id,
      bookingMode: 'instant',
      status: 'pending',
      address: {
        street: '456 Race Ave',
        city: 'Bengaluru',
        postalCode: '560001',
      },
      pricing: {
        basePrice: 600,
        totalAmount: 600,
      },
      payment: {
        status: 'pending',
        method: 'online',
      },
    });

    const [res1, res2] = await Promise.allSettled([
      bookingService.acceptBookingByProvider(pUser1._id.toString(), raceBooking._id.toString()),
      bookingService.acceptBookingByProvider(pUser2._id.toString(), raceBooking._id.toString()),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejections = [res1, res2].filter((r) => r.status === 'rejected');

    console.log(`Race results: ${successes.length} fulfilled, ${rejections.length} rejected`);
    if (successes.length !== 1 || rejections.length !== 1) {
      throw new Error(`Race condition failed! Expected exactly 1 winner and 1 rejection, got ${successes.length} wins and ${rejections.length} rejections`);
    }
    console.log('PASS: Test 4 (Atomic concurrency test verified)');

    // Clean up temporary test bookings
    await Booking.deleteMany({ _id: { $in: [booking._id, raceBooking._id] } });
    console.log('\nCleaned up test bookings.');
    console.log('\nALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Acceptance test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runAcceptanceTests();
