const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateUpdateBannerConfig } = require('../middleware/validation');

// ==========================================
// 1. PUBLIC PROMOTIONAL BANNER ENDPOINTS
// ==========================================
router.get('/', bannerController.getPublicBanner);

// ==========================================
// 2. ADMIN BANNER MANAGEMENT ENDPOINTS
// ==========================================
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  bannerController.getAdminBanner
);

router.put(
  '/admin',
  authenticate,
  requireRole('admin'),
  validateUpdateBannerConfig,
  bannerController.updateAdminBanner
);

module.exports = router;
