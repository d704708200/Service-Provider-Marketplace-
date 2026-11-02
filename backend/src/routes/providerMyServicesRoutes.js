const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// All routes require authenticated provider
router.use(authenticate, requireRole('provider'));

// GET /api/provider/my-services - View provider tags & catalog
router.get('/', tagController.getProviderServicesAndTags);

// PUT /api/provider/my-services/tags - Save selected tags
router.put('/tags', tagController.updateProviderTags);

// PATCH /api/provider/my-services/tags/:tagId/status - Toggle single tag status
router.patch(
  '/tags/:tagId/status',
  validateObjectId('tagId'),
  tagController.toggleProviderTagStatus
);

module.exports = router;

