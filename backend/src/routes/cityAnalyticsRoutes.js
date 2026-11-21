const express = require('express');
const router = express.Router();
const cityAnalyticsController = require('../controllers/cityAnalyticsController');
const { authenticate, requireRole } = require('../middleware/auth');

// All analytics routes require Super Admin / Admin role
router.use(authenticate, requireRole('admin'));

// GET /api/admin/analytics/cities/export - CSV export
router.get('/cities/export', cityAnalyticsController.exportCityAnalyticsCSV);

// GET /api/admin/analytics/cities - Overview and aggregated city-wise table
router.get('/cities', cityAnalyticsController.getCityAnalytics);

// GET /api/admin/analytics/cities/:city/bookings - Paginated bookings for selected city
router.get('/cities/:city/bookings', cityAnalyticsController.getCityBookings);

// GET /api/admin/analytics/cities/:city/summary - Detailed summary & charts for selected city
router.get('/cities/:city/summary', cityAnalyticsController.getCitySummary);

module.exports = router;
