const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// =========================================================
// 1. PUBLIC / CUSTOMER / PROVIDER DISCOVERY ROUTES
// =========================================================

// GET /api/tags - List active tags (can filter by category, subcategory, search)
router.get('/', tagController.getTags);

// GET /api/tags/:id - Get single tag details
router.get('/:id', validateObjectId('id'), tagController.getTagById);

// =========================================================
// 2. ADMIN-ONLY MANAGEMENT ROUTES
// =========================================================

// POST /api/tags - Admin create new service tag
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  tagController.createTag
);

// PUT /api/tags/:id - Admin update service tag
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  tagController.updateTag
);

// PATCH /api/tags/:id/status - Admin update active / visibility status
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  tagController.updateTagStatus
);

// DELETE /api/tags/:id - Admin safe delete or archive tag
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  tagController.deleteTag
);

// GET /api/tags/:id/providers - Admin view providers associated with tag
router.get(
  '/:id/providers',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  tagController.getTagProviders
);

module.exports = router;

