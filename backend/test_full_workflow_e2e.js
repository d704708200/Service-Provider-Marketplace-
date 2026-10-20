/**
 * FULL END-TO-END WORKFLOW INTEGRATION TEST
 * Service Provider Marketplace
 * 
 * Executes PHASES 1 to 9 of the User Request against the live Backend API and MongoDB Atlas:
 * Phase 1: Environment & Readiness
 * Phase 2: Customer Registration/Login, Service Selection & Booking Creation
 * Phase 3: Provider Login, Incoming Request Listing & Booking Acceptance (with duplicate lock verification)
 * Phase 4: Provider Starts Service (status: in_progress, timestamp recorded, intruder lock checked)
 * Phase 5: Provider Proposes Extra Materials (Copper Pipe x2 @ 150 = 300, Wall Bracket x1 @ 100 = 100 -> 400)
 *          Verifies itemized estimate breakdown, backend persistence, immutability & completion block
 * Phase 6: Customer Reviews & Approves Proposal (server-side calculation, customer authorization, provider lock)
 * Phase 7: Payment Flow:
 *          - Case A (Online Booking with base paid): Extra-materials payment order in paise, HMAC SHA-256 signature verification
 *          - Payment failure reporting & retry balance retention
 *          - Duplicate payment & duplicate approval guards
 * Phase 8: Provider Completes Service (status: completed, timestamps recorded, final bill verified, duplicate completion blocked)
 * Phase 9: Mandatory Negative & Regression Tests:
 *          - Complete service without extra items
 *          - Reject extra items & retain base price
 *          - Intruders blocked across customer and provider endpoints
 *          - Negative quantity & negative unit price validation
 *          - Tampered Razorpay signature rejection
 *          - Cash / pay-on-service workflow with extras
 */

const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:5000/api';

const results = [];

function recordResult(testId, step, expected, actual, status, evidence, fix = 'None') {
  results.push({
    testId,
    step,
    expected,
    actual,
    status,
    evidence: typeof evidence === 'object' ? JSON.stringify(evidence) : String(evidence),
    fix
  });
  const icon = status === 'PASS' ? '✅' : status === 'BLOCKED' ? '⚠️' : '❌';
  console.log(`${icon} [${testId}] ${step}: ${status} - ${expected}`);
}

