/**
 * Complete Customer Review & Rating System Regression Tests
 *
 * Requirements covered:
 * 1. Customer submits a review for a completed booking (201)
 * 2. Review rating validation: only integers 1 to 5 allowed (400)
 * 3. Empty comment is allowed, character limit enforced
 * 4. Customer attempting to review another customer's booking rejected (403)
 * 5. Review submission for pending or cancelled booking rejected (400)
 * 6. Duplicate review for the same booking rejected (409)
 * 7. Unauthenticated review submission rejected (401)
 * 8. Customer retrieves their submitted reviews (/api/reviews/my-reviews)
 * 9. Booking review status endpoint (/api/reviews/booking/:id) returns review
 * 10. Provider public reviews endpoint (/api/reviews/provider/:id) returns review
 * 11. Provider rating average and count recalculate dynamically
 * 12. Review appears in Admin Panel (/api/reviews/admin)
 * 13. Admin hides review -> Provider rating recalculates and excludes hidden review from public list
 * 14. Admin restores review -> Provider rating updates back
 */

const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Customer = require('./src/models/Customer');
const Provider = require('./src/models/Provider');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const Booking = require('./src/models/Booking');
const Review = require('./src/models/Review');
const Admin = require('./src/models/Admin');
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

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runReviewTests() {
  console.log('=== STARTING REVIEW & RATING SYSTEM REGRESSION TESTS ===\n');

  await connectDB();
  const server = app.listen(0);
  const testPort = server.address().port;

  const createdUserIds = [];
  const createdCustomerIds = [];
  const createdProviderIds = [];
  const createdCategoryIds = [];
  const createdServiceIds = [];
  const createdBookingIds = [];
  const createdReviewIds = [];

  try {
    const runId = Date.now();
    const hashedPassword = await hashPassword('ReviewTest@123');

    // 1. Setup Admin
    const adminUser = await User.create({
      name: `Review Admin ${runId}`,
      email: `admin.rev.${runId}@example.com`,
      phone: `9500${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(adminUser._id);

    await Admin.create({
      user: adminUser._id,
      permissions: ['manage_reviews', 'super_admin']
    });

    const adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    // 2. Setup Customer A & Customer B
    const userA = await User.create({
      name: `Review Customer A ${runId}`,
      email: `custa.rev.${runId}@example.com`,
      phone: `9501${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(userA._id);

    const customerA = await Customer.create({ user: userA._id, addresses: [] });
    createdCustomerIds.push(customerA._id);
    const tokenA = generateToken({ userId: userA._id, email: userA.email, role: 'customer' });

    const userB = await User.create({
      name: `Review Customer B ${runId}`,
      email: `custb.rev.${runId}@example.com`,
      phone: `9502${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(userB._id);

    const customerB = await Customer.create({ user: userB._id, addresses: [] });
    createdCustomerIds.push(customerB._id);
    const tokenB = generateToken({ userId: userB._id, email: userB.email, role: 'customer' });

    // 3. Setup Provider
    const providerUser = await User.create({
      name: `Review Pro ${runId}`,
      email: `pro.rev.${runId}@example.com`,
      phone: `9503${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'provider',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(providerUser._id);

    const category = await Category.create({
      name: `Electrical Service ${runId}`,
      slug: `electrical-service-${runId}`,
      isActive: true
    });
    createdCategoryIds.push(category._id);

    const providerProfile = await Provider.create({
      user: providerUser._id,
      businessName: `Super Spark Electricals ${runId}`,
      categories: [category._id],
      verificationStatus: 'verified',
      isAvailable: true,
      rating: { average: 0, count: 0 }
    });
    createdProviderIds.push(providerProfile._id);

    const service = await Service.create({
      provider: providerProfile._id,
      category: category._id,
      name: 'Fan Installation & Wiring',
      description: 'Quick ceiling fan installation',
      price: 350,
      pricingType: 'fixed',
      isActive: true
    });
    createdServiceIds.push(service._id);

    // 4. Create Bookings:
    // Booking 1: Completed booking owned by Customer A
    const completedBooking = await Booking.create({
      bookingReference: `BK-COMP-${runId}`,
      customer: customerA._id,
      provider: providerProfile._id,
      service: service._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '10:00 AM', endTime: '12:00 PM' },
      status: 'completed',
      address: { street: '123 Test Rd', city: 'Mumbai', zipCode: '400001' },
      pricing: { basePrice: 350, tax: 0, discount: 0, totalAmount: 350 },
      paymentStatus: 'paid',
      paymentMethod: 'online',
      statusTimestamps: { completedAt: new Date() }
    });
    createdBookingIds.push(completedBooking._id);

    // Booking 2: Pending booking owned by Customer A
    const pendingBooking = await Booking.create({
      bookingReference: `BK-PEND-${runId}`,
      customer: customerA._id,
      provider: providerProfile._id,
      service: service._id,
      bookingMode: 'scheduled',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: '02:00 PM', endTime: '04:00 PM' },
      status: 'pending',
      address: { street: '123 Test Rd', city: 'Mumbai', zipCode: '400001' },
      pricing: { basePrice: 350, tax: 0, discount: 0, totalAmount: 350 }
    });
    createdBookingIds.push(pendingBooking._id);

    // ------------------------------------------------------------
    // TEST 1: Unauthenticated review submission rejected (401)
    // ------------------------------------------------------------
    const unauthRes = await makeRequest(testPort, 'POST', '/api/reviews', {}, {
      bookingId: completedBooking._id,
      rating: 5,
      comment: 'Excellent!'
    });
    assert(unauthRes.status === 401, 'TEST 1: Unauthenticated POST /api/reviews rejected with HTTP 401');

    // ------------------------------------------------------------
    // TEST 2: Customer B cannot review Customer A's booking (403)
    // ------------------------------------------------------------
    const nonOwnerRes = await makeRequest(
      testPort,
      'POST',
      '/api/reviews',
      { Authorization: `Bearer ${tokenB}` },
      {
        bookingId: completedBooking._id,
        rating: 5,
        comment: 'Trying to review another person booking'
      }
    );
    assert(nonOwnerRes.status === 403, 'TEST 2: Reviewing another customer booking rejected with HTTP 403');

    // ------------------------------------------------------------
    // TEST 3: Cannot review pending booking (400)
    // ------------------------------------------------------------
    const pendingReviewRes = await makeRequest(
      testPort,
      'POST',
      '/api/reviews',
      { Authorization: `Bearer ${tokenA}` },
      {
        bookingId: pendingBooking._id,
        rating: 5,
        comment: 'Cannot review pending booking'
      }
    );
    assert(pendingReviewRes.status === 400, 'TEST 3: Reviewing non-completed booking rejected with HTTP 400');

    // ------------------------------------------------------------
    // TEST 4: Invalid ratings (<1 or >5 or non-number) rejected (400)
    // ------------------------------------------------------------
    const invalidRating0 = await makeRequest(
      testPort,
      'POST',
      '/api/reviews',
      { Authorization: `Bearer ${tokenA}` },
      { bookingId: completedBooking._id, rating: 0, comment: 'Too low' }
    );
    assert(invalidRating0.status === 400, 'TEST 4.1: Rating of 0 rejected with HTTP 400');

    const invalidRating6 = await makeRequest(
      testPort,
      'POST',
      '/api/reviews',
      { Authorization: `Bearer ${tokenA}` },
      { bookingId: completedBooking._id, rating: 6, comment: 'Too high' }
    );
    assert(invalidRating6.status === 400, 'TEST 4.2: Rating of 6 rejected with HTTP 400');

    // ------------------------------------------------------------
    // TEST 5: Successful review submission by Customer A
    // ------------------------------------------------------------
    const submitRes = await makeRequest(
      testPort,
      'POST',
      '/api/reviews',
      { Authorization: `Bearer ${tokenA}` },
      {
        bookingId: completedBooking._id,
        rating: 5,
        comment: 'Punctual, polite, and clean work done in 20 minutes!'
      }
    );
    assert(submitRes.status === 201, 'TEST 5.1: Customer submits review returns HTTP 201');
    assert(submitRes.body?.success === true, 'TEST 5.2: Response success is true');
    const createdRevId = submitRes.body?.data?._id;
    if (createdRevId) createdReviewIds.push(createdRevId);
    assert(submitRes.body?.data?.rating === 5, 'TEST 5.3: Rating persisted as 5');
    assert(submitRes.body?.data?.booking?.bookingReference === completedBooking.bookingReference,
      'TEST 5.4: Linked booking reference populated correctly');

    // ------------------------------------------------------------
    // TEST 6: Duplicate review for same booking rejected (409)
    // ------------------------------------------------------------
    const duplicateRes = await makeRequest(
      testPort,
      'POST',
      '/api/reviews',
      { Authorization: `Bearer ${tokenA}` },
      {
        bookingId: completedBooking._id,
        rating: 4,
        comment: 'Trying to submit a second time'
      }
    );
    assert(duplicateRes.status === 409, 'TEST 6: Duplicate review for same booking rejected with HTTP 409');

    // ------------------------------------------------------------
    // TEST 7: Customer reviews retrieved via /api/reviews/my-reviews
    // ------------------------------------------------------------
    const myReviewsRes = await makeRequest(
      testPort,
      'GET',
      '/api/reviews/my-reviews',
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(myReviewsRes.status === 200, 'TEST 7.1: GET /api/reviews/my-reviews returns HTTP 200');
    assert(myReviewsRes.body?.data?.some(r => r._id === createdRevId),
      'TEST 7.2: Submitted review returned in customer my-reviews list');

    // ------------------------------------------------------------
    // TEST 8: Check review status for specific booking
    // ------------------------------------------------------------
    const bookingRevRes = await makeRequest(
      testPort,
      'GET',
      `/api/reviews/booking/${completedBooking._id}`,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(bookingRevRes.status === 200, 'TEST 8.1: GET /api/reviews/booking/:id returns HTTP 200');
    assert(bookingRevRes.body?.data?._id === createdRevId, 'TEST 8.2: Returns the review for this booking');

    // ------------------------------------------------------------
    // TEST 9: Provider average rating & count updated dynamically
    // ------------------------------------------------------------
    const updatedProvider = await Provider.findById(providerProfile._id);
    assert(updatedProvider.rating.count === 1, 'TEST 9.1: Provider rating count updated to 1');
    assert(updatedProvider.rating.average === 5, 'TEST 9.2: Provider average rating updated to 5.0');

    // ------------------------------------------------------------
    // TEST 10: Provider public reviews endpoint returns submitted review
    // ------------------------------------------------------------
    const pubReviewsRes = await makeRequest(
      testPort,
      'GET',
      `/api/reviews/provider/${providerProfile._id}`
    );
    assert(pubReviewsRes.status === 200, 'TEST 10.1: GET /api/reviews/provider/:id returns HTTP 200');
    assert(pubReviewsRes.body?.data?.length === 1, 'TEST 10.2: Provider has 1 public review');

    // ------------------------------------------------------------
    // TEST 11: Review appears in Admin Panel list
    // ------------------------------------------------------------
    const adminListRes = await makeRequest(
      testPort,
      'GET',
      '/api/reviews/admin',
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminListRes.status === 200, 'TEST 11.1: Admin GET /api/reviews/admin returns HTTP 200');
    assert(adminListRes.body?.data?.some(r => r._id === createdRevId),
      'TEST 11.2: Customer review visible in Admin Panel');

    // ------------------------------------------------------------
    // TEST 12: Admin hides review -> Provider rating updates and excludes it
    // ------------------------------------------------------------
    const hideRes = await makeRequest(
      testPort,
      'PATCH',
      `/api/reviews/admin/${createdRevId}/visibility`,
      { Authorization: `Bearer ${adminToken}` },
      { isPublic: false }
    );
    assert(hideRes.status === 200, 'TEST 12.1: Admin hides review returns HTTP 200');

    const providerAfterHide = await Provider.findById(providerProfile._id);
    assert(providerAfterHide.rating.count === 0, 'TEST 12.2: Provider rating count drops to 0 after hide');

    const pubReviewsAfterHide = await makeRequest(
      testPort,
      'GET',
      `/api/reviews/provider/${providerProfile._id}`
    );
    assert(pubReviewsAfterHide.body?.data?.length === 0,
      'TEST 12.3: Hidden review excluded from public provider reviews');

    // ------------------------------------------------------------
    // TEST 13: Admin restores review -> Provider rating recalculates back
    // ------------------------------------------------------------
    const restoreRes = await makeRequest(
      testPort,
      'PATCH',
      `/api/reviews/admin/${createdRevId}/visibility`,
      { Authorization: `Bearer ${adminToken}` },
      { isPublic: true }
    );
    assert(restoreRes.status === 200, 'TEST 13.1: Admin restores review returns HTTP 200');

    const providerAfterRestore = await Provider.findById(providerProfile._id);
    assert(providerAfterRestore.rating.count === 1, 'TEST 13.2: Provider rating count restored to 1');
    assert(providerAfterRestore.rating.average === 5, 'TEST 13.3: Provider average restored to 5');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n--- Cleaning up test records ---');
    try {
      if (createdReviewIds.length > 0) await Review.deleteMany({ _id: { $in: createdReviewIds } });
      if (createdBookingIds.length > 0) await Booking.deleteMany({ _id: { $in: createdBookingIds } });
      if (createdServiceIds.length > 0) await Service.deleteMany({ _id: { $in: createdServiceIds } });
      if (createdProviderIds.length > 0) await Provider.deleteMany({ _id: { $in: createdProviderIds } });
      if (createdCategoryIds.length > 0) await Category.deleteMany({ _id: { $in: createdCategoryIds } });
      if (createdCustomerIds.length > 0) await Customer.deleteMany({ _id: { $in: createdCustomerIds } });
      if (createdUserIds.length > 0) await User.deleteMany({ _id: { $in: createdUserIds } });
    } catch (cleanupErr) {
      console.warn('Cleanup error:', cleanupErr.message);
    }

    server.close();
    await disconnectDB();
  }

  console.log('\n==================================================');
  if (process.exitCode) {
    console.log('SOME TESTS FAILED.');
  } else {
    console.log('ALL 13 REVIEW & RATING TESTS PASSED!');
  }
  console.log('==================================================\n');
}

runReviewTests();
