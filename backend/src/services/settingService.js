const { SystemSetting, User } = require('../models');

// In-memory cache for fast lookups
let cachedCommissionSetting = null;
let cacheExpiry = 0;
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
 * Invalidate cached setting (e.g. after update)
 */
const invalidateCommissionCache = () => {
  cachedCommissionSetting = null;
  cacheExpiry = 0;
};

/**
 * Get active Platform Commission Setting from persistent database
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
 * Update Platform Commission Setting (Admin Only)
 * Enforces:
 * - Percentage between 0 and 100 (inclusive)
 * - Required audit reason
 * - Records Admin ID, old percentage, new percentage, timestamp, and reason
 * - Invalidates cache so all subsequent future bookings use the new rate
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

  // Fetch admin user name for audit log
  let adminName = 'Administrator';
  if (adminUserId) {
    const adminUser = await User.findById(adminUserId).select('name email');
    if (adminUser?.name) {
      adminName = adminUser.name;
    }
  }

  // Current setting for previousValue
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
          $position: 0 // Newest first
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('updatedBy', 'name email');

  // Invalidate cache immediately
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

module.exports = {
  getFallbackCommissionRate,
  getPlatformCommissionSetting,
  updatePlatformCommissionSetting,
  invalidateCommissionCache
};

