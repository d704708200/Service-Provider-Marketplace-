const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validateObjectId,
  validateCreateBooking,
  validateCancelBooking,
  validateRejectBooking
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

// Complete service (in_progress -> completed)
router.patch(
  '/provider/:id/complete',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  bookingController.completeProviderService
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
