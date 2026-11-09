const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const providerController = require('../controllers/providerController');
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

// --- Service-Level Radius & Location Management ---

// GET /api/provider/my-services/service-areas - View configured service locations & radii
router.get('/service-areas', providerController.getProviderServiceAreaConfigs);

// GET /api/provider/my-services/radius-options/:categoryId - View allowed radius options for a category
router.get(
  '/radius-options/:categoryId',
  validateObjectId('categoryId'),
  providerController.getProviderAllowedRadiusOptions
);

// PUT /api/provider/my-services/service-areas - Save/update service location and radius
router.put('/service-areas', providerController.updateProviderServiceAreaConfig);

// DELETE /api/provider/my-services/service-areas/:categoryId - Remove service area config
router.delete(
  '/service-areas/:categoryId',
  validateObjectId('categoryId'),
  providerController.deleteProviderServiceAreaConfig
);

module.exports = router;

