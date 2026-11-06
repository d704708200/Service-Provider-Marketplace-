/**
 * AUTOMATED TEST SUITE:
 * Provider Reviews & Ratings Backend Integration
 * 
 * Verifies:
 * 1. Fetching reviews strictly for the authenticated provider (no cross-provider leaks).
 * 2. Accurate aggregate calculation of average rating and star distribution from actual DB records.
 * 3. Star rating filtering (5★, 4★, 3★, 2★, 1★).
 * 4. Pagination and metadata (page, limit, totalPages).
 * 5. Complete population of customer details, service name, and booking reference.
 * 6. Empty state behavior for providers with 0 reviews.
 * 7. Automatic synchronization with Provider model's rating fields.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const {
  User,
  Customer,
  Provider,
  Category,
  Service,
  Booking,
  Review
} = require('./src/models');
const reviewService = require('./src/services/reviewService');

async function runProviderReviewsSuite() {
  console.log('================================================================================');
  console.log('⭐ RUNNING PROVIDER REVIEWS & RATINGS TEST SUITE');
  console.log('================================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  const testSuffix = `test_rev_${Date.now()}`;
  let userA, providerA, userB, providerB, custUser, customer, category, service;
  const createdBookingIds = [];
  const createdReviewIds = [];

  try {
    // 1. Setup Staging Provider A
    userA = await User.create({
      name: `Provider A ${testSuffix}`,
      email: `provA_${testSuffix}@example.com`,
      phone: `999${String(Date.now()).slice(-7)}`,
      password: 'Password123!',
      role: 'provider',
      isActive: true,
      isVerified: true
    });

    category = await Category.create({
      name: `Category ${testSuffix}`,
      slug: `cat-${testSuffix}`,
      isActive: true
    });

    providerA = await Provider.create({
      user: userA._id,
      businessName: `Test Electric Services ${testSuffix}`,
      categories: [category._id],
      verificationStatus: 'verified',
      isAvailable: true,
      rating: { average: 0, count: 0 }
    });

    // 2. Setup Staging Provider B
    userB = await User.create({
      name: `Provider B ${testSuffix}`,
      email: `provB_${testSuffix}@example.com`,
      phone: `988${String(Date.now()).slice(-7)}`,
      password: 'Password123!',
      role: 'provider',
      isActive: true,
      isVerified: true
    });

    providerB = await Provider.create({
      user: userB._id,
      businessName: `Test Plumbing Services ${testSuffix}`,
      categories: [category._id],
      verificationStatus: 'verified',
      isAvailable: true,
      rating: { average: 0, count: 0 }
    });

    // 3. Setup Staging Customer
    custUser = await User.create({
      name: `John Customer ${testSuffix}`,
      email: `cust_${testSuffix}@example.com`,
      phone: `977${String(Date.now()).slice(-7)}`,
      password: 'Password123!',
      role: 'customer',
      isActive: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
    });

    customer = await Customer.create({
      user: custUser._id,
      addresses: [{ street: '123 Test St', city: 'TestCity', isDefault: true }]
    });

    service = await Service.create({
      name: `Fan Repair ${testSuffix}`,
      category: category._id,
      price: 499,
      priceType: 'fixed',
      isActive: true
    });

    // Helper to create test booking and review
    const createTestReview = async (providerDoc, ratingVal, commentText) => {
      const bRef = `BK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const booking = await Booking.create({
        bookingReference: bRef,
        customer: customer._id,
        provider: providerDoc._id,
        service: service._id,
        status: 'completed',
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
        address: { street: '123 Test St', city: 'TestCity' },
        pricing: { basePrice: 499, totalAmount: 499 }
      });
      createdBookingIds.push(booking._id);

      const review = await Review.create({
        booking: booking._id,
        customer: customer._id,
        provider: providerDoc._id,
        service: service._id,
        rating: ratingVal,
        comment: commentText,
        isPublic: true
      });
      createdReviewIds.push(review._id);
      return review;
    };

    // Provider A reviews: 5, 4, 5
    await createTestReview(providerA, 5, 'Outstanding electrical work! Very polite.');
    await createTestReview(providerA, 4, 'Good work, arrived slightly late but fixed everything.');
    await createTestReview(providerA, 5, 'Best technician in the city, highly recommended!');

    // Provider B reviews: 2, 3
    await createTestReview(providerB, 2, 'Work was messy and took too long.');
    await createTestReview(providerB, 3, 'Average service, acceptable.');

    console.log('\n--- Scenario 1: Fetch reviews for Provider A ---');
    const resA = await reviewService.getProviderReviews(userA._id);
    assert(resA.reviews.length === 3, 'Provider A receives exactly 3 reviews');
    assert(resA.stats.total === 3, 'Stats total count matches 3');
    // (5 + 4 + 5) / 3 = 14 / 3 = 4.7
    assert(resA.stats.averageRating === 4.7, `Average rating is 4.7 (received: ${resA.stats.averageRating})`);
    assert(resA.stats.distribution[5] === 2, '5-star count is 2');
    assert(resA.stats.distribution[4] === 1, '4-star count is 1');
    assert(resA.stats.distribution[3] === 0, '3-star count is 0');
    assert(resA.stats.distribution[2] === 0, '2-star count is 0');
    assert(resA.stats.distribution[1] === 0, '1-star count is 0');

    console.log('\n--- Scenario 2: Data isolation (zero leak between providers) ---');
    const hasAnyProvBReviewInA = resA.reviews.some(
      (r) => r.provider?._id?.toString() === providerB._id.toString()
    );
    assert(!hasAnyProvBReviewInA, 'Zero Provider B reviews leaked into Provider A response');

    const resB = await reviewService.getProviderReviews(userB._id);
    assert(resB.reviews.length === 2, 'Provider B receives exactly 2 reviews');
    // (2 + 3) / 2 = 2.5
    assert(resB.stats.averageRating === 2.5, `Provider B average rating is 2.5 (received: ${resB.stats.averageRating})`);
    assert(resB.stats.distribution[2] === 1, 'Provider B 2-star count is 1');
    assert(resB.stats.distribution[3] === 1, 'Provider B 3-star count is 1');
    assert(resB.stats.distribution[5] === 0, 'Provider B 5-star count is 0');

    console.log('\n--- Scenario 3: Star rating filtering ---');
    const filtered5 = await reviewService.getProviderReviews(userA._id, { rating: 5 });
    assert(filtered5.reviews.length === 2, 'Rating=5 filter returns exactly 2 reviews');
    assert(filtered5.reviews.every((r) => r.rating === 5), 'All returned reviews have rating === 5');
    assert(filtered5.stats.total === 3, 'Aggregate stats remain based on all reviews (total=3)');

    const filtered4 = await reviewService.getProviderReviews(userA._id, { rating: 4 });
    assert(filtered4.reviews.length === 1, 'Rating=4 filter returns exactly 1 review');
    assert(filtered4.reviews[0].rating === 4, 'Returned review has rating === 4');

    const filtered1 = await reviewService.getProviderReviews(userA._id, { rating: 1 });
    assert(filtered1.reviews.length === 0, 'Rating=1 filter returns 0 reviews for Provider A');

    console.log('\n--- Scenario 4: Populated relational fields ---');
    const firstRev = resA.reviews[0];
    assert(firstRev.customer?.user?.name === `John Customer ${testSuffix}`, 'Customer user name populated correctly');
    assert(!!firstRev.customer?.user?.avatar, 'Customer avatar populated');
    assert(firstRev.service?.name === `Fan Repair ${testSuffix}`, 'Service name populated correctly');
    assert(firstRev.booking?.bookingReference?.startsWith('BK-'), 'Booking reference populated correctly');

    console.log('\n--- Scenario 5: Pagination ---');
    const paginated = await reviewService.getProviderReviews(userA._id, { page: 1, limit: 2 });
    assert(paginated.reviews.length === 2, 'Page 1 with limit 2 returns 2 reviews');
    assert(paginated.pagination.total === 3, 'Pagination total is 3');
    assert(paginated.pagination.totalPages === 2, 'Total pages is 2');
    assert(paginated.pagination.page === 1, 'Current page is 1');

    const page2 = await reviewService.getProviderReviews(userA._id, { page: 2, limit: 2 });
    assert(page2.reviews.length === 1, 'Page 2 with limit 2 returns remaining 1 review');

    console.log('\n--- Scenario 6: Provider with zero reviews ---');
    // Create new provider with zero reviews
    const userC = await User.create({
      name: `Provider C ${testSuffix}`,
      email: `provC_${testSuffix}@example.com`,
      phone: `966${String(Date.now()).slice(-7)}`,
      password: 'Password123!',
      role: 'provider',
      isActive: true
    });
    const providerC = await Provider.create({
      user: userC._id,
      businessName: `Test Painting ${testSuffix}`,
      categories: [category._id],
      verificationStatus: 'verified'
    });

    const resC = await reviewService.getProviderReviews(userC._id);
    assert(resC.reviews.length === 0, 'Provider with 0 reviews returns empty array');
    assert(resC.stats.total === 0, 'Stats total is 0');
    assert(resC.stats.averageRating === 0, 'Average rating is 0');
    assert(resC.stats.distribution[5] === 0, 'Distribution 5-star count is 0');

    // Cleanup userC & providerC
    await Provider.findByIdAndDelete(providerC._id);
    await User.findByIdAndDelete(userC._id);

    console.log('\n--- Scenario 7: Provider model rating auto-sync ---');
    const updatedProvA = await Provider.findById(providerA._id);
    assert(updatedProvA.rating.average === 4.7, `Provider A rating.average synced to 4.7 (DB value: ${updatedProvA.rating.average})`);
    assert(updatedProvA.rating.count === 3, `Provider A rating.count synced to 3 (DB value: ${updatedProvA.rating.count})`);

    console.log('\n--- Scenario 8: HTTP Route Resolution & ObjectId Isolation ---');
    const http = require('http');
    const app = require('./src/app');
    const { generateToken } = require('./src/utils/jwt');

    const tokenA = generateToken({ userId: userA._id, role: 'provider' });
    const tokenB = generateToken({ userId: userB._id, role: 'provider' });
    const custToken = generateToken({ userId: custUser._id, role: 'customer' });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const serverPort = server.address().port;
    const baseUrl = `http://127.0.0.1:${serverPort}`;

    const makeRequest = (urlPath, token = null) => {
      return new Promise((resolve, reject) => {
        const url = new URL(urlPath, baseUrl);
        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const req = http.request(url, { method: 'GET', headers }, (res) => {
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            let json = {};
            try { json = JSON.parse(rawData); } catch (_) {}
            resolve({ status: res.statusCode, body: json, raw: rawData });
          });
        });
        req.on('error', reject);
        req.end();
      });
    };

    // 1. Authenticated Provider A calls /api/reviews/provider/me
    const httpResA = await makeRequest('/api/reviews/provider/me?page=1&limit=10', tokenA);
    assert(httpResA.status === 200, `Provider A HTTP 200 OK (got: ${httpResA.status})`);
    assert(httpResA.body.success === true, 'Response success is true');
    assert(Array.isArray(httpResA.body.data) && httpResA.body.data.length === 3, 'Data has 3 reviews');
    assert(httpResA.body.stats?.averageRating === 4.7, `HTTP stats.averageRating is 4.7 (got: ${httpResA.body.stats?.averageRating})`);
    assert(httpResA.body.stats?.distribution?.[5] === 2, 'Distribution 5-star count is 2');
    assert(!httpResA.raw.includes('Invalid MongoDB ObjectId'), 'Never treats "me" as invalid ObjectId');

    // 2. Authenticated Provider B calls /api/reviews/provider/me (isolation test)
    const httpResB = await makeRequest('/api/reviews/provider/me?page=1&limit=10', tokenB);
    assert(httpResB.status === 200, `Provider B HTTP 200 OK (got: ${httpResB.status})`);
    assert(httpResB.body.data.length === 2, 'Provider B receives only their 2 reviews');
    assert(httpResB.body.stats?.averageRating === 2.5, 'Provider B stats average is 2.5');

    // 3. Unauthenticated call to /api/reviews/provider/me
    const unauthRes = await makeRequest('/api/reviews/provider/me');
    assert(unauthRes.status === 401, `Unauthenticated request returns 401 (got: ${unauthRes.status})`);
    assert(!unauthRes.raw.includes('Invalid MongoDB ObjectId'), 'Unauthenticated does not fail on ObjectId validation');

    // 4. Role-based check: Customer calling provider route returns 403
    const forbiddenRes = await makeRequest('/api/reviews/provider/me', custToken);
    assert(forbiddenRes.status === 403, `Customer token calling provider reviews returns 403 (got: ${forbiddenRes.status})`);

    // 5. Public provider endpoint with valid ObjectId
    const validPublicRes = await makeRequest(`/api/reviews/provider/${providerA._id}`);
    assert(validPublicRes.status === 200, `Public endpoint with valid ObjectId returns 200 (got: ${validPublicRes.status})`);

    // 6. Public provider endpoint with invalid ObjectId returns controlled 400
    const invalidPublicRes = await makeRequest('/api/reviews/provider/not-a-valid-id');
    assert(invalidPublicRes.status === 400, `Public endpoint with invalid ID returns 400 (got: ${invalidPublicRes.status})`);
    assert(invalidPublicRes.body.error?.message?.includes('Invalid MongoDB ObjectId'), 'Error message states invalid MongoDB ObjectId for non-"me" parameter');

    // 7. Verify /providers/me/reviews route alias
    const aliasRes = await makeRequest('/api/providers/me/reviews', tokenA);
    assert(aliasRes.status === 200, `Alias /api/providers/me/reviews returns 200 (got: ${aliasRes.status})`);

    await new Promise((resolve) => server.close(resolve));

  } finally {
    // Teardown test artifacts
    if (createdReviewIds.length > 0) {
      await Review.deleteMany({ _id: { $in: createdReviewIds } });
    }
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (service) await Service.findByIdAndDelete(service._id);
    if (customer) await Customer.findByIdAndDelete(customer._id);
    if (custUser) await User.findByIdAndDelete(custUser._id);
    if (category) await Category.findByIdAndDelete(category._id);
    if (providerA) await Provider.findByIdAndDelete(providerA._id);
    if (userA) await User.findByIdAndDelete(userA._id);
    if (providerB) await Provider.findByIdAndDelete(providerB._id);
    if (userB) await User.findByIdAndDelete(userB._id);

    await mongoose.disconnect();
    console.log('\n[TEARDOWN] Disconnected from MongoDB');
  }

  console.log('================================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runProviderReviewsSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

