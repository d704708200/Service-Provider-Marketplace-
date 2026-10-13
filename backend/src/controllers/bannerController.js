const bannerService = require('../services/bannerService');

/**
 * GET /api/banner
 * Public discovery endpoint for active home promotional banner
 */
const getPublicBanner = async (req, res, next) => {
  try {
    const banner = await bannerService.getPublicBanner();
    res.status(200).json({
      success: true,
      message: 'Home promotional banner retrieved successfully',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/banner/admin
 * Admin endpoint for fetching full banner configuration
 */
const getAdminBanner = async (req, res, next) => {
  try {
    const banner = await bannerService.getAdminBanner();
    res.status(200).json({
      success: true,
      message: 'Admin banner configuration retrieved successfully',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/banner/admin
 * Admin endpoint for updating banner configuration
 */
const updateAdminBanner = async (req, res, next) => {
  try {
    const banner = await bannerService.updateAdminBanner(req.body, req.user?._id);
    res.status(200).json({
      success: true,
      message: 'Home banner configuration updated successfully',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicBanner,
  getAdminBanner,
  updateAdminBanner
};
