const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  validateRegisterCustomer,
  validateRegisterProvider,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation');

// Rate limiter for diagnostic and email-test endpoints (10 requests per 15 minutes)
const emailTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many diagnostic or email requests from this IP. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Access control: Requires matching x-admin-secret OR an authenticated admin user
const requireAdminOrSecret = (req, res, next) => {
  const secretHeader = req.headers['x-admin-secret'];
  const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  if (scriptSecret && secretHeader && secretHeader === scriptSecret) {
    return next();
  }

  // If secretHeader was sent but does not match, reject immediately
  if (secretHeader && (!scriptSecret || secretHeader !== scriptSecret)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed: Invalid admin secret provided.'
    });
  }

  // Fallback to JWT Bearer authentication for administrators
  return authenticate(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied: Valid administrative authorization or matching admin secret required.'
    });
  });
};

// Customer Auth Routes
router.post('/register/customer', validateRegisterCustomer, authController.registerCustomer);
router.post('/login/customer', validateLogin, authController.loginCustomer);

// Provider Auth Routes
router.post('/register/provider', validateRegisterProvider, authController.registerProvider);
router.post('/login/provider', validateLogin, authController.loginProvider);

// Admin Auth Route (Login only; no public admin registration)
router.post('/login/admin', validateLogin, authController.loginAdmin);

// Forgot & Reset Password Routes
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);
router.get('/reset-password', authController.renderResetPasswordPage);

// Email & SMTP Transporter Diagnostics (Protected by rate limiter & admin authentication/secret)
router.get('/smtp-verify', emailTestLimiter, requireAdminOrSecret, authController.verifySmtp);
router.get('/email-verify', emailTestLimiter, requireAdminOrSecret, authController.verifySmtp);
router.post('/smtp-test-email', emailTestLimiter, requireAdminOrSecret, authController.sendTestEmail);
router.post('/email-test', emailTestLimiter, requireAdminOrSecret, authController.sendTestEmail);

// Current Authenticated User Profile
router.get('/me', authenticate, authController.getMe);

module.exports = router;
