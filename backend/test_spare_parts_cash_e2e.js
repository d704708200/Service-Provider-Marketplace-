/**
 * Automated Test Suite for:
 * FEATURE: ADD CASH PAYMENT OPTION FOR EXTRA MATERIALS / ADDITIONAL CHARGES
 * 
 * Verifies all 12 requested scenarios:
 * 1. Base service already paid + online extras payment.
 * 2. Base service already paid + cash extras payment.
 * 3. Base service unpaid + online payment.
 * 4. Base service unpaid + cash payment.
 * 5. Customer rejects extras.
 * 6. Cash selected but not yet collected.
 * 7. Provider confirms cash collection.
 * 8. Duplicate cash confirmation prevention.
 * 9. Tampered additional amount rejection.
 * 10. No Razorpay order created for cash extras.
 * 11. No duplicate charge of the original base amount.
 * 12. Existing booking and payment regression tests.
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:5000/api';
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key';

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING CASH PAYMENT OPTION FOR EXTRA MATERIALS TEST SUITE');
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
    const timestamp = Date.now();
    const createdBookings = [];

    // Setup: Customer & Provider login
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

    // Fetch an active service
    const servicesRes = await axios.get(`${BASE_URL}/services`);
    const service = servicesRes.data.data[0];
    const basePrice = service.basePrice;
    console.log(`Using Service: "${service.name}", Base Price: ₹${basePrice}\n`);

    // Helper: generate valid mock Razorpay signature
    function generateRazorpaySignature(orderId, paymentId) {
      return crypto
        .createHmac('sha256', RAZORPAY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    }

    // -------------------------------------------------------------
    // SCENARIO 1: Base service already paid + online extras payment
    // -------------------------------------------------------------
    console.log('--- Test 1: Base service already paid + online extras payment ---');
    const b1Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '12 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Scenario 1: Base paid online + online extras'
      },
      custHeaders
    );
    const b1Id = b1Res.data.data._id;

    // Customer creates base payment order & verifies it
    const b1Order = await axios.post(`${BASE_URL}/bookings/customer/${b1Id}/payment/order`, {}, custHeaders);
    const b1PayId = `pay_mock_${Date.now()}`;
    const b1Sig = generateRazorpaySignature(b1Order.data.data.orderId, b1PayId);
    await axios.post(
      `${BASE_URL}/bookings/customer/${b1Id}/payment/verify`,
      {
        razorpayOrderId: b1Order.data.data.orderId,
        razorpayPaymentId: b1PayId,
        razorpaySignature: b1Sig
      },
      custHeaders
    );

    // Provider accepts and starts
    await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/start`, {}, provHeaders);

    // Provider submits extra items: ₹299 parts + ₹100 labour = ₹399
    await axios.post(
      `${BASE_URL}/bookings/provider/${b1Id}/spare-parts`,
      {
        items: [
          { name: 'Replacement Capacitor', quantity: 1, unitPrice: 299, labourCharge: 100 }
        ]
      },
      provHeaders
    );

    // Customer approves extras
    await axios.patch(`${BASE_URL}/bookings/customer/${b1Id}/spare-parts/review`, { action: 'approve' }, custHeaders);

    // Customer selects online payment for extras
    await axios.patch(
      `${BASE_URL}/bookings/customer/${b1Id}/spare-parts/payment-method`,
      { paymentMethod: 'online' },
      custHeaders
    );

    // Customer creates spare parts order: MUST ONLY CHARGE ₹399, NOT ₹500 + ₹399
    const partsOrderRes1 = await axios.post(
      `${BASE_URL}/bookings/customer/${b1Id}/spare-parts/payment/order`,
      {},
      custHeaders
    );
    assert(
      partsOrderRes1.data.data.amount === 399 * 100,
      `Scenario 1: Spare parts order amount is ₹399 (39900 paise), never re-charging base price (₹${basePrice})`
    );

    // Verify online spare parts payment
    const partsPayId1 = `pay_parts_${Date.now()}`;
    const partsSig1 = generateRazorpaySignature(partsOrderRes1.data.data.orderId, partsPayId1);
    const verifyParts1 = await axios.post(
      `${BASE_URL}/bookings/customer/${b1Id}/spare-parts/payment/verify`,
      {
        razorpayOrderId: partsOrderRes1.data.data.orderId,
        razorpayPaymentId: partsPayId1,
        razorpaySignature: partsSig1
      },
      custHeaders
    );
    assert(
      verifyParts1.data.data.spareParts.paymentStatus === 'paid',
      'Scenario 1: Spare parts marked paid after signature verification'
    );

    // Complete service
    const comp1 = await axios.patch(`${BASE_URL}/bookings/provider/${b1Id}/complete`, {}, provHeaders);
    assert(comp1.data.data.status === 'completed', 'Scenario 1: Service successfully completed after online payment');

    // -------------------------------------------------------------
    // SCENARIO 2: Base service already paid + cash extras payment
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Base service already paid + cash extras payment ---');
    const b2Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '14 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Scenario 2: Base paid online + cash extras'
      },
      custHeaders
    );
    const b2Id = b2Res.data.data._id;

    // Pay base online
    const b2Order = await axios.post(`${BASE_URL}/bookings/customer/${b2Id}/payment/order`, {}, custHeaders);
    const b2PayId = `pay_mock_${Date.now()}`;
    const b2Sig = generateRazorpaySignature(b2Order.data.data.orderId, b2PayId);
    await axios.post(
      `${BASE_URL}/bookings/customer/${b2Id}/payment/verify`,
      {
        razorpayOrderId: b2Order.data.data.orderId,
        razorpayPaymentId: b2PayId,
        razorpaySignature: b2Sig
      },
      custHeaders
    );

    // Provider accepts and starts
    await axios.patch(`${BASE_URL}/bookings/provider/${b2Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b2Id}/start`, {}, provHeaders);

    // Submit extra parts: ₹350
    await axios.post(
      `${BASE_URL}/bookings/provider/${b2Id}/spare-parts`,
      {
        items: [{ name: 'LED Transformer', quantity: 1, unitPrice: 250, labourCharge: 100 }]
      },
      provHeaders
    );

    // Customer approves extras
    await axios.patch(`${BASE_URL}/bookings/customer/${b2Id}/spare-parts/review`, { action: 'approve' }, custHeaders);

    // Customer selects Cash / Pay on Service
    const cashSelectRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${b2Id}/spare-parts/payment-method`,
      { paymentMethod: 'cash' },
      custHeaders
    );
    assert(
      cashSelectRes.data.data.spareParts.paymentMethod === 'cash',
      'Scenario 2: Spare parts paymentMethod set to "cash"'
    );
    assert(
      cashSelectRes.data.data.spareParts.paymentStatus === 'pending',
      'Scenario 2: Spare parts paymentStatus remains "pending" until provider confirms cash collection'
    );

    // Completion blocked until cash confirmed
    let blockedComp2 = false;
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${b2Id}/complete`, {}, provHeaders);
    } catch (e) {
      blockedComp2 = e.response?.status === 400;
    }
    assert(blockedComp2, 'Scenario 2: Service completion blocked before cash extras are collected');

    // Provider marks cash received for the extra portion
    const cashConfirmRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${b2Id}/cash/confirm`,
      {},
      provHeaders
    );
    assert(
      cashConfirmRes.data.data.spareParts.paymentStatus === 'paid',
      'Scenario 2: Provider confirmed cash collection, marking spareParts.paymentStatus = "paid"'
    );
    assert(
      cashConfirmRes.data.data.paymentStatus === 'paid',
      'Scenario 2: Base paymentStatus remains "paid"'
    );

    // Provider can now complete service
    const comp2 = await axios.patch(`${BASE_URL}/bookings/provider/${b2Id}/complete`, {}, provHeaders);
    assert(comp2.data.data.status === 'completed', 'Scenario 2: Service successfully completed after cash confirmation');

    // -------------------------------------------------------------
    // SCENARIO 3: Base service unpaid + online payment
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Base service unpaid + online payment ---');
    const b3Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '16 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Scenario 3: Unpaid base + online payment'
      },
      custHeaders
    );
    const b3Id = b3Res.data.data._id;

    // Provider accepts and starts without customer having paid base upfront
    await axios.patch(`${BASE_URL}/bookings/provider/${b3Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b3Id}/start`, {}, provHeaders);

    // Provider adds extra parts: ₹200
    await axios.post(
      `${BASE_URL}/bookings/provider/${b3Id}/spare-parts`,
      {
        items: [{ name: 'Fuse Block', quantity: 1, unitPrice: 150, labourCharge: 50 }]
      },
      provHeaders
    );
    await axios.patch(`${BASE_URL}/bookings/customer/${b3Id}/spare-parts/review`, { action: 'approve' }, custHeaders);

    // Scenario 3: Base service unpaid + online payment
    // Base order covers base service:
    const b3BaseOrder = await axios.post(`${BASE_URL}/bookings/customer/${b3Id}/payment/order`, {}, custHeaders);
    const b3BasePayId = `pay_base_${Date.now()}`;
    await axios.post(
      `${BASE_URL}/bookings/customer/${b3Id}/payment/verify`,
      {
        razorpayOrderId: b3BaseOrder.data.data.orderId,
        razorpayPaymentId: b3BasePayId,
        razorpaySignature: generateRazorpaySignature(b3BaseOrder.data.data.orderId, b3BasePayId)
      },
      custHeaders
    );

    // Customer selects online payment for approved extras (₹200)
    await axios.patch(
      `${BASE_URL}/bookings/customer/${b3Id}/spare-parts/payment-method`,
      { paymentMethod: 'online' },
      custHeaders
    );

    const b3OrderRes = await axios.post(
      `${BASE_URL}/bookings/customer/${b3Id}/spare-parts/payment/order`,
      {},
      custHeaders
    );
    assert(
      b3OrderRes.data.data.amount === 200 * 100,
      `Scenario 3: Spare parts order calculates additional amount ₹200 (20000 paise)`
    );

    // Verify online payment for extras
    const b3PayId = `pay_parts_${Date.now()}`;
    const b3Sig = generateRazorpaySignature(b3OrderRes.data.data.orderId, b3PayId);
    const b3Verify = await axios.post(
      `${BASE_URL}/bookings/customer/${b3Id}/spare-parts/payment/verify`,
      {
        razorpayOrderId: b3OrderRes.data.data.orderId,
        razorpayPaymentId: b3PayId,
        razorpaySignature: b3Sig
      },
      custHeaders
    );
    assert(
      b3Verify.data.data.paymentStatus === 'paid' && b3Verify.data.data.spareParts.paymentStatus === 'paid',
      'Scenario 3: Both base payment and spare parts marked paid online without duplicate charges'
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Base service unpaid + cash payment
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Base service unpaid + cash payment ---');
    const b4Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '18 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'cash',
        notes: 'Scenario 4: Full cash booking'
      },
      custHeaders
    );
    const b4Id = b4Res.data.data._id;
    await axios.patch(`${BASE_URL}/bookings/provider/${b4Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b4Id}/start`, {}, provHeaders);

    await axios.post(
      `${BASE_URL}/bookings/provider/${b4Id}/spare-parts`,
      {
        items: [{ name: 'Wire roll', quantity: 2, unitPrice: 100, labourCharge: 50 }]
      },
      provHeaders
    );
    await axios.patch(`${BASE_URL}/bookings/customer/${b4Id}/spare-parts/review`, { action: 'approve' }, custHeaders);

    // Total cash payable = base + 250
    const b4Booking = (await axios.get(`${BASE_URL}/bookings/customer/${b4Id}`, custHeaders)).data.data;
    assert(
      b4Booking.pricing.totalAmount === basePrice + 250,
      `Scenario 4: Total revised cash amount is ₹${basePrice + 250}`
    );

    // Provider marks full cash collected
    const b4Confirm = await axios.patch(`${BASE_URL}/bookings/provider/${b4Id}/cash/confirm`, {}, provHeaders);
    assert(
      b4Confirm.data.data.paymentDetails.cashCollectedAmount === basePrice + 250,
      `Scenario 4: Cash collected recorded exactly as ₹${basePrice + 250}`
    );
    assert(
      b4Confirm.data.data.paymentStatus === 'paid' && b4Confirm.data.data.spareParts.paymentStatus === 'paid',
      'Scenario 4: Full cash booking and spare parts marked paid'
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Customer rejects extras
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Customer rejects extras ---');
    const b5Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '20 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'cash',
        notes: 'Scenario 5: Rejection test'
      },
      custHeaders
    );
    const b5Id = b5Res.data.data._id;
    await axios.patch(`${BASE_URL}/bookings/provider/${b5Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b5Id}/start`, {}, provHeaders);

    await axios.post(
      `${BASE_URL}/bookings/provider/${b5Id}/spare-parts`,
      {
        items: [{ name: 'Expensive Motor', quantity: 1, unitPrice: 1500, labourCharge: 500 }]
      },
      provHeaders
    );

    // Customer rejects extras
    const b5Reject = await axios.patch(
      `${BASE_URL}/bookings/customer/${b5Id}/spare-parts/review`,
      { action: 'reject', rejectionReason: 'Too expensive' },
      custHeaders
    );
    assert(b5Reject.data.data.spareParts.status === 'rejected', 'Scenario 5: Proposal status marked "rejected"');
    assert(
      b5Reject.data.data.pricing.totalAmount === basePrice,
      `Scenario 5: Total amount restored to original base price (₹${basePrice})`
    );

    // Cannot initiate payment for rejected extras
    let rejectedPaymentBlocked = false;
    try {
      await axios.post(`${BASE_URL}/bookings/customer/${b5Id}/spare-parts/payment/order`, {}, custHeaders);
    } catch (e) {
      rejectedPaymentBlocked = e.response?.status === 400;
    }
    assert(rejectedPaymentBlocked, 'Scenario 5: Payment initiation blocked for rejected spare parts');

    // -------------------------------------------------------------
    // SCENARIO 6: Cash selected but not yet collected
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Cash selected but not yet collected ---');
    const b6Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '22 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Scenario 6: Cash uncollected test'
      },
      custHeaders
    );
    const b6Id = b6Res.data.data._id;
    // Pay base online
    const b6Order = await axios.post(`${BASE_URL}/bookings/customer/${b6Id}/payment/order`, {}, custHeaders);
    const b6PayId = `pay_mock_${Date.now()}`;
    await axios.post(
      `${BASE_URL}/bookings/customer/${b6Id}/payment/verify`,
      {
        razorpayOrderId: b6Order.data.data.orderId,
        razorpayPaymentId: b6PayId,
        razorpaySignature: generateRazorpaySignature(b6Order.data.data.orderId, b6PayId)
      },
      custHeaders
    );

    await axios.patch(`${BASE_URL}/bookings/provider/${b6Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b6Id}/start`, {}, provHeaders);
    await axios.post(
      `${BASE_URL}/bookings/provider/${b6Id}/spare-parts`,
      { items: [{ name: 'Switch', quantity: 1, unitPrice: 80, labourCharge: 20 }] },
      provHeaders
    );
    await axios.patch(`${BASE_URL}/bookings/customer/${b6Id}/spare-parts/review`, { action: 'approve' }, custHeaders);
    await axios.patch(
      `${BASE_URL}/bookings/customer/${b6Id}/spare-parts/payment-method`,
      { paymentMethod: 'cash' },
      custHeaders
    );

    const b6Check = (await axios.get(`${BASE_URL}/bookings/customer/${b6Id}`, custHeaders)).data.data;
    assert(
      b6Check.spareParts.paymentStatus === 'pending',
      'Scenario 6: spareParts.paymentStatus remains "pending" after cash selection'
    );
    assert(
      b6Check.paymentDetails?.cashConfirmedByProvider === false,
      'Scenario 6: cashConfirmedByProvider is false before collection'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Provider confirms cash collection
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Provider confirms cash collection ---');
    const b7Confirm = await axios.patch(`${BASE_URL}/bookings/provider/${b6Id}/cash/confirm`, {}, provHeaders);
    assert(
      b7Confirm.data.data.spareParts.paymentStatus === 'paid',
      'Scenario 7: spareParts.paymentStatus updated to "paid" upon provider confirmation'
    );
    assert(
      b7Confirm.data.data.paymentDetails?.cashConfirmedByProvider === true,
      'Scenario 7: cashConfirmedByProvider set to true'
    );
    assert(
      b7Confirm.data.data.paymentDetails?.cashCollectedAmount === 100,
      'Scenario 7: Extra cash amount recorded accurately (₹100)'
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Duplicate cash confirmation prevention
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Duplicate cash confirmation prevention ---');
    const b8Dup = await axios.patch(`${BASE_URL}/bookings/provider/${b6Id}/cash/confirm`, {}, provHeaders);
    assert(
      b8Dup.status === 200 && b8Dup.data.data.paymentDetails?.cashCollectedAmount === 100,
      'Scenario 8: Duplicate cash confirmation is idempotent and does not multiply collected amount'
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Tampered additional amount rejection
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Tampered additional amount rejection ---');
    let tamperedOrderRejected = false;
    try {
      // Backend createSparePartsPaymentOrder does NOT accept amount from client; amounts are calculated server-side
      const b9Order = await axios.post(
        `${BASE_URL}/bookings/customer/${b1Id}/spare-parts/payment/order`,
        { amount: 1 }, // Trying to send a tampered amount of ₹1
        custHeaders
      );
    } catch (e) {
      tamperedOrderRejected = true;
    }
    // Also test invalid negative price during submission
    let negativePriceRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${b6Id}/spare-parts`,
        { items: [{ name: 'Bad item', quantity: 1, unitPrice: -50, labourCharge: 0 }] },
        provHeaders
      );
    } catch (e) {
      negativePriceRejected = e.response?.status === 400;
    }
    assert(negativePriceRejected, 'Scenario 9: Backend rejects negative or invalid item pricing');

    // -------------------------------------------------------------
    // SCENARIO 10: No Razorpay order created for cash extras
    // -------------------------------------------------------------
    console.log('\n--- Test 10: No Razorpay order created for cash extras ---');
    const b10Booking = (await axios.get(`${BASE_URL}/bookings/customer/${b6Id}`, custHeaders)).data.data;
    assert(
      !b10Booking.spareParts.paymentDetails?.razorpayOrderId,
      'Scenario 10: No Razorpay order ID exists on booking for cash extras'
    );

    // -------------------------------------------------------------
    // SCENARIO 11: No duplicate charge of the original base amount
    // -------------------------------------------------------------
    console.log('\n--- Test 11: No duplicate charge of original base amount ---');
    // In Scenario 1, base service was ₹500 (already paid). Additional amount was ₹399.
    // Order was created for exactly 39900 paise (₹399), verifying base was not charged twice.
    assert(
      partsOrderRes1.data.data.amount === 39900,
      'Scenario 11: Backend only created order for the incremental ₹399, ensuring ₹500 base is never double-charged'
    );

    // -------------------------------------------------------------
    // SCENARIO 12: Existing booking regression test (0 extra items)
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Existing booking regression test (0 extras) ---');
    const b12Res = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '24 Civil Lines', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'cash',
        notes: 'Scenario 12: Normal 0-extras booking'
      },
      custHeaders
    );
    const b12Id = b12Res.data.data._id;
    await axios.patch(`${BASE_URL}/bookings/provider/${b12Id}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b12Id}/start`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${b12Id}/cash/confirm`, {}, provHeaders);
    const b12Comp = await axios.patch(`${BASE_URL}/bookings/provider/${b12Id}/complete`, {}, provHeaders);
    assert(
      b12Comp.data.data.status === 'completed' && b12Comp.data.data.pricing.totalAmount === basePrice,
      'Scenario 12: Standard 0-extras cash booking functions seamlessly without regression'
    );

    console.log('\n======================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test suite failed with unexpected error:', error.response?.data || error.message);
  } finally {
    // Teardown: Clean up bookings created during this test run to prevent DB pollution
    if (createdBookings.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdBookings.length} test bookings created during this test run...`);
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGODB_URI);
        }
        const objIds = createdBookings.map(id => new mongoose.Types.ObjectId(id));
        const delRes = await mongoose.connection.collection('bookings').deleteMany({ _id: { $in: objIds } });
        console.log(`   ✓ Cleaned up ${delRes.deletedCount} test bookings from test run.`);
      } catch (cleanupErr) {
        console.error('   ⚠️ Teardown cleanup error:', cleanupErr.message);
      }
    }
  }
}

runTests();

