const notificationService = require('../services/notificationService');

const registerToken = async (req, res, next) => {
  try {
    const { token, platform, deviceModel, appVersion } = req.body;
    const device = await notificationService.registerDeviceToken(req.user._id, req.user.role, {
      token,
      platform,
      deviceModel,
      appVersion
    });

    res.status(200).json({
      success: true,
      message: 'FCM device token registered successfully',
      data: {
        id: device._id,
        platform: device.platform,
        isActive: device.isActive,
        lastUsedAt: device.lastUsedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const unregisterToken = async (req, res, next) => {
  try {
    const token = req.body.token || req.query.token;
    const result = await notificationService.unregisterDeviceToken(req.user._id, token);

    res.status(200).json({
      success: true,
      message: 'FCM device token unregistered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getUserNotifications(req.user._id, req.query);

    res.status(200).json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadNotificationCount(req.user._id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markNotificationRead(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user._id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const sendTestPush = async (req, res, next) => {
  try {
    const title = req.body.title || 'FCM Push Test';
    const body = req.body.body || `Hello ${req.user.name || 'User'}, this is a real FCM push notification from Render production backend!`;

    const result = await notificationService.sendNotification({
      recipientIds: [req.user._id],
      title,
      body,
      type: 'system',
      data: {
        test: 'true',
        userId: req.user._id.toString(),
        timestamp: new Date().toISOString()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Test push notification dispatched',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerToken,
  unregisterToken,
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  sendTestPush
};
