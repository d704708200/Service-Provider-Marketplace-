/**
 * Comprehensive Test Suite for Provider Self-Service Catalog & Custom Pricing Feature
 *
 * Requirements covered:
 * 1. Provider creates a service and sets its price.
 * 2. Invalid price, duration, or inactive category is rejected.
 * 3. Unverified provider cannot publish a service.
 * 4. Provider A cannot edit or delete Provider B's service.
 * 5. Provider cannot modify an admin-owned catalog service.
 * 6. Deactivated service disappears from customer-facing listings.
 * 7. Service price changes do not alter existing bookings.
 * 8. Customer booking uses the correct selected service and price.
 * 9. Safe deletion: rejected if service has existing bookings; allowed when zero bookings.
 * 10. Booking counts correctly reported on provider services list.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');
const Provider = require('./src/models/Provider');
const Customer = require('./src/models/Customer');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const Booking = require('./src/models/Booking');

const providerService = require('./src/services/providerService');
const bookingService = require('./src/services/bookingService');
const serviceService = require('./src/services/serviceService');

let passed = 0;
let total = 0;

async function test(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`✓ Test ${total}: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ Test ${total} FAILED: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function run() {
  console.log('--- RUNNING PROVIDER SELF-SERVICE CATALOG & CUSTOM PRICING TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);

  // Clean up any test fixtures from previous runs
  await User.deleteMany({ email: /^test-provider-cat/ });
  await User.deleteMany({ email: /^test-cust-cat/ });
  await Category.deleteMany({ slug: /^test-cat-/ });
  await Booking.deleteMany({ bookingReference: /^BK-CAT-TEST-/ });

  // 1. Create Test Categories (Active and Inactive)
  const activeCategory = await Category.create({
    name: 'Test Category Active ' + Date.now(),
    slug: 'test-cat-active-' + Date.now(),
    isActive: true
  });

  const inactiveCategory = await Category.create({
    name: 'Test Category Inactive ' + Date.now(),
    slug: 'test-cat-inactive-' + Date.now(),
    isActive: false
  });

  // 2. Create Verified Provider A
  const ts = Date.now().toString().slice(-6);
  const userA = await User.create({
    name: 'Provider Alice',
    email: `test-provider-cat-a-${Date.now()}@example.com`,
    phone: `91000${ts}`,
    password: 'password123',
    role: 'provider',
    isActive: true
  });

  const providerA = await Provider.create({
    user: userA._id,
    businessName: 'Alice Services',
    categories: [activeCategory._id],
    verificationStatus: 'verified',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    isAvailable: true
  });

  // 3. Create Unverified Provider B
  const userB = await User.create({
    name: 'Provider Bob (Unverified)',
    email: `test-provider-cat-b-${Date.now()}@example.com`,
    phone: `92000${ts}`,
    password: 'password123',
    role: 'provider',
    isActive: true
  });

  const providerB = await Provider.create({
    user: userB._id,
    businessName: 'Bob Unverified Services',
    categories: [activeCategory._id],
    verificationStatus: 'pending',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    isAvailable: true
  });

  // 4. Create Verified Provider C (for ownership cross-testing)
  const userC = await User.create({
    name: 'Provider Charlie',
    email: `test-provider-cat-c-${Date.now()}@example.com`,
    phone: `93000${ts}`,
    password: 'password123',
    role: 'provider',
    isActive: true
  });

  const providerC = await Provider.create({
    user: userC._id,
    businessName: 'Charlie Services',
    categories: [activeCategory._id],
    verificationStatus: 'verified',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    isAvailable: true
  });

  // 5. Create Customer
  const customerUser = await User.create({
    name: 'Customer Dave',
    email: `test-cust-cat-d-${Date.now()}@example.com`,
    phone: `94000${ts}`,
    password: 'password123',
    role: 'customer',
    isActive: true
  });

  const customerDoc = await Customer.create({
    user: customerUser._id,
    phone: `94000${ts}`
  });

  // 6. Create Admin Catalog Service (provider: null)
  const adminCatalogService = await Service.create({
    name: 'Standard Admin Deep Cleaning',
    category: activeCategory._id,
    provider: null,
    price: 399,
    priceType: 'fixed',
    estimatedDurationMinutes: 45,
    isActive: true
  });

  let createdServiceAId = null;

  // Test 1: Verified Provider creates a service and sets its custom price & duration
  await test('Verified provider creates a service with custom price, duration, and category', async () => {
    const created = await providerService.addProviderServiceByUserId(userA._id, {
      name: 'Alice Premium Deep Clean',
      category: activeCategory._id.toString(),
      price: 699,
      priceType: 'fixed',
      estimatedDurationMinutes: 90,
      description: 'Complete home premium deep scrubbing'
    });

    assert.ok(created._id, 'Service should have been created with an ID');
    assert.strictEqual(created.name, 'Alice Premium Deep Clean');
    assert.strictEqual(created.price, 699);
    assert.strictEqual(created.estimatedDurationMinutes, 90);
    assert.strictEqual(created.provider.toString(), providerA._id.toString());
    assert.strictEqual(created.bookingCount, 0);

    createdServiceAId = created._id;
  });

  // Test 2: Unverified provider cannot publish a service
  await test('Unverified provider cannot publish a service (rejected with 403)', async () => {
    let failed = false;
    try {
      await providerService.addProviderServiceByUserId(userB._id, {
        name: 'Bob Illegal Service',
        category: activeCategory._id.toString(),
        price: 299,
        estimatedDurationMinutes: 60
      });
    } catch (err) {
      failed = true;
      assert.strictEqual(err.statusCode, 403);
      assert.ok(err.message.includes('verified service providers'));
    }
    assert.ok(failed, 'Should have rejected unverified provider');
  });

  // Test 3: Rejection of invalid price, duration, or inactive category
  await test('Rejects invalid price (<= 0), invalid duration (< 1), or inactive category', async () => {
    // 3a. Inactive category
    let failedInactiveCat = false;
    try {
      await providerService.addProviderServiceByUserId(userA._id, {
        name: 'Alice Inactive Cat Srv',
        category: inactiveCategory._id.toString(),
        price: 500,
        estimatedDurationMinutes: 60
      });
    } catch (err) {
      failedInactiveCat = true;
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('inactive'));
    }
    assert.ok(failedInactiveCat, 'Should have rejected inactive category');

    // 3b. Price <= 0
    let failedZeroPrice = false;
    try {
      await providerService.addProviderServiceByUserId(userA._id, {
        name: 'Alice Zero Price Srv',
        category: activeCategory._id.toString(),
        price: 0,
        estimatedDurationMinutes: 60
      });
    } catch (err) {
      failedZeroPrice = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(failedZeroPrice, 'Should have rejected zero price');

    // 3c. Duration < 1
    let failedDuration = false;
    try {
      await providerService.addProviderServiceByUserId(userA._id, {
        name: 'Alice Zero Duration Srv',
        category: activeCategory._id.toString(),
        price: 500,
        estimatedDurationMinutes: 0
      });
    } catch (err) {
      failedDuration = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(failedDuration, 'Should have rejected invalid duration');
  });

  // Test 4: Provider A cannot edit or delete Provider C's service
  await test('Provider A cannot edit or delete Provider C\'s service (rejected with 403)', async () => {
    const serviceC = await providerService.addProviderServiceByUserId(userC._id, {
      name: 'Charlie Custom Woodwork',
      category: activeCategory._id.toString(),
      price: 850,
      estimatedDurationMinutes: 120
    });

    // Alice tries to update Charlie's service
    let editBlocked = false;
    try {
      await providerService.updateProviderServiceByUserId(userA._id, serviceC._id, {
        name: 'Alice Hacked Service'
      });
    } catch (err) {
      editBlocked = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(editBlocked, 'Should have blocked cross-provider edit');

    // Alice tries to delete Charlie's service
    let deleteBlocked = false;
    try {
      await providerService.deleteProviderServiceByUserId(userA._id, serviceC._id);
    } catch (err) {
      deleteBlocked = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(deleteBlocked, 'Should have blocked cross-provider delete');
  });

  // Test 5: Provider cannot modify an admin-owned catalog service
  await test('Provider cannot edit or delete an admin catalog service (rejected with 403)', async () => {
    let editAdminBlocked = false;
    try {
      await providerService.updateProviderServiceByUserId(userA._id, adminCatalogService._id, {
        price: 999
      });
    } catch (err) {
      editAdminBlocked = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(editAdminBlocked, 'Should have blocked editing admin service');

    let deleteAdminBlocked = false;
    try {
      await providerService.deleteProviderServiceByUserId(userA._id, adminCatalogService._id);
    } catch (err) {
      deleteAdminBlocked = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(deleteAdminBlocked, 'Should have blocked deleting admin service');
  });

  // Test 6: Provider updates service details, status, and price
  await test('Provider can update their service details and toggle active status', async () => {
    const updated = await providerService.updateProviderServiceByUserId(userA._id, createdServiceAId, {
      name: 'Alice Ultra Deep Cleaning',
      price: 749,
      estimatedDurationMinutes: 100
    });
    assert.strictEqual(updated.name, 'Alice Ultra Deep Cleaning');
    assert.strictEqual(updated.price, 749);
    assert.strictEqual(updated.estimatedDurationMinutes, 100);

    // Toggle status to inactive
    const toggled = await providerService.updateProviderServiceStatusByUserId(userA._id, createdServiceAId, false);
    assert.strictEqual(toggled.isActive, false);

    // Customer public detail should not include deactivated service
    const pubProvInactive = await providerService.getPublicProviderById(providerA._id);
    const hasInactive = pubProvInactive.services.some((s) => s._id.toString() === createdServiceAId.toString());
    assert.strictEqual(hasInactive, false, 'Inactive custom service should not be visible to customer');

    // Reactivate for subsequent tests
    const reactivated = await providerService.updateProviderServiceStatusByUserId(userA._id, createdServiceAId, true);
    assert.strictEqual(reactivated.isActive, true);

    const pubProvActive = await providerService.getPublicProviderById(providerA._id);
    const hasActive = pubProvActive.services.some((s) => s._id.toString() === createdServiceAId.toString());
    assert.strictEqual(hasActive, true, 'Active custom service should be visible to customer');
  });

  // Test 7: Customer books provider's custom service; booking records server-validated price
  let bookingId = null;
  await test('Customer booking uses server-validated provider custom service price', async () => {
    const booking = await bookingService.createBooking(customerUser._id, {
      serviceId: createdServiceAId.toString(),
      providerId: providerA._id.toString(),
      bookingMode: 'instant',
      address: {
        street: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001'
      }
    });

    assert.ok(booking._id, 'Booking created');
    assert.strictEqual(booking.pricing.basePrice, 749, 'Booking price must match current service price (749)');
    bookingId = booking._id;
  });

  // Test 8: Price change on service does not silently modify existing booking
  await test('Service price changes do not change historical or existing bookings', async () => {
    // Alice increases price to 899
    await providerService.updateProviderServiceByUserId(userA._id, createdServiceAId, {
      price: 899
    });

    const refreshedBooking = await Booking.findById(bookingId).lean();
    assert.strictEqual(refreshedBooking.pricing.basePrice, 749, 'Existing booking basePrice must remain 749');

    const srvInDb = await Service.findById(createdServiceAId).lean();
    assert.strictEqual(srvInDb.price, 899, 'Service price should now be 899');
  });

  // Test 9: Deleting a service with bookings is rejected (HTTP 400 + recommends deactivation)
  await test('Deleting service with existing bookings is rejected with recommendation to deactivate', async () => {
    let deleteFailed = false;
    try {
      await providerService.deleteProviderServiceByUserId(userA._id, createdServiceAId);
    } catch (err) {
      deleteFailed = true;
      assert.strictEqual(err.statusCode, 400);
      assert.ok(err.message.includes('deactivate'));
    }
    assert.ok(deleteFailed, 'Should reject deletion when service has bookings');
  });

  // Test 10: Provider service list includes accurate bookingCount
  await test('Provider services list includes accurate bookingCount', async () => {
    const list = await providerService.getProviderServicesByUserId(userA._id);
    const aliceSrv = list.find((s) => s._id.toString() === createdServiceAId.toString());
    assert.ok(aliceSrv, 'Service must be present in provider services list');
    assert.strictEqual(aliceSrv.bookingCount, 1, 'Booking count should be exactly 1');
  });

  // Test 11: Service with zero bookings can be safely deleted
  await test('Service with zero bookings can be safely deleted', async () => {
    const temporarySrv = await providerService.addProviderServiceByUserId(userA._id, {
      name: 'Temporary Clean for Deletion',
      category: activeCategory._id.toString(),
      price: 199,
      estimatedDurationMinutes: 30
    });

    const delRes = await providerService.deleteProviderServiceByUserId(userA._id, temporarySrv._id);
    assert.strictEqual(delRes.deleted, true);

    const check = await Service.findById(temporarySrv._id);
    assert.strictEqual(check, null, 'Service should be deleted from DB');
  });

  // Test 12: Admin catalog services still work and appear for providers without custom services
  await test('Customer provider details show admin catalog services alongside custom services', async () => {
    const details = await providerService.getPublicProviderById(providerA._id);
    const serviceNames = details.services.map((s) => s.name);
    // Provider A's custom service
    assert.ok(serviceNames.includes('Alice Ultra Deep Cleaning'), 'Custom service should appear');
    // Admin catalog service for activeCategory
    assert.ok(serviceNames.includes('Standard Admin Deep Cleaning'), 'Admin catalog service should appear');
  });

  // Clean up
  await Booking.deleteMany({ _id: bookingId });
  await Service.deleteMany({ provider: { $in: [providerA._id, providerB._id, providerC._id] } });
  await Service.findByIdAndDelete(adminCatalogService._id);
  await Provider.deleteMany({ _id: { $in: [providerA._id, providerB._id, providerC._id] } });
  await Customer.deleteMany({ _id: customerDoc._id });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id, customerUser._id] } });
  await Category.deleteMany({ _id: { $in: [activeCategory._id, inactiveCategory._id] } });

  await mongoose.disconnect();
  console.log(`\nAll ${passed}/${total} Provider Self-Service Catalog tests passed successfully!`);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
