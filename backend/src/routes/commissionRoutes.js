const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');
const { authenticate, requireRole } = require('../middleware/auth');

// All commission monitoring routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// KPI Dashboard metrics
router.get('/dashboard', commissionController.getDashboard);

// Transactions table listing & filters
router.get('/transactions', commissionController.getTransactions);

// CSV Export
router.get('/export', commissionController.exportCsv);

// Booking platform commission breakdown
router.get('/booking/:bookingId', commissionController.getBookingBreakdown);

// Audited manual adjustment or reversal
router.post('/transactions/:id/adjust', commissionController.adjustTransaction);

module.exports = router;

