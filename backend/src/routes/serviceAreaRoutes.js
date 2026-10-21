const express = require('express');
const router = express.Router();
const serviceAreaController = require('../controllers/serviceAreaController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

// List service areas (admin only)
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  serviceAreaController.getAdminServiceAreas
);

// Create new service area (admin only)
router.post(
  '/admin',
  authenticate,
  requireRole('admin'),
  serviceAreaController.createServiceArea
);

// Update service area (admin only)
router.put(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  serviceAreaController.updateServiceArea
);

// Toggle service area active status (admin only)
router.patch(
  '/admin/:id/status',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  serviceAreaController.toggleServiceAreaStatus
);

// Delete service area (admin only)
router.delete(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  serviceAreaController.deleteServiceArea
);

module.exports = router;
