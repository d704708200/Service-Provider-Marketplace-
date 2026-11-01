const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// ==========================================
// Device Token Lifecycle (Authenticated)
// ==========================================

// Register / refresh FCM device push token
router.post('/token', authenticate, notificationController.registerToken);

// Unregister / deactivate FCM device push token on logout
router.post('/token/unregister', authenticate, notificationController.unregisterToken);
router.delete('/token', authenticate, notificationController.unregisterToken);

// ==========================================
// Notification History & Read Status
// ==========================================

// Fetch paginated notification history for current user
router.get('/', authenticate, notificationController.getNotifications);

// Fetch unread notification count
router.get('/unread-count', authenticate, notificationController.getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', authenticate, validateObjectId('id'), notificationController.markNotificationAsRead);

// Mark all notifications as read
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

module.exports = router;
