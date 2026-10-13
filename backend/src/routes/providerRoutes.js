const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validateObjectId,
  validateUpdateProviderProfile,
  validateSubmitDocument,
  validateDocumentReview,
  validateProviderVerification,
  validateAccountStatus,
  validateProviderAvailability,
  validateProviderServiceArea,
  validateUpdateProviderServiceArea,
  validateCreateService,
  validateUpdateService
} = require('../middleware/validation');

// =========================================================
// 1. PROVIDER SELF-MANAGEMENT ROUTES (role: provider)
// =========================================================
router.get(
  '/me',
  authenticate,
  requireRole('provider'),
  providerController.getProviderMe
);

router.put(
  '/me',
  authenticate,
  requireRole('provider'),
  validateUpdateProviderProfile,
  providerController.updateProviderMe
);

router.get(
  '/me/services',
  authenticate,
  requireRole('provider'),
  providerController.getProviderServices
);

router.post(
  '/me/services',
  authenticate,
  requireRole('provider'),
  validateCreateService,
  providerController.addProviderService
);

router.put(
  '/me/services/:id',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  validateUpdateService,
  providerController.updateProviderService
);

router.delete(
  '/me/services/:id',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  providerController.deleteProviderService
);

router.get(
  '/me/availability',
  authenticate,
  requireRole('provider'),
  providerController.getProviderAvailability
);

router.put(
  '/me/availability',
  authenticate,
  requireRole('provider'),
  validateProviderAvailability,
  providerController.updateProviderAvailability
);

router.get(
  '/me/service-areas',
  authenticate,
  requireRole('provider'),
  providerController.getProviderServiceAreas
);

router.post(
  '/me/service-areas',
  authenticate,
  requireRole('provider'),
  validateProviderServiceArea,
  providerController.addProviderServiceArea
);

router.put(
  '/me/service-areas/:id',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  validateUpdateProviderServiceArea,
  providerController.updateProviderServiceArea
);

router.delete(
  '/me/service-areas/:id',
  authenticate,
  requireRole('provider'),
  validateObjectId('id'),
  providerController.deleteProviderServiceArea
);

router.post(
  '/me/documents',
  authenticate,
  requireRole('provider'),
  validateSubmitDocument,
  providerController.submitDocument
);

router.delete(
  '/me/documents/:documentId',
  authenticate,
  requireRole('provider'),
  validateObjectId('documentId'),
  providerController.deleteDocument
);

// =========================================================
// 2. ADMIN VERIFICATION & DIRECTORY ROUTES (role: admin)
// =========================================================
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  providerController.getAdminProviders
);

router.get(
  '/admin/pending',
  authenticate,
  requireRole('admin'),
  providerController.getAdminPendingVerifications
);

router.get(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  providerController.getAdminProviderById
);

router.patch(
  '/admin/:id/documents/:documentId/status',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateObjectId('documentId'),
  validateDocumentReview,
  providerController.reviewDocument
);

router.patch(
  '/admin/:id/verification',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateProviderVerification,
  providerController.updateProviderVerification
);

router.patch(
  '/admin/:id/account-status',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateAccountStatus,
  providerController.updateProviderAccountStatus
);

// =========================================================
// 3. PUBLIC DISCOVERY ROUTES (Customers / Unauthenticated)
// =========================================================
router.get('/', providerController.getPublicProviders);

router.get('/:id', validateObjectId('id'), providerController.getPublicProviderById);

module.exports = router;
