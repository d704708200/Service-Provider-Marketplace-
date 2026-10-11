const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validateObjectId,
  validateCreateCategory,
  validateUpdateCategory,
  validateUpdateCategoryStatus
} = require('../middleware/validation');

// Public Category Route (customers / providers)
router.get('/', categoryController.getPublicCategories);

// Admin Category Listing (including inactive, with pagination & stats)
router.get('/admin', authenticate, requireRole('admin'), categoryController.getAdminCategories);

// Retrieve single Category Details (public/authenticated)
router.get('/:id', validateObjectId('id'), categoryController.getCategoryById);

// Admin-only Category Management Routes
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validateCreateCategory,
  categoryController.createCategory
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateUpdateCategory,
  categoryController.updateCategory
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateUpdateCategoryStatus,
  categoryController.updateCategoryStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  categoryController.deleteCategory
);

module.exports = router;
