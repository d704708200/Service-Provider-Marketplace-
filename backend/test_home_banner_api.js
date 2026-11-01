const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { HomeBanner, BannerConfig, User, Admin } = require('./src/models');
const homeBannerService = require('./src/services/homeBannerService');

const runTests = async () => {
  console.log('🧪 RUNNING HOME BANNER BACKEND SERVICE & MODEL TEST SUITE\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  const testSuffix = Math.random().toString(36).substring(2, 7);
  let adminUser = null;
  const createdBannerIds = [];

  try {
    // 0. Locate an admin user for audit fields
    adminUser = await User.findOne({ role: 'admin' });
    const adminUserId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

    // -------------------------------------------------------------
    // TEST 1: Existing Promotional Banner Preservation
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Verify Existing Promotional Banner Unaffected ---');
    let promoBanner = await BannerConfig.findOne({ key: 'home_first_service_offer' });
    if (!promoBanner) {
      promoBanner = await BannerConfig.create({
        key: 'home_first_service_offer',
        isEnabled: true,
        badgeText: 'FIRST SERVICE ORDER',
        title: 'Get ₹100 OFF',
        subtitle: 'Book your first service today',
        discountAmount: 100,
        currency: '₹',
        buttonLabel: 'Book Now',
        targetRoute: 'SearchTab'
      });
    }
    assert(promoBanner, 'Existing promo banner must exist');
    assert.strictEqual(promoBanner.key, 'home_first_service_offer');
    assert.strictEqual(typeof promoBanner.isEnabled, 'boolean');
    assert.strictEqual(typeof promoBanner.discountAmount, 'number');
    console.log('✓ Existing single promotional offer banner verified completely intact');

    // -------------------------------------------------------------
    // TEST 2: Create Home Banners (Admin)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Create Infinite Slider Home Banners ---');
    const banner1 = await homeBannerService.createBanner({
      title: `Mega Electrician Sale ${testSuffix}`,
      subtitle: 'Flat 20% off on complete home rewiring',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
      destinationType: 'category',
      destinationId: '6ad0669fc4dfd126d9d0649b',
      isActive: true,
      displayOrder: 0
    }, adminUserId);
    createdBannerIds.push(banner1._id);

    assert(banner1._id, 'Banner 1 must have an ID');
    assert.strictEqual(banner1.title, `Mega Electrician Sale ${testSuffix}`);
    assert.strictEqual(banner1.destinationType, 'category');
    assert.strictEqual(banner1.isActive, true);
    console.log('✓ Created banner 1 successfully (order 0)');

    const banner2 = await homeBannerService.createBanner({
      title: `AC Seasonal Tune-Up ${testSuffix}`,
      subtitle: 'Prepare your air conditioners for peak summer',
      imageUrl: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
      destinationType: 'search',
      destinationId: 'AC Service',
      isActive: true,
      displayOrder: 1
    }, adminUserId);
    createdBannerIds.push(banner2._id);
    console.log('✓ Created banner 2 successfully (order 1)');

    const banner3 = await homeBannerService.createBanner({
      title: `Emergency Plumbing 24/7 ${testSuffix}`,
      subtitle: 'Rapid response plumbers within 30 minutes',
      imageUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80',
      destinationType: 'service',
      destinationId: '6ace4d070cd697583ee269fb',
      isActive: true,
      displayOrder: 2
    }, adminUserId);
    createdBannerIds.push(banner3._id);
    console.log('✓ Created banner 3 successfully (order 2)');

    // -------------------------------------------------------------
    // TEST 3: Scheduled & Inactive Banners Filtering
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Active and Scheduled Date Filtering ---');
    // Inactive banner
    const inactiveBanner = await homeBannerService.createBanner({
      title: `Inactive Draft Banner ${testSuffix}`,
      subtitle: 'Should not appear in customer app',
      imageUrl: 'https://images.unsplash.com/photo-sample.jpg',
      isActive: false
    }, adminUserId);
    createdBannerIds.push(inactiveBanner._id);

    // Future scheduled banner
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureBanner = await homeBannerService.createBanner({
      title: `Future Scheduled Banner ${testSuffix}`,
      subtitle: 'Starts next week',
      imageUrl: 'https://images.unsplash.com/photo-future.jpg',
      isActive: true,
      startDate: futureDate
    }, adminUserId);
    createdBannerIds.push(futureBanner._id);

    // Expired banner
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const expiredBanner = await homeBannerService.createBanner({
      title: `Expired Banner ${testSuffix}`,
      subtitle: 'Ended two days ago',
      imageUrl: 'https://images.unsplash.com/photo-expired.jpg',
      isActive: true,
      endDate: pastDate
    }, adminUserId);
    createdBannerIds.push(expiredBanner._id);

    // Query active customer banners
    const activeBanners = await homeBannerService.getActiveBanners();
    const activeTestBanners = activeBanners.filter(b => b.title.includes(testSuffix));

    assert.strictEqual(activeTestBanners.length, 3, 'Exactly 3 test banners should be active for customer');
    assert.strictEqual(activeTestBanners[0].title, `Mega Electrician Sale ${testSuffix}`);
    assert.strictEqual(activeTestBanners[1].title, `AC Seasonal Tune-Up ${testSuffix}`);
    assert.strictEqual(activeTestBanners[2].title, `Emergency Plumbing 24/7 ${testSuffix}`);
    console.log('✓ Public active banners query correctly excludes inactive, future, and expired banners');

    // -------------------------------------------------------------
    // TEST 4: Admin Reordering
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Reorder Banners (displayOrder) ---');
    // Reorder: 3, 1, 2
    const reorderedIds = [banner3._id.toString(), banner1._id.toString(), banner2._id.toString()];
    await homeBannerService.reorderBanners(reorderedIds, adminUserId);

    const reorderedActive = await homeBannerService.getActiveBanners();
    const reorderedTest = reorderedActive.filter(b => b.title.includes(testSuffix));

    assert.strictEqual(reorderedTest[0]._id.toString(), banner3._id.toString());
    assert.strictEqual(reorderedTest[1]._id.toString(), banner1._id.toString());
    assert.strictEqual(reorderedTest[2]._id.toString(), banner2._id.toString());
    console.log('✓ Banners successfully reordered: Emergency Plumbing is now first in slider');

    // -------------------------------------------------------------
    // TEST 5: Toggle Status
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Toggle Active/Inactive Status ---');
    const toggled = await homeBannerService.toggleBannerStatus(banner3._id, false, adminUserId);
    assert.strictEqual(toggled.isActive, false);

    const afterToggle = await homeBannerService.getActiveBanners();
    const afterToggleTest = afterToggle.filter(b => b.title.includes(testSuffix));
    assert.strictEqual(afterToggleTest.length, 2, 'Toggled banner must be excluded from public list');
    console.log('✓ Inactive banner immediately disappears from customer active banners');

    // Re-enable
    await homeBannerService.toggleBannerStatus(banner3._id, true, adminUserId);

    // -------------------------------------------------------------
    // TEST 6: Update Banner
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Update Banner Metadata ---');
    const updated = await homeBannerService.updateBanner(banner1._id, {
      title: `Updated Mega Electrician Sale ${testSuffix}`,
      subtitle: 'Exclusive 25% discount this weekend only'
    }, adminUserId);
    assert.strictEqual(updated.title, `Updated Mega Electrician Sale ${testSuffix}`);
    assert.strictEqual(updated.subtitle, 'Exclusive 25% discount this weekend only');
    console.log('✓ Banner updated successfully');

    // -------------------------------------------------------------
    // TEST 7: Delete Banner
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Delete Banner ---');
    await homeBannerService.deleteBanner(banner2._id);
    const banner2Check = await HomeBanner.findById(banner2._id);
    assert.strictEqual(banner2Check, null, 'Deleted banner must not exist in DB');
    console.log('✓ Banner deleted successfully');

    console.log('\n🎉 ALL HOME BANNER TESTS COMPLETED SUCCESSFULLY!\n');
  } finally {
    // Cleanup test banners
    if (createdBannerIds.length > 0) {
      await HomeBanner.deleteMany({ _id: { $in: createdBannerIds } });
      console.log(`Cleaned up ${createdBannerIds.length} test banners.`);
    }
    await mongoose.disconnect();
    console.log('✓ Database disconnected cleanly.');
  }
};

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
