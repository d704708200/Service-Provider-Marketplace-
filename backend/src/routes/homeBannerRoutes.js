const express = require('express');
const homeBannerController = require('../controllers/homeBannerController');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validateObjectId,
  validateCreateHomeBanner,
  validateUpdateHomeBanner,
  validateReorderHomeBanners
} = require('../middleware/validation');
const { uploadSingleBannerImage } = require('../middleware/upload');

// ==========================================
// 1. Public Customer Router (GET /api/home-banners)
// ==========================================
const publicRouter = express.Router();

// Retrieve all currently active and scheduled home screen slider banners
publicRouter.get('/', homeBannerController.getPublicHomeBanners);

// ==========================================
// 2. Admin Router (Mounted at /api/admin/home-banners)
// ==========================================
const adminRouter = express.Router();

// Enforce admin authentication & authorization for all admin routes
adminRouter.use(authenticate, requireRole('admin'));

// List all banners (with search / filter)
adminRouter.get('/', homeBannerController.getAdminHomeBanners);

// Create new banner with optional image upload
adminRouter.post(
  '/',
  uploadSingleBannerImage('image'),
  validateCreateHomeBanner,
  homeBannerController.createAdminHomeBanner
);

// Reorder banners (must come before /:id)
adminRouter.patch(
  '/reorder',
  validateReorderHomeBanners,
  homeBannerController.reorderAdminHomeBanners
);

// Get single banner details
adminRouter.get(
  '/:id',
  validateObjectId('id'),
  homeBannerController.getAdminHomeBannerById
);

// Update banner with optional image upload
adminRouter.put(
  '/:id',
  validateObjectId('id'),
  uploadSingleBannerImage('image'),
  validateUpdateHomeBanner,
  homeBannerController.updateAdminHomeBanner
);

// Delete banner
adminRouter.delete(
  '/:id',
  validateObjectId('id'),
  homeBannerController.deleteAdminHomeBanner
);

// Toggle active status
adminRouter.patch(
  '/:id/status',
  validateObjectId('id'),
  homeBannerController.toggleAdminHomeBannerStatus
);

module.exports = {
  publicRouter,
  adminRouter
};

