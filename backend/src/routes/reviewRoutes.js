const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// List reviews (admin only)
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  reviewController.getAdminReviews
);

// Toggle review visibility / moderation status
router.patch(
  '/admin/:id/visibility',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  reviewController.updateReviewVisibility
);

// Delete review (admin only)
router.delete(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  reviewController.deleteReviewByAdmin
);

module.exports = router;