async function runFullE2ETest() {
  console.log('\n========================================================================');
  console.log('🚀 EXECUTING FULL REAL INTEGRATION WORKFLOW SUITE');
  console.log('========================================================================\n');

  const ts = Date.now();
  let customerUser, customerToken, customerProfile;
  let intruderCustomerUser, intruderCustomerToken;
  let providerUser, providerToken, providerProfile;
  let intruderProviderUser, intruderProviderToken;
  let activeService;
  let testBooking;
  let razorpayKeyId;

  try {
    // -------------------------------------------------------------------------
    // PHASE 1 — Environment and Readiness Checks
    // -------------------------------------------------------------------------
    console.log('--- PHASE 1: Environment & Readiness Checks ---');

    // 1.1 Backend Health
    const healthRes = await axios.get(`${BASE_URL}/health`);
    const isHealthy = healthRes.status === 200 && healthRes.data.success && healthRes.data.database?.connected;
    recordResult(
      'PHASE-1.1',
      'Backend Health Check',
      'HTTP 200 with MongoDB connected',
      `HTTP ${healthRes.status}, DB Connected: ${healthRes.data.database?.connected}`,
      isHealthy ? 'PASS' : 'FAIL',
      `Uptime: ${healthRes.data.uptime}s, Environment: ${healthRes.data.environment}`
    );

    // 1.2 Environment Variables & Razorpay Mode
    const envRazorpayKey = (process.env.RAZORPAY_KEY_ID || '').trim();
    const isTestMode = envRazorpayKey.startsWith('rzp_test_');
    razorpayKeyId = envRazorpayKey;
    recordResult(
      'PHASE-1.2',
      'Razorpay Test Mode Verification',
      'Key prefix rzp_test_ indicating TEST mode (never live)',
      `Key prefix: ${envRazorpayKey.substring(0, 8)}`,
      isTestMode ? 'PASS' : 'FAIL',
      `Razorpay Test Mode Confirmed. Real charge prevented.`
    );

    // -------------------------------------------------------------------------
    // PHASE 2 — Customer Login and Booking Creation
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2: Customer Login and Booking ---');

    // 2.1 Customer Login (using standard demo account or fresh registration)
    const custLoginRes = await axios.post(`${BASE_URL}/auth/login/customer`, {
      email: 'customer.demo@gmail.com',
      password: 'Customer@123'
    });
    customerToken = custLoginRes.data.data.token;
    customerUser = custLoginRes.data.data.user;
    recordResult(
      'PHASE-2.1',
      'Customer Authentication',
      'Customer authenticates successfully and receives JWT',
      `HTTP 200, Role: ${customerUser.role}, Email: ${customerUser.email}`,
      customerToken && customerUser.role === 'customer' ? 'PASS' : 'FAIL',
      `User ID: ${customerUser._id}`
    );

    // 2.2 Customer Profile Fetch
    const custProfileRes = await axios.get(`${BASE_URL}/customers/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    customerProfile = custProfileRes.data.data;
    recordResult(
      'PHASE-2.2',
      'Customer Profile Verification',
      'Profile loaded successfully for authenticated customer',
      `Customer profile ID: ${customerProfile._id}`,
      customerProfile ? 'PASS' : 'FAIL',
      `Addresses count: ${customerProfile.addresses?.length || 0}`
    );

    // 2.3 Register Intruder Customer (for security validation)
    const intruderCustRes = await axios.post(`${BASE_URL}/auth/register/customer`, {
      name: 'Intruder Customer E2E',
      email: `intruder_cust_${ts}@example.com`,
      password: 'Password123!',
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    intruderCustomerToken = intruderCustRes.data.data.token;
    intruderCustomerUser = intruderCustRes.data.data.user;

    // 2.4 Select Active Service
    const servicesRes = await axios.get(`${BASE_URL}/services?limit=10`);
    const services = servicesRes.data.data.services || servicesRes.data.data;
    activeService = services.find((s) => s.isActive && s.price > 0) || services[0];
    const baseServicePrice = activeService.price;
    recordResult(
      'PHASE-2.3',
      'Service Selection & Pricing Verification',
      'Retrieve active service with authoritative base price',
      `Service: "${activeService.name}", Base Price: ₹${baseServicePrice}`,
      activeService && baseServicePrice > 0 ? 'PASS' : 'FAIL',
      `Service ID: ${activeService._id}`
    );

    // 2.5 Provider Authentication
    const provLoginRes = await axios.post(`${BASE_URL}/auth/login/provider`, {
      email: 'provider.demo@gmail.com',
      password: 'Provider@123'
    });
    providerToken = provLoginRes.data.data.token;
    providerUser = provLoginRes.data.data.user;
    providerProfile = provLoginRes.data.data.provider;

    // Register Intruder Provider
    const intruderProvRes = await axios.post(`${BASE_URL}/auth/register/provider`, {
      name: 'Intruder Provider E2E',
      email: `intruder_prov_${ts}@example.com`,
      password: 'Password123!',
      phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
      businessName: 'Intruder Electricals',
      serviceCategory: activeService.category?._id || activeService.category
    });
    intruderProviderToken = intruderProvRes.data.data.token;
    intruderProviderUser = intruderProvRes.data.data.user;

    // 2.6 Customer Creates Online Booking
    const bookingPayload = {
      serviceId: activeService._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: {
        street: '742 Evergreen Terrace',
        city: 'Bengaluru',
        zipCode: '560001'
      },
      paymentMethod: 'online',
      notes: 'E2E Full Workflow Test Booking'
    };
    const createBookingRes = await axios.post(`${BASE_URL}/bookings`, bookingPayload, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    testBooking = createBookingRes.data.data;
    recordResult(
      'PHASE-2.4',
      'Customer Booking Creation',
      'Booking persisted in MongoDB with status pending and authoritative amount',
      `Booking Ref: ${testBooking.bookingReference}, Status: ${testBooking.status}, Total: ₹${testBooking.pricing.totalAmount}`,
      testBooking.status === 'pending' && testBooking.pricing.totalAmount === baseServicePrice ? 'PASS' : 'FAIL',
      `Booking ID: ${testBooking._id}`
    );

    // 2.7 Pay Initial Base Amount via Razorpay Online Test Mode
    const baseOrderRes = await axios.post(
      `${BASE_URL}/bookings/customer/${testBooking._id}/payment/order`,
      {},
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const baseOrderId = baseOrderRes.data.data.orderId;
    const basePaymentId = `pay_base_${ts}`;
    const baseSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET.trim())
      .update(`${baseOrderId}|${basePaymentId}`)
      .digest('hex');

    const verifyBaseRes = await axios.post(
      `${BASE_URL}/bookings/customer/${testBooking._id}/payment/verify`,
      {
        razorpayOrderId: baseOrderId,
        razorpayPaymentId: basePaymentId,
        razorpaySignature: baseSignature
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    testBooking = verifyBaseRes.data.data;
    recordResult(
      'PHASE-2.5',
      'Initial Base Payment Verification',
      'Base booking payment verified via Razorpay HMAC signature and marked paid',
      `Payment status: ${testBooking.paymentStatus}, Order: ${baseOrderId}`,
      testBooking.paymentStatus === 'paid' ? 'PASS' : 'FAIL',
      `Base amount ₹${baseServicePrice} paid in test mode`
    );

    // -------------------------------------------------------------------------
    // PHASE 3 — Provider Login and Booking Acceptance
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 3: Provider Login and Acceptance ---');

    // 3.1 Provider lists incoming requests
    const provRequestsRes = await axios.get(`${BASE_URL}/bookings/provider/requests`, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });
    const foundInRequests = provRequestsRes.data.data.some((b) => b._id === testBooking._id);
    recordResult(
      'PHASE-3.1',
      'Provider Request Visibility',
      'Incoming pending booking appears in provider request feed',
      `Booking ${testBooking.bookingReference} found in requests: ${foundInRequests}`,
      foundInRequests ? 'PASS' : 'FAIL',
      `Provider: ${providerUser.name}`
    );

    // 3.2 Provider accepts booking
    const acceptRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${testBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    testBooking = acceptRes.data.data;
    recordResult(
      'PHASE-3.2',
      'Provider Booking Acceptance',
      'Booking status transitions to accepted with provider assigned',
      `Status: ${testBooking.status}, Provider assigned: ${testBooking.provider?.businessName || testBooking.provider}`,
      testBooking.status === 'accepted' ? 'PASS' : 'FAIL',
      `Accepted at: ${testBooking.statusTimestamps?.acceptedAt || new Date().toISOString()}`
    );

    // 3.3 Duplicate acceptance test
    let dupAcceptBlocked = false;
    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${testBooking._id}/accept`,
        {},
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 409) dupAcceptBlocked = true;
    }
    recordResult(
      'PHASE-3.3',
      'Duplicate Acceptance Guard',
      'Duplicate acceptance returns HTTP 409 conflict and prevents multiple claims',
      dupAcceptBlocked ? 'HTTP 409 Conflict returned' : 'Duplicate acceptance not rejected',
      dupAcceptBlocked ? 'PASS' : 'FAIL',
      'Atomic concurrency lock verified'
    );

    // -------------------------------------------------------------------------
    // PHASE 4 — Start Service
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 4: Start Service ---');

    // 4.1 Intruder Provider cannot start another provider's booking
    let intruderStartBlocked = false;
    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${testBooking._id}/start`,
        {},
        { headers: { Authorization: `Bearer ${intruderProviderToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 403) intruderStartBlocked = true;
    }
    recordResult(
      'PHASE-4.1',
      'Unauthorized Provider Start Guard',
      'Unassigned provider receives HTTP 403 Forbidden when attempting start',
      intruderStartBlocked ? 'HTTP 403 Forbidden' : 'Intruder was not blocked',
      intruderStartBlocked ? 'PASS' : 'FAIL',
      'Provider ownership enforcement verified'
    );

    // 4.2 Assigned Provider starts service
    const startRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${testBooking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    testBooking = startRes.data.data;
    recordResult(
      'PHASE-4.2',
      'Assigned Provider Starts Service',
      'Booking transitions to in_progress with start timestamp recorded',
      `Status: ${testBooking.status}, inProgressAt: ${testBooking.statusTimestamps?.inProgressAt}`,
      testBooking.status === 'in_progress' && testBooking.statusTimestamps?.inProgressAt ? 'PASS' : 'FAIL',
      `Start timestamp recorded successfully`
    );

    // -------------------------------------------------------------------------
    // PHASE 5 — Add Extra Materials Before Completion
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 5: Add Extra Materials Before Completion ---');

    // Sample extra items required by specification:
    // - Copper Pipe: Qty 2 @ 150 = 300
    // - Wall Bracket: Qty 1 @ 100 = 100
    // Total extra materials = ₹400
    const extraItems = [
      { name: 'Copper Pipe', quantity: 2, unitPrice: 150, labourCharge: 0, description: '1/2 inch copper pipe' },
      { name: 'Wall Bracket', quantity: 1, unitPrice: 100, labourCharge: 0, description: 'Heavy duty steel bracket' }
    ];

    const submitPartsRes = await axios.post(
      `${BASE_URL}/bookings/provider/${testBooking._id}/spare-parts`,
      { items: extraItems },
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    testBooking = submitPartsRes.data.data;
    const partsSubtotal = testBooking.spareParts?.partsSubtotal;
    const totalAdditional = testBooking.spareParts?.totalAdditionalAmount;
    const bookingTotalBeforeApproval = testBooking.pricing?.totalAmount;

    recordResult(
      'PHASE-5.1',
      'Submit Extra Materials Proposal',
      'Proposal persisted with status pending_approval / pending_customer_approval, subtotal ₹400, base price unchanged',
      `Status: ${testBooking.spareParts?.status}, Extra Total: ₹${totalAdditional}, Booking Total: ₹${bookingTotalBeforeApproval}`,
      ['pending_approval', 'pending_customer_approval'].includes(testBooking.spareParts?.status) &&
        totalAdditional === 400 &&
        bookingTotalBeforeApproval === baseServicePrice
        ? 'PASS'
        : 'FAIL',
      `Original service amount preserved: ₹${testBooking.spareParts?.originalServiceAmount}`
    );

    // 5.2 Completion Block while proposal is pending approval
    let compBlockedOnPending = false;
    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${testBooking._id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.message?.includes('awaiting customer approval')) {
        compBlockedOnPending = true;
      }
    }
    recordResult(
      'PHASE-5.2',
      'Completion Block on Pending Proposal',
      'Service completion rejected with HTTP 400 while proposal is awaiting customer approval',
      compBlockedOnPending ? 'HTTP 400: Completion correctly blocked' : 'Service completion was not blocked',
      compBlockedOnPending ? 'PASS' : 'FAIL',
      'Two-step workflow security rule verified'
    );

    // -------------------------------------------------------------------------
    // PHASE 6 — Customer Reviews and Approves Extras
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 6: Customer Reviews and Approves Extras ---');

    // 6.1 Intruder Customer cannot approve
    let intruderApproveBlocked = false;
    try {
      await axios.patch(
        `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/review`,
        { action: 'approve' },
        { headers: { Authorization: `Bearer ${intruderCustomerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 403) intruderApproveBlocked = true;
    }
    recordResult(
      'PHASE-6.1',
      'Unauthorized Customer Review Guard',
      'Different customer receives HTTP 403 when attempting review',
      intruderApproveBlocked ? 'HTTP 403 Forbidden' : 'Intruder customer was not blocked',
      intruderApproveBlocked ? 'PASS' : 'FAIL',
      'Customer booking ownership verified'
    );

    // 6.2 Legitimate Customer Approves Proposal
    const approvePartsRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/review`,
      { action: 'approve' },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    testBooking = approvePartsRes.data.data;
    const expectedRevisedTotal = baseServicePrice + 400;

    recordResult(
      'PHASE-6.2',
      'Customer Approves Extra Materials',
      `Status becomes approved, revised total calculated server-side: ₹${baseServicePrice} + ₹400 = ₹${expectedRevisedTotal}`,
      `Status: ${testBooking.spareParts?.status}, Revised Total: ₹${testBooking.pricing?.totalAmount}`,
      testBooking.spareParts?.status === 'approved' && testBooking.pricing?.totalAmount === expectedRevisedTotal
        ? 'PASS'
        : 'FAIL',
      `ReviewedAt timestamp: ${testBooking.spareParts?.reviewedAt}`
    );

    // 6.3 Provider Immutability Lock (cannot edit approved proposal silently)
    let providerEditBlocked = false;
    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${testBooking._id}/spare-parts`,
        { items: [{ name: 'Secret Extra Wire', quantity: 1, unitPrice: 200 }] },
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.message?.includes('Cannot edit spare parts after customer has approved')) {
        providerEditBlocked = true;
      }
    }
    recordResult(
      'PHASE-6.3',
      'Provider Immutability Lock on Approved Proposal',
      'Provider blocked with HTTP 400 from silently altering approved charges',
      providerEditBlocked ? 'HTTP 400: Edit blocked after customer approval' : 'Provider was able to edit approved bill',
      providerEditBlocked ? 'PASS' : 'FAIL',
      'Price integrity security lock verified'
    );

    // -------------------------------------------------------------------------
    // PHASE 7 — Payment After Approval
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 7: Payment After Approval ---');

    // 7.1 Completion blocked while approved extra online payment is unpaid
    let compBlockedOnUnpaidParts = false;
    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${testBooking._id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.message?.includes('has not been paid yet')) {
        compBlockedOnUnpaidParts = true;
      }
    }
    recordResult(
      'PHASE-7.1',
      'Completion Block on Unpaid Approved Extra Charges',
      'Service completion rejected with HTTP 400 while approved extra amount is unpaid',
      compBlockedOnUnpaidParts ? 'HTTP 400: Completion blocked on unpaid extras' : 'Completion was not blocked',
      compBlockedOnUnpaidParts ? 'PASS' : 'FAIL',
      'Payment completion requirement enforced before job completion'
    );

    // 7.2 Create Razorpay Order specifically for approved extra amount (₹400 = 40000 paise)
    const partsOrderRes = await axios.post(
      `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/payment/order`,
      {},
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const partsOrderData = partsOrderRes.data.data;
    const partsOrderId = partsOrderData.orderId;
    const partsOrderAmount = partsOrderData.amount;
    recordResult(
      'PHASE-7.2',
      'Spare Parts Razorpay Order Creation',
      'Razorpay order created for exact additional amount in paise (40000 paise = ₹400)',
      `Order ID: ${partsOrderId}, Amount in paise: ${partsOrderAmount}`,
      partsOrderId && partsOrderAmount === 40000 ? 'PASS' : 'FAIL',
      `Receipt: ${testBooking.bookingReference}-PARTS`
    );

    // 7.3 Failed Payment Simulation & Balance Retention
    const failReportRes = await axios.post(
      `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/payment/failure`,
      { reason: 'Customer simulated card timeout' },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const failedBookingData = failReportRes.data.data;
    recordResult(
      'PHASE-7.3',
      'Payment Failure Reporting & Balance Retention',
      'Payment status marked as failed, outstanding balance retained at ₹400 for retry',
      `Payment status: ${failedBookingData.spareParts?.paymentStatus}, Balance: ₹${failedBookingData.spareParts?.totalAdditionalAmount}`,
      failedBookingData.spareParts?.paymentStatus === 'failed' && failedBookingData.spareParts?.totalAdditionalAmount === 400
        ? 'PASS'
        : 'FAIL',
      `Failure reason: ${failedBookingData.spareParts?.paymentDetails?.failureReason}`
    );

    // 7.4 Tampered Signature Rejection
    let tamperedRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/payment/verify`,
        {
          razorpayOrderId: partsOrderId,
          razorpayPaymentId: `pay_parts_${ts}`,
          razorpaySignature: 'invalid_tampered_signature_hex_12345'
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400) tamperedRejected = true;
    }
    recordResult(
      'PHASE-7.4',
      'Tampered Signature Rejection',
      'Backend rejects forged/tampered signature with HTTP 400',
      tamperedRejected ? 'HTTP 400 Bad Request' : 'Forged signature was accepted',
      tamperedRejected ? 'PASS' : 'FAIL',
      'Cryptographic HMAC SHA-256 protection verified'
    );

    // 7.5 Valid Signature Verification (Razorpay Test Mode)
    const validPartsPayId = `pay_parts_valid_${ts}`;
    const validPartsSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET.trim())
      .update(`${partsOrderId}|${validPartsPayId}`)
      .digest('hex');

    const verifyPartsRes = await axios.post(
      `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/payment/verify`,
      {
        razorpayOrderId: partsOrderId,
        razorpayPaymentId: validPartsPayId,
        razorpaySignature: validPartsSignature
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    testBooking = verifyPartsRes.data.data;
    recordResult(
      'PHASE-7.5',
      'Valid Signature Verification & Payment Confirmation',
      'Backend cryptographically validates HMAC signature and updates spareParts.paymentStatus to paid',
      `spareParts.paymentStatus: ${testBooking.spareParts?.paymentStatus}, paidAt: ${testBooking.spareParts?.paymentDetails?.paidAt}`,
      testBooking.spareParts?.paymentStatus === 'paid' ? 'PASS' : 'FAIL',
      `Payment ID: ${validPartsPayId}`
    );

    // 7.6 Duplicate Payment Rejection
    let dupPayRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/bookings/customer/${testBooking._id}/spare-parts/payment/order`,
        {},
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.message?.includes('already been paid')) {
        dupPayRejected = true;
      }
    }
    recordResult(
      'PHASE-7.6',
      'Duplicate Payment Order Guard',
      'Attempt to create second payment order for paid proposal rejected with HTTP 400',
      dupPayRejected ? 'HTTP 400: Already paid' : 'Duplicate payment allowed',
      dupPayRejected ? 'PASS' : 'FAIL',
      'Double charge prevention verified'
    );

    // -------------------------------------------------------------------------
    // PHASE 8 — Complete Service
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 8: Complete Service ---');

    // 8.1 Provider Completes Service
    const completeRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${testBooking._id}/complete`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    testBooking = completeRes.data.data;
    recordResult(
      'PHASE-8.1',
      'Provider Completes Service',
      'Booking transitions to completed with completedAt timestamp recorded',
      `Status: ${testBooking.status}, completedAt: ${testBooking.statusTimestamps?.completedAt}`,
      testBooking.status === 'completed' && testBooking.statusTimestamps?.completedAt ? 'PASS' : 'FAIL',
      `Final completed booking verified`
    );

    // 8.2 Customer and Provider views confirm final state & breakdown
    const customerViewRes = await axios.get(`${BASE_URL}/bookings/customer/${testBooking._id}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const finalCustBooking = customerViewRes.data.data;
    const finalMatches =
      finalCustBooking.status === 'completed' &&
      finalCustBooking.spareParts?.items?.length === 2 &&
      finalCustBooking.pricing?.totalAmount === expectedRevisedTotal;

    recordResult(
      'PHASE-8.2',
      'Customer Final Bill Verification',
      `Customer view confirms completed status, 2 approved items, and total ₹${expectedRevisedTotal}`,
      `Status: ${finalCustBooking.status}, Items: ${finalCustBooking.spareParts?.items?.length}, Total: ₹${finalCustBooking.pricing?.totalAmount}`,
      finalMatches ? 'PASS' : 'FAIL',
      `Verified final customer booking document`
    );

    // 8.3 Duplicate Completion Guard
    let dupCompBlocked = false;
    try {
      await axios.patch(
        `${BASE_URL}/bookings/provider/${testBooking._id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400) dupCompBlocked = true;
    }
    recordResult(
      'PHASE-8.3',
      'Duplicate Completion Guard',
      'Attempt to complete already completed booking rejected with HTTP 400',
      dupCompBlocked ? 'HTTP 400 Bad Request' : 'Duplicate completion allowed',
      dupCompBlocked ? 'PASS' : 'FAIL',
      'Idempotent state lock verified'
    );

    // -------------------------------------------------------------------------
    // PHASE 9 — Mandatory Negative & Regression Tests
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 9: Mandatory Negative & Regression Tests ---');

    // 9.1 Complete service WITHOUT any extra items
    const noExtrasRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: activeService._id,
        bookingMode: 'instant',
        address: { street: '100 Simple St', city: 'Bengaluru', zipCode: '560001' },
        paymentMethod: 'cash',
        notes: 'Booking with 0 extra items'
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const noExtrasBooking = noExtrasRes.data.data;
    await axios.patch(
      `${BASE_URL}/bookings/provider/${noExtrasBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/provider/${noExtrasBooking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    const noExtrasCompRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${noExtrasBooking._id}/complete`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    recordResult(
      'PHASE-9.1',
      'Complete Service With No Extra Items',
      'Normal booking completes seamlessly without extra materials',
      `Status: ${noExtrasCompRes.data.data.status}, Total: ₹${noExtrasCompRes.data.data.pricing?.totalAmount}`,
      noExtrasCompRes.data.data.status === 'completed' && noExtrasCompRes.data.data.pricing?.totalAmount === baseServicePrice
        ? 'PASS'
        : 'FAIL',
      `Booking without extras completed successfully at base price ₹${baseServicePrice}`
    );

    // 9.2 Customer Rejection of Extra Items Workflow
    const rejectBookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: activeService._id,
        bookingMode: 'instant',
        address: { street: '200 Decline Rd', city: 'Bengaluru', zipCode: '560001' },
        paymentMethod: 'cash',
        notes: 'Booking to test rejection'
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const rejectBooking = rejectBookingRes.data.data;
    await axios.patch(
      `${BASE_URL}/bookings/provider/${rejectBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/provider/${rejectBooking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    await axios.post(
      `${BASE_URL}/bookings/provider/${rejectBooking._id}/spare-parts`,
      { items: [{ name: 'Overpriced Component', quantity: 1, unitPrice: 900 }] },
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    const declineRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${rejectBooking._id}/spare-parts/review`,
      { action: 'reject', rejectionReason: 'Too expensive, not authorized' },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const declinedBooking = declineRes.data.data;
    recordResult(
      'PHASE-9.2',
      'Customer Rejects Extra Materials Proposal',
      'Status becomes rejected, dispute reason saved, booking total remains original base price',
      `Status: ${declinedBooking.spareParts?.status}, Reason: "${declinedBooking.spareParts?.rejectionReason}", Total: ₹${declinedBooking.pricing?.totalAmount}`,
      declinedBooking.spareParts?.status === 'rejected' &&
        declinedBooking.spareParts?.rejectionReason === 'Too expensive, not authorized' &&
        declinedBooking.pricing?.totalAmount === baseServicePrice
        ? 'PASS'
        : 'FAIL',
      'Rejection workflow verified without modifying base price'
    );

    // 9.3 Negative quantity & unit price validation
    let validationBlocked = false;
    try {
      await axios.post(
        `${BASE_URL}/bookings/provider/${rejectBooking._id}/spare-parts`,
        { items: [{ name: 'Invalid Item', quantity: -2, unitPrice: -50 }] },
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 400) validationBlocked = true;
    }
    recordResult(
      'PHASE-9.3',
      'Negative Quantity & Price Validation',
      'Server-side validation rejects negative quantity or unit price with HTTP 400',
      validationBlocked ? 'HTTP 400 Bad Request' : 'Negative values allowed',
      validationBlocked ? 'PASS' : 'FAIL',
      'Server-side schema validation verified'
    );

    // 9.4 Cash / Pay-on-service booking with approved extra materials
    const cashBookingRes = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: activeService._id,
        bookingMode: 'instant',
        address: { street: '300 Cash Lane', city: 'Bengaluru', zipCode: '560001' },
        paymentMethod: 'cash',
        notes: 'Cash payment with extras'
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const cashBooking = cashBookingRes.data.data;
    await axios.patch(
      `${BASE_URL}/bookings/provider/${cashBooking._id}/accept`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    await axios.patch(
      `${BASE_URL}/bookings/provider/${cashBooking._id}/start`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    await axios.post(
      `${BASE_URL}/bookings/provider/${cashBooking._id}/spare-parts`,
      { items: [{ name: 'Cash Filter Replacement', quantity: 1, unitPrice: 250, labourCharge: 50 }] },
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    const cashApproveRes = await axios.patch(
      `${BASE_URL}/bookings/customer/${cashBooking._id}/spare-parts/review`,
      { action: 'approve' },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    const expectedCashTotal = baseServicePrice + 300;
    const cashCompRes = await axios.patch(
      `${BASE_URL}/bookings/provider/${cashBooking._id}/complete`,
      {},
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );
    recordResult(
      'PHASE-9.4',
      'Cash Booking With Extra Materials Workflow',
      `Cash booking total revised to ₹${expectedCashTotal} and completes without requiring Razorpay`,
      `Status: ${cashCompRes.data.data.status}, Total: ₹${cashCompRes.data.data.pricing?.totalAmount}, Method: ${cashCompRes.data.data.paymentMethod}`,
      cashCompRes.data.data.status === 'completed' && cashCompRes.data.data.pricing?.totalAmount === expectedCashTotal
        ? 'PASS'
        : 'FAIL',
      'Cash pay-on-service handling verified'
    );

    console.log('\n========================================================================');
    console.log('📊 FULL E2E SUITE EXECUTION SUMMARY');
    console.log('========================================================================');
    const passedCount = results.filter((r) => r.status === 'PASS').length;
    const failedCount = results.filter((r) => r.status === 'FAIL').length;
    const blockedCount = results.filter((r) => r.status === 'BLOCKED').length;
    console.log(`TOTAL TESTS: ${results.length} | PASS: ${passedCount} | FAIL: ${failedCount} | BLOCKED: ${blockedCount}`);

    return {
      results,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        blocked: blockedCount,
        testBookingId: testBooking?._id,
        testBookingReference: testBooking?.bookingReference,
        customerEmail: customerUser?.email,
        providerEmail: providerUser?.email,
        basePrice: baseServicePrice,
        extraAmount: 400,
        approvedTotal: expectedRevisedTotal,
        razorpayKeyId
      }
    };
  } catch (err) {
    console.error('💥 E2E Execution Error:', err.response?.data || err.message);
    recordResult('FATAL', 'E2E Suite Execution', 'Completed without unhandled exceptions', err.message, 'FAIL', err.response?.data || err.stack);
    return { results, error: err.message };
  }
}

runFullE2ETest();
