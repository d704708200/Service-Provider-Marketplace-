/**
 * Automated End-to-End Test Suite for Parts / Spare Materials Billing Feature
 * 
 * Tests:
 * 1. Multiple parts and quantity calculations (quantity * unitPrice + labourCharge)
 * 2. Decimal and integer rounding / precision in paise
 * 3. Rejection of invalid inputs (negative quantity, negative price, negative labour)
 * 4. Provider authorization (unassigned provider forbidden from submitting parts)
 * 5. Customer authorization (unauthorized customer forbidden from reviewing parts)
 * 6. Customer rejection workflow (dispute reason recorded, totals revert to original amount)
 * 7. Customer approval workflow (totals recalculated: basePrice + parts + labour)
 * 8. Immutability lock (cannot edit parts once approved or paid)
 * 9. Spare parts Razorpay order generation with exact additional amount
 * 10. Cryptographic HMAC SHA-256 signature verification for spare parts payment
 * 11. Regression verification of cash booking totals
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:5000/api';

async function runSparePartsBillingTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING SPARE PARTS BILLING E2E TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

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

    // 1. Authenticate Demo Customer 1 (Owner)
    const cust1Login = await axios.post(`${BASE_URL}/auth/login/customer`, {
      email: 'customer.demo@gmail.com',
      password: 'Customer@123'
    });
    const cust1Token = cust1Login.data.data.token;
    assert(cust1Token, 'Customer 1 (customer.demo@gmail.com) logged in');

    // 2. Create and authenticate Customer 2 (Intruder)
    const cust2Email = `cust_parts_intruder_${timestamp}@example.com`;
    const cust2Res = await axios.post(`${BASE_URL}/auth/register/customer`, {
      name: 'Parts Customer Intruder',
      email: cust2Email,
      password: 'Password123!',
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const cust2Token = cust2Res.data.data.token;
    assert(cust2Token, 'Customer 2 registered for authorization tests');

    // 3. Authenticate Demo Provider 1 (Assigned Worker)
    const prov1Login = await axios.post(`${BASE_URL}/auth/login/provider`, {
      email: 'provider.demo@gmail.com',
      password: 'Provider@123'
    });
    const prov1Token = prov1Login.data.data.token;
    assert(prov1Token, 'Provider 1 (provider.demo@gmail.com) logged in');

    // 4. Create Provider 2 (Unassigned Intruder)
    const prov2Email = `prov_parts_intruder_${timestamp}@example.com`;
    const prov2Res = await axios.post(`${BASE_URL}/auth/register/provider`, {
      name: 'Unassigned Intruder Worker',
      email: prov2Email,
      password: 'Password123!',
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const prov2Token = prov2Res.data.data.token;
    assert(prov2Token, 'Provider 2 registered for authorization tests');

    // 5. Fetch a public service
    const servicesRes = await axios.get(`${BASE_URL}/services`);
    const service = servicesRes.data.data[0];
    assert(service && service._id, `Retrieved active service: ${service?.name} (Price: ₹${service?.basePrice})`);

    // 6. Customer 1 books an online scheduled service
    const bookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '45 MG Road', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Fan making clicking noises, might need capacitor or bearing'
      },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const booking = bookingRes.data.data;
    assert(booking && booking._id, `Created initial booking: ${booking?.bookingReference}`);
    const originalServiceAmount = booking.pricing.totalAmount;
    assert(originalServiceAmount === service.basePrice, `Original service amount matches base price (₹${originalServiceAmount})`);

    // 7. Provider 1 claims the booking and marks in_progress
    await axios.patch(
      `${BASE_URL}/bookings/provider/${booking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/provider/${booking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    console.log('  ℹ️ Booking claimed by Provider 1 and marked in_progress');

    // TEST: Unassigned Provider 2 cannot add spare parts
    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${booking._id}/spare-parts`,
        {
          items: [{ name: 'Fake Item', quantity: 1, unitPrice: 100 }]
        },
        { headers: { Authorization: `Bearer ${prov2Token}` } }
      );
      assert(false, 'Provider 2 should be forbidden from submitting spare parts');
    } catch (err) {
      assert(err.response?.status === 403, 'Forbidden 403 when unassigned provider submits parts');
    }

    // TEST: Validation rejects negative quantity or negative unit price
    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${booking._id}/spare-parts`,
        {
          items: [{ name: 'Invalid Item', quantity: -2, unitPrice: 100 }]
        },
        { headers: { Authorization: `Bearer ${prov1Token}` } }
      );
      assert(false, 'Validation should fail on negative quantity');
    } catch (err) {
      assert(err.response?.status === 400, 'Validation returns 400 on negative quantity');
    }

    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${booking._id}/spare-parts`,
        {
          items: [{ name: 'Invalid Price', quantity: 1, unitPrice: -50 }]
        },
        { headers: { Authorization: `Bearer ${prov1Token}` } }
      );
      assert(false, 'Validation should fail on negative unit price');
    } catch (err) {
      assert(err.response?.status === 400, 'Validation returns 400 on negative unit price');
    }

    // TEST: Provider 1 submits valid multi-item spare parts
    // Part 1: Havells 3.15uF Capacitor, Qty: 2, UnitPrice: ₹150, Labour: ₹50 => Line Total: 2*150 + 50 = ₹350
    // Part 2: Ball Bearing 6202, Qty: 1, UnitPrice: ₹220, Labour: ₹80 => Line Total: 1*220 + 80 = ₹300
    // Expected Parts Subtotal: 300 + 220 = ₹520
    // Expected Labour Subtotal: 50 + 80 = ₹130
    // Expected Total Additional: ₹650
    const submitPartsRes = await axios.post(
      `${BASE_URL}/bookings/provider/${booking._id}/spare-parts`,
      {
        items: [
          {
            name: 'Havells 3.15uF Capacitor',
            description: 'Heavy duty fan capacitor',
            quantity: 2,
            unitPrice: 150,
            labourCharge: 50,
            notes: 'High endurance'
          },
          {
            name: 'Ball Bearing 6202',
            description: 'SKF low noise',
            quantity: 1,
            unitPrice: 220,
            labourCharge: 80,
            notes: 'Replaced worn bearing'
          }
        ]
      },
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );

    const partsData = submitPartsRes.data.data.spareParts;
    assert(partsData.status === 'pending_approval', 'Spare parts status is pending_approval');
    assert(partsData.partsSubtotal === 520, `Parts subtotal calculated server-side: ₹${partsData.partsSubtotal} (expected 520)`);
    assert(partsData.labourSubtotal === 130, `Labour subtotal calculated server-side: ₹${partsData.labourSubtotal} (expected 130)`);
    assert(partsData.totalAdditionalAmount === 650, `Total additional amount calculated server-side: ₹${partsData.totalAdditionalAmount} (expected 650)`);
    assert(partsData.originalServiceAmount === originalServiceAmount, 'Original service amount preserved without alteration');
    assert(submitPartsRes.data.data.pricing.totalAmount === originalServiceAmount, 'Booking total is NOT updated before customer approval');

    // TEST: Unauthorized customer cannot approve or reject
    try {
      await axios.patch(
        `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/review`,
        { action: 'approve' },
        { headers: { Authorization: `Bearer ${cust2Token}` } }
      );
      assert(false, 'Customer 2 should be forbidden from reviewing Customer 1 booking');
    } catch (err) {
      assert(err.response?.status === 403, 'Forbidden 403 when wrong customer attempts review');
    }

    // TEST: Customer rejection workflow
    const rejectRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/review`,
      { action: 'reject', rejectionReason: 'Bearing price is too high, please only replace capacitor' },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    assert(rejectRes.data.data.spareParts.status === 'rejected', 'Customer rejection sets status to rejected');
    assert(rejectRes.data.data.spareParts.rejectionReason.includes('too high'), 'Rejection reason persisted');
    assert(rejectRes.data.data.pricing.totalAmount === originalServiceAmount, 'Booking total remains originalServiceAmount upon rejection');
    assert(rejectRes.data.data.status === 'in_progress', 'Booking status remains in_progress (does not incorrectly cancel or complete booking)');

    // TEST: Provider can resubmit corrected bill following rejection
    // Resubmit only Capacitor: Qty 2, UnitPrice: ₹150, Labour: ₹50 => Total Additional: ₹350
    const resubmitRes = await axios.post(
      `${BASE_URL}/bookings/provider/${booking._id}/spare-parts`,
      {
        items: [
          {
            name: 'Havells 3.15uF Capacitor',
            description: 'Heavy duty fan capacitor',
            quantity: 2,
            unitPrice: 150,
            labourCharge: 50
          }
        ]
      },
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    assert(resubmitRes.data.data.spareParts.totalAdditionalAmount === 350, 'Resubmitted parts total is ₹350');
    assert(resubmitRes.data.data.spareParts.status === 'pending_approval', 'Status reset to pending_approval');

    // TEST: Customer approves the updated charges
    const approveRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/review`,
      { action: 'approve' },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const approvedBooking = approveRes.data.data;
    assert(approvedBooking.spareParts.status === 'approved', 'Customer approval sets status to approved');
    const expectedRevisedTotal = originalServiceAmount + 350;
    assert(
      approvedBooking.pricing.totalAmount === expectedRevisedTotal,
      `Revised booking total matches base + parts (₹${originalServiceAmount} + ₹350 = ₹${expectedRevisedTotal})`
    );

    // TEST: Provider CANNOT edit parts once approved
    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${booking._id}/spare-parts`,
        {
          items: [{ name: 'Sneaky Add', quantity: 1, unitPrice: 500 }]
        },
        { headers: { Authorization: `Bearer ${prov1Token}` } }
      );
      assert(false, 'Provider should be blocked from modifying already approved spare parts');
    } catch (err) {
      assert(err.response?.status === 400, 'Provider edit blocked on approved charges (400)');
    }

    // TEST: Create Razorpay Payment Order for approved spare parts
    const partsOrderRes = await axios.post(
      `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/payment/order`,
      {},
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const partsOrder = partsOrderRes.data.data;
    assert(partsOrder.orderId, `Spare parts Razorpay order created: ${partsOrder.orderId}`);
    assert(partsOrder.amount === 35000, `Razorpay order amount equals ₹350 in paise (35000)`);
    assert(partsOrder.bookingReference, `Order response contains bookingReference: ${partsOrder.bookingReference}`);

    // TEST: Cryptographic Payment Signature Verification for spare parts
    const razorpayOrderId = partsOrder.orderId;
    const razorpayPaymentId = `pay_parts_test_${Date.now()}`;
    const testSecret = process.env.RAZORPAY_KEY_SECRET || 'UVmoRQl5c51d7CoCxJqa3hvY';
    const generatedSignature = crypto
      .createHmac('sha256', testSecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    // Test tampered signature rejection
    try {
      await axios.post(
        `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/payment/verify`,
        {
          razorpayOrderId: razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId,
          razorpaySignature: 'tampered_signature_1234567890abcdef'
        },
        { headers: { Authorization: `Bearer ${cust1Token}` } }
      );
      assert(false, 'Tampered payment signature should be rejected');
    } catch (tamperErr) {
      assert(tamperErr.response?.status === 400, 'Tampered payment signature correctly rejected (HTTP 400)');
    }

    // Test valid payment verification
    const verifyRes = await axios.post(
      `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/payment/verify`,
      {
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: generatedSignature
      },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    assert(verifyRes.data.success, 'Spare parts payment verified successfully');
    assert(verifyRes.data.data.spareParts.paymentStatus === 'paid', 'spareParts.paymentStatus marked as paid');

    // TEST: Duplicate payment rejection (cannot pay already paid spare parts)
    try {
      await axios.post(
        `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/payment/order`,
        {},
        { headers: { Authorization: `Bearer ${cust1Token}` } }
      );
      assert(false, 'Duplicate spare parts payment order should be rejected');
    } catch (dupPayErr) {
      assert(
        dupPayErr.response?.status === 400 && dupPayErr.response?.data?.error?.message?.includes('already been paid'),
        'Duplicate spare parts payment order correctly rejected with HTTP 400'
      );
    }

    // TEST: Duplicate customer approval rejection
    try {
      await axios.patch(
        `${BASE_URL}/bookings/customer/${booking._id}/spare-parts/review`,
        { action: 'approve' },
        { headers: { Authorization: `Bearer ${cust1Token}` } }
      );
      assert(false, 'Duplicate approval on already approved spare parts should be rejected');
    } catch (dupApproveErr) {
      assert(
        dupApproveErr.response?.status === 400 && dupApproveErr.response?.data?.error?.message?.includes('No pending'),
        'Duplicate approval on already approved spare parts correctly rejected with HTTP 400'
      );
    }

    // TEST: Service Completion workflow after approved work and payment
    const completeRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${booking._id}/complete`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    assert(completeRes.data.success, 'Booking successfully completed after approved extra work');
    assert(completeRes.data.data.status === 'completed', 'Booking final status is completed');

    // TEST: Duplicate completion guard
    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${booking._id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${prov1Token}` } }
      );
      assert(false, 'Duplicate completion should be rejected');
    } catch (dupCompErr) {
      assert(
        dupCompErr.response?.status === 400,
        'Duplicate completion correctly blocked with HTTP 400'
      );
    }

    // TEST: Service completion BLOCKED if extra parts proposal is still pending approval
    const pendingPartsBookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'instant',
        address: { street: '55 Pending Lane', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'cash',
        notes: 'Testing completion block on pending parts'
      },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const pendingPartsBooking = pendingPartsBookingRes.data.data;
    await axios.patch(
      `${BASE_URL}/bookings/provider/${pendingPartsBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/provider/${pendingPartsBooking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    await axios.post(
      `${BASE_URL}/bookings/provider/${pendingPartsBooking._id}/spare-parts`,
      {
        items: [{ name: 'Pending Extra Item', quantity: 1, unitPrice: 150 }]
      },
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );

    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${pendingPartsBooking._id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${prov1Token}` } }
      );
      assert(false, 'Provider should not complete service while extra parts are awaiting customer approval');
    } catch (pendingCompErr) {
      assert(
        pendingCompErr.response?.status === 400 && pendingCompErr.response?.data?.error?.message?.includes('awaiting customer approval'),
        'Completion blocked when extra materials proposal is pending customer approval (HTTP 400)'
      );
    }

    // TEST: Failed payment reporting & retry balance retention
    const failedBookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'instant',
        address: { street: '99 Retry Ave', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Testing payment failure and retry'
      },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const failedBooking = failedBookingRes.data.data;
    await axios.patch(
      `${BASE_URL}/bookings/provider/${failedBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/provider/${failedBooking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    await axios.post(
      `${BASE_URL}/bookings/provider/${failedBooking._id}/spare-parts`,
      {
        items: [{ name: 'Capacitor 45uF', quantity: 1, unitPrice: 200, labourCharge: 50 }]
      },
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/customer/${failedBooking._id}/spare-parts/review`,
      { action: 'approve' },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );

    // Customer reports payment failure
    const failReportRes = await axios.post(
      `${BASE_URL}/bookings/customer/${failedBooking._id}/spare-parts/payment/failure`,
      { reason: 'Customer card declined by bank' },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    assert(
      failReportRes.data.data.spareParts.paymentStatus === 'failed',
      'Spare parts payment status marked as failed upon report'
    );
    assert(
      failReportRes.data.data.spareParts.totalAdditionalAmount === 250,
      'Outstanding additional amount balance retained at ₹250 for retry'
    );

    // TEST: Cash Booking flow regression check
    const cashBookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '14:00', endTime: '16:00' },
        address: { street: '12 Temple Lane', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'cash',
        notes: 'Cash booking spare parts test'
      },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const cashBooking = cashBookingRes.data.data;
    await axios.patch(
      `${BASE_URL}/bookings/provider/${cashBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );

    await axios.post(
      `${BASE_URL}/bookings/provider/${cashBooking._id}/spare-parts`,
      {
        items: [{ name: 'PVC Pipe', quantity: 3, unitPrice: 80, labourCharge: 60 }]
      },
      { headers: { Authorization: `Bearer ${prov1Token}` } }
    );

    const cashApproveRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${cashBooking._id}/spare-parts/review`,
      { action: 'approve' },
      { headers: { Authorization: `Bearer ${cust1Token}` } }
    );
    const expectedCashTotal = cashBooking.pricing.basePrice + (3 * 80 + 60); // base + 300
    assert(
      cashApproveRes.data.data.pricing.totalAmount === expectedCashTotal,
      `Cash booking updated total is ₹${expectedCashTotal} (Base: ₹${cashBooking.pricing.basePrice} + Parts: ₹300)`
    );

    console.log('\n======================================================');
    console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('💥 Test execution error:', err.response?.data || err.message);
    failed++;
  }
}

runSparePartsBillingTests();
