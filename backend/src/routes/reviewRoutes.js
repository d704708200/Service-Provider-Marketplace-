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

// Provider: Get authenticated provider's reviews, rating stats, and distribution
// Registered strictly BEFORE /provider/:providerId so literal 'me' is never matched as a param
router.get(
  '/provider/me',
  authenticate,
  requireRole('provider'),
  reviewController.getProviderReviews
);

// Alias: /api/reviews/me
router.get(
  '/me',
  authenticate,
  requireRole('provider'),
  reviewController.getProviderReviews
);

// Public: Get reviews for a specific provider by ObjectId
// Includes guard so 'me' is never evaluated by validateObjectId
router.get(
  '/provider/:providerId',
  (req, res, next) => {
    if (req.params.providerId === 'me') {
      return authenticate(req, res, () => {
        requireRole('provider')(req, res, () => {
          reviewController.getProviderReviews(req, res, next);
        });
      });
    }
    next();
  },
  validateObjectId('providerId'),
  reviewController.getProviderPublicReviews
);

module.exports = router;
