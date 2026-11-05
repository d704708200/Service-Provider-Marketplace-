const settingService = require('../services/settingService');

/**
 * GET /api/admin/settings/commission
 * Get current platform commission percentage, metadata and history (Admin only)
 */
const getCommissionSetting = async (req, res, next) => {
  try {
    const data = await settingService.getPlatformCommissionSetting(true);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/settings/commission
 * Update platform commission percentage with required audit reason (Admin only)
 */
const updateCommissionSetting = async (req, res, next) => {
  try {
    const { percentage, reason } = req.body;
    const adminUserId = req.user ? req.user._id : null;

    const data = await settingService.updatePlatformCommissionSetting(adminUserId, {
      percentage,
      reason
    });

    res.status(200).json({
      success: true,
      message: `Platform commission percentage updated to ${data.percentage}%`,
      data
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCommissionSetting,
  updateCommissionSetting
};

