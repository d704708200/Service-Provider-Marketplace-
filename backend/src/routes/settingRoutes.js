const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const { authenticate, requireRole } = require('../middleware/auth');

// All settings endpoints require authentication and administrator privilege
router.use(authenticate);
router.use(requireRole('admin'));

// Platform Commission Settings
router.get('/commission', settingController.getCommissionSetting);
router.put('/commission', settingController.updateCommissionSetting);

module.exports = router;

