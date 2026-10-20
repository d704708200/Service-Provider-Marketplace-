const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validateObjectId,
  validateCreateBooking,
  validateCancelBooking,
  validateRejectBooking,
  validateVerifyPayment,
  validateSubmitSpareParts,
  validateReviewSpareParts
} = require('../middleware/validation');

// ==========================================
// 1. Customer Booking Routes (Role: customer)
// ==========================================

// Create booking (instant or scheduled)
router.post(
  '/',
  authenticate,
  requireRole('customer'),
  validateCreateBooking,
  bookingController.createBooking
);

// List authenticated customer's bookings
router.get(
  '/customer',
  authenticate,
  requireRole('customer'),
  bookingController.getCustomerBookings
);

// Get single customer booking details
router.get(
  '/customer/:id',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.getCustomerBookingById
);

// Cancel customer booking
router.patch(
  '/customer/:id/cancel',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  validateCancelBooking,
  bookingController.cancelCustomerBooking
);

// Customer reviews (approve / reject) proposed spare parts
router.patch(
  '/customer/:id/spare-parts/review',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  validateReviewSpareParts,
  bookingController.reviewSpareParts
);

// Customer creates Razorpay order for approved spare parts
router.post(
  '/customer/:id/spare-parts/payment/order',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.createSparePartsPaymentOrder
);

// Customer verifies Razorpay payment for approved spare parts
router.post(
  '/customer/:id/spare-parts/payment/verify',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  validateVerifyPayment,
  bookingController.verifySparePartsPayment
);

// Customer reports spare parts payment cancelled or failed
router.post(
  '/customer/:id/spare-parts/payment/failure',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.recordSparePartsPaymentFailure
);

// Initiate Razorpay payment order for customer booking
router.post(
  '/customer/:id/payment/order',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.createPaymentOrder
);

// Verify Razorpay payment signature for customer booking
router.post(
  '/customer/:id/payment/verify',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  validateVerifyPayment,
  bookingController.verifyPayment
);

// Record payment failure or cancellation for customer booking
router.post(
  '/customer/:id/payment/failure',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.recordPaymentFailure
);

// ==========================================
// 2. Provider Booking Routes (Role: provider)
// ==========================================

// List pending requests (assigned + instant pool)
router.get(
  '/provider/requests',
  authenticate,
  requireRole('provider'),
  bookingController.getProviderRequests
);

// List provider booking history
router.get(
  '/provider/history',
  authenticate,
  requireRole('provider'),
  bookingController.getProviderHistory
);

// Get single booking details for provider
router.get(
  '/provider/:id',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  bookingController.getProviderBookingById
);

// Accept booking request (concurrency-safe atomic claim)
router.patch(
  '/provider/:id/accept',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  bookingController.acceptProviderBooking
);

// Reject booking request
router.patch(
  '/provider/:id/reject',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  validateRejectBooking,
  bookingController.rejectProviderBooking
);

// Start service (accepted -> in_progress)
router.patch(
  '/provider/:id/start',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  bookingController.startProviderService
);

// Provider submits / updates spare parts charges (accepted or in_progress)
router.post(
  '/provider/:id/spare-parts',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  validateSubmitSpareParts,
  bookingController.submitSpareParts
);

// Provider confirms cash received on service
router.patch(
  '/provider/:id/cash/confirm',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  bookingController.confirmCashPaymentByProvider
);

// Complete service (in_progress -> completed)
router.patch(
  '/provider/:id/complete',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  bookingController.completeProviderService
);

// Customer confirms cash payment
router.patch(
  '/customer/:id/cash/confirm',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.confirmCashPaymentByCustomer
);

// Customer reports cash payment dispute
router.post(
  '/customer/:id/cash/dispute',
  authenticate,
  requireRole('customer'),
  validateObjectId('id'),
  bookingController.reportCashPaymentDispute
);

// ==========================================
// 3. Admin Booking Routes (Role: admin)
// ==========================================

// List all platform bookings with pagination and filters
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  bookingController.getAdminBookings
);

// View single booking details
router.get(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  bookingController.getAdminBookingById
);

// Supervised cancellation by admin
router.patch(
  '/admin/:id/cancel',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateCancelBooking,
  bookingController.cancelAdminBooking
);

module.exports = router;
