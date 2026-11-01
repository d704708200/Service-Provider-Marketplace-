const HomeBanner = require('../models/HomeBanner');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

/**
 * Delete asset from Cloudinary safely
 */
const safeDeleteCloudinaryAsset = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[HomeBannerService] Cloudinary deletion warning:', err.message);
  }
};

/**
 * Fetch all active, currently scheduled banners for the Customer App Home Screen
 */
const getActiveBanners = async () => {
  const now = new Date();

  const filter = {
    isActive: true,
    $and: [
      {
        $or: [
          { startDate: null },
          { startDate: { $exists: false } },
          { startDate: { $lte: now } }
        ]
      },
      {
        $or: [
          { endDate: null },
          { endDate: { $exists: false } },
          { endDate: { $gte: now } }
        ]
      }
    ]
  };

  const banners = await HomeBanner.find(filter)
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean();

  return banners;
};

/**
 * Fetch all banners for Admin Panel with optional search / status filtering
 */
const getAllBannersAdmin = async (query = {}) => {
  const filter = {};

  if (query.status === 'active') {
    filter.isActive = true;
  } else if (query.status === 'inactive') {
    filter.isActive = false;
  }

  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    filter.title = { $regex: query.search.trim(), $options: 'i' };
  }

  const banners = await HomeBanner.find(filter)
    .sort({ displayOrder: 1, createdAt: -1 })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();

  return banners;
};

/**
 * Fetch a single banner by ID for Admin Panel
 */
const getBannerById = async (id) => {
  const banner = await HomeBanner.findById(id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!banner) {
    const error = new Error('Home banner not found');
    error.statusCode = 404;
    throw error;
  }

  return banner;
};

/**
 * Create a new Home Banner (Admin)
 */
const createBanner = async (data, userId = null) => {
  let displayOrder = data.displayOrder;

  // Auto-assign displayOrder to end of list if not provided
  if (displayOrder === undefined || displayOrder === null || isNaN(displayOrder)) {
    const maxOrderBanner = await HomeBanner.findOne()
      .sort({ displayOrder: -1 })
      .select('displayOrder')
      .lean();
    displayOrder = maxOrderBanner && typeof maxOrderBanner.displayOrder === 'number'
      ? maxOrderBanner.displayOrder + 1
      : 0;
  }

  const banner = new HomeBanner({
    title: data.title,
    subtitle: data.subtitle || '',
    imageUrl: data.imageUrl,
    publicId: data.publicId || '',
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    displayOrder: Number(displayOrder),
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    destinationType: data.destinationType || 'none',
    destinationId: data.destinationId || '',
    destinationMetadata: data.destinationMetadata || {},
    createdBy: userId,
    updatedBy: userId
  });

  await banner.save();
  return banner;
};

/**
 * Update an existing Home Banner (Admin)
 */
const updateBanner = async (id, data, userId = null) => {
  const banner = await HomeBanner.findById(id);
  if (!banner) {
    const error = new Error('Home banner not found');
    error.statusCode = 404;
    throw error;
  }

  // If a new image is provided and old image has publicId, remove old image
  if (data.imageUrl && data.imageUrl !== banner.imageUrl && banner.publicId && data.publicId !== banner.publicId) {
    await safeDeleteCloudinaryAsset(banner.publicId);
  }

  if (data.title !== undefined) banner.title = data.title;
  if (data.subtitle !== undefined) banner.subtitle = data.subtitle;
  if (data.imageUrl !== undefined) banner.imageUrl = data.imageUrl;
  if (data.publicId !== undefined) banner.publicId = data.publicId;
  if (data.isActive !== undefined) banner.isActive = Boolean(data.isActive);
  if (data.displayOrder !== undefined) banner.displayOrder = Number(data.displayOrder);
  if (data.startDate !== undefined) banner.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) banner.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.destinationType !== undefined) banner.destinationType = data.destinationType;
  if (data.destinationId !== undefined) banner.destinationId = data.destinationId;
  if (data.destinationMetadata !== undefined) banner.destinationMetadata = data.destinationMetadata;
  banner.updatedBy = userId;

  await banner.save();
  return banner;
};

/**
 * Delete a Home Banner (Admin)
 */
const deleteBanner = async (id) => {
  const banner = await HomeBanner.findById(id);
  if (!banner) {
    const error = new Error('Home banner not found');
    error.statusCode = 404;
    throw error;
  }

  if (banner.publicId) {
    await safeDeleteCloudinaryAsset(banner.publicId);
  }

  await HomeBanner.findByIdAndDelete(id);
  return { success: true, id };
};

/**
 * Toggle Active / Inactive Status (Admin)
 */
const toggleBannerStatus = async (id, isActive, userId = null) => {
  const banner = await HomeBanner.findById(id);
  if (!banner) {
    const error = new Error('Home banner not found');
    error.statusCode = 404;
    throw error;
  }

  const newStatus = isActive !== undefined ? Boolean(isActive) : !banner.isActive;
  banner.isActive = newStatus;
  banner.updatedBy = userId;
  await banner.save();

  return banner;
};

/**
 * Reorder banners based on an array of ordered IDs (Admin)
 */
const reorderBanners = async (orderedIds = [], userId = null) => {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    const error = new Error('orderedIds must be a non-empty array of banner IDs');
    error.statusCode = 400;
    throw error;
  }

  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { displayOrder: index, updatedBy: userId } }
    }
  }));

  await HomeBanner.bulkWrite(bulkOps);

  const updatedBanners = await HomeBanner.find({ _id: { $in: orderedIds } })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean();

  return updatedBanners;
};

module.exports = {
  getActiveBanners,
  getAllBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  reorderBanners
};

