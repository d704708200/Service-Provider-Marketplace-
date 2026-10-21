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

// Customer: Submit review for a completed booking
router.post(
  '/',
  authenticate,
  requireRole('customer'),
  reviewController.createCustomerReview
);

// Customer: Get authenticated customer's submitted reviews
router.get(
  '/my-reviews',
  authenticate,
  requireRole('customer'),
  reviewController.getCustomerReviews
);

// Customer: Check review status for a specific booking
router.get(
  '/booking/:bookingId',
  authenticate,
  requireRole('customer'),
  validateObjectId('bookingId'),
  reviewController.getBookingReview
);

// Public: Get reviews for a provider
router.get(
  '/provider/:providerId',
  validateObjectId('providerId'),
  reviewController.getProviderPublicReviews
);

module.exports = router;
