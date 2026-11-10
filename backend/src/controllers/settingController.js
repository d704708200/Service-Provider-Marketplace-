const settingService = require('../services/settingService');

/**
 * GET /api/admin/settings/commission
 * Get current platform commission settings (Service & Labour) with metadata and history (Admin only)
 */
const getCommissionSetting = async (req, res, next) => {
  try {
    const { serviceCommission, labourCommission } = await settingService.getDualCommissionSettings(true);
    res.status(200).json({
      success: true,
      data: {
        // Preserves direct backward compatibility with existing Admin Panel readers
        percentage: serviceCommission.percentage,
        rateDecimal: serviceCommission.rateDecimal,
        rateFormatted: serviceCommission.rateFormatted,
        effectiveFrom: serviceCommission.effectiveFrom,
        updatedBy: serviceCommission.updatedBy,
        history: serviceCommission.history,
        source: serviceCommission.source,
        // Dual commission explicitly structured
        serviceCommission,
        labourCommission
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/settings/commission
 * Update platform service commission percentage with required audit reason (Admin only)
 */
const updateCommissionSetting = async (req, res, next) => {
  try {
    const { percentage, reason, type } = req.body;
    const adminUserId = req.user ? req.user._id : null;

    if (type === 'labour') {
      const data = await settingService.updateLabourCommissionSetting(adminUserId, {
        percentage,
        reason
      });
      return res.status(200).json({
        success: true,
        message: `Platform labour commission percentage updated to ${data.percentage}%`,
        data
      });
    }

    const data = await settingService.updatePlatformCommissionSetting(adminUserId, {
      percentage,
      reason
    });

    res.status(200).json({
      success: true,
      message: `Platform service commission percentage updated to ${data.percentage}%`,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/settings/commission/labour
 * Get current labour commission percentage, metadata and history (Admin only)
 */
const getLabourCommissionSetting = async (req, res, next) => {
  try {
    const data = await settingService.getLabourCommissionSetting(true);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/settings/commission/labour
 * Update labour commission percentage with required audit reason (Admin only)
 */
const updateLabourCommissionSetting = async (req, res, next) => {
  try {
    const { percentage, reason } = req.body;
    const adminUserId = req.user ? req.user._id : null;

    const data = await settingService.updateLabourCommissionSetting(adminUserId, {
      percentage,
      reason
    });

    res.status(200).json({
      success: true,
      message: `Platform labour commission percentage updated to ${data.percentage}%`,
      data
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCommissionSetting,
  updateCommissionSetting,
  getLabourCommissionSetting,
  updateLabourCommissionSetting
};

