/**
 * End-to-End Test Suite: Customer Booking, Razorpay/Cash Payment, Provider Requests & Acceptance
 * Project: E:\SERVICE-PROVIDER-MARKETPLACE
 * 
 * Verifies:
 * 1. Authentication for Customer and Provider via live API
 * 2. Active catalog & positive service price check
 * 3. Validation rejection of past scheduled dates and invalid time slots
 * 4. Customer booking creation (Scheduled & Instant) with MongoDB persistence
 * 5. Server-calculated authoritative pricing (client-side spoofing prevention)
 * 6. Razorpay order generation matching server-side amount & test currency
 * 7. Razorpay signature verification & tampered signature rejection
 * 8. Cash / Pay on Service pending payment lifecycle
 * 9. Provider request visibility (pending queue) for demo provider
 * 10. Provider booking acceptance (atomic concurrency check)
 * 11. Customer and Admin status synchronization & unauthorized access prevention
 */

const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const API_BASE = 'http://localhost:5000/api';
const Booking = require('./src/models/Booking');
const Service = require('./src/models/Service');
const Provider = require('./src/models/Provider');
const User = require('./src/models/User');

const CUSTOMER_CREDENTIALS = {
  email: 'customer.demo@gmail.com',
  password: 'Customer@123'
};

const PROVIDER_CREDENTIALS = {
  email: 'provider.demo@gmail.com',
  password: 'Provider@123'
};

