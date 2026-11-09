const express = require('express');
const router = express.Router();
const serviceRadiusController = require('../controllers/serviceRadiusController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// Public/authenticated view of active radius configurations
router.get('/public', serviceRadiusController.listRadiusConfigs);

// All Admin management routes
router.use(authenticate, requireRole('admin'));

// GET /api/service-radii - List all service radius configs
router.get('/', serviceRadiusController.listRadiusConfigs);

// POST /api/service-radii - Create service radius config
router.post('/', serviceRadiusController.createRadiusConfig);

// GET /api/service-radii/:id - Get config details
router.get('/:id', validateObjectId('id'), serviceRadiusController.getRadiusConfigById);

// PUT /api/service-radii/:id - Update config
router.put('/:id', validateObjectId('id'), serviceRadiusController.updateRadiusConfig);

// POST /api/service-radii/:id/radii - Add new radius option
router.post('/:id/radii', validateObjectId('id'), serviceRadiusController.addRadiusOption);

// PATCH /api/service-radii/:id/radii/:radiusId/status - Toggle radius option active status
router.patch(
  '/:id/radii/:radiusId/status',
  validateObjectId('id'),
  validateObjectId('radiusId'),
  serviceRadiusController.toggleRadiusOption
);

// DELETE /api/service-radii/:id/radii/:radiusId - Delete unused radius option
router.delete(
  '/:id/radii/:radiusId',
  validateObjectId('id'),
  validateObjectId('radiusId'),
  serviceRadiusController.deleteRadiusOption
);

// GET /api/service-radii/:id/providers - View providers configured with radius
router.get('/:id/providers', validateObjectId('id'), serviceRadiusController.getProvidersByRadius);

// DELETE /api/service-radii/:id - Delete whole config
router.delete('/:id', validateObjectId('id'), serviceRadiusController.deleteRadiusConfig);

module.exports = router;

