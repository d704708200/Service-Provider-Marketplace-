/**
 * Test Suite for:
 * Provider App — Mark Job Completed & Completion Business Rules
 * 
 * Verifies all 10 required conditions:
 * 1. Valid in-progress booking with no extra charges can be completed.
 * 2. Approved extras with verified online payment can be completed.
 * 3. Approved extras with cash not yet collected — completion must be blocked.
 * 4. Pending extra-material approval — completion must be blocked with clear message.
 * 5. Approved cash extras after provider confirms collection can be completed.
 * 6. Rejected extras under existing business rules can be completed.
 * 7. Duplicate completion request is rejected safely.
 * 8. Unauthorized provider attempting completion is forbidden (HTTP 403).
 * 9. Already-completed booking blocks duplicate completion (HTTP 400).
 * 10. Regression test: Preserves existing bookings, base payment amounts, and test cleanup.
 */

const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:5000/api';
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key';

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PROVIDER MARK JOB COMPLETED TEST SUITE (10 SCENARIOS)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const createdBookings = [];

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
    // 1. Auth Setup
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

    // Get services
    const servRes = await axios.get(`${BASE_URL}/services`);
    const services = servRes.data.data || [];
    const elecService = services.find((s) => s.name && s.name.includes('Electrical')) || services[0];
    assert(elecService, 'Service retrieved for test bookings');

    // Helper: Create & accept a base booking
    async function createAndStartBooking(notes, paymentMethod = 'cash') {
      const bRes = await axios.post(
        `${BASE_URL}/bookings`,
        {
          serviceId: elecService._id,
          bookingMode: 'scheduled',
          scheduledDate: new Date(Date.now() + 86400000).toISOString(),
          scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
          address: { street: '10 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
          paymentMethod,
          notes
        },
        custHeaders
      );
      const bId = bRes.data.data._id;
      createdBookings.push(bId);

      // If online base payment, pay it
      if (paymentMethod === 'online') {
        const orderRes = await axios.post(`${BASE_URL}/bookings/customer/${bId}/payment/order`, {}, custHeaders);
        const orderId = orderRes.data.data.orderId;
        const paymentId = `pay_online_${Date.now()}`;
        const signature = crypto
          .createHmac('sha256', RAZORPAY_SECRET)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        await axios.post(
          `${BASE_URL}/bookings/customer/${bId}/payment/verify`,
          {
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature
          },
          custHeaders
        );
      }

      await axios.patch(`${BASE_URL}/bookings/provider/${bId}/accept`, {}, provHeaders);
      await axios.patch(`${BASE_URL}/bookings/provider/${bId}/start`, {}, provHeaders);
      return bId;
    }

    // -------------------------------------------------------------
    // SCENARIO 1: Valid in-progress booking with no extra charges
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Valid in-progress booking with no extra charges ---');
    const b1Id = await createAndStartBooking('Scenario 1: No extra charges cash booking');
    // Cash collection confirmed
    await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/cash/confirm`, {}, provHeaders);
    const comp1 = await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/complete`, {}, provHeaders);
    assert(comp1.data.data.status === 'completed', 'Scenario 1: In-progress booking successfully marked completed');

    // -------------------------------------------------------------
    // SCENARIO 2: Approved extras with verified online payment
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Approved extras with verified online payment ---');
    const b2Id = await createAndStartBooking('Scenario 2: Online extras payment', 'online');
    // Submit spare parts
    await axios.post(
      `${BASE_URL}/bookings/provider/${b2Id}/spare-parts`,
      {
        items: [{ name: 'Capacitor', unitPrice: 200, quantity: 1, labourCharge: 50 }]
      },
      provHeaders
    );
    // Customer approves
    await axios.patch(`${BASE_URL}/bookings/customer/${b2Id}/spare-parts/review`, { action: 'approve' }, custHeaders);
    // Customer selects online payment method
    await axios.patch(
      `${BASE_URL}/bookings/customer/${b2Id}/spare-parts/payment-method`,
      { paymentMethod: 'online' },
      custHeaders
    );
    // Customer pays online
    const order2 = await axios.post(`${BASE_URL}/bookings/customer/${b2Id}/spare-parts/payment/order`, {}, custHeaders);
    const payId2 = `pay_parts_${Date.now()}`;
    const sig2 = crypto
      .createHmac('sha256', RAZORPAY_SECRET)
      .update(`${order2.data.data.orderId}|${payId2}`)
      .digest('hex');

    await axios.post(
      `${BASE_URL}/bookings/customer/${b2Id}/spare-parts/payment/verify`,
      {
        razorpayOrderId: order2.data.data.orderId,
        razorpayPaymentId: payId2,
        razorpaySignature: sig2
      },
      custHeaders
    );

    const comp2 = await axios.patch(`${BASE_URL}/bookings/provider/${b2Id}/complete`, {}, provHeaders);
    assert(comp2.data.data.status === 'completed', 'Scenario 2: Approved online extras booking completed successfully');

    // -------------------------------------------------------------
    // SCENARIO 3: Approved extras with cash not yet collected — completion blocked
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Approved extras with cash not yet collected ---');
    const b3Id = await createAndStartBooking('Scenario 3: Uncollected cash extras', 'online');
    await axios.post(
      `${BASE_URL}/bookings/provider/${b3Id}/spare-parts`,
      {
        items: [{ name: 'Switch', unitPrice: 150, quantity: 1, labourCharge: 50 }]
      },
      provHeaders
    );
    await axios.patch(`${BASE_URL}/bookings/customer/${b3Id}/spare-parts/review`, { action: 'approve' }, custHeaders);
    await axios.patch(
      `${BASE_URL}/bookings/customer/${b3Id}/spare-parts/payment-method`,
      { paymentMethod: 'cash' },
      custHeaders
    );

    let b3Blocked = false;
    let b3Error = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b3Id}/complete`, {}, provHeaders);
    } catch (err) {
      b3Blocked = err.response?.status === 400;
      b3Error = err.response?.data?.error?.message || err.response?.data?.message || '';
    }
    assert(b3Blocked, 'Scenario 3: Completion blocked when approved cash extras are uncollected');
    assert(/collect/i.test(b3Error), `Scenario 3 error message requires cash collection: "${b3Error}"`);

    // -------------------------------------------------------------
    // SCENARIO 4: Pending extra-material approval — completion blocked with clear message
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Pending extra-material approval ---');
    const b4Id = await createAndStartBooking('Scenario 4: Pending proposal block', 'online');
    await axios.post(
      `${BASE_URL}/bookings/provider/${b4Id}/spare-parts`,
      {
        items: [{ name: 'Cable Wire', unitPrice: 300, quantity: 1, labourCharge: 100 }]
      },
      provHeaders
    );

    let b4Blocked = false;
    let b4Error = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b4Id}/complete`, {}, provHeaders);
    } catch (err) {
      b4Blocked = err.response?.status === 400;
      b4Error = err.response?.data?.error?.message || err.response?.data?.message || '';
    }
    assert(b4Blocked, 'Scenario 4: Completion blocked when extra materials proposal is pending');
    assert(
      /awaiting customer approval/i.test(b4Error),
      `Scenario 4 error message informs provider to await approval: "${b4Error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Approved cash extras after provider confirms collection
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Approved cash extras after collection confirmation ---');
    // Confirm cash for b3 from Scenario 3
    const cashConfirmRes = await axios.patch(`${BASE_URL}/bookings/provider/${b3Id}/cash/confirm`, {}, provHeaders);
    assert(cashConfirmRes.data.data.spareParts.paymentStatus === 'paid', 'Provider confirmed cash collection');
    const comp3 = await axios.patch(`${BASE_URL}/bookings/provider/${b3Id}/complete`, {}, provHeaders);
    assert(comp3.data.data.status === 'completed', 'Scenario 5: Successfully completed after cash confirmation');

    // -------------------------------------------------------------
    // SCENARIO 6: Rejected extras under existing business rules
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Rejected extras under existing business rules ---');
    const b6Id = await createAndStartBooking('Scenario 6: Rejection test', 'online');
    await axios.post(
      `${BASE_URL}/bookings/provider/${b6Id}/spare-parts`,
      {
        items: [{ name: 'Excessive part', unitPrice: 900, quantity: 1, labourCharge: 100 }]
      },
      provHeaders
    );
    await axios.patch(
      `${BASE_URL}/bookings/customer/${b6Id}/spare-parts/review`,
      { action: 'reject', rejectionReason: 'Too expensive' },
      custHeaders
    );

    const comp6 = await axios.patch(`${BASE_URL}/bookings/provider/${b6Id}/complete`, {}, provHeaders);
    assert(
      comp6.data.data.status === 'completed' && comp6.data.data.pricing.totalAmount === 500,
      'Scenario 6: Booking completed successfully with original base price when extras are rejected'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Duplicate completion request
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Duplicate completion request ---');
    let b1DupBlocked = false;
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/complete`, {}, provHeaders);
    } catch (err) {
      b1DupBlocked = err.response?.status === 400 || err.response?.status === 409;
    }
    assert(b1DupBlocked, 'Scenario 7: Duplicate completion request safely rejected');

    // -------------------------------------------------------------
    // SCENARIO 8: Unauthorized provider attempting completion
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Unauthorized provider attempting completion ---');
    // Create random intruder provider
    const intruderEmail = `intruder_${Date.now()}@example.com`;
    const regRes = await axios.post(`${BASE_URL}/auth/register/provider`, {
      name: 'Intruder Provider',
      email: intruderEmail,
      phone: '9988776655',
      password: 'Password@123',
      businessName: 'Intruder Corp',
      categories: [elecService.category?._id || elecService.category]
    });
    const intruderToken = regRes.data.data.token;
    const intruderHeaders = { headers: { Authorization: `Bearer ${intruderToken}` } };

    let intruderBlocked = false;
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/complete`, {}, intruderHeaders);
    } catch (err) {
      intruderBlocked = err.response?.status === 403;
    }
    assert(intruderBlocked, 'Scenario 8: Unauthorized provider blocked with HTTP 403');

    // -------------------------------------------------------------
    // SCENARIO 9: Already-completed booking blocks duplicate completion
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Already-completed booking blocks duplicate completion ---');
    let b6DupError = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b6Id}/complete`, {}, provHeaders);
    } catch (err) {
      b6DupError = err.response?.data?.error?.message || err.response?.data?.message || '';
    }
    assert(
      /Cannot complete service from 'completed' status/i.test(b6DupError),
      `Scenario 9: Blocked with explicit message: "${b6DupError}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 10: Target booking BK-20261020-85F4 preserved unchanged
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Target booking BK-20261020-85F4 preserved unchanged ---');
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const targetDoc = await mongoose.connection.collection('bookings').findOne({ bookingReference: 'BK-20261020-85F4' });
    assert(targetDoc !== null, 'Target booking exists');
    assert(targetDoc.status === 'in_progress', 'Target booking status remains in_progress');
    assert(targetDoc.paymentStatus === 'paid', 'Target base payment remains paid');
    assert(targetDoc.paymentDetails?.razorpayPaymentId === 'pay_Tq8KO67VXr0oxM', 'Base Razorpay payment ID preserved');
    assert(targetDoc.spareParts?.status === 'pending_approval', 'Spare parts status remains pending_approval');

    console.log('\n======================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test suite failed with unexpected error:', error.response?.data || error.message);
  } finally {
    if (createdBookings.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdBookings.length} test bookings created during this test run...`);
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGODB_URI);
        }
        const objIds = createdBookings.map((id) => new mongoose.Types.ObjectId(id));
        await mongoose.connection.collection('bookings').deleteMany({ _id: { $in: objIds } });
        await mongoose.connection.collection('notifications').deleteMany({
          'data.bookingId': { $in: createdBookings.map(String) }
        });
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
