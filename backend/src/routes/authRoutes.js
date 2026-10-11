const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  validateRegisterCustomer,
  validateRegisterProvider,
  validateLogin
} = require('../middleware/validation');

// Customer Auth Routes
router.post('/register/customer', validateRegisterCustomer, authController.registerCustomer);
router.post('/login/customer', validateLogin, authController.loginCustomer);

// Provider Auth Routes
router.post('/register/provider', validateRegisterProvider, authController.registerProvider);
router.post('/login/provider', validateLogin, authController.loginProvider);

// Admin Auth Route (Login only; no public admin registration)
router.post('/login/admin', validateLogin, authController.loginAdmin);

// Current Authenticated User Profile
router.get('/me', authenticate, authController.getMe);

module.exports = router;
