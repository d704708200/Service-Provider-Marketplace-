const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadSingleAvatar, uploadSingleKYCDocument } = require('../middleware/upload');
const {
  validateObjectId,
  validateUpdateProviderProfile,
  validateSubmitDocument,
  validateSubmitKYCDocuments,
  validateReviewKYC,
  validateDocumentReview,
  validateProviderVerification,
  validateAccountStatus,
  validateUpdateTopRatedStatus,
  validateProviderAvailability,
  validateProviderServiceArea,
  validateUpdateProviderServiceArea,
  validateCreateService,
  validateUpdateService,
  validateUpdateServiceStatus
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

router.post(
  '/me/avatar',
  authenticate,
  requireRole('provider'),
  uploadSingleAvatar('avatar'),
  providerController.uploadProviderAvatar
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
  ['/me/services/:id', '/me/services/:serviceId'],
  authenticate,
  requireRole('provider'),
  validateObjectId('id', 'serviceId'),
  validateUpdateService,
  providerController.updateProviderService
);

router.patch(
  ['/me/services/:id', '/me/services/:serviceId'],
  authenticate,
  requireRole('provider'),
  validateObjectId('id', 'serviceId'),
  validateUpdateService,
  providerController.updateProviderService
);

router.patch(
  ['/me/services/:id/status', '/me/services/:serviceId/status'],
  authenticate,
  requireRole('provider'),
  validateObjectId('id', 'serviceId'),
  validateUpdateServiceStatus,
  providerController.updateProviderServiceStatus
);

router.delete(
  ['/me/services/:id', '/me/services/:serviceId'],
  authenticate,
  requireRole('provider'),
  validateObjectId('id', 'serviceId'),
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

router.post(
  '/me/kyc/upload',
  authenticate,
  requireRole('provider'),
  uploadSingleKYCDocument('document'),
  providerController.uploadKYCDocument
);

router.post(
  '/me/kyc/submit',
  authenticate,
  requireRole('provider'),
  validateSubmitKYCDocuments,
  providerController.submitKYC
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
router.patch(
  '/admin/:id/kyc/review',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateReviewKYC,
  providerController.reviewKYC
);
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

router.patch(
  '/admin/:id/top-rated',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  validateUpdateTopRatedStatus,
  providerController.updateTopRatedStatus
);

router.delete(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  providerController.deleteProviderByAdmin
);

// =========================================================
// 3. PUBLIC DISCOVERY ROUTES (Customers / Unauthenticated)
// =========================================================
router.get('/', providerController.getPublicProviders);

router.get(
  ['/:id/availability-check', '/:providerId/availability-check'],
  validateObjectId('id', 'providerId'),
  providerController.checkProviderSlotAvailability
);

router.get('/:id', validateObjectId('id'), providerController.getPublicProviderById);

module.exports = router;
