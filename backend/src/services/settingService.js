const { SystemSetting, User } = require('../models');

// In-memory cache for fast lookups
let cachedCommissionSetting = null;
let cachedLabourCommissionSetting = null;
let cacheExpiry = 0;
let labourCacheExpiry = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

/**
 * Normalizes PLATFORM_COMMISSION_RATE environment variable fallback:
 * - If value is between 0 and 1 (e.g. 0.15), treats as decimal rate (15%).
 * - If value is between 1 and 100 (e.g. 15), divides by 100 to get decimal rate (0.15).
 * - Defaults to 15%.
 */
const getFallbackCommissionRate = () => {
  const envVal = process.env.PLATFORM_COMMISSION_RATE;
  let percentage = 15;

  if (envVal !== undefined && envVal !== null && String(envVal).trim() !== '') {
    const parsed = parseFloat(String(envVal).trim());
    if (!isNaN(parsed) && parsed >= 0) {
      if (parsed > 0 && parsed <= 1) {
        percentage = Math.round(parsed * 10000) / 100;
      } else if (parsed > 1 && parsed <= 100) {
        percentage = parsed;
      }
    }
  }

  const rateDecimal = Math.round((percentage / 100) * 10000) / 10000;
  return {
    percentage,
    rateDecimal,
    rateFormatted: `${percentage}%`
  };
};

/**
 * Normalizes LABOUR_COMMISSION_RATE fallback:
 * - Defaults to 0% until Admin explicitly configures it.
 */
const getFallbackLabourCommissionRate = () => {
  const envVal = process.env.LABOUR_COMMISSION_RATE;
  let percentage = 0;

  if (envVal !== undefined && envVal !== null && String(envVal).trim() !== '') {
    const parsed = parseFloat(String(envVal).trim());
    if (!isNaN(parsed) && parsed >= 0) {
      if (parsed > 0 && parsed <= 1) {
        percentage = Math.round(parsed * 10000) / 100;
      } else if (parsed > 1 && parsed <= 100) {
        percentage = parsed;
      }
    }
  }

  const rateDecimal = Math.round((percentage / 100) * 10000) / 10000;
  return {
    percentage,
    rateDecimal,
    rateFormatted: `${percentage}%`
  };
};

/**
 * Invalidate cached settings (e.g. after update)
 */
const invalidateCommissionCache = () => {
  cachedCommissionSetting = null;
  cachedLabourCommissionSetting = null;
  cacheExpiry = 0;
  labourCacheExpiry = 0;
};

/**
 * Get active Platform Service Commission Setting from persistent database
 * Defaults to 15% (or env fallback) if not yet configured by Admin.
 */
const getPlatformCommissionSetting = async (forceFresh = false) => {
  const now = Date.now();
  if (!forceFresh && cachedCommissionSetting && now < cacheExpiry) {
    return cachedCommissionSetting;
  }

  const fallback = getFallbackCommissionRate();

  try {
    const doc = await SystemSetting.findOne({ key: 'platform_commission' })
      .populate('updatedBy', 'name email')
      .lean();

    if (!doc || doc.value === undefined || doc.value === null) {
      const result = {
        percentage: fallback.percentage,
        rateDecimal: fallback.rateDecimal,
        rateFormatted: fallback.rateFormatted,
        effectiveFrom: null,
        updatedBy: null,
        history: [],
        source: 'default'
      };
      cachedCommissionSetting = result;
      cacheExpiry = now + CACHE_TTL_MS;
      return result;
    }

    const percentage = doc.value?.percentage !== undefined
      ? Number(doc.value.percentage)
      : Number(doc.value);

    const safePercentage = isNaN(percentage) ? fallback.percentage : percentage;
    const rateDecimal = Math.round((safePercentage / 100) * 10000) / 10000;

    const result = {
      percentage: safePercentage,
      rateDecimal,
      rateFormatted: `${safePercentage}%`,
      effectiveFrom: doc.effectiveFrom || doc.updatedAt,
      updatedBy: doc.updatedBy ? {
        _id: doc.updatedBy._id,
        name: doc.updatedBy.name || 'Administrator',
        email: doc.updatedBy.email || 'N/A'
      } : null,
      history: Array.isArray(doc.history) ? doc.history.map(h => ({
        previousPercentage: h.previousValue?.percentage !== undefined ? h.previousValue.percentage : h.previousValue,
        newPercentage: h.newValue?.percentage !== undefined ? h.newValue.percentage : h.newValue,
        changedBy: h.changedByName || 'Administrator',
        reason: h.reason,
        timestamp: h.timestamp
      })) : [],
      source: 'admin_database'
    };

    cachedCommissionSetting = result;
    cacheExpiry = now + CACHE_TTL_MS;
    return result;
  } catch (err) {
    console.warn('[SETTING_SERVICE_FETCH_WARN]', err.message);
    return {
      percentage: fallback.percentage,
      rateDecimal: fallback.rateDecimal,
      rateFormatted: fallback.rateFormatted,
      effectiveFrom: null,
      updatedBy: null,
      history: [],
      source: 'fallback'
    };
  }
};

