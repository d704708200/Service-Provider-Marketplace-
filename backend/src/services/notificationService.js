const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const { getFirebaseMessaging, isFirebaseConfigured } = require('../config/firebase');

// In-memory idempotency cache for deduplication within short intervals (60s TTL)
const deduplicationCache = new Map();
const DEDUP_WINDOW_MS = 60 * 1000;

const cleanupDeduplicationCache = () => {
  const now = Date.now();
  for (const [key, timestamp] of deduplicationCache.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      deduplicationCache.delete(key);
    }
  }
};

/**
 * Register or refresh an FCM device push token
 */
const registerDeviceToken = async (userId, role, tokenData) => {
  const { token, platform = 'android', deviceModel = null, appVersion = null } = tokenData;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    const error = new Error('Device push token is required');
    error.statusCode = 400;
    throw error;
  }

  const cleanToken = token.trim();

  // Upsert token: if this token was previously registered to another user/device, reassign to current user
  const updatedDevice = await DeviceToken.findOneAndUpdate(
    { token: cleanToken },
    {
      $set: {
        user: userId,
        role,
        platform,
        deviceModel,
        appVersion,
        isActive: true,
        lastUsedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return updatedDevice;
};

/**
 * Deactivate or unregister an FCM token on logout
 */
const unregisterDeviceToken = async (userId, token) => {
  if (!token) {
    // If no specific token passed, deactivate all tokens for this user
    await DeviceToken.updateMany(
      { user: userId },
      { $set: { isActive: false, lastUsedAt: new Date() } }
    );
    return { success: true, message: 'All device tokens deactivated' };
  }

  const result = await DeviceToken.findOneAndUpdate(
    { user: userId, token: token.trim() },
    { $set: { isActive: false, lastUsedAt: new Date() } },
    { new: true }
  );

  return { success: true, deactivated: Boolean(result) };
};

/**
 * Retrieve paginated notifications for authenticated user
 */
const getUserNotifications = async (userId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { recipient: userId };
  if (query.unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, isRead: false })
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get unread notification count
 */
const getUnreadNotificationCount = async (userId) => {
  const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });
  return { unreadCount };
};

/**
 * Mark a single notification as read
 */
const markNotificationRead = async (userId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    const error = new Error('Notification not found or access denied');
    error.statusCode = 404;
    throw error;
  }

  return notification;
};

/**
 * Mark all notifications as read for a user
 */
const markAllNotificationsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount
  };
};

/**
 * Send push notification and persist in MongoDB
 * Handles:
 * - Deduplication via idempotencyKey
 * - Persisting Notification records in MongoDB
 * - Querying active DeviceTokens
 * - Safe dispatch via FCM v1 sendEachForMulticast
 * - Automatic deactivation of invalid/expired FCM tokens
 * - Never throwing unhandled errors to avoid breaking callers
 */
const sendNotification = async ({
  recipientIds,
  title,
  body,
  type = 'booking',
  data = {},
  bookingId = null,
  idempotencyKey = null
}) => {
  try {
    if (!recipientIds) return { success: false, reason: 'No recipients provided' };

    const ids = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
    if (ids.length === 0) return { success: false, reason: 'Empty recipient list' };

    // Idempotency check
    if (idempotencyKey) {
      cleanupDeduplicationCache();
      if (deduplicationCache.has(idempotencyKey)) {
        return { success: true, deduplicated: true };
      }
      deduplicationCache.set(idempotencyKey, Date.now());
    }

    // 1. Persist notification in database for all recipients
    const notifDocs = ids.map((userId) => ({
      recipient: userId,
      title,
      message: body,
      type: type || 'booking',
      data: {
        ...data,
        bookingId: bookingId ? String(bookingId) : undefined
      },
      isRead: false
    }));

    let savedNotifs = [];
    try {
      savedNotifs = await Notification.insertMany(notifDocs);
    } catch (dbErr) {
      console.error('[NotificationService] Error saving in-app notifications:', dbErr.message);
    }

    // 2. Fetch active device tokens for all recipients
    const deviceTokens = await DeviceToken.find({
      user: { $in: ids },
      isActive: true
    }).select('token user');

    if (!deviceTokens || deviceTokens.length === 0) {
      return {
        success: true,
        inAppSaved: savedNotifs.length,
        pushSent: 0,
        reason: 'No active device tokens found'
      };
    }

    const tokens = [...new Set(deviceTokens.map((dt) => dt.token))];

    // 3. Dispatch via FCM if messaging is available
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      return {
        success: true,
        inAppSaved: savedNotifs.length,
        pushSent: 0,
        reason: 'Firebase Messaging not configured or in standby mode'
      };
    }

    // Prepare payload (FCM data values must be strings)
    const stringifiedData = {
      title: String(title || ''),
      body: String(body || ''),
      type: String(type || 'booking')
    };

    if (bookingId) {
      stringifiedData.bookingId = String(bookingId);
    }

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }

    const multicastMessage = {
      tokens,
      notification: {
        title,
        body
      },
      data: stringifiedData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          priority: 'max',
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      }
    };

    const response = await messaging.sendEachForMulticast(multicastMessage);

    // 4. Handle expired/invalid tokens and deactivate them
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errorCode = resp.error.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await DeviceToken.updateMany(
        { token: { $in: invalidTokens } },
        { $set: { isActive: false, lastUsedAt: new Date() } }
      );
    }

    return {
      success: true,
      inAppSaved: savedNotifs.length,
      pushSent: response.successCount,
      pushFailed: response.failureCount,
      invalidTokensCleaned: invalidTokens.length
    };
  } catch (error) {
    // Failure of push notification must never crash or throw to caller
    console.error('[NotificationService] Error dispatching push notification:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  registerDeviceToken,
  unregisterDeviceToken,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  sendNotification
};
