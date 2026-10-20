/**
  * Test Suite for:
  * - Provider pending requests list
  * - Provider notification creation & delivery
  * - Customer and provider status contract consistency
  * - Prevention of duplicate notifications / acceptance
  * - Safety of paid bookings and extra-material records
  */

const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PROVIDER BOOKING & NOTIFICATION END-TO-END TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const createdBookingIds = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Log in customer (customer.demo@gmail.com) and provider (provider.demo@gmail.com)
    const custLogin = await axios.post(`${BASE_URL}/auth/login/customer`, {
      email: 'customer.demo@gmail.com',
      password: 'Customer@123'
    });
    const custToken = custLogin.data.data.token;
    const custHeaders = { headers: { Authorization: `Bearer ${custToken}` } };

    const provLogin = await axios.post(`${BASE_URL}/auth/login/provider`, {
      email: 'provider.demo@gmail.com',
      password: 'Provider@123'
    });
    const provToken = provLogin.data.data.token;
    const provHeaders = { headers: { Authorization: `Bearer ${provToken}` } };

    // Get electrical service offered by provider
    const servRes = await axios.get(`${BASE_URL}/services`);
    const services = servRes.data.data || [];
    const elecService = services.find(s => s.name && s.name.includes('Electrical')) || services[0];
    assert(elecService, 'Service retrieved for test bookings');

    // -------------------------------------------------------------
    // TEST 1: New booking appears in provider pending requests
    // -------------------------------------------------------------
    console.log('\n--- Test 1: New booking appears in provider pending requests ---');
    const b1Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: elecService._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '11:00', endTime: '13:00' },
        address: { street: '45 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'cash',
        notes: 'Test 1 pending request visibility check'
      },
      custHeaders
    );
    const b1 = b1Res.data.data;
    createdBookingIds.push(b1._id);
    assert(b1.status === 'pending', 'Booking created with pending status');

    const pendingRequests = (await axios.get(`${BASE_URL}/bookings/provider/requests`, provHeaders)).data.data;
    const b1InRequests = pendingRequests.find(r => r._id === b1._id);
    assert(b1InRequests, `Newly created booking ${b1.bookingReference} appears in provider requests list`);

    // -------------------------------------------------------------
    // TEST 2: Provider notification is created and can be fetched
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Provider notification is created and can be fetched ---');
    const notifsRes = await axios.get(`${BASE_URL}/bookings/user/notifications`, provHeaders);
    const notifs = notifsRes.data.data || [];
    const b1Notif = notifs.find(n => n.data && n.data.bookingId === b1._id);
    assert(b1Notif, `Notification created for booking ${b1.bookingReference} and retrievable via API`);
    assert(b1Notif && b1Notif.title.includes(b1.bookingReference), 'Notification title references booking ID');

    // Mark notification as read
    if (b1Notif) {
      const readRes = await axios.patch(`${BASE_URL}/bookings/user/notifications/${b1Notif._id}/read`, {}, provHeaders);
      assert(readRes.data.data.isRead === true, 'Notification marked as read successfully');
    }

    // -------------------------------------------------------------
    // TEST 3: Customer and provider see consistent booking status
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Customer and provider see consistent booking status ---');
    // Provider accepts
    const acceptRes = await axios.patch(`${BASE_URL}/bookings/provider/${b1._id}/accept`, {}, provHeaders);
    assert(acceptRes.data.data.status === 'accepted', 'Provider accepted booking -> status is accepted');

    // Check from customer side
    const custView = (await axios.get(`${BASE_URL}/bookings/customer/${b1._id}`, custHeaders)).data.data;
    assert(custView.status === 'accepted', 'Customer view confirms status is accepted');

    // Provider starts service
    const startRes = await axios.patch(`${BASE_URL}/bookings/provider/${b1._id}/start`, {}, provHeaders);
    assert(startRes.data.data.status === 'in_progress', 'Provider started service -> status is in_progress');

    // Check from customer side again
    const custViewInProgress = (await axios.get(`${BASE_URL}/bookings/customer/${b1._id}`, custHeaders)).data.data;
    assert(custViewInProgress.status === 'in_progress', 'Customer view confirms status is in_progress');

    // -------------------------------------------------------------
    // TEST 4: Duplicate provider acceptance prevented (HTTP 409)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Duplicate provider acceptance prevented ---');
    let duplicateRejected = false;
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b1._id}/accept`, {}, provHeaders);
    } catch (err) {
      duplicateRejected = err.response?.status === 409 || err.response?.status === 400;
    }
    assert(duplicateRejected, 'Duplicate accept call rejected with conflict / bad request');

    // -------------------------------------------------------------
    // TEST 5: Target booking BK-20261020-85F4 preserved unchanged
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Verify target booking BK-20261020-85F4 is protected and untouched ---');
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const targetDoc = await mongoose.connection.collection('bookings').findOne({ bookingReference: 'BK-20261020-85F4' });
    assert(targetDoc !== null, 'BK-20261020-85F4 exists in database');
    assert(targetDoc.paymentStatus === 'paid', 'BK-20261020-85F4 paymentStatus is paid');
    assert(targetDoc.paymentDetails?.razorpayPaymentId === 'pay_Tq8KO67VXr0oxM', 'BK-20261020-85F4 Razorpay payment ID preserved');
    assert(targetDoc.spareParts?.items?.length === 1, 'BK-20261020-85F4 spare parts proposal preserved');

    console.log('\n======================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test suite failed with unexpected error:', error.response?.data || error.message);
  } finally {
    // Teardown: Clean up test bookings and test notifications created by this test run
    if (createdBookingIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdBookingIds.length} test bookings created during this test run...`);
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGODB_URI);
        }
        const objIds = createdBookingIds.map(id => new mongoose.Types.ObjectId(id));
        await mongoose.connection.collection('bookings').deleteMany({ _id: { $in: objIds } });
        await mongoose.connection.collection('notifications').deleteMany({ 'data.bookingId': { $in: createdBookingIds.map(String) } });
        console.log('   ✓ Cleaned up test bookings and notifications.');
      } catch (cleanupErr) {
        console.error('   ⚠️ Teardown cleanup error:', cleanupErr.message);
      }
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runTests();
