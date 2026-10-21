const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Admin = require('./src/models/Admin');
const Customer = require('./src/models/Customer');
const Provider = require('./src/models/Provider');
const Category = require('./src/models/Category');
const Service = require('./src/models/Service');
const Booking = require('./src/models/Booking');
const Review = require('./src/models/Review');
const ServiceArea = require('./src/models/ServiceArea');
const { generateToken } = require('./src/utils/jwt');
const { hashPassword } = require('./src/services/authService');
const { connectDB, disconnectDB } = require('./src/config/db');

function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runAllModulesIntegrationTests() {
  console.log('=== STARTING ALL-MODULES ADMIN INTEGRATION TESTS ===\n');

  if (!process.env.MONGODB_URI) {
    console.error('FAIL: MONGODB_URI not configured in .env');
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('FAIL: Could not connect to MongoDB');
    process.exit(1);
  }

  const testPort = 5096;
  const server = app.listen(testPort);

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failCount++;
    }
  }

  const createdUserIds = [];
  const createdCustomerIds = [];
  const createdProviderIds = [];
  const createdCategoryIds = [];
  const createdServiceIds = [];
  const createdBookingIds = [];
  const createdReviewIds = [];
  const createdServiceAreaIds = [];

  try {
    const runId = Date.now();
    const hashedPassword = await hashPassword('TestPassword@123');

    // 1. Setup Admin Account
    const adminUser = await User.create({
      name: `FullMod Admin ${runId}`,
      email: `admin.full.${runId}@example.com`,
      phone: `9300${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(adminUser._id);

    await Admin.create({
      user: adminUser._id,
      permissions: ['manage_users', 'manage_providers', 'manage_categories', 'manage_services', 'manage_bookings', 'manage_reviews', 'manage_reports', 'super_admin']
    });

    const adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    // 2. Setup Customer & Provider
    const customerUser = await User.create({
      name: `FullMod Cust ${runId}`,
      email: `cust.full.${runId}@example.com`,
      phone: `9301${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(customerUser._id);

    const customerProfile = await Customer.create({
      user: customerUser._id,
      addresses: [{ street: '101 Pine St', city: 'Pune', zipCode: '411001' }]
    });
    createdCustomerIds.push(customerProfile._id);

    const customerToken = generateToken({
      userId: customerUser._id,
      email: customerUser.email,
      role: customerUser.role
    });

    const cat = await Category.create({
      name: `FullMod Cat ${runId}`,
      slug: `fm-cat-${runId}`,
      isActive: true
    });
    createdCategoryIds.push(cat._id);

    const providerUser = await User.create({
      name: `FullMod Prov ${runId}`,
      email: `prov.full.${runId}@example.com`,
      phone: `9302${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'provider',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(providerUser._id);

    const providerProfile = await Provider.create({
      user: providerUser._id,
      businessName: `FullMod Agency ${runId}`,
      categories: [cat._id],
      verificationStatus: 'verified',
      isAvailable: true
    });
    createdProviderIds.push(providerProfile._id);

    const service = await Service.create({
      name: `Premium Plumbing Repair ${runId}`,
      category: cat._id,
      provider: providerProfile._id,
      price: 500,
      isActive: true
    });
    createdServiceIds.push(service._id);

    const booking = await Booking.create({
      bookingReference: `BK-FM-${runId}`,
      customer: customerProfile._id,
      provider: providerProfile._id,
      service: service._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '11:00 AM', endTime: '01:00 PM' },
      status: 'completed',
      address: { street: '101 Pine St', city: 'Pune', zipCode: '411001' },
      pricing: { basePrice: 500, tax: 0, discount: 0, totalAmount: 500 },
      paymentStatus: 'paid',
      paymentMethod: 'online'
    });
    createdBookingIds.push(booking._id);

    const review = await Review.create({
      booking: booking._id,
      customer: customerProfile._id,
      provider: providerProfile._id,
      service: service._id,
      rating: 5,
      comment: `Flawless execution by ${providerProfile.businessName}`
    });
    createdReviewIds.push(review._id);

    console.log(`Created baseline test entities for full module tests.\n`);

    // --- REVIEWS MODULE TESTS ---
    // Test 1: Unauthenticated Reviews rejected
    const unauthReviewRes = await makeRequest(testPort, 'GET', '/api/reviews/admin');
    assert(unauthReviewRes.status === 401, 'TEST 1.1: Unauthenticated GET /api/reviews/admin rejected (401)');

    // Test 2: Non-admin Reviews rejected (403)
    const nonAdminReviewRes = await makeRequest(
      testPort,
      'GET',
      '/api/reviews/admin',
      { Authorization: `Bearer ${customerToken}` }
    );
    assert(nonAdminReviewRes.status === 403, 'TEST 1.2: Customer GET /api/reviews/admin rejected (403)');

    // Test 3: Admin Reviews list & score breakdown
    const adminReviewsRes = await makeRequest(
      testPort,
      'GET',
      '/api/reviews/admin',
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminReviewsRes.status === 200, 'TEST 1.3: Admin GET /api/reviews/admin returns HTTP 200');
    assert(adminReviewsRes.body?.success === true, 'TEST 1.4: Response success === true');
    assert(adminReviewsRes.body?.data?.some(r => r._id.toString() === review._id.toString()),
      'TEST 1.5: Review retrieved with customer & provider populated');
    assert(adminReviewsRes.body?.stats?.distribution[5] >= 1,
      'TEST 1.6: Rating stats distribution calculated correctly');

    // Test 4: Admin Toggle Review visibility (hide & restore)
    const hideReviewRes = await makeRequest(
      testPort,
      'PATCH',
      `/api/reviews/admin/${review._id}/visibility`,
      { Authorization: `Bearer ${adminToken}` },
      { isPublic: false }
    );
    assert(hideReviewRes.status === 200, 'TEST 1.7: PATCH /api/reviews/admin/:id/visibility returns HTTP 200');
    assert(hideReviewRes.body?.data?.isPublic === false, 'TEST 1.8: Review isPublic updated to false');

    // --- SERVICE AREAS MODULE TESTS ---
    // Test 5: Unauthenticated Locations rejected
    const unauthLocRes = await makeRequest(testPort, 'GET', '/api/locations/admin');
    assert(unauthLocRes.status === 401, 'TEST 2.1: Unauthenticated GET /api/locations/admin rejected (401)');

    // Test 6: Admin creates new service area
    const createAreaRes = await makeRequest(
      testPort,
      'POST',
      '/api/locations/admin',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Pune Central Zone ${runId}`,
        city: 'Pune',
        state: 'Maharashtra',
        zipCodes: ['411001', '411002'],
        isActive: true
      }
    );
    assert(createAreaRes.status === 201, 'TEST 2.2: Admin POST /api/locations/admin returns HTTP 201');
    const createdAreaId = createAreaRes.body?.data?._id;
    if (createdAreaId) createdServiceAreaIds.push(createdAreaId);
    assert(createAreaRes.body?.data?.city === 'Pune', 'TEST 2.3: Area city persisted correctly in MongoDB');

    // Test 7: Admin lists service areas
    const listAreasRes = await makeRequest(
      testPort,
      'GET',
      '/api/locations/admin',
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(listAreasRes.status === 200, 'TEST 2.4: Admin GET /api/locations/admin returns HTTP 200');
    assert(listAreasRes.body?.data?.some(a => a._id.toString() === createdAreaId),
      'TEST 2.5: Created service area returned in directory');

    // Test 8: Admin updates and toggles service area status
    const toggleAreaRes = await makeRequest(
      testPort,
      'PATCH',
      `/api/locations/admin/${createdAreaId}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isActive: false }
    );
    assert(toggleAreaRes.status === 200, 'TEST 2.6: Toggle location status returns HTTP 200');
    assert(toggleAreaRes.body?.data?.isActive === false, 'TEST 2.7: Area isActive set to false');

    // --- REPORTS MODULE TESTS ---
    // Test 9: Unauthenticated Reports rejected
    const unauthRepRes = await makeRequest(testPort, 'GET', '/api/reports/admin');
    assert(unauthRepRes.status === 401, 'TEST 3.1: Unauthenticated GET /api/reports/admin rejected (401)');

    // Test 10: Admin GET Reports with 7d, 30d, 90d periods
    const rep30dRes = await makeRequest(
      testPort,
      'GET',
      '/api/reports/admin?period=30d',
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(rep30dRes.status === 200, 'TEST 3.2: Admin GET /api/reports/admin?period=30d returns HTTP 200');
    assert(rep30dRes.body?.success === true, 'TEST 3.3: Reports response success === true');
    assert(rep30dRes.body?.data?.revenue?.grossTransactionValue >= 500,
      'TEST 3.4: Gross transaction revenue aggregated correctly');
    assert(rep30dRes.body?.data?.revenue?.estimatedCommission === Math.round(rep30dRes.body?.data?.revenue?.grossTransactionValue * 0.15),
      'TEST 3.5: Platform commission accurately calculated (15%)');
    assert(rep30dRes.body?.data?.bookings?.completed >= 1,
      'TEST 3.6: Completed bookings count aggregated correctly');
    assert(rep30dRes.body?.data?.providers?.total >= 1,
      'TEST 3.7: Provider network totals aggregated correctly');

  } catch (err) {
    console.error('Unhandled test execution error:', err);
    failCount++;
  } finally {
    console.log('\n--- Cleaning up test records ---');
    if (createdReviewIds.length > 0) {
      await Review.deleteMany({ _id: { $in: createdReviewIds } });
    }
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (createdServiceAreaIds.length > 0) {
      await ServiceArea.deleteMany({ _id: { $in: createdServiceAreaIds } });
    }
    if (createdServiceIds.length > 0) {
      await Service.deleteMany({ _id: { $in: createdServiceIds } });
    }
    if (createdCategoryIds.length > 0) {
      await Category.deleteMany({ _id: { $in: createdCategoryIds } });
    }
    if (createdCustomerIds.length > 0) {
      await Customer.deleteMany({ _id: { $in: createdCustomerIds } });
    }
    if (createdProviderIds.length > 0) {
      await Provider.deleteMany({ _id: { $in: createdProviderIds } });
    }
    if (createdUserIds.length > 0) {
      await Admin.deleteMany({ user: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await disconnectDB();
    server.close();

    console.log(`\n==================================================`);
    console.log(`TOTAL TESTS RUN: ${passCount + failCount}`);
    console.log(`PASSED: ${passCount}`);
    console.log(`FAILED: ${failCount}`);
    console.log(`==================================================\n`);

    if (failCount > 0) {
      process.exit(1);
    }
  }
}

runAllModulesIntegrationTests();
