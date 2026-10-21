const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadSingleAvatar } = require('../middleware/upload');
const {
  validateObjectId,
  validateUpdateCustomerProfile,
  validateCustomerAddress,
  validateUpdateCustomerAddress
} = require('../middleware/validation');

// =========================================================
// 1. ADMIN CUSTOMER MANAGEMENT ROUTES (role: admin)
// =========================================================
router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  customerController.getAdminCustomers
);

router.delete(
  '/admin/:id',
  authenticate,
  requireRole('admin'),
  validateObjectId('id'),
  customerController.deleteCustomerByAdmin
);

// =========================================================
// 2. CUSTOMER SELF-MANAGEMENT ROUTES (role: customer)
// =========================================================

/**
 * Customer Profile Management
 */
router.get('/me', authenticate, requireRole('customer'), customerController.getCustomerMe);
router.put('/me', authenticate, requireRole('customer'), validateUpdateCustomerProfile, customerController.updateCustomerMe);
router.post('/me/avatar', authenticate, requireRole('customer'), uploadSingleAvatar('avatar'), customerController.uploadCustomerAvatar);

/**
 * Saved Addresses Management
 */
router.get('/me/addresses', authenticate, requireRole('customer'), customerController.getCustomerAddresses);
router.post('/me/addresses', authenticate, requireRole('customer'), validateCustomerAddress, customerController.addCustomerAddress);
router.put(
  '/me/addresses/:addressId',
  authenticate,
  requireRole('customer'),
  validateObjectId('addressId'),
  validateUpdateCustomerAddress,
  customerController.updateCustomerAddress
);
router.delete(
  '/me/addresses/:addressId',
  authenticate,
  requireRole('customer'),
  validateObjectId('addressId'),
  customerController.deleteCustomerAddress
);
router.patch(
  '/me/addresses/:addressId/default',
  authenticate,
  requireRole('customer'),
  validateObjectId('addressId'),
  customerController.setDefaultCustomerAddress
);

module.exports = router;