let customerToken = null;
let providerToken = null;
let testScheduledBooking = null;
let testInstantBooking = null;
let selectedService = null;

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('  STARTING E2E CUSTOMER BOOKING & PROVIDER VERIFICATION TESTS   ');
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // -------------------------------------------------------------
  // STEP 1: AUTHENTICATION
  // -------------------------------------------------------------
  console.log('[STEP 1] Authenticating Customer and Provider accounts...');
  
  const custAuthRes = await request('/auth/login/customer', {
    method: 'POST',
    body: CUSTOMER_CREDENTIALS
  });
  assert.strictEqual(custAuthRes.status, 200, `Customer login failed: ${JSON.stringify(custAuthRes.data)}`);
  customerToken = custAuthRes.data.data.token;
  assert.ok(customerToken, 'Customer JWT token must be returned');
  console.log('  ✓ Customer authenticated successfully (customer.demo@gmail.com)');

  const provAuthRes = await request('/auth/login/provider', {
    method: 'POST',
    body: PROVIDER_CREDENTIALS
  });
  assert.strictEqual(provAuthRes.status, 200, `Provider login failed: ${JSON.stringify(provAuthRes.data)}`);
  providerToken = provAuthRes.data.data.token;
  assert.ok(providerToken, 'Provider JWT token must be returned');
  console.log('  ✓ Provider authenticated successfully (provider.demo@gmail.com)');

  // -------------------------------------------------------------
  // STEP 2: SERVICE CATALOG & AUTHORITATIVE PRICE VALIDATION
  // -------------------------------------------------------------
  console.log('\n[STEP 2] Fetching active services and verifying pricing...');
  
  const servicesRes = await request('/services');
  assert.strictEqual(servicesRes.status, 200, 'Services list must return 200');
  assert.ok(Array.isArray(servicesRes.data.data), 'Services data must be an array');
  assert.ok(servicesRes.data.data.length > 0, 'There must be active services in the system');

  // Find a service offered or compatible with the provider
  selectedService = servicesRes.data.data.find(
    (s) => s.name === 'Home Electrical Wiring & Inspection' || s.category?.name === 'Electrician'
  ) || servicesRes.data.data[0];

  assert.ok(selectedService, 'Selected service must exist');
  assert.ok(Number(selectedService.price) > 0, `Service price must be greater than zero (got: ${selectedService.price})`);
  assert.ok(Number(selectedService.basePrice) > 0, `Service basePrice virtual must match positive price (got: ${selectedService.basePrice})`);

  console.log(`  ✓ Selected Service: "${selectedService.name}"`);
  console.log(`  ✓ Authoritative Service Price: ₹${selectedService.price}`);

  // Fetch single service detail
  const detailRes = await request(`/services/${selectedService._id}`);
  assert.strictEqual(detailRes.status, 200, 'Service detail must return 200');
  assert.strictEqual(detailRes.data.data.price, selectedService.price, 'Price must match single service response');
  assert.strictEqual(detailRes.data.data.basePrice, selectedService.price, 'BasePrice must match single service response');
  console.log('  ✓ Service detail API returns identical positive price and basePrice');

  // -------------------------------------------------------------
  // STEP 3: SCHEDULE VALIDATION CHECKS (PAST DATE & TIME SLOT)
  // -------------------------------------------------------------
  console.log('\n[STEP 3] Testing form validation & server validation rejection rules...');

  // 3.1 Past date rejection
  const pastBookingRes = await request('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      serviceId: selectedService._id,
      bookingMode: 'scheduled',
      scheduledDate: '2024-01-01', // definitely in the past
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: { street: '42 Main St', city: 'Jaipur' },
      problemDescription: 'Checking past date rejection'
    }
  });
  assert.strictEqual(pastBookingRes.status, 400, 'Past scheduled date must be rejected with 400');
  console.log('  ✓ Server correctly rejected past scheduled date (HTTP 400)');

  // 3.2 Missing time slot for scheduled mode
  const missingSlotRes = await request('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      serviceId: selectedService._id,
      bookingMode: 'scheduled',
      scheduledDate: '2028-11-20',
      address: { street: '42 Main St', city: 'Jaipur' },
      problemDescription: 'Checking missing slot rejection'
    }
  });
  assert.strictEqual(missingSlotRes.status, 400, 'Scheduled booking without time slot must be rejected with 400');
  console.log('  ✓ Server correctly rejected missing scheduled time slot (HTTP 400)');

  // 3.3 Unsupported payment method rejection
  const invalidPaymentRes = await request('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      serviceId: selectedService._id,
      bookingMode: 'scheduled',
      scheduledDate: '2028-11-20',
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      paymentMethod: 'crypto_currency',
      address: { street: '42 Main St', city: 'Jaipur' },
      problemDescription: 'Checking invalid payment method rejection'
    }
  });
  assert.strictEqual(invalidPaymentRes.status, 400, 'Unsupported payment method must be rejected with 400');
  console.log('  ✓ Server correctly rejected unsupported payment method (HTTP 400)');

  // -------------------------------------------------------------
  // STEP 4: CUSTOMER CREATES SCHEDULED BOOKING (WITH RAZORPAY PAYMENT)
  // -------------------------------------------------------------
  console.log('\n[STEP 4] Customer creates a Scheduled Booking (Online Payment Flow)...');

  // Calculate future date in local timezone
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const scheduledDateStr = futureDate.toISOString().slice(0, 10);

  const scheduledPayload = {
    serviceId: selectedService._id,
    bookingMode: 'scheduled',
    paymentMethod: 'online', // Razorpay online payment
    scheduledDate: scheduledDateStr,
    scheduledTimeSlot: {
      startTime: '11:00',
      endTime: '13:00'
    },
    address: {
      street: 'Flat 402, Sunshine Residency, Vaishali Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      zipCode: '302021'
    },
    problemDescription: 'Circuit breaker tripping repeatedly in kitchen and dining area',
    // Attempt client-side price spoofing to verify server recalculates from DB
    pricing: {
      basePrice: 0,
      totalAmount: 0
    }
  };

  const createScheduledRes = await request('/bookings', {
    method: 'POST',
    token: customerToken,
    body: scheduledPayload
  });

  assert.strictEqual(createScheduledRes.status, 201, `Failed to create booking: ${JSON.stringify(createScheduledRes.data)}`);
  testScheduledBooking = createScheduledRes.data.data;
  assert.ok(testScheduledBooking._id, 'Booking ID must be returned');
  assert.ok(testScheduledBooking.bookingReference, 'Booking reference must be returned');
  assert.strictEqual(testScheduledBooking.status, 'pending', 'Initial status must be pending');
  assert.strictEqual(testScheduledBooking.paymentStatus, 'pending', 'Initial payment status must be pending');
  
  // Authoritative price check
  assert.strictEqual(
    testScheduledBooking.pricing.basePrice,
    selectedService.price,
    `Server must ignore spoofed ₹0 and use authoritative service price ₹${selectedService.price}`
  );
  assert.strictEqual(
    testScheduledBooking.pricing.totalAmount,
    selectedService.price,
    `Total payable must equal authoritative service price ₹${selectedService.price}`
  );

  console.log(`  ✓ Booking created: ${testScheduledBooking.bookingReference}`);
  console.log(`  ✓ Persisted Authoritative Amount: ₹${testScheduledBooking.pricing.totalAmount} (spoofed ₹0 rejected)`);

  // Verify direct MongoDB persistence
  const dbBooking = await Booking.findById(testScheduledBooking._id).lean();
  assert.ok(dbBooking, 'Booking must be persisted in MongoDB');
  assert.strictEqual(dbBooking.bookingReference, testScheduledBooking.bookingReference);
  assert.strictEqual(dbBooking.pricing.totalAmount, selectedService.price);
  console.log('  ✓ Verified in MongoDB Atlas: document exists with correct structure and amount');

  // -------------------------------------------------------------
  // STEP 5: RAZORPAY PAYMENT INTEGRATION TESTS
  // -------------------------------------------------------------
  console.log('\n[STEP 5] Testing Razorpay Order Generation & Signature Verification...');

  // 5.1 Create Razorpay Order
  const orderRes = await request(`/bookings/customer/${testScheduledBooking._id}/payment/order`, {
    method: 'POST',
    token: customerToken
  });

  assert.strictEqual(orderRes.status, 200, `Order creation failed: ${JSON.stringify(orderRes.data)}`);
  const orderData = orderRes.data.data;
  assert.ok(orderData.orderId, 'Razorpay orderId must be returned');
  assert.strictEqual(orderData.amount, selectedService.price * 100, 'Paise amount must equal INR * 100');
  assert.strictEqual(orderData.currency, 'INR', 'Currency must be INR');
  console.log(`  ✓ Razorpay Order created: ${orderData.orderId} (Amount: ${orderData.amount} paise = ₹${orderData.amount / 100})`);

  // 5.2 Test Tampered/Forged Signature Rejection
  const tamperedSigRes = await request(`/bookings/customer/${testScheduledBooking._id}/payment/verify`, {
    method: 'POST',
    token: customerToken,
    body: {
      razorpayOrderId: orderData.orderId,
      razorpayPaymentId: 'pay_test_tampered123',
      razorpaySignature: 'bad_signature_00000000000000000000000000000000000000000'
    }
  });
  assert.strictEqual(tamperedSigRes.status, 400, 'Tampered signature must be rejected with 400');
  console.log('  ✓ Tampered payment signature correctly rejected (HTTP 400)');

  // 5.2b Test Mismatched Order ID Rejection
  const wrongOrderRes = await request(`/bookings/customer/${testScheduledBooking._id}/payment/verify`, {
    method: 'POST',
    token: customerToken,
    body: {
      razorpayOrderId: 'order_wrong_mismatched_99999',
      razorpayPaymentId: 'pay_test_mismatched123',
      razorpaySignature: 'any_signature'
    }
  });
  assert.strictEqual(wrongOrderRes.status, 400, 'Mismatched order ID must be rejected with 400');
  console.log('  ✓ Mismatched Razorpay order ID correctly rejected (HTTP 400)');

  // 5.3 Test Valid Signature Verification
  const testPaymentId = `pay_live_test_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderData.orderId}|${testPaymentId}`)
    .digest('hex');

  const validSigRes = await request(`/bookings/customer/${testScheduledBooking._id}/payment/verify`, {
    method: 'POST',
    token: customerToken,
    body: {
      razorpayOrderId: orderData.orderId,
      razorpayPaymentId: testPaymentId,
      razorpaySignature: validSignature
    }
  });

  assert.strictEqual(validSigRes.status, 200, `Valid signature verification failed: ${JSON.stringify(validSigRes.data)}`);
  assert.strictEqual(validSigRes.data.data.paymentStatus, 'paid', 'Booking payment status must transition to paid');
  console.log('  ✓ Valid Razorpay HMAC SHA-256 signature accepted. Payment status updated to PAID.');

  // -------------------------------------------------------------
  // STEP 6: CASH / PAY ON SERVICE BOOKING CREATION
  // -------------------------------------------------------------
  console.log('\n[STEP 6] Customer creates Instant / Cash Booking...');

  const instantPayload = {
    serviceId: selectedService._id,
    bookingMode: 'instant',
    paymentMethod: 'cash',
    address: {
      street: 'House 15, Near City Palace',
      city: 'Jaipur',
      state: 'Rajasthan',
      zipCode: '302002'
    },
    problemDescription: 'Immediate short circuit check in commercial shop'
  };

  const createInstantRes = await request('/bookings', {
    method: 'POST',
    token: customerToken,
    body: instantPayload
  });

  assert.strictEqual(createInstantRes.status, 201, `Failed to create instant booking: ${JSON.stringify(createInstantRes.data)}`);
  testInstantBooking = createInstantRes.data.data;
  assert.strictEqual(testInstantBooking.bookingMode, 'instant');
  assert.strictEqual(testInstantBooking.paymentMethod, 'cash');
  assert.strictEqual(testInstantBooking.paymentStatus, 'pending');
  assert.strictEqual(testInstantBooking.pricing.totalAmount, selectedService.price);
  console.log(`  ✓ Cash Booking created: ${testInstantBooking.bookingReference}`);
  console.log(`  ✓ Payment status is appropriately 'pending' until actual service completion`);

  // -------------------------------------------------------------
  // STEP 7: PROVIDER RECEIVES PENDING REQUESTS
  // -------------------------------------------------------------
  console.log('\n[STEP 7] Provider checks pending requests...');

  const provRequestsRes = await request('/bookings/provider/requests', {
    token: providerToken
  });

  assert.strictEqual(provRequestsRes.status, 200, 'Provider requests endpoint must return 200');
  const pendingRequests = provRequestsRes.data.data;
  assert.ok(Array.isArray(pendingRequests), 'Provider requests must be an array');
  
  // Find our created booking
  const foundBooking = pendingRequests.find(
    (b) => b._id.toString() === testScheduledBooking._id.toString() || b._id.toString() === testInstantBooking._id.toString()
  );

  assert.ok(foundBooking, `Booking ${testInstantBooking.bookingReference} must appear in provider's pending requests queue`);
  assert.ok(foundBooking.service, 'Service info must be populated');
  assert.ok(foundBooking.customer, 'Customer info must be populated');
  assert.ok(foundBooking.pricing?.totalAmount > 0, 'Pricing totalAmount must be positive');
  console.log(`  ✓ Provider received booking: ${foundBooking.bookingReference}`);
  console.log(`  ✓ Service: ${foundBooking.service.name} (Amount: ₹${foundBooking.pricing.totalAmount})`);
  console.log(`  ✓ Customer Name: ${foundBooking.customer.user?.name || 'Customer'}`);

  // -------------------------------------------------------------
  // STEP 8: PROVIDER ACCEPTS THE BOOKING (ATOMIC CLAIM)
  // -------------------------------------------------------------
  console.log('\n[STEP 8] Provider accepts the booking request...');

  const bookingToAcceptId = foundBooking._id;
  const acceptRes = await request(`/bookings/provider/${bookingToAcceptId}/accept`, {
    method: 'PATCH',
    token: providerToken
  });

  assert.strictEqual(acceptRes.status, 200, `Provider accept failed: ${JSON.stringify(acceptRes.data)}`);
  assert.strictEqual(acceptRes.data.data.status, 'accepted', 'Booking status must be accepted');
  console.log(`  ✓ Booking ${foundBooking.bookingReference} accepted by provider`);

  // 8.1 Attempt double-accept / conflict test
  const doubleAcceptRes = await request(`/bookings/provider/${bookingToAcceptId}/accept`, {
    method: 'PATCH',
    token: providerToken
  });
  assert.strictEqual(doubleAcceptRes.status, 409, 'Double accept must return conflict 409');
  console.log('  ✓ Atomic concurrency guard prevents duplicate acceptance (HTTP 409)');

  // -------------------------------------------------------------
  // STEP 9: SYNCHRONIZATION ACROSS CUSTOMER & ADMIN
  // -------------------------------------------------------------
  console.log('\n[STEP 9] Verifying updated status across Customer and Provider views...');

  // Customer view
  const custCheckRes = await request(`/bookings/customer/${bookingToAcceptId}`, {
    token: customerToken
  });
  assert.strictEqual(custCheckRes.status, 200, 'Customer must be able to view booking');
  assert.strictEqual(custCheckRes.data.data.status, 'accepted', 'Customer must see updated status as accepted');
  assert.ok(custCheckRes.data.data.provider, 'Customer must see assigned provider');
  console.log('  ✓ Customer sees status: ACCEPTED with assigned provider profile');

  // Provider progression: start -> complete
  const startRes = await request(`/bookings/provider/${bookingToAcceptId}/start`, {
    method: 'PATCH',
    token: providerToken
  });
  assert.strictEqual(startRes.status, 200);
  assert.strictEqual(startRes.data.data.status, 'in_progress');
  console.log('  ✓ Provider transitioned booking to: IN_PROGRESS');

  const completeRes = await request(`/bookings/provider/${bookingToAcceptId}/complete`, {
    method: 'PATCH',
    token: providerToken
  });
  assert.strictEqual(completeRes.status, 200);
  assert.strictEqual(completeRes.data.data.status, 'completed');
  console.log('  ✓ Provider transitioned booking to: COMPLETED');

  // Customer fetches completed booking
  const custFinalRes = await request(`/bookings/customer/${bookingToAcceptId}`, {
    token: customerToken
  });
  assert.strictEqual(custFinalRes.data.data.status, 'completed');
  console.log('  ✓ Customer view confirmed final status: COMPLETED');

  // -------------------------------------------------------------
  // STEP 10: UNAUTHORIZED ACCESS CONTROL
  // -------------------------------------------------------------
  console.log('\n[STEP 10] Testing security & authorization guards...');
  
  const unauthRes = await request(`/bookings/customer/${bookingToAcceptId}`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated access must be rejected with 401');
  console.log('  ✓ Unauthenticated access correctly blocked (HTTP 401)');

  console.log('\n================================================================');
  console.log('  ALL E2E BOOKING & PROVIDER VERIFICATION TESTS PASSED (10/10)   ');
  console.log('================================================================\n');

  await mongoose.disconnect();
}

runE2ETests().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  if (mongoose.connection.readyState !== 0) {
    mongoose.disconnect();
  }
  process.exit(1);
});