/**
 * Get active Labour Commission Setting from persistent database
 * Defaults to 0% (or env fallback) until explicitly configured by Admin.
 */
const getLabourCommissionSetting = async (forceFresh = false) => {
  const now = Date.now();
  if (!forceFresh && cachedLabourCommissionSetting && now < labourCacheExpiry) {
    return cachedLabourCommissionSetting;
  }

  const fallback = getFallbackLabourCommissionRate();

  try {
    const doc = await SystemSetting.findOne({ key: 'labour_commission' })
      .populate('updatedBy', 'name email')
      .lean();

    if (!doc || doc.value === undefined || doc.value === null) {
      const result = {
        percentage: fallback.percentage,
        rateDecimal: fallback.rateDecimal,
        rateFormatted: fallback.rateFormatted,
        effectiveFrom: null,
        updatedBy: null,
        history: [],
        source: 'default'
      };
      cachedLabourCommissionSetting = result;
      labourCacheExpiry = now + CACHE_TTL_MS;
      return result;
    }

    const percentage = doc.value?.percentage !== undefined
      ? Number(doc.value.percentage)
      : Number(doc.value);

    const safePercentage = isNaN(percentage) ? fallback.percentage : percentage;
    const rateDecimal = Math.round((safePercentage / 100) * 10000) / 10000;

    const result = {
      percentage: safePercentage,
      currentRate: safePercentage,
      rateDecimal,
      rateFormatted: `${safePercentage}%`,
      effectiveFrom: doc.effectiveFrom || doc.updatedAt,
      updatedBy: doc.updatedBy ? {
        _id: doc.updatedBy._id,
        name: doc.updatedBy.name || 'Administrator',
        email: doc.updatedBy.email || 'N/A'
      } : null,
      history: Array.isArray(doc.history) ? doc.history.map(h => ({
        previousPercentage: h.previousValue?.percentage !== undefined ? h.previousValue.percentage : h.previousValue,
        newPercentage: h.newValue?.percentage !== undefined ? h.newValue.percentage : h.newValue,
        changedBy: h.changedByName || 'Administrator',
        reason: h.reason,
        timestamp: h.timestamp
      })) : [],
      source: 'admin_database'
    };

    cachedLabourCommissionSetting = result;
    labourCacheExpiry = now + CACHE_TTL_MS;
    return result;
  } catch (err) {
    console.warn('[LABOUR_COMMISSION_SETTING_FETCH_WARN]', err.message);
    return {
      percentage: fallback.percentage,
      currentRate: fallback.percentage,
      rateDecimal: fallback.rateDecimal,
      rateFormatted: fallback.rateFormatted,
      effectiveFrom: null,
      updatedBy: null,
      history: [],
      source: 'fallback'
    };
  }
};

/**
 * Update Platform Service Commission Setting (Admin Only)
 */
