/**
 * Phase 10: Booking & Scheduling Lifecycle Live Database Integration Tests
 */

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('./src/models/User');
const Customer = require('./src/models/Customer');
const Provider = require('./src/models/Provider');
const Category = require('./src/models/Category');
const Service = require('./src/models/Service');
const Booking = require('./src/models/Booking');
const { generateToken } = require('./src/utils/jwt');
const bookingService = require('./src/services/bookingService');
const app = require('./src/app');
const http = require('http');

let server;
let baseUrl;

const uniqueId = Date.now();

// Test users
let customerUser, customerProfile, customerToken;
let provider1User, provider1Profile, provider1Token;
let provider2User, provider2Profile, provider2Token;
let adminUser, adminToken;

// Test catalog
let activeCategory, inactiveCategory;
let activeService, inactiveService;

async function setup() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // 1. Create Customer
  customerUser = await User.create({
    name: `Customer Test ${uniqueId}`,
    email: `cust_${uniqueId}@example.com`,
    phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123',
    role: 'customer'
  });
  customerProfile = await Customer.create({ user: customerUser._id });
  customerToken = generateToken({ userId: customerUser._id, email: customerUser.email, role: 'customer' });

  // 2. Create Category
  activeCategory = await Category.create({
    name: `Plumbing Cat ${uniqueId}`,
    slug: `plumbing-cat-${uniqueId}`,
    isActive: true
  });
  inactiveCategory = await Category.create({
    name: `Inactive Cat ${uniqueId}`,
    slug: `inactive-cat-${uniqueId}`,
    isActive: false
  });

  // 3. Create Provider 1 (Verified, active)
  provider1User = await User.create({
    name: `Provider 1 ${uniqueId}`,
    email: `prov1_${uniqueId}@example.com`,
    phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123',
    role: 'provider'
  });
  provider1Profile = await Provider.create({
    user: provider1User._id,
    businessName: `P1 Repairs ${uniqueId}`,
    categories: [activeCategory._id],
    verificationStatus: 'verified',
    isAvailable: true
  });
  provider1Token = generateToken({ userId: provider1User._id, email: provider1User.email, role: 'provider' });

  // 4. Create Provider 2 (Verified, active, competes for instant bookings)
  provider2User = await User.create({
    name: `Provider 2 ${uniqueId}`,
    email: `prov2_${uniqueId}@example.com`,
    phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123',
    role: 'provider'
  });
  provider2Profile = await Provider.create({
    user: provider2User._id,
    businessName: `P2 Repairs ${uniqueId}`,
    categories: [activeCategory._id],
    verificationStatus: 'verified',
    isAvailable: true
  });
  provider2Token = generateToken({ userId: provider2User._id, email: provider2User.email, role: 'provider' });

  // 5. Create Admin
  adminUser = await User.create({
    name: `Admin ${uniqueId}`,
    email: `admin_${uniqueId}@example.com`,
    phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123',
    role: 'admin'
  });
  adminToken = generateToken({ userId: adminUser._id, email: adminUser.email, role: 'admin' });

  // 6. Create Services
  activeService = await Service.create({
    name: `Pipe Leak Repair ${uniqueId}`,
    category: activeCategory._id,
    price: 499,
    priceType: 'fixed',
    estimatedDurationMinutes: 45,
    isActive: true
  });

  inactiveService = await Service.create({
    name: `Obsolete Service ${uniqueId}`,
    category: activeCategory._id,
    price: 299,
    priceType: 'fixed',
    isActive: false
  });

  // Start HTTP test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
}

async function teardown() {
  // Clean up all created test records
  await Booking.deleteMany({ customer: customerProfile._id });
  await Service.deleteMany({ _id: { $in: [activeService._id, inactiveService._id] } });
  await Category.deleteMany({ _id: { $in: [activeCategory._id, inactiveCategory._id] } });
  await Provider.deleteMany({ _id: { $in: [provider1Profile._id, provider2Profile._id] } });
  await Customer.deleteMany({ _id: customerProfile._id });
  await User.deleteMany({ _id: { $in: [customerUser._id, provider1User._id, provider2User._id, adminUser._id] } });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
}

