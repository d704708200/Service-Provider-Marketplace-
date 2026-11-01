const homeBannerService = require('../services/homeBannerService');
const { uploadImage } = require('../config/cloudinary');

/**
 * Public Customer API: Fetch active, scheduled home screen banners
 */
const getPublicHomeBanners = async (req, res, next) => {
  try {
    const banners = await homeBannerService.getActiveBanners();
    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Fetch all home screen banners with optional search / filter
 */
const getAdminHomeBanners = async (req, res, next) => {
  try {
    const banners = await homeBannerService.getAllBannersAdmin(req.query);
    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Fetch a single banner by ID
 */
const getAdminHomeBannerById = async (req, res, next) => {
  try {
    const banner = await homeBannerService.getBannerById(req.params.id);
    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Create a new home screen banner (with image file upload or image URL)
 */
const createAdminHomeBanner = async (req, res, next) => {
  try {
    const bannerData = { ...req.body };

    // If a file was uploaded via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadImage(req.file, { folder: 'marketplace/banners' });
      bannerData.imageUrl = uploadResult.url;
      bannerData.publicId = uploadResult.public_id;
    }

    const banner = await homeBannerService.createBanner(bannerData, req.user?._id);

    res.status(201).json({
      success: true,
      message: 'Home screen banner created successfully',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Update an existing home screen banner
 */
const updateAdminHomeBanner = async (req, res, next) => {
  try {
    const bannerData = { ...req.body };

    // If a new image file was uploaded
    if (req.file) {
      const uploadResult = await uploadImage(req.file, { folder: 'marketplace/banners' });
      bannerData.imageUrl = uploadResult.url;
      bannerData.publicId = uploadResult.public_id;
    }

    const banner = await homeBannerService.updateBanner(req.params.id, bannerData, req.user?._id);

    res.status(200).json({
      success: true,
      message: 'Home screen banner updated successfully',
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Delete a banner
 */
const deleteAdminHomeBanner = async (req, res, next) => {
  try {
    const result = await homeBannerService.deleteBanner(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Home screen banner deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Toggle active/inactive status
 */
const toggleAdminHomeBannerStatus = async (req, res, next) => {
  try {
    const banner = await homeBannerService.toggleBannerStatus(req.params.id, req.body.isActive, req.user?._id);
    res.status(200).json({
      success: true,
      message: `Banner status set to ${banner.isActive ? 'active' : 'inactive'}`,
      data: banner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin API: Reorder banners by providing array of IDs
 */
const reorderAdminHomeBanners = async (req, res, next) => {
  try {
    const banners = await homeBannerService.reorderBanners(req.body.orderedIds, req.user?._id);
    res.status(200).json({
      success: true,
      message: 'Home screen banners reordered successfully',
      data: banners
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicHomeBanners,
  getAdminHomeBanners,
  getAdminHomeBannerById,
  createAdminHomeBanner,
  updateAdminHomeBanner,
  deleteAdminHomeBanner,
  toggleAdminHomeBannerStatus,
  reorderAdminHomeBanners
};
