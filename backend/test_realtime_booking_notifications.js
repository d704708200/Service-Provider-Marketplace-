const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const {
  User,
  Customer,
  Provider,
  Category,
  Service,
  Booking,
  Notification,
  DeviceToken
} = require('./src/models');
const notificationService = require('./src/services/notificationService');
const bookingService = require('./src/services/bookingService');
const { setMockMessaging } = require('./src/config/firebase');

const runTests = async () => {
  console.log('🧪 RUNNING REAL-TIME BOOKING NOTIFICATION & BELL BADGE INTEGRATION TEST SUITE\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  const testSuffix = Math.random().toString(36).substring(2, 8);

  // Capture mock multicast messages
  let capturedMulticasts = [];
  const mockMessaging = {
    sendEachForMulticast: async (payload) => {
      capturedMulticasts.push(payload);
      return {
        successCount: payload.tokens.length,
        failureCount: 0,
        responses: payload.tokens.map(() => ({ success: true }))
      };
    }
  };
  setMockMessaging(mockMessaging);

  // Test entities
  let customerUser, customerDoc;
  let assignedProviderUser, assignedProviderDoc;
  let unrelatedProviderUser, unrelatedProviderDoc;
  let testCategory, testService;
  let testBooking;

  const assignedProviderToken = `fcm_assigned_prov_${testSuffix}`;
  const unrelatedProviderToken = `fcm_unrelated_prov_${testSuffix}`;
  const customerToken = `fcm_customer_${testSuffix}`;

  try {
    // -------------------------------------------------------------
    // SETUP: Create test users, customer, providers, and service
    // -------------------------------------------------------------
    customerUser = await User.create({
      name: `Test Customer ${testSuffix}`,
      email: `cust_${testSuffix}@example.com`,
      password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'customer'
    });
    customerDoc = await Customer.create({
      user: customerUser._id,
      phone: customerUser.phone
    });

    testCategory = await Category.create({
      name: `Cleaning ${testSuffix}`,
      slug: `cleaning-${testSuffix}`,
      isActive: true
    });

    testService = await Service.create({
      name: `Deep House Cleaning ${testSuffix}`,
      category: testCategory._id,
      price: 1499,
      priceType: 'fixed',
      isActive: true
    });

    assignedProviderUser = await User.create({
      name: `Assigned Provider ${testSuffix}`,
      email: `prov_assigned_${testSuffix}@example.com`,
      password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'provider'
    });
    assignedProviderDoc = await Provider.create({
      user: assignedProviderUser._id,
      businessName: `Assigned Experts ${testSuffix}`,
      phone: assignedProviderUser.phone,
      verificationStatus: 'verified',
      isAvailable: true,
      categories: [testCategory._id]
    });

    unrelatedProviderUser = await User.create({
      name: `Unrelated Provider ${testSuffix}`,
      email: `prov_unrelated_${testSuffix}@example.com`,
      password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'provider'
    });
    unrelatedProviderDoc = await Provider.create({
      user: unrelatedProviderUser._id,
      businessName: `Unrelated Experts ${testSuffix}`,
      phone: unrelatedProviderUser.phone,
      verificationStatus: 'verified',
      isAvailable: true,
      categories: [testCategory._id]
    });

    // Register active device tokens
    await notificationService.registerDeviceToken(assignedProviderUser._id, 'provider', {
      token: assignedProviderToken,
      platform: 'android'
    });
    await notificationService.registerDeviceToken(unrelatedProviderUser._id, 'provider', {
      token: unrelatedProviderToken,
      platform: 'android'
    });
    await notificationService.registerDeviceToken(customerUser._id, 'customer', {
      token: customerToken,
      platform: 'android'
    });

    // -------------------------------------------------------------
    // TEST 1 & 2: Successful booking creation notifies assigned provider only
    // -------------------------------------------------------------
    console.log('--- Test 1 & 2: Booking Creation Notification Targeting ---');
    capturedMulticasts = [];

    const bookingInput = {
      providerId: assignedProviderDoc._id.toString(),
      serviceId: testService._id.toString(),
      bookingMode: 'scheduled',
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: {
        street: '123 Market St',
        city: 'Indore',
        state: 'MP',
        zipCode: '452001'
      },
      paymentMethod: 'cash'
    };

    testBooking = await bookingService.createBooking(customerUser._id, bookingInput);
    assert(testBooking, 'Booking created successfully in MongoDB');

    // Check multicast messages
    const providerDispatch = capturedMulticasts.find(m => m.tokens.includes(assignedProviderToken));
    assert(providerDispatch, 'Assigned provider received FCM push notification');
    assert.strictEqual(providerDispatch.notification.title, 'New Booking Request');
    assert(providerDispatch.notification.body.includes(testService.name));
    assert(providerDispatch.notification.body.includes(testBooking.bookingReference));
    assert.strictEqual(providerDispatch.data.bookingId, testBooking._id.toString());
    assert.strictEqual(providerDispatch.data.bookingReference, testBooking.bookingReference);
    assert.strictEqual(providerDispatch.android.notification.channelId, 'default');
    assert.strictEqual(providerDispatch.android.notification.priority, 'max');

    // Check unrelated provider DID NOT receive the notification
    const unrelatedDispatch = capturedMulticasts.find(m => m.tokens.includes(unrelatedProviderToken));
    assert.strictEqual(unrelatedDispatch, undefined, 'Unrelated provider did NOT receive notification');
    console.log('✓ Test 1 Passed: Assigned provider received "New Booking Request" with full details');
    console.log('✓ Test 2 Passed: Unrelated provider was not notified');

    // -------------------------------------------------------------
    // TEST 3: Provider acceptance sends "Booking Confirmed" to correct customer
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Provider Acceptance Sends "Booking Confirmed" to Customer ---');
    capturedMulticasts = [];

    const acceptedBooking = await bookingService.acceptBookingByProvider(
      assignedProviderUser._id,
      testBooking._id
    );
    assert.strictEqual(acceptedBooking.status, 'accepted');

    const customerConfirmDispatch = capturedMulticasts.find(m => m.tokens.includes(customerToken));
    assert(customerConfirmDispatch, 'Customer received confirmation FCM push notification');
    assert.strictEqual(customerConfirmDispatch.notification.title, 'Booking Confirmed');
    assert(customerConfirmDispatch.notification.body.includes(assignedProviderDoc.businessName));
    assert(customerConfirmDispatch.notification.body.includes(testBooking.bookingReference));
    assert.strictEqual(customerConfirmDispatch.data.bookingId, testBooking._id.toString());
    assert.strictEqual(customerConfirmDispatch.data.status, 'accepted');
    console.log('✓ Test 3 Passed: Customer received "Booking Confirmed" notification upon provider acceptance');

    // -------------------------------------------------------------
    // TEST 4: Failed operations do not send false success notifications
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Failed Operations Do Not Send False Notifications ---');
    capturedMulticasts = [];

    // Attempt to accept already-accepted booking
    try {
      await bookingService.acceptBookingByProvider(assignedProviderUser._id, testBooking._id);
      assert.fail('Should have thrown error on double accept');
    } catch (err) {
      assert(err.statusCode === 409, 'Double accept rejected with 409 conflict');
    }
    assert.strictEqual(capturedMulticasts.length, 0, 'No notification dispatched on failed accept');

    // Attempt booking with non-existent provider
    try {
      await bookingService.createBooking(customerUser._id, {
        ...bookingInput,
        providerId: new mongoose.Types.ObjectId().toString()
      });
      assert.fail('Should have thrown error on non-existent provider');
    } catch (err) {
      assert(err.statusCode === 404);
    }
    assert.strictEqual(capturedMulticasts.length, 0, 'No notification dispatched on failed booking creation');
    console.log('✓ Test 4 Passed: Failed operations correctly abort before notification dispatch');

    // -------------------------------------------------------------
    // TEST 5: Repeated requests do not create duplicate notifications (Idempotency)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Idempotency & Deduplication ---');
    capturedMulticasts = [];

    const dupKey = `booking_test_dup_${testSuffix}`;
    const firstDispatch = await notificationService.sendNotification({
      recipientIds: [customerUser._id],
      title: 'Booking Confirmed',
      body: 'Your booking has been confirmed.',
      idempotencyKey: dupKey
    });
    assert.strictEqual(firstDispatch.success, true);
    assert.strictEqual(capturedMulticasts.length, 1);

    const secondDispatch = await notificationService.sendNotification({
      recipientIds: [customerUser._id],
      title: 'Booking Confirmed',
      body: 'Your booking has been confirmed.',
      idempotencyKey: dupKey
    });
    assert.strictEqual(secondDispatch.deduplicated, true, 'Second call was deduplicated');
    assert.strictEqual(capturedMulticasts.length, 1, 'No duplicate FCM dispatch occurred');
    console.log('✓ Test 5 Passed: Rapid duplicate notification was safely suppressed');

    // -------------------------------------------------------------
    // TEST 6: Customer and provider unread counts remain separate and accurate
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Recipient Isolation & Unread Counts ---');
    const custCount = await notificationService.getUnreadNotificationCount(customerUser._id);
    const provCount = await notificationService.getUnreadNotificationCount(assignedProviderUser._id);
    const unrelatedCount = await notificationService.getUnreadNotificationCount(unrelatedProviderUser._id);

    assert(custCount.unreadCount > 0, 'Customer has unread notifications');
    assert(provCount.unreadCount > 0, 'Assigned provider has unread notifications');
    assert.strictEqual(unrelatedCount.unreadCount, 0, 'Unrelated provider unread count is 0');
    console.log(`✓ Test 6 Passed: Unread counts isolated (Customer: ${custCount.unreadCount}, Provider: ${provCount.unreadCount}, Unrelated: ${unrelatedCount.unreadCount})`);

    // -------------------------------------------------------------
    // TEST 7: Reading a notification decreases unread count correctly
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Decrement Unread Count On Mark Read ---');
    const { notifications: custNotifs } = await notificationService.getUserNotifications(customerUser._id);
    assert(custNotifs.length > 0);
    const notifToRead = custNotifs[0];

    const initialUnread = custCount.unreadCount;
    await notificationService.markNotificationRead(customerUser._id, notifToRead._id);

    const updatedCustCount = await notificationService.getUnreadNotificationCount(customerUser._id);
    assert.strictEqual(updatedCustCount.unreadCount, initialUnread - 1, 'Unread count decreased by 1');
    console.log(`✓ Test 7 Passed: Unread count decreased from ${initialUnread} to ${updatedCustCount.unreadCount}`);

    // -------------------------------------------------------------
    // TEST 8: Mark All as Read sets count to 0
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Mark All As Read Clears Unread Count ---');
    await notificationService.markAllNotificationsRead(customerUser._id);
    const clearedCount = await notificationService.getUnreadNotificationCount(customerUser._id);
    assert.strictEqual(clearedCount.unreadCount, 0, 'Customer unread count is now 0');

    // Verify provider unread count was NOT affected
    const provCountAfter = await notificationService.getUnreadNotificationCount(assignedProviderUser._id);
    assert(provCountAfter.unreadCount > 0, 'Provider unread count remained intact');
    console.log('✓ Test 8 Passed: Customer unread count is 0 while Provider unread count was preserved');

    // -------------------------------------------------------------
    // TEST 9: Notification payload navigation metadata
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Notification Payload Navigation Metadata ---');
    const { notifications: provNotifs } = await notificationService.getUserNotifications(assignedProviderUser._id);
    const bookingNotif = provNotifs.find(n => n.data && n.data.bookingId);
    assert(bookingNotif, 'Found notification with bookingId data');
    assert.strictEqual(bookingNotif.data.bookingId, testBooking._id.toString());
    assert.strictEqual(bookingNotif.data.bookingReference, testBooking.bookingReference);
    console.log('✓ Test 9 Passed: Notification payload correctly links to booking details screen navigation');

    console.log('\n🎉 ALL 9 REAL-TIME BOOKING NOTIFICATION & BELL BADGE TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    // Clean up test records
    console.log('Cleaning up test documents...');
    if (customerUser) await User.deleteOne({ _id: customerUser._id });
    if (customerDoc) await Customer.deleteOne({ _id: customerDoc._id });
    if (assignedProviderUser) await User.deleteOne({ _id: assignedProviderUser._id });
    if (assignedProviderDoc) await Provider.deleteOne({ _id: assignedProviderDoc._id });
    if (unrelatedProviderUser) await User.deleteOne({ _id: unrelatedProviderUser._id });
    if (unrelatedProviderDoc) await Provider.deleteOne({ _id: unrelatedProviderDoc._id });
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });
    if (testService) await Service.deleteOne({ _id: testService._id });
    if (testBooking) await Booking.deleteOne({ _id: testBooking._id });
    await Notification.deleteMany({
      recipient: { $in: [customerUser?._id, assignedProviderUser?._id, unrelatedProviderUser?._id].filter(Boolean) }
    });
    await DeviceToken.deleteMany({
      user: { $in: [customerUser?._id, assignedProviderUser?._id, unrelatedProviderUser?._id].filter(Boolean) }
    });
    await mongoose.disconnect();
    console.log('✓ Database disconnected cleanly.');
  }
};

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
