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

async function runBookingManagementTests() {
  console.log('=== STARTING ADMIN BOOKING MANAGEMENT TESTS ===\n');

  if (!process.env.MONGODB_URI) {
    console.error('FAIL: MONGODB_URI not configured in .env');
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('FAIL: Could not connect to MongoDB');
    process.exit(1);
  }

  const testPort = 5097;
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

  try {
    const runId = Date.now();
    const hashedPassword = await hashPassword('TestPassword@123');

    // 1. Setup Admin Account
    const adminUser = await User.create({
      name: `Booking Admin ${runId}`,
      email: `admin.bk.${runId}@example.com`,
      phone: `9200${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(adminUser._id);

    await Admin.create({
      user: adminUser._id,
      permissions: ['manage_users', 'manage_providers', 'manage_bookings', 'super_admin']
    });

    const adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    // 2. Setup Non-Admin (Customer)
    const customerUser = await User.create({
      name: `Booking Cust ${runId}`,
      email: `cust.bk.${runId}@example.com`,
      phone: `9201${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(customerUser._id);

    const customerProfile = await Customer.create({
      user: customerUser._id,
      addresses: [{ street: '456 Ocean Ave', city: 'Metropolis', zipCode: '10001' }]
    });
    createdCustomerIds.push(customerProfile._id);

    const customerToken = generateToken({
      userId: customerUser._id,
      email: customerUser.email,
      role: customerUser.role
    });

    // 3. Setup Provider, Category, Service
    const cat = await Category.create({
      name: `Booking Cat ${runId}`,
      slug: `bk-cat-${runId}`,
      isActive: true
    });
    createdCategoryIds.push(cat._id);

    const providerUser = await User.create({
      name: `Booking Prov ${runId}`,
      email: `prov.bk.${runId}@example.com`,
      phone: `9202${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'provider',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(providerUser._id);

    const providerProfile = await Provider.create({
      user: providerUser._id,
      businessName: `Star Services ${runId}`,
      categories: [cat._id],
      verificationStatus: 'verified',
      isAvailable: true
    });
    createdProviderIds.push(providerProfile._id);

    const service = await Service.create({
      name: `Deep Cleaning Pro ${runId}`,
      category: cat._id,
      provider: providerProfile._id,
      price: 299,
      isActive: true
    });
    createdServiceIds.push(service._id);

    // 4. Setup Sample Bookings (1 completed, 1 pending)
    const booking1 = await Booking.create({
      bookingReference: `BK-COMP-${runId}`,
      customer: customerProfile._id,
      provider: providerProfile._id,
      service: service._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00 AM', endTime: '12:00 PM' },
      status: 'completed',
      address: { street: '456 Ocean Ave', city: 'Metropolis', zipCode: '10001' },
      pricing: { basePrice: 299, tax: 0, discount: 0, totalAmount: 299 },
      paymentStatus: 'paid',
      paymentMethod: 'online',
      paymentDetails: {
        razorpayOrderId: `order_${runId}`,
        razorpayPaymentId: `pay_${runId}`,
        paidAt: new Date()
      },
      statusTimestamps: {
        acceptedAt: new Date(),
        inProgressAt: new Date(),
        completedAt: new Date()
      }
    });
    createdBookingIds.push(booking1._id);

    const review = await Review.create({
      booking: booking1._id,
      customer: customerProfile._id,
      provider: providerProfile._id,
      service: service._id,
      rating: 5,
      comment: 'Superb service, highly recommend!'
    });
    createdReviewIds.push(review._id);

    const booking2 = await Booking.create({
      bookingReference: `BK-PEND-${runId}`,
      customer: customerProfile._id,
      provider: providerProfile._id,
      service: service._id,
      bookingMode: 'instant',
      status: 'pending',
      address: { street: '456 Ocean Ave', city: 'Metropolis', zipCode: '10001' },
      pricing: { basePrice: 299, tax: 0, discount: 0, totalAmount: 299 },
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    });
    createdBookingIds.push(booking2._id);

    console.log(`Created baseline test entities for Booking Management tests.\n`);

    // --- TEST 1: Unauthenticated access rejected ---
    const unauthRes = await makeRequest(testPort, 'GET', '/api/bookings/admin');
    assert(unauthRes.status === 401, 'TEST 1.1: Unauthenticated GET /api/bookings/admin returns HTTP 401');

    const unauthStatsRes = await makeRequest(testPort, 'GET', '/api/bookings/admin/stats');
    assert(unauthStatsRes.status === 401, 'TEST 1.2: Unauthenticated GET /api/bookings/admin/stats returns HTTP 401');

    // --- TEST 2: Non-admin access rejected (403) ---
    const nonAdminRes = await makeRequest(
      testPort,
      'GET',
      '/api/bookings/admin',
      { Authorization: `Bearer ${customerToken}` }
    );
    assert(nonAdminRes.status === 403, 'TEST 2.1: Non-admin GET /api/bookings/admin returns HTTP 403 Forbidden');

    const nonAdminStatsRes = await makeRequest(
      testPort,
      'GET',
      '/api/bookings/admin/stats',
      { Authorization: `Bearer ${customerToken}` }
    );
    assert(nonAdminStatsRes.status === 403, 'TEST 2.2: Non-admin GET /api/bookings/admin/stats returns HTTP 403 Forbidden');

    // --- TEST 3: Admin GET /api/bookings/admin/stats returns live aggregated metrics ---
    const statsRes = await makeRequest(
      testPort,
      'GET',
      '/api/bookings/admin/stats',
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(statsRes.status === 200, 'TEST 3.1: Admin GET /api/bookings/admin/stats returns HTTP 200');
    assert(statsRes.body?.success === true, 'TEST 3.2: Stats response success === true');
    assert(statsRes.body?.data?.total >= 2, 'TEST 3.3: Total bookings count aggregated correctly');
    assert(statsRes.body?.data?.completed >= 1, 'TEST 3.4: Completed bookings count aggregated correctly');
    assert(statsRes.body?.data?.pending >= 1, 'TEST 3.5: Pending bookings count aggregated correctly');
    assert(statsRes.body?.data?.totalRevenue >= 299, 'TEST 3.6: Total verified revenue aggregated correctly');

    // --- TEST 4: Admin GET /api/bookings/admin list and pagination ---
    const listRes = await makeRequest(
      testPort,
      'GET',
      '/api/bookings/admin',
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(listRes.status === 200, 'TEST 4.1: Admin GET /api/bookings/admin returns HTTP 200');
    assert(listRes.body?.success === true, 'TEST 4.2: List response success === true');
    assert(Array.isArray(listRes.body?.data), 'TEST 4.3: Response data is array of bookings');
    assert(listRes.body?.pagination?.total >= 2, 'TEST 4.4: Pagination total count present');

    // --- TEST 5: Search and filters ---
    // Search by reference
    const searchRefRes = await makeRequest(
      testPort,
      'GET',
      `/api/bookings/admin?search=${booking1.bookingReference}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(searchRefRes.status === 200, 'TEST 5.1: Search by bookingReference returns HTTP 200');
    assert(searchRefRes.body?.data?.some(b => b.bookingReference === booking1.bookingReference),
      'TEST 5.2: Specific booking found by reference');

    // Search by Customer Name
    const searchCustRes = await makeRequest(
      testPort,
      'GET',
      `/api/bookings/admin?search=${encodeURIComponent(customerUser.name)}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(searchCustRes.body?.data?.length >= 2, 'TEST 5.3: Filter by customer name matches bookings');

    // Filter by status=completed
    const statusFilterRes = await makeRequest(
      testPort,
      'GET',
      `/api/bookings/admin?status=completed`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(statusFilterRes.body?.data?.every(b => b.status === 'completed'),
      'TEST 5.4: Status filter only returns completed bookings');

    // Filter by paymentStatus=paid
    const paymentFilterRes = await makeRequest(
      testPort,
      'GET',
      `/api/bookings/admin?paymentStatus=paid`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(paymentFilterRes.body?.data?.every(b => b.paymentStatus === 'paid'),
      'TEST 5.5: Payment status filter only returns paid bookings');

    // --- TEST 6: Get Single Booking Details (with linked review and populated categories) ---
    const detailRes = await makeRequest(
      testPort,
      'GET',
      `/api/bookings/admin/${booking1._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(detailRes.status === 200, 'TEST 6.1: Admin GET /api/bookings/admin/:id returns HTTP 200');
    assert(detailRes.body?.data?.bookingReference === booking1.bookingReference,
      'TEST 6.2: Booking reference matches in detail view');
    assert(detailRes.body?.data?.service?.category?.name === cat.name,
      'TEST 6.3: Service category populated in detail view');
    assert(detailRes.body?.data?.review?.rating === 5,
      'TEST 6.4: Review rating populated in detail view');

    // Non-existent booking ID returns 404
    const fakeId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await makeRequest(
      testPort,
      'GET',
      `/api/bookings/admin/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundRes.status === 404, 'TEST 6.5: Non-existent booking returns HTTP 404');

    // --- TEST 7: Supervised Administrative Cancellation ---
    const cancelRes = await makeRequest(
      testPort,
      'PATCH',
      `/api/bookings/admin/${booking2._id}/cancel`,
      { Authorization: `Bearer ${adminToken}` },
      { cancellationReason: 'Customer requested admin assistance to cancel dispatch' }
    );
    assert(cancelRes.status === 200, 'TEST 7.1: Supervised admin cancellation returns HTTP 200');
    assert(cancelRes.body?.data?.status === 'cancelled',
      'TEST 7.2: Booking status updated to cancelled');
    assert(cancelRes.body?.data?.cancelledBy === 'admin',
      'TEST 7.3: cancelledBy recorded as admin');

    // Cannot cancel already completed booking
    const cancelCompletedRes = await makeRequest(
      testPort,
      'PATCH',
      `/api/bookings/admin/${booking1._id}/cancel`,
      { Authorization: `Bearer ${adminToken}` },
      { cancellationReason: 'Try cancel completed' }
    );
    assert(cancelCompletedRes.status === 400, 'TEST 7.4: Cannot cancel completed booking (HTTP 400)');

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

runBookingManagementTests();
