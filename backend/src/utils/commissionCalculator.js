/**
 * Commission Calculator for Mendroo Platform
 * 
 * CRITICAL BUSINESS RULES:
 * 1. Mendroo platform commission must be calculated ONLY ONCE on the original service/base price agreed at booking time.
 * 2. Additional spare parts, materials, or replacement components supplied by the provider must be 100% EXCLUDED from platform commission.
 * 3. Platform commission rate is controlled by Admin via persistent settings.
 * 4. When a booking is created, its commission rate is FROZEN as an immutable snapshot. Future changes to the global commission percentage do NOT alter existing bookings or completed transactions.
 * 
 * Formula:
 *   commissionAmount = originalServicePrice ? configuredCommissionRate / 100
 */

/**
 * Normalizes PLATFORM_COMMISSION_RATE fallback:
 * - If value is between 0 and 1 (e.g. 0.15), treats as decimal rate (15%).
 * - If value is between 1 and 100 (e.g. 15), divides by 100 to get decimal rate (0.15).
 * - Defaults to 0.15 (15%).
 * Returns { rateDecimal: number, ratePercentage: number, rateFormatted: string }
 */
const getPlatformCommissionConfig = () => {
  try {
    const settingService = require('../services/settingService');
    const fallback = settingService.getFallbackCommissionRate();
    return {
      rateDecimal: fallback.rateDecimal,
      ratePercentage: fallback.percentage,
      rateFormatted: fallback.rateFormatted
    };
  } catch (e) {
    const envVal = process.env.PLATFORM_COMMISSION_RATE;
    let decimal = 0.15;
    if (envVal !== undefined && envVal !== null && String(envVal).trim() !== '') {
      const parsed = parseFloat(String(envVal).trim());
      if (!isNaN(parsed) && parsed >= 0) {
        decimal = parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
      }
    }
    decimal = Math.round(decimal * 10000) / 10000;
    const percentage = Math.round(decimal * 100);
    return {
      rateDecimal: decimal,
      ratePercentage: percentage,
      rateFormatted: `${percentage}%`
    };
  }
};

/**
 * Async helper to retrieve the live active commission setting (configured by Admin in DB)
 */
const getActiveCommissionRate = async () => {
  try {
    const settingService = require('../services/settingService');
    const setting = await settingService.getPlatformCommissionSetting();
    return {
      rateDecimal: setting.rateDecimal,
      ratePercentage: setting.percentage,
      rateFormatted: setting.rateFormatted,
      effectiveFrom: setting.effectiveFrom
    };
  } catch (err) {
    return getPlatformCommissionConfig();
  }
};

/**
 * Calculates complete accounting breakdown for a booking.
 * Respects the booking's immutable commission rate snapshot if present.
 * 
 * @param {Object} booking - Booking mongoose document or plain object
 * @param {Object} options - Optional override options (e.g. commissionPercentage, commissionRate)
 * @returns {Object} Complete accounting breakdown
 */
