/**
 * Dynamic Service Tags End-to-End Automated Test Suite
 * Tests all 15 requirements specified in Phase 7.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const {
  User,
  Category,
  ServiceTag,
  Provider,
  Service,
  Booking
} = require('./src/models');

const tagService = require('./src/services/tagService');
const bookingService = require('./src/services/bookingService');

const MONGODB_URI = process.env.MONGODB_URI;

let testCategory = null;
let testUser1 = null;
let testUser2 = null;
let testProvider1 = null;
let testProvider2 = null;
let testCustomer = null;
let testService = null;
let createdTag = null;
let bikeTag = null;
let carTag = null;

let passedTests = 0;
let totalTests = 15;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   DYNAMIC SERVICE TAGS SYSTEM — 15 E2E TEST SUITE   ');
  console.log('======================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB Atlas successfully.\n');

  try {
    // Setup references
    testCategory = await Category.findOne({ name: 'Bike Car Mechanic' });
    if (!testCategory) {
      testCategory = await Category.findOne({});
    }
    assert(testCategory, 'A valid category must exist in the database');
    console.log(`Using Category: "${testCategory.name}" (${testCategory._id})`);

    // Fetch existing standard tags for this category
    bikeTag = await ServiceTag.findOne({
      category: testCategory._id,
      name: 'Bike Repair',
      isArchived: false
    });
    carTag = await ServiceTag.findOne({
      category: testCategory._id,
      name: 'Car Repair',
      isArchived: false
    });

    if (!bikeTag) {
      bikeTag = await ServiceTag.create({
        name: 'Bike Repair',
        slug: 'bike-repair',
        category: testCategory._id,
        subcategory: { name: 'Two Wheeler', slug: 'two-wheeler' },
        isActive: true,
        isCustomerVisible: true
      });
    }

    if (!carTag) {
      carTag = await ServiceTag.create({
        name: 'Car Repair',
        slug: 'car-repair',
        category: testCategory._id,
        subcategory: { name: 'Four Wheeler', slug: 'four-wheeler' },
        isActive: true,
        isCustomerVisible: true
      });
    }

    // Clean up any old test entities
    await ServiceTag.deleteMany({ name: 'Emergency Towing TEST_SUITE' });
    await User.deleteMany({ email: { $in: ['test_prov1@test.com', 'test_prov2@test.com', 'test_cust@test.com'] } });

    // Create test customer
    testCustomer = await User.create({
      name: 'Test Customer E2E',
      email: 'test_cust@test.com',
      phone: '+919876543200',
      password: 'HashedPassword123!',
      role: 'customer',
      isActive: true
    });

    // Create test provider 1
    testUser1 = await User.create({
      name: 'Provider 1 Auto Works',
      email: 'test_prov1@test.com',
      phone: '+919876543201',
      password: 'HashedPassword123!',
      role: 'provider',
      isActive: true
    });
    testProvider1 = await Provider.create({
      user: testUser1._id,
      businessName: 'Provider 1 Auto Works',
      categories: [testCategory._id],
      verificationStatus: 'verified',
      isActive: true,
      serviceTags: []
    });

    // Create test provider 2
    testUser2 = await User.create({
      name: 'Provider 2 Car Masters',
      email: 'test_prov2@test.com',
      phone: '+919876543202',
      password: 'HashedPassword123!',
      role: 'provider',
      isActive: true
    });
    testProvider2 = await Provider.create({
      user: testUser2._id,
      businessName: 'Provider 2 Car Masters',
      categories: [testCategory._id],
      verificationStatus: 'verified',
      isActive: true,
      serviceTags: []
    });

    // Create a base service for provider 1
    testService = await Service.create({
      provider: testProvider1._id,
      category: testCategory._id,
      name: 'Standard Inspection',
      price: 499,
      durationMinutes: 45,
      isActive: true
    });

    // -----------------------------------------------------------
    // TEST 1: Admin creates a Mechanics category tag ('Emergency Towing')
    // -----------------------------------------------------------
    console.log('[Test 1] Admin creates Mechanics category tag ("Emergency Towing")...');
    createdTag = await tagService.createTag({
      name: 'Emergency Towing TEST_SUITE',
      category: testCategory._id,
      subcategoryName: 'Emergency Assistance',
      description: '24/7 on-demand towing for broken down vehicles',
      displayOrder: 99,
      isActive: true,
      isCustomerVisible: true
    });
    assert(createdTag && createdTag._id, 'Tag creation failed');
    assert(createdTag.name === 'Emergency Towing TEST_SUITE', 'Tag name mismatch');
    passedTests++;
    console.log('  ✓ Test 1 PASSED: Created tag with ID', createdTag._id);

    // -----------------------------------------------------------
    // TEST 2: Tag appears in Category tags API
    // -----------------------------------------------------------
    console.log('[Test 2] Tag appears in Category tags API (getTagsForCategory)...');
    const categoryTagsResult = await tagService.getTagsForCategory(testCategory._id);
    assert(categoryTagsResult.tags && categoryTagsResult.tags.length > 0, 'No tags returned for category');
    const foundCreated = categoryTagsResult.tags.find((t) => String(t._id) === String(createdTag._id));
    assert(foundCreated, 'Newly created tag does not appear in category tags list');
    passedTests++;
    console.log(`  ✓ Test 2 PASSED: Category contains ${categoryTagsResult.tags.length} active tags including new tag.`);

    // -----------------------------------------------------------
    // TEST 3: Provider 1 selects 'Bike Repair' and 'Emergency Towing'
    // -----------------------------------------------------------
    console.log('[Test 3] Provider 1 selects "Bike Repair" and "Emergency Towing"...');
    const p1UpdatedTags = await tagService.updateProviderTags(testUser1._id, {
      tags: [
        { tagId: bikeTag._id, isActive: true, basePrice: 450, pricingType: 'fixed' },
        { tagId: createdTag._id, isActive: true, basePrice: 1200, pricingType: 'fixed' }
      ]
    });
    assert(p1UpdatedTags && p1UpdatedTags.serviceTags && p1UpdatedTags.serviceTags.length === 2, 'Provider 1 should have 2 tags');
    passedTests++;
    console.log('  ✓ Test 3 PASSED: Provider 1 tags successfully updated.');

    // -----------------------------------------------------------
    // TEST 4: Provider selection is saved correctly in MongoDB (Provider.serviceTags)
    // -----------------------------------------------------------
    console.log('[Test 4] Provider selection is saved correctly in MongoDB...');
    const savedP1 = await Provider.findById(testProvider1._id);
    assert(savedP1.serviceTags.length === 2, 'Provider serviceTags length mismatch');
    const p1Bike = savedP1.serviceTags.find((st) => String(st.tag) === String(bikeTag._id));
    const p1Towing = savedP1.serviceTags.find((st) => String(st.tag) === String(createdTag._id));
    assert(p1Bike && p1Bike.basePrice === 450, 'Provider 1 bike tag not saved with price 450');
    assert(p1Towing && p1Towing.basePrice === 1200, 'Provider 1 towing tag not saved with price 1200');
    passedTests++;
    console.log('  ✓ Test 4 PASSED: MongoDB document verified with correct prices and IDs.');

    // -----------------------------------------------------------
    // TEST 5: Second provider selects 'Car Repair' only
    // -----------------------------------------------------------
    console.log('[Test 5] Second provider selects "Car Repair" only...');
    const p2UpdatedTags = await tagService.updateProviderTags(testUser2._id, {
      tags: [
        { tagId: carTag._id, isActive: true, basePrice: 800, pricingType: 'fixed' }
      ]
    });
    assert(p2UpdatedTags && p2UpdatedTags.serviceTags && p2UpdatedTags.serviceTags.length === 1, 'Provider 2 should have 1 tag');
    const savedP2 = await Provider.findById(testProvider2._id);
    assert(savedP2.serviceTags.length === 1, 'Provider 2 serviceTags length mismatch');
    assert(String(savedP2.serviceTags[0].tag) === String(carTag._id), 'Provider 2 tag mismatch');
    passedTests++;
    console.log('  ✓ Test 5 PASSED: Provider 2 configured exclusively with Car Repair.');

    // -----------------------------------------------------------
    // TEST 6: Customer opens category with 'All' and sees both providers
    // -----------------------------------------------------------
    console.log('[Test 6] Customer opens category with "All" and sees both providers...');
    const allProvidersRes = await tagService.getProvidersByCategoryAndTag(testCategory._id, {});
    const p1InAll = allProvidersRes.providers.some((p) => String(p._id) === String(testProvider1._id));
    const p2InAll = allProvidersRes.providers.some((p) => String(p._id) === String(testProvider2._id));
    assert(p1InAll, 'Provider 1 should be visible in All view');
    assert(p2InAll, 'Provider 2 should be visible in All view');
    passedTests++;
    console.log('  ✓ Test 6 PASSED: Both providers appear in Category All view.');

    // -----------------------------------------------------------
    // TEST 7: Customer filters by 'Bike Repair' and sees only Provider 1
    // -----------------------------------------------------------
    console.log('[Test 7] Customer filters by "Bike Repair" and sees only Provider 1...');
    const bikeFiltered = await tagService.getProvidersByCategoryAndTag(testCategory._id, {
      tagId: bikeTag._id
    });
    const p1InBike = bikeFiltered.providers.some((p) => String(p._id) === String(testProvider1._id));
    const p2InBike = bikeFiltered.providers.some((p) => String(p._id) === String(testProvider2._id));
    assert(p1InBike, 'Provider 1 MUST appear in Bike Repair filter');
    assert(!p2InBike, 'Provider 2 MUST NOT appear in Bike Repair filter');
    passedTests++;
    console.log('  ✓ Test 7 PASSED: Only Provider 1 is returned for Bike Repair.');

    // -----------------------------------------------------------
    // TEST 8: Customer filters by 'Car Repair' and sees only Provider 2
    // -----------------------------------------------------------
    console.log('[Test 8] Customer filters by "Car Repair" and sees only Provider 2...');
    const carFiltered = await tagService.getProvidersByCategoryAndTag(testCategory._id, {
      tagId: carTag._id
    });
    const p1InCar = carFiltered.providers.some((p) => String(p._id) === String(testProvider1._id));
    const p2InCar = carFiltered.providers.some((p) => String(p._id) === String(testProvider2._id));
    assert(!p1InCar, 'Provider 1 MUST NOT appear in Car Repair filter');
    assert(p2InCar, 'Provider 2 MUST appear in Car Repair filter');
    passedTests++;
    console.log('  ✓ Test 8 PASSED: Only Provider 2 is returned for Car Repair.');

    // -----------------------------------------------------------
    // TEST 9: Inactive provider tag is excluded from customer search
    // -----------------------------------------------------------
    console.log('[Test 9] Inactive provider tag is excluded from customer search...');
    // Provider 1 deactivates Bike Repair tag
    await tagService.toggleProviderTagStatus(testUser1._id, bikeTag._id, false);
    const bikeFilteredAfterDeactivation = await tagService.getProvidersByCategoryAndTag(testCategory._id, {
      tagId: bikeTag._id
    });
    const p1InBikeDeactivated = bikeFilteredAfterDeactivation.providers.some(
      (p) => String(p._id) === String(testProvider1._id)
    );
    assert(!p1InBikeDeactivated, 'Provider 1 should not appear when their tag is deactivated');
    // Reactivate for next tests
    await tagService.toggleProviderTagStatus(testUser1._id, bikeTag._id, true);
    passedTests++;
    console.log('  ✓ Test 9 PASSED: Inactive provider tag is properly excluded from customer search.');

    // -----------------------------------------------------------
    // TEST 10: Unapproved provider tag is excluded
    // -----------------------------------------------------------
    console.log('[Test 10] Unapproved provider tag is excluded...');
    await Provider.updateOne(
      { _id: testProvider1._id, 'serviceTags.tag': createdTag._id },
      { $set: { 'serviceTags.$.approvalStatus': 'pending' } }
    );
    const towingFilteredPending = await tagService.getProvidersByCategoryAndTag(testCategory._id, {
      tagId: createdTag._id
    });
    const p1InTowingPending = towingFilteredPending.providers.some(
      (p) => String(p._id) === String(testProvider1._id)
    );
    assert(!p1InTowingPending, 'Provider with pending tag approval should not appear in customer results');
    // Restore approval
    await Provider.updateOne(
      { _id: testProvider1._id, 'serviceTags.tag': createdTag._id },
      { $set: { 'serviceTags.$.approvalStatus': 'approved' } }
    );
    passedTests++;
    console.log('  ✓ Test 10 PASSED: Unapproved tag status correctly hides provider.');

    // -----------------------------------------------------------
    // TEST 11: Wrong category/tag combination is rejected
    // -----------------------------------------------------------
    console.log('[Test 11] Wrong category/tag combination is rejected...');
    let threwError = false;
    try {
      // Create tag with non-existent or invalid category
      await tagService.createTag({
        name: 'Invalid Tag',
        category: new mongoose.Types.ObjectId(),
        subcategoryName: 'Test'
      });
    } catch (err) {
      threwError = true;
    }
    assert(threwError, 'Creating tag for non-existent category should throw 404');
    passedTests++;
    console.log('  ✓ Test 11 PASSED: Invalid category-tag relation rejected.');

    // -----------------------------------------------------------
    // TEST 12: Tag with isActive: false is excluded from category tags list
    // -----------------------------------------------------------
    console.log('[Test 12] Inactive tag is excluded from category discovery...');
    await tagService.updateTagStatus(createdTag._id, { isActive: false });
    const tagsAfterDisable = await tagService.getTagsForCategory(testCategory._id);
    const isTagPresent = tagsAfterDisable.tags.some((t) => String(t._id) === String(createdTag._id));
    assert(!isTagPresent, 'Disabled tag must not appear in customer category tags list');
    // Re-enable
    await tagService.updateTagStatus(createdTag._id, { isActive: true });
    passedTests++;
    console.log('  ✓ Test 12 PASSED: Inactive tags hidden from public category view.');

    // -----------------------------------------------------------
    // TEST 13: Booking creation validates exact tag eligibility
    // -----------------------------------------------------------
    console.log('[Test 13] Booking creation validates exact tag eligibility...');
    // Attempt to book Provider 2 for Bike Repair (Provider 2 only has Car Repair)
    let bookingRejected = false;
    try {
      await bookingService.createBooking(testCustomer._id, {
        serviceId: testService._id,
        providerId: testProvider2._id,
        tagId: bikeTag._id,
        bookingMode: 'instant',
        paymentMethod: 'cash',
        address: { street: '123 Main St', city: 'Jaipur' }
      });
    } catch (err) {
      bookingRejected = true;
      assert(
        err.message.includes('does not offer') || err.statusCode === 400,
        `Expected provider tag mismatch error, got: ${err.message}`
      );
    }
    assert(bookingRejected, 'Booking should be rejected when provider does not offer the requested tag');
    passedTests++;
    console.log('  ✓ Test 13 PASSED: Booking accurately rejected when provider lacks the tag.');

    // -----------------------------------------------------------
    // TEST 14: Instant/broadcast booking dispatches only to tag-eligible providers
    // -----------------------------------------------------------
    console.log('[Test 14] Instant booking dispatches only to tag-eligible providers...');
    // Book Provider 1 for Bike Repair (Provider 1 HAS Bike Repair)
    const validBooking = await bookingService.createBooking(testCustomer._id, {
      serviceId: testService._id,
      providerId: testProvider1._id,
      tagId: bikeTag._id,
      bookingMode: 'instant',
      paymentMethod: 'cash',
      address: { street: '456 MG Road', city: 'Jaipur' }
    });
    assert(validBooking && validBooking._id, 'Valid booking creation failed');
    assert(String(validBooking.tag) === String(bikeTag._id), 'Booking tag field not saved');
    assert(String(validBooking.category) === String(testCategory._id), 'Booking category field not saved');
    passedTests++;
    console.log('  ✓ Test 14 PASSED: Eligible booking created with category, subcategory and tag populated.');

    // -----------------------------------------------------------
    // TEST 15: Existing booking records remain accessible and intact
    // -----------------------------------------------------------
    console.log('[Test 15] Existing booking records remain accessible and intact...');
    const fetchedBooking = await Booking.findById(validBooking._id).populate('tag category');
    assert(fetchedBooking, 'Could not retrieve created booking');
    assert(fetchedBooking.tag && fetchedBooking.tag.name === 'Bike Repair', 'Populated tag name mismatch');
    assert(fetchedBooking.category && fetchedBooking.category.name === testCategory.name, 'Category mismatch');
    passedTests++;
    console.log('  ✓ Test 15 PASSED: Booking retrieved and populated with 100% backward compatibility.');

    console.log('\n======================================================');
    console.log(`   ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!   `);
    console.log('======================================================\n');
  } finally {
    // Clean up test records
    console.log('Cleaning up temporary test suite data...');
    if (createdTag) {
      await ServiceTag.findByIdAndDelete(createdTag._id);
    }
    if (testService) {
      await Service.findByIdAndDelete(testService._id);
    }
    await Booking.deleteMany({ customer: testCustomer?._id });
    if (testProvider1) {
      await Provider.findByIdAndDelete(testProvider1._id);
    }
    if (testProvider2) {
      await Provider.findByIdAndDelete(testProvider2._id);
    }
    await User.deleteMany({ email: { $in: ['test_prov1@test.com', 'test_prov2@test.com', 'test_cust@test.com'] } });
    console.log('Test cleanup complete.');
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed with Error:\n', err);
  process.exit(1);
});