const updatePlatformCommissionSetting = async (adminUserId, { percentage, reason }) => {
  if (percentage === undefined || percentage === null || String(percentage).trim() === '') {
    const err = new Error('Commission percentage is required');
    err.statusCode = 400;
    throw err;
  }

  const parsed = Number(percentage);
  if (isNaN(parsed) || !isFinite(parsed)) {
    const err = new Error('Commission percentage must be a valid numeric value');
    err.statusCode = 400;
    throw err;
  }

  if (parsed < 0 || parsed > 100) {
    const err = new Error('Commission percentage must be between 0% and 100%');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedPercentage = Math.round(parsed * 100) / 100;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    const err = new Error('A valid reason for change is required (minimum 3 characters)');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedReason = reason.trim();

  let adminName = 'Administrator';
  if (adminUserId) {
    const adminUser = await User.findById(adminUserId).select('name email');
    if (adminUser?.name) {
      adminName = adminUser.name;
    }
  }

  const current = await getPlatformCommissionSetting(true);
  const previousPercentage = current.percentage;

  const now = new Date();
  const historyEntry = {
    previousValue: { percentage: previousPercentage },
    newValue: { percentage: sanitizedPercentage },
    changedBy: adminUserId,
    changedByName: adminName,
    reason: sanitizedReason,
    timestamp: now
  };

  const updatedDoc = await SystemSetting.findOneAndUpdate(
    { key: 'platform_commission' },
    {
      $set: {
        value: { percentage: sanitizedPercentage },
        description: 'Global Mendroo platform commission rate applied only to original service price',
        updatedBy: adminUserId,
        effectiveFrom: now
      },
      $push: {
        history: {
          $each: [historyEntry],
          $position: 0
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('updatedBy', 'name email');

  invalidateCommissionCache();

  return {
    percentage: sanitizedPercentage,
    rateDecimal: Math.round((sanitizedPercentage / 100) * 10000) / 10000,
    rateFormatted: `${sanitizedPercentage}%`,
    previousPercentage,
    effectiveFrom: updatedDoc.effectiveFrom,
    updatedBy: {
      _id: updatedDoc.updatedBy?._id || adminUserId,
      name: updatedDoc.updatedBy?.name || adminName,
      email: updatedDoc.updatedBy?.email || 'N/A'
    },
    history: updatedDoc.history.map(h => ({
      previousPercentage: h.previousValue?.percentage !== undefined ? h.previousValue.percentage : h.previousValue,
      newPercentage: h.newValue?.percentage !== undefined ? h.newValue.percentage : h.newValue,
      changedBy: h.changedByName || 'Administrator',
      reason: h.reason,
      timestamp: h.timestamp
    }))
  };
};

/**
 * Update Labour Commission Setting (Admin Only)
 */
const updateLabourCommissionSetting = async (adminUserIdOrPayload, payloadMaybe = {}) => {
  let adminUserId = adminUserIdOrPayload;
  let payload = payloadMaybe;

  if (adminUserIdOrPayload && typeof adminUserIdOrPayload === 'object' && adminUserIdOrPayload.adminId !== undefined) {
    adminUserId = adminUserIdOrPayload.adminId;
    payload = {
      percentage: adminUserIdOrPayload.percentage !== undefined ? adminUserIdOrPayload.percentage : adminUserIdOrPayload.rate,
      reason: adminUserIdOrPayload.reason
    };
  } else if (payloadMaybe && (payloadMaybe.rate !== undefined && payloadMaybe.percentage === undefined)) {
    payload = { ...payloadMaybe, percentage: payloadMaybe.rate };
  }

  const { percentage, reason } = payload || {};

  if (percentage === undefined || percentage === null || String(percentage).trim() === '') {
    const err = new Error('Labour commission percentage is required');
    err.statusCode = 400;
    throw err;
  }

  const parsed = Number(percentage);
  if (isNaN(parsed) || !isFinite(parsed)) {
    const err = new Error('Labour commission percentage must be a valid numeric value');
    err.statusCode = 400;
    throw err;
  }

  if (parsed < 0 || parsed > 100) {
    const err = new Error('Labour commission percentage must be between 0% and 100%');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedPercentage = Math.round(parsed * 100) / 100;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    const err = new Error('A valid reason for change is required (minimum 3 characters)');
    err.statusCode = 400;
    throw err;
  }

  const sanitizedReason = reason.trim();

  let adminName = 'Administrator';
  if (adminUserId) {
    const adminUser = await User.findById(adminUserId).select('name email');
    if (adminUser?.name) {
      adminName = adminUser.name;
    }
  }

  const current = await getLabourCommissionSetting(true);
  const previousPercentage = current.percentage;

  const now = new Date();
  const historyEntry = {
    previousValue: { percentage: previousPercentage },
    newValue: { percentage: sanitizedPercentage },
    changedBy: adminUserId,
    changedByName: adminName,
    reason: sanitizedReason,
    timestamp: now
  };

  const updatedDoc = await SystemSetting.findOneAndUpdate(
    { key: 'labour_commission' },
    {
      $set: {
        value: { percentage: sanitizedPercentage },
        description: 'Mendroo platform labour commission rate applied only to customer-approved labour charges',
        updatedBy: adminUserId,
        effectiveFrom: now
      },
      $push: {
        history: {
          $each: [historyEntry],
          $position: 0
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('updatedBy', 'name email');

  invalidateCommissionCache();

  return {
    percentage: sanitizedPercentage,
    currentRate: sanitizedPercentage,
    rateDecimal: Math.round((sanitizedPercentage / 100) * 10000) / 10000,
    rateFormatted: `${sanitizedPercentage}%`,
    previousPercentage,
    effectiveFrom: updatedDoc.effectiveFrom,
    updatedBy: {
      _id: updatedDoc.updatedBy?._id || adminUserId,
      name: updatedDoc.updatedBy?.name || adminName,
      email: updatedDoc.updatedBy?.email || 'N/A'
    },
    history: updatedDoc.history.map(h => ({
      previousPercentage: h.previousValue?.percentage !== undefined ? h.previousValue.percentage : h.previousValue,
      newPercentage: h.newValue?.percentage !== undefined ? h.newValue.percentage : h.newValue,
      changedBy: h.changedByName || 'Administrator',
      reason: h.reason,
      timestamp: h.timestamp
    }))
  };
};

/**
 * Get both Service and Labour commission settings together
 */
const getDualCommissionSettings = async (forceFresh = false) => {
  const [serviceCommission, labourCommission] = await Promise.all([
    getPlatformCommissionSetting(forceFresh),
    getLabourCommissionSetting(forceFresh)
  ]);
  return {
    serviceCommission,
    labourCommission,
    activeRates: {
      serviceCommissionRate: serviceCommission.percentage,
      labourCommissionRate: labourCommission.percentage
    }
  };
};

module.exports = {
  getFallbackCommissionRate,
  getFallbackLabourCommissionRate,
  getPlatformCommissionSetting,
  getLabourCommissionSetting,
  updatePlatformCommissionSetting,
  updateLabourCommissionSetting,
  getDualCommissionSettings,
  invalidateCommissionCache
};

