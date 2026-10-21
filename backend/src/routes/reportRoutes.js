const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requireRole } = require('../middleware/auth');

// Get analytical reports (admin only)
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  reportController.getPlatformReports
);

module.exports = router;
