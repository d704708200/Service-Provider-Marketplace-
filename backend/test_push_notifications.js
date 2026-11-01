const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { User, Notification, DeviceToken } = require('./src/models');
const notificationService = require('./src/services/notificationService');
const { setMockMessaging, initializeFirebase } = require('./src/config/firebase');

const runTests = async () => {
  console.log('🧪 RUNNING PUSH NOTIFICATIONS & DEVICE TOKEN LIFECYCLE TEST SUITE');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  const testSuffix = Math.random().toString(36).substring(2, 7);
  const testUserId1 = new mongoose.Types.ObjectId();
  const testUserId2 = new mongoose.Types.ObjectId();

  const token1 = `fcm_test_tok_device1_${testSuffix}`;
  const token2 = `fcm_test_tok_device2_${testSuffix}`;
  const tokenInvalid = `fcm_test_tok_invalid_${testSuffix}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Register Device Token
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Register Device Token ---');
    const regResult1 = await notificationService.registerDeviceToken(testUserId1, 'customer', {
      token: token1,
      platform: 'android',
      deviceModel: 'Pixel 8',
      appVersion: '1.0.0'
    });
    assert(regResult1, 'Token 1 registered successfully');
    assert.strictEqual(regResult1.token, token1);
    assert.strictEqual(regResult1.isActive, true);
    assert.strictEqual(regResult1.platform, 'android');
    assert.strictEqual(regResult1.user.toString(), testUserId1.toString());
    console.log('✓ Registered initial token for user 1');

    // Support multiple devices for same user
    const regResult2 = await notificationService.registerDeviceToken(testUserId1, 'customer', {
      token: token2,
      platform: 'android',
      deviceModel: 'Samsung S24',
      appVersion: '1.0.0'
    });
    assert(regResult2, 'Token 2 registered successfully');

    const user1Tokens = await DeviceToken.find({ user: testUserId1, isActive: true });
    assert.strictEqual(user1Tokens.length, 2, 'User 1 has 2 active device tokens');
    console.log('✓ Multi-device support verified: User has 2 concurrent active tokens');

    // Reassign token when a new user logs in on same device
    const reassignResult = await notificationService.registerDeviceToken(testUserId2, 'provider', {
      token: token1,
      platform: 'android',
      deviceModel: 'Pixel 8 (New User)',
      appVersion: '1.0.1'
    });
    assert.strictEqual(reassignResult.user.toString(), testUserId2.toString());
    assert.strictEqual(reassignResult.role, 'provider');

    const updatedUser1Tokens = await DeviceToken.find({ user: testUserId1, isActive: true });
    assert.strictEqual(updatedUser1Tokens.length, 1, 'Token 1 cleanly transferred to User 2; User 1 now has 1 token');
    console.log('✓ Device transfer handled cleanly: token reassigned without duplicates');

    // Register an invalid token to test invalidation
    await notificationService.registerDeviceToken(testUserId1, 'customer', {
      token: tokenInvalid,
      platform: 'android'
    });

    // -------------------------------------------------------------
    // TEST 2: Unregister Device Token on Logout
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Unregister Device Token on Logout ---');
    const unregResult = await notificationService.unregisterDeviceToken(testUserId1, token2);
    assert.strictEqual(unregResult.success, true);

    const token2Doc = await DeviceToken.findOne({ token: token2 });
    assert.strictEqual(token2Doc.isActive, false, 'Token 2 is now inactive');
    console.log('✓ Token successfully deactivated upon logout');

    // -------------------------------------------------------------
    // TEST 3: Notification History, Unread Counts, and Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Notification History & Ownership Isolation ---');
    const notifUser1_A = await Notification.create({
      recipient: testUserId1,
      title: 'Booking Confirmed: BK-1001',
      message: 'Your electrical service booking is confirmed.',
      type: 'booking',
      data: { bookingId: 'b1001' },
      isRead: false
    });

    const notifUser1_B = await Notification.create({
      recipient: testUserId1,
      title: 'Provider Arrived: BK-1001',
      message: 'Your service technician has arrived.',
      type: 'booking',
      data: { bookingId: 'b1001' },
      isRead: false
    });

    const notifUser2 = await Notification.create({
      recipient: testUserId2,
      title: 'New Request: BK-2001',
      message: 'New plumbing request in your area.',
      type: 'booking',
      data: { bookingId: 'b2001' },
      isRead: false
    });

    // Fetch user 1 notifications
    const history1 = await notificationService.getUserNotifications(testUserId1);
    assert.strictEqual(history1.notifications.length, 2, 'User 1 sees exactly 2 notifications');
    assert.strictEqual(history1.unreadCount, 2, 'User 1 has 2 unread notifications');

    // Verify ownership isolation: User 1 never sees User 2 notifications
    const hasUser2Notif = history1.notifications.some((n) => n._id.toString() === notifUser2._id.toString());
    assert.strictEqual(hasUser2Notif, false, 'User 1 cannot access User 2 notifications');
    console.log('✓ Ownership isolation strictly enforced');

    // Mark single notification as read
    const readSingle = await notificationService.markNotificationRead(testUserId1, notifUser1_A._id);
    assert.strictEqual(readSingle.isRead, true);

    const countAfterSingle = await notificationService.getUnreadNotificationCount(testUserId1);
    assert.strictEqual(countAfterSingle.unreadCount, 1, 'Unread count updated to 1');
    console.log('✓ Single notification mark-as-read verified');

    // Mark all as read
    const markAllRes = await notificationService.markAllNotificationsRead(testUserId1);
    assert.strictEqual(markAllRes.success, true);

    const countAfterAll = await notificationService.getUnreadNotificationCount(testUserId1);
    assert.strictEqual(countAfterAll.unreadCount, 0, 'Unread count updated to 0');
    console.log('✓ Mark all notifications as read verified');

    // -------------------------------------------------------------
    // TEST 4: Push Notification Dispatch & Mocked FCM Integration
    // -------------------------------------------------------------
    console.log('\n--- Test 4: FCM Push Notification Dispatch & Token Invalidation ---');

    let capturedMulticastMessage = null;
    const mockMessaging = {
      sendEachForMulticast: async (message) => {
        capturedMulticastMessage = message;
        // Simulate response: token1 succeeds, tokenInvalid fails with registration-token-not-registered
        const responses = message.tokens.map((t) => {
          if (t === tokenInvalid) {
            return {
              success: false,
              error: { code: 'messaging/registration-token-not-registered' }
            };
          }
          return { success: true, messageId: `msg_${Math.random()}` };
        });

        const successCount = responses.filter((r) => r.success).length;
        const failureCount = responses.filter((r) => !r.success).length;
        return { responses, successCount, failureCount };
      }
    };

    setMockMessaging(mockMessaging);

    const dispatchResult = await notificationService.sendNotification({
      recipientIds: [testUserId1, testUserId2],
      title: 'Test Push Event',
      body: 'This is a test notification payload',
      type: 'booking',
      data: { testKey: 'testValue' },
      bookingId: 'bk_99999',
      idempotencyKey: `test_event_1_${testSuffix}`
    });

    assert.strictEqual(dispatchResult.success, true);
    assert(capturedMulticastMessage, 'FCM multicast message was created');
    assert.strictEqual(capturedMulticastMessage.notification.title, 'Test Push Event');
    assert.strictEqual(capturedMulticastMessage.notification.body, 'This is a test notification payload');
    assert.strictEqual(capturedMulticastMessage.data.bookingId, 'bk_99999');
    assert.strictEqual(capturedMulticastMessage.android.notification.channelId, 'default');
    console.log('✓ FCM multicast payload correctly structured with high-priority Android channel');

    // Verify invalid token was automatically deactivated in DB
    const invalidDoc = await DeviceToken.findOne({ token: tokenInvalid });
    assert.strictEqual(invalidDoc.isActive, false, 'Invalid FCM token was automatically deactivated');
    console.log('✓ Expired/invalid FCM tokens automatically marked inactive');

    // -------------------------------------------------------------
    // TEST 5: Idempotency & Deduplication
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Notification Deduplication ---');
    const duplicateDispatch = await notificationService.sendNotification({
      recipientIds: [testUserId1],
      title: 'Test Push Event',
      body: 'Duplicate test',
      idempotencyKey: `test_event_1_${testSuffix}`
    });

    assert.strictEqual(duplicateDispatch.deduplicated, true, 'Duplicate notification suppressed');
    console.log('✓ Rapid duplicate notifications safely deduplicated');

    // -------------------------------------------------------------
    // TEST 6: Resilience against FCM Delivery Failures
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Resilience against FCM Delivery Failures ---');
    const failingMessaging = {
      sendEachForMulticast: async () => {
        throw new Error('FCM network failure simulation');
      }
    };
    setMockMessaging(failingMessaging);

    // Call sendNotification and ensure it DOES NOT throw to caller
    const failResult = await notificationService.sendNotification({
      recipientIds: [testUserId2],
      title: 'Resilience Test',
      body: 'Should not crash caller'
    });
    assert.strictEqual(failResult.success, false);
    assert(failResult.error, 'Error captured cleanly without uncaught exception');
    console.log('✓ Push failure handled gracefully without disrupting business logic');

    console.log('\n🎉 ALL PUSH NOTIFICATION & TOKEN LIFECYCLE TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    // Reset mock
    setMockMessaging(null);

    // Teardown test data
    await DeviceToken.deleteMany({ token: { $in: [token1, token2, tokenInvalid] } });
    await Notification.deleteMany({ recipient: { $in: [testUserId1, testUserId2] } });
    await mongoose.disconnect();
    console.log('✓ Test data cleaned up and database disconnected');
  }
};

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