const calculateBookingCommission = (booking, options = {}) => {
  if (!booking) {
    return {
      originalServicePrice: 0,
      additionalPartsAmount: 0,
      partsDescription: '',
      customerApprovedPartsAmount: 0,
      totalCustomerPayable: 0,
      commissionableAmount: 0,
      platformCommissionRate: 15,
      platformCommissionAmount: 0,
      providerNetEarning: 0,
      partsCommission: 0
    };
  }

  // Determine applicable rate:
  // 1. Explicit option override (e.g. during specific calculation)
  // 2. Booking's frozen immutable snapshot (booking.platformCommissionRate / booking.accounting.platformCommissionRate)
  // 3. Fallback to active system configuration
  let ratePercentage = null;

  if (options.commissionPercentage !== undefined && options.commissionPercentage !== null && !isNaN(Number(options.commissionPercentage))) {
    ratePercentage = Number(options.commissionPercentage);
  } else if (options.commissionRate !== undefined && options.commissionRate !== null && !isNaN(Number(options.commissionRate))) {
    const cr = Number(options.commissionRate);
    ratePercentage = cr > 0 && cr <= 1 ? Math.round(cr * 10000) / 100 : cr;
  } else if (booking.platformCommissionRate !== undefined && booking.platformCommissionRate !== null && !isNaN(Number(booking.platformCommissionRate))) {
    ratePercentage = Number(booking.platformCommissionRate);
  } else if (booking.accounting?.platformCommissionRate !== undefined && booking.accounting?.platformCommissionRate !== null && !isNaN(Number(booking.accounting.platformCommissionRate))) {
    ratePercentage = Number(booking.accounting.platformCommissionRate);
  }

  if (ratePercentage === null || isNaN(ratePercentage)) {
    const defaultConfig = getPlatformCommissionConfig();
    ratePercentage = defaultConfig.ratePercentage;
  }

  ratePercentage = Math.round(ratePercentage * 100) / 100;
  const rateDecimal = Math.round((ratePercentage / 100) * 10000) / 10000;

  // 1. Original Service Price: Base price agreed at booking creation
  let originalServicePrice = Number(
    booking.originalServicePrice ||
    booking.accounting?.originalServicePrice ||
    booking.spareParts?.originalServiceAmount ||
    booking.pricing?.basePrice ||
    0
  );

  // Fallback: If originalServicePrice is still 0 but pricing.totalAmount exists and no spare parts
  if (originalServicePrice <= 0 && booking.pricing?.totalAmount) {
    const partsTotal = Number(booking.spareParts?.totalAdditionalAmount || 0);
    originalServicePrice = Math.max(0, Number(booking.pricing.totalAmount) - partsTotal);
  }
  originalServicePrice = Math.round(originalServicePrice * 100) / 100;

  // 2. Additional Parts Amount (All submitted items)
  let additionalPartsAmount = 0;
  let partsDescription = '';

  if (booking.spareParts && Array.isArray(booking.spareParts.items) && booking.spareParts.items.length > 0) {
    additionalPartsAmount = Number(booking.spareParts.totalAdditionalAmount || 0);
    partsDescription = booking.spareParts.items
      .map(item => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}: ?${item.totalPrice}`)
      .join(', ');
  } else if (booking.additionalPartsAmount) {
    additionalPartsAmount = Number(booking.additionalPartsAmount);
  } else if (booking.accounting?.additionalPartsAmount) {
    additionalPartsAmount = Number(booking.accounting.additionalPartsAmount);
  }
  additionalPartsAmount = Math.round(additionalPartsAmount * 100) / 100;

  // 3. Customer Approved Parts Amount (Only counted if customer explicitly approved)
  const isPartsApproved = Boolean(
    booking.spareParts &&
    booking.spareParts.status === 'approved'
  );
  const customerApprovedPartsAmount = isPartsApproved ? additionalPartsAmount : 0;

  // 4. Commissionable Amount: STRICTLY the original service base price
  const commissionableAmount = originalServicePrice;

  // 5. Platform Commission Amount:
  // Formula: originalServicePrice ? ratePercentage / 100
  const platformCommissionAmount = Math.round(commissionableAmount * rateDecimal * 100) / 100;

  // 6. Parts Commission is always 0
  const partsCommission = 0;

  // 7. Total Customer Payable:
  const tax = Number(booking.pricing?.tax || 0);
  const discount = Number(booking.pricing?.discount || 0);
  const baseServiceWithTaxAndDiscount = Math.round((originalServicePrice + tax - discount) * 100) / 100;
  const totalCustomerPayable = Math.round((baseServiceWithTaxAndDiscount + customerApprovedPartsAmount) * 100) / 100;

  // 8. Provider Net Earning:
  // Service Net (originalServicePrice - commission) + 100% of approved parts
  const providerServiceEarning = Math.round((originalServicePrice - platformCommissionAmount) * 100) / 100;
  const providerNetEarning = Math.round((providerServiceEarning + customerApprovedPartsAmount) * 100) / 100;

  return {
    originalServicePrice,
    additionalPartsAmount,
    partsDescription,
    customerApprovedPartsAmount,
    totalCustomerPayable,
    commissionableAmount,
    platformCommissionRate: ratePercentage,
    platformCommissionAmount,
    providerNetEarning,
    partsCommission: 0
  };
};

module.exports = {
  getPlatformCommissionConfig,
  getActiveCommissionRate,
  calculateBookingCommission
};
