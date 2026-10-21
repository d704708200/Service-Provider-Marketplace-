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

// All customer endpoints require authentication and 'customer' role
router.use(authenticate, requireRole('customer'));

/**
 * Customer Profile Management
 */
router.get('/me', customerController.getCustomerMe);
router.put('/me', validateUpdateCustomerProfile, customerController.updateCustomerMe);
router.post('/me/avatar', uploadSingleAvatar('avatar'), customerController.uploadCustomerAvatar);

/**
 * Saved Addresses Management
 */
router.get('/me/addresses', customerController.getCustomerAddresses);
router.post('/me/addresses', validateCustomerAddress, customerController.addCustomerAddress);
router.put(
  '/me/addresses/:addressId',
  validateObjectId('addressId'),
  validateUpdateCustomerAddress,
  customerController.updateCustomerAddress
);
router.delete(
  '/me/addresses/:addressId',
  validateObjectId('addressId'),
  customerController.deleteCustomerAddress
);
router.patch(
  '/me/addresses/:addressId/default',
  validateObjectId('addressId'),
  customerController.setDefaultCustomerAddress
);

module.exports = router;