// Minimal JSON request helper
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('   PHASE 10 LIVE BOOKING INTEGRATION TEST SUITE     ');
  console.log('====================================================\n');

  await setup();
  console.log('Test environment provisioned with isolated fixtures.\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Unauthenticated booking creation rejected (401)
    const unauth = await request('POST', '/bookings', { serviceId: activeService._id });
    assert(unauth.status === 401, `Unauthenticated booking rejected with 401 (Received: ${unauth.status})`);

    // 2. Providers and admins forbidden from booking as customer (403)
    const provBook = await request('POST', '/bookings', { serviceId: activeService._id }, provider1Token);
    assert(provBook.status === 403, `Provider cannot create customer booking (Status: ${provBook.status})`);

    const adminBook = await request('POST', '/bookings', { serviceId: activeService._id }, adminToken);
    assert(adminBook.status === 403, `Admin cannot create customer booking (Status: ${adminBook.status})`);

    // 3. Inactive service rejected (400)
    const inactServ = await request(
      'POST',
      '/bookings',
      {
        serviceId: inactiveService._id,
        bookingMode: 'instant',
        address: { street: '123 Test Rd', city: 'Mumbai' }
      },
      customerToken
    );
    assert(inactServ.status === 400, `Inactive service booking rejected with 400 (Received: ${inactServ.status})`);

    // 4. Client-supplied price and customer ID override prevented
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    const spoofAttempt = await request(
      'POST',
      '/bookings',
      {
        serviceId: activeService._id,
        bookingMode: 'scheduled',
        address: { street: '456 Hill Road', city: 'Mumbai', zipCode: '400050' },
        scheduledDate: futureDate.toISOString(),
        scheduledTimeSlot: { startTime: '11:00', endTime: '13:00' },
        // Malicious client inputs:
        pricing: { basePrice: 1, totalAmount: 1 },
        customer: provider1User._id,
        status: 'completed'
      },
      customerToken
    );
    assert(spoofAttempt.status === 201, `Scheduled booking successfully created (Status: 201)`);
    assert(
      spoofAttempt.body.data.pricing.basePrice === 499 && spoofAttempt.body.data.pricing.totalAmount === 499,
      `Calculated price from database (499) overrode spoofed client price (1)`
    );
    assert(
      spoofAttempt.body.data.status === 'pending',
      `Booking status initialized to 'pending' instead of client-supplied 'completed'`
    );
    assert(
      spoofAttempt.body.data.bookingReference.startsWith('BK-'),
      `Generated unique booking reference '${spoofAttempt.body.data.bookingReference}'`
    );

    const scheduledBookingId = spoofAttempt.body.data._id;

    // 5. Past scheduled date rejected
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const pastBook = await request(
      'POST',
      '/bookings',
      {
        serviceId: activeService._id,
        bookingMode: 'scheduled',
        address: { street: '456 Hill Road', city: 'Mumbai' },
        scheduledDate: pastDate.toISOString(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' }
      },
      customerToken
    );
    assert(pastBook.status === 400, `Past schedule date rejected with 400 (Status: ${pastBook.status})`);

    // 6. Instant booking created with eligible provider broadcast
    const instantBook = await request(
      'POST',
      '/bookings',
      {
        serviceId: activeService._id,
        bookingMode: 'instant',
        address: { street: '789 Marine Drive', city: 'Mumbai' },
        notes: 'Water pipe leaking under kitchen sink'
      },
      customerToken
    );
    assert(instantBook.status === 201, `Instant booking created (Status: 201)`);
    assert(instantBook.body.data.bookingMode === 'instant', `Booking mode set to 'instant'`);
    assert(instantBook.body.data.provider === null, `Instant broadcast initialized with provider=null`);

    const instantBookingId = instantBook.body.data._id;

    // 7. Customer list and access control
    const custBookings = await request('GET', '/bookings/customer', null, customerToken);
    assert(
      custBookings.status === 200 && custBookings.body.data.length >= 2,
      `Customer lists own bookings (Count: ${custBookings.body.data.length})`
    );

    const custSingle = await request('GET', `/bookings/customer/${instantBookingId}`, null, customerToken);
    assert(custSingle.status === 200, `Customer retrieves single booking details (Status: 200)`);

    // 8. Provider sees instant request in provider requests pool
    const p1Requests = await request('GET', '/bookings/provider/requests', null, provider1Token);
    assert(
      p1Requests.status === 200 && p1Requests.body.data.some((b) => b._id === instantBookingId),
      `Provider 1 discovers pending instant booking in request pool`
    );

    const p2Requests = await request('GET', '/bookings/provider/requests', null, provider2Token);
    assert(
      p2Requests.status === 200 && p2Requests.body.data.some((b) => b._id === instantBookingId),
      `Provider 2 also discovers the instant booking in request pool`
    );

    // 9. Concurrency test: Provider 1 and Provider 2 attempt to accept the SAME instant booking
    const [p1AcceptRes, p2AcceptRes] = await Promise.all([
      request('PATCH', `/bookings/provider/${instantBookingId}/accept`, {}, provider1Token),
      request('PATCH', `/bookings/provider/${instantBookingId}/accept`, {}, provider2Token)
    ]);

    const oneSucceeded = (p1AcceptRes.status === 200 && p2AcceptRes.status === 409) ||
                         (p2AcceptRes.status === 200 && p1AcceptRes.status === 409);
    assert(
      oneSucceeded,
      `Atomic concurrency protection: Exactly one provider accepted (P1: ${p1AcceptRes.status}, P2: ${p2AcceptRes.status})`
    );

    const winningProviderToken = p1AcceptRes.status === 200 ? provider1Token : provider2Token;
    const losingProviderToken = p1AcceptRes.status === 200 ? provider2Token : provider1Token;

    // 10. Losing provider cannot view or modify winning provider's assigned booking
    const losingStart = await request('PATCH', `/bookings/provider/${instantBookingId}/start`, {}, losingProviderToken);
    assert(losingStart.status === 403, `Unassigned provider cannot start service (Status: ${losingStart.status})`);

    // 11. State Machine: Invalid transition (accepted -> completed without in_progress)
    const badComplete = await request('PATCH', `/bookings/provider/${instantBookingId}/complete`, {}, winningProviderToken);
    assert(badComplete.status === 400, `Rejects invalid transition from 'accepted' directly to 'completed' (Status: ${badComplete.status})`);

    // 12. State Machine: Winning provider starts service (accepted -> in_progress)
    const startRes = await request('PATCH', `/bookings/provider/${instantBookingId}/start`, {}, winningProviderToken);
    assert(startRes.status === 200 && startRes.body.data.status === 'in_progress', `Service marked 'in_progress' with timestamp`);

    // 13. Customer cannot cancel service when already in_progress
    const badCancel = await request('PATCH', `/bookings/customer/${instantBookingId}/cancel`, { cancellationReason: 'Changed mind' }, customerToken);
    assert(badCancel.status === 400, `Customer cannot cancel service in_progress (Status: ${badCancel.status})`);

    // 14. Provider completes service (in_progress -> completed)
    const completeRes = await request('PATCH', `/bookings/provider/${instantBookingId}/complete`, {}, winningProviderToken);
    assert(completeRes.status === 200 && completeRes.body.data.status === 'completed', `Service completed successfully (Status: 200)`);

    // 15. Customer cancels scheduled booking (pending -> cancelled)
    const cancelRes = await request('PATCH', `/bookings/customer/${scheduledBookingId}/cancel`, { cancellationReason: 'Postponing work' }, customerToken);
    assert(
      cancelRes.status === 200 && cancelRes.body.data.status === 'cancelled',
      `Customer cancelled pending scheduled booking (Status: 200)`
    );

    // 16. Admin oversees all bookings with pagination and filters
    const adminList = await request('GET', '/bookings/admin?status=completed', null, adminToken);
    assert(
      adminList.status === 200 && adminList.body.data.some((b) => b._id === instantBookingId),
      `Admin retrieves completed bookings list (Count: ${adminList.body.data.length})`
    );

    const adminDetail = await request('GET', `/bookings/admin/${instantBookingId}`, null, adminToken);
    assert(
      adminDetail.status === 200 && adminDetail.body.data.bookingReference,
      `Admin inspects booking detail with customer, provider, and pricing metadata`
    );
  } finally {
    await teardown();
    console.log('\nTest environment safely torn down.');
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
