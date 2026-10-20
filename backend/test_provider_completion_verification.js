/**
 * Verification test suite for:
 * Provider App "Mark Job Completed" workflow & BK-20261020-DLGT verification
 * 
 * Verifies:
 * 1. Booking BK-20261020-DLGT current status and fields.
 * 2. Paid online booking can be completed.
 * 3. Cash-extra booking can be completed only after required cash confirmation.
 * 4. Pending approvals block completion with clear message.
 * 5. Unpaid required amounts (online/cash) block completion with clear message.
 * 6. Successful completion updates status to 'completed' and records statusTimestamps.completedAt.
 * 7. Duplicate completion is safely rejected with HTTP 400.
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:5000/api';
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key';

function generateRazorpaySignature(orderId, paymentId) {
  return crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runVerification() {
  console.log('\n=============================================================');
  console.log('🔍 VERIFYING MARK JOB COMPLETED WORKFLOW & BK-20261020-DLGT');
  console.log('=============================================================\n');

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
    // 1. Authenticate Demo Customer & Provider
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

    // -------------------------------------------------------------
    // CHECK 1: Verification of booking BK-20261020-DLGT
    // -------------------------------------------------------------
    console.log('--- Check 1: Booking BK-20261020-DLGT Status ---');
    const bDlgtRes = await axios.get(`${BASE_URL}/bookings/provider/6ad75072a5ce86cabea52433`, provHeaders);
    const bDlgt = bDlgtRes.data.data;
    assert(
      bDlgt.bookingReference === 'BK-20261020-DLGT',
      'Booking reference matches BK-20261020-DLGT'
    );
    assert(
      bDlgt.status === 'completed',
      'Booking BK-20261020-DLGT status is "completed"'
    );
    assert(
      bDlgt.paymentStatus === 'paid' && bDlgt.spareParts?.paymentStatus === 'paid',
      'BK-20261020-DLGT has both base service and spare parts marked paid'
    );
    assert(
      bDlgt.statusTimestamps?.completedAt,
      `BK-20261020-DLGT has completedAt timestamp: ${bDlgt.statusTimestamps?.completedAt}`
    );

    // -------------------------------------------------------------
    // CHECK 2: Duplicate completion is safely rejected
    // -------------------------------------------------------------
    console.log('\n--- Check 2: Duplicate completion safely rejected ---');
    let dupRejected = false;
    let dupMsg = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/6ad75072a5ce86cabea52433/complete`, {}, provHeaders);
    } catch (e) {
      dupRejected = e.response?.status === 400;
      dupMsg = e.response?.data?.error?.message || '';
    }
    assert(dupRejected, `Duplicate completion rejected with HTTP 400: "${dupMsg}"`);

    // -------------------------------------------------------------
    // CHECK 3: Paid online booking can be completed
    // -------------------------------------------------------------
    console.log('\n--- Check 3: Paid online booking can be completed ---');
    const bOnlineRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '50 Test Road', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Online booking test'
      },
      custHeaders
    );
    const bOnlineId = bOnlineRes.data.data._id;

    // Customer pays online
    const bOnlineOrder = await axios.post(`${BASE_URL}/bookings/customer/${bOnlineId}/payment/order`, {}, custHeaders);
    const bOnlinePayId = `pay_online_${Date.now()}`;
    await axios.post(
      `${BASE_URL}/bookings/customer/${bOnlineId}/payment/verify`,
      {
        razorpayOrderId: bOnlineOrder.data.data.orderId,
        razorpayPaymentId: bOnlinePayId,
        razorpaySignature: generateRazorpaySignature(bOnlineOrder.data.data.orderId, bOnlinePayId)
      },
      custHeaders
    );

    await axios.patch(`${BASE_URL}/bookings/provider/${bOnlineId}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${bOnlineId}/start`, {}, provHeaders);

    const bOnlineComp = await axios.patch(`${BASE_URL}/bookings/provider/${bOnlineId}/complete`, {}, provHeaders);
    assert(
      bOnlineComp.data.data.status === 'completed',
      'Paid online booking completed successfully'
    );
    assert(
      bOnlineComp.data.data.statusTimestamps?.completedAt,
      'statusTimestamps.completedAt set correctly'
    );

    // -------------------------------------------------------------
    // CHECK 4: Pending extra materials proposal blocks completion
    // -------------------------------------------------------------
    console.log('\n--- Check 4: Pending proposal blocks completion ---');
    const bPendingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '52 Test Road', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Pending proposal test'
      },
      custHeaders
    );
    const bPendingId = bPendingRes.data.data._id;
    // Pay base
    const bPOrder = await axios.post(`${BASE_URL}/bookings/customer/${bPendingId}/payment/order`, {}, custHeaders);
    const bPPayId = `pay_p_${Date.now()}`;
    await axios.post(
      `${BASE_URL}/bookings/customer/${bPendingId}/payment/verify`,
      {
        razorpayOrderId: bPOrder.data.data.orderId,
        razorpayPaymentId: bPPayId,
        razorpaySignature: generateRazorpaySignature(bPOrder.data.data.orderId, bPPayId)
      },
      custHeaders
    );
    await axios.patch(`${BASE_URL}/bookings/provider/${bPendingId}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${bPendingId}/start`, {}, provHeaders);

    // Propose extra items but customer has NOT approved yet
    await axios.post(
      `${BASE_URL}/bookings/provider/${bPendingId}/spare-parts`,
      { items: [{ name: 'Pending Wire', quantity: 1, unitPrice: 150, labourCharge: 50 }] },
      provHeaders
    );

    let proposalBlocked = false;
    let proposalMsg = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${bPendingId}/complete`, {}, provHeaders);
    } catch (e) {
      proposalBlocked = e.response?.status === 400;
      proposalMsg = e.response?.data?.error?.message || '';
    }
    assert(
      proposalBlocked && proposalMsg.includes('awaiting customer approval'),
      `Completion blocked when extra materials awaiting approval: "${proposalMsg}"`
    );

    // -------------------------------------------------------------
    // CHECK 5: Cash-extra booking can be completed only AFTER cash confirmation
    // -------------------------------------------------------------
    console.log('\n--- Check 5: Cash-extra requires cash confirmation ---');
    // Customer approves proposal
    await axios.patch(`${BASE_URL}/bookings/customer/${bPendingId}/spare-parts/review`, { action: 'approve' }, custHeaders);
    // Customer selects cash
    await axios.patch(
      `${BASE_URL}/bookings/customer/${bPendingId}/spare-parts/payment-method`,
      { paymentMethod: 'cash' },
      custHeaders
    );

    // Completion blocked before cash collection
    let uncollectedBlocked = false;
    let uncollectedMsg = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${bPendingId}/complete`, {}, provHeaders);
    } catch (e) {
      uncollectedBlocked = e.response?.status === 400;
      uncollectedMsg = e.response?.data?.error?.message || '';
    }
    assert(
      uncollectedBlocked && uncollectedMsg.includes('must mark cash collected'),
      `Completion blocked before provider confirms cash: "${uncollectedMsg}"`
    );

    // Provider confirms cash
    await axios.patch(`${BASE_URL}/bookings/provider/${bPendingId}/cash/confirm`, {}, provHeaders);

    // Now completion succeeds
    const bCashExtraComp = await axios.patch(`${BASE_URL}/bookings/provider/${bPendingId}/complete`, {}, provHeaders);
    assert(
      bCashExtraComp.data.data.status === 'completed',
      'Cash-extra booking successfully completed after cash confirmation'
    );

    // -------------------------------------------------------------
    // CHECK 6: Unpaid online booking blocks completion
    // -------------------------------------------------------------
    console.log('\n--- Check 6: Unpaid online booking blocks completion ---');
    const bUnpaidOnlineRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: service._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
        address: { street: '54 Test Road', city: 'Prayagraj', zipCode: '211001' },
        paymentMethod: 'online',
        notes: 'Unpaid online test'
      },
      custHeaders
    );
    const bUnpaidOnlineId = bUnpaidOnlineRes.data.data._id;
    await axios.patch(`${BASE_URL}/bookings/provider/${bUnpaidOnlineId}/accept`, {}, provHeaders);
    await axios.patch(`${BASE_URL}/bookings/provider/${bUnpaidOnlineId}/start`, {}, provHeaders);

    let unpaidOnlineBlocked = false;
    let unpaidOnlineMsg = '';
    try {
      await axios.patch(`${BASE_URL}/bookings/provider/${bUnpaidOnlineId}/complete`, {}, provHeaders);
    } catch (e) {
      unpaidOnlineBlocked = e.response?.status === 400;
      unpaidOnlineMsg = e.response?.data?.error?.message || '';
    }
    assert(
      unpaidOnlineBlocked && unpaidOnlineMsg.includes('Online payment for base service is pending'),
      `Completion blocked when online base payment is unpaid: "${unpaidOnlineMsg}"`
    );

    console.log('\n======================================================');
    console.log(`🎉 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Unexpected verification failure:', err.response?.data || err.message);
  }
}

runVerification();
