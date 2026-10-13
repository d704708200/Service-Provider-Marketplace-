const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validateObjectId,
  validateCreateService,
  validateUpdateService,
  validateUpdateServiceStatus
} = require('../middleware/validation');

// Public Service Routes (Customers & Providers)
router.get('/', serviceController.getPublicServices);

// Admin Service Listing (including inactive, with pagination, category filter, and booking counts)
router.get('/admin', authenticate, requireRole('admin'), serviceController.getAdminServices);

// Retrieve single Service Details (public / authenticated)
router.get('/:id', validateObjectId('id'), serviceController.getServiceById);

// Admin-only Service Management Routes
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validateCreateService,
  serviceController.createService
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateUpdateService,
  serviceController.updateService
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateUpdateServiceStatus,
  serviceController.updateServiceStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  serviceController.deleteService
);

module.exports = router;
