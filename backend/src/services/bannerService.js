const BannerConfig = require('../models/BannerConfig');

const BANNER_KEY = 'home_first_service_offer';

const DEFAULT_BANNER = {
  key: BANNER_KEY,
  isEnabled: true,
  badgeText: 'FIRST SERVICE ORDER',
  title: 'Get ₹100 OFF',
  subtitle: 'Book your first service today',
  discountAmount: 100,
  currency: '₹',
  buttonLabel: 'Book Now',
  targetRoute: 'SearchTab'
};

/**
 * Public: Fetch active banner config
 * If not found, automatically seeds the initial default banner.
 * If isEnabled is false, returns { isEnabled: false } so client safely hides it.
 */
const getPublicBanner = async () => {
  let banner = await BannerConfig.findOne({ key: BANNER_KEY }).lean();

  if (!banner) {
    banner = await BannerConfig.create(DEFAULT_BANNER);
    banner = banner.toObject();
  }

  if (!banner.isEnabled) {
    return {
      isEnabled: false
    };
  }

  return {
    isEnabled: true,
    badgeText: banner.badgeText,
    title: banner.title,
    subtitle: banner.subtitle,
    discountAmount: banner.discountAmount,
    currency: banner.currency,
    buttonLabel: banner.buttonLabel,
    targetRoute: banner.targetRoute
  };
};

/**
 * Admin: Fetch full banner config including metadata
 */
const getAdminBanner = async () => {
  let banner = await BannerConfig.findOne({ key: BANNER_KEY })
    .populate('updatedBy', 'name email')
    .lean();

  if (!banner) {
    const created = await BannerConfig.create(DEFAULT_BANNER);
    banner = await BannerConfig.findById(created._id)
      .populate('updatedBy', 'name email')
      .lean();
  }

  return banner;
};

/**
 * Admin: Update banner config
 */
const updateAdminBanner = async (updateData, adminUserId) => {
  let banner = await BannerConfig.findOne({ key: BANNER_KEY });

  if (!banner) {
    banner = new BannerConfig({ key: BANNER_KEY, ...DEFAULT_BANNER });
  }

  if (updateData.isEnabled !== undefined) {
    banner.isEnabled = Boolean(updateData.isEnabled);
  }
  if (updateData.badgeText !== undefined) {
    banner.badgeText = updateData.badgeText.trim();
  }
  if (updateData.title !== undefined) {
    banner.title = updateData.title.trim();
  }
  if (updateData.subtitle !== undefined) {
    banner.subtitle = updateData.subtitle.trim();
  }
  if (updateData.discountAmount !== undefined) {
    banner.discountAmount = Number(updateData.discountAmount) || 0;
  }
  if (updateData.currency !== undefined) {
    banner.currency = updateData.currency.trim() || '₹';
  }
  if (updateData.buttonLabel !== undefined) {
    banner.buttonLabel = updateData.buttonLabel.trim() || 'Book Now';
  }
  if (updateData.targetRoute !== undefined) {
    banner.targetRoute = updateData.targetRoute.trim() || 'SearchTab';
  }

  if (adminUserId) {
    banner.updatedBy = adminUserId;
  }

  await banner.save();

  return await BannerConfig.findById(banner._id)
    .populate('updatedBy', 'name email')
    .lean();
};

module.exports = {
  getPublicBanner,
  getAdminBanner,
  updateAdminBanner
};
