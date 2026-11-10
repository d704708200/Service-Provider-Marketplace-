/**
 * Commission Calculator for Mendroo Platform
 * 
 * CRITICAL BUSINESS RULES:
 * 1. Mendroo platform commission consists of two independently configurable components:
 *    a) Service Commission: Calculated strictly on the original service/base price agreed at booking creation.
 *    b) Labour Commission: Calculated strictly on customer-approved labour charges.
 * 2. Additional spare parts, materials, and replacement components supplied by the provider are 100% EXCLUDED from platform commission (Parts Commission = ₹0).
 * 3. Both commission rates are controlled by Admin via persistent settings with audited change history.
 * 4. When a booking is created, its commission rates are FROZEN as immutable snapshots. Future changes to global commission percentages do NOT alter existing bookings or completed transactions.
 * 5. Historical bookings created before Labour Commission configuration must retain 0% labour commission (no retroactive billing).
 * 
 * Formula:
 *   serviceCommissionAmount = originalServicePrice × serviceCommissionRate / 100
 *   labourCommissionAmount = approvedLabourCharge × labourCommissionRate / 100 (0 if unapproved)
 *   totalPlatformCommission = serviceCommissionAmount + labourCommissionAmount
 *   providerNetEarning = totalCustomerPayable - totalPlatformCommission
 *   partsCommission = 0
 */

/**
 * Normalizes PLATFORM_COMMISSION_RATE fallback:
 * - Defaults to 15%.
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
 * Normalizes LABOUR_COMMISSION_RATE fallback:
 * - Defaults to 0%.
 */
const getLabourCommissionConfig = () => {
  try {
    const settingService = require('../services/settingService');
    const fallback = settingService.getFallbackLabourCommissionRate();
    return {
      rateDecimal: fallback.rateDecimal,
      ratePercentage: fallback.percentage,
      rateFormatted: fallback.rateFormatted
    };
  } catch (e) {
    const envVal = process.env.LABOUR_COMMISSION_RATE;
    let decimal = 0.0;
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
 * Async helper to retrieve the live active service commission setting (configured by Admin in DB)
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
 * Async helper to retrieve the live active labour commission setting (configured by Admin in DB)
 */
const getActiveLabourCommissionRate = async () => {
  try {
    const settingService = require('../services/settingService');
    const setting = await settingService.getLabourCommissionSetting();
    return {
      rateDecimal: setting.rateDecimal,
      ratePercentage: setting.percentage,
      rateFormatted: setting.rateFormatted,
      effectiveFrom: setting.effectiveFrom
    };
  } catch (err) {
    return getLabourCommissionConfig();
  }
};

/**
 * Async helper to retrieve both live active commission settings together
 */
const getActiveCommissionRates = async () => {
  const [serviceConfig, labourConfig] = await Promise.all([
    getActiveCommissionRate(),
    getActiveLabourCommissionRate()
  ]);
  return {
    serviceRateDecimal: serviceConfig.rateDecimal,
    serviceRatePercentage: serviceConfig.ratePercentage,
    serviceRateFormatted: serviceConfig.rateFormatted,
    labourRateDecimal: labourConfig.rateDecimal,
    labourRatePercentage: labourConfig.ratePercentage,
    labourRateFormatted: labourConfig.rateFormatted,
    effectiveFrom: serviceConfig.effectiveFrom
  };
};

/**
 * Calculates complete accounting breakdown for a booking.
 * Respects the booking's immutable commission rate snapshots if present.
 * 
 * @param {Object} booking - Booking mongoose document or plain object
 * @param {Object} options - Optional override options
 * @returns {Object} Complete dual accounting breakdown
 */
const calculateBookingCommission = (booking, options = {}) => {
  if (!booking) {
    return {
      originalServicePrice: 0,
      additionalPartsAmount: 0,
      partsDescription: '',
      customerApprovedPartsAmount: 0,
      labourCharge: 0,
      approvedLabourCharge: 0,
      totalCustomerPayable: 0,
      commissionableAmount: 0,
      platformCommissionRate: 15,
      serviceCommissionRate: 15,
      labourCommissionRate: 0,
      serviceCommissionAmount: 0,
      labourCommissionAmount: 0,
      totalPlatformCommission: 0,
      platformCommissionAmount: 0,
      labourCommissionStatus: 'not_applicable',
      providerNetEarning: 0,
      partsCommission: 0
    };
  }

  // -------------------------------------------------------------------------
  // 1. Service Commission Rate Snapshot / Override
  // -------------------------------------------------------------------------
  let serviceRatePercentage = null;

  if (options.serviceCommissionPercentage !== undefined && options.serviceCommissionPercentage !== null && !isNaN(Number(options.serviceCommissionPercentage))) {
    serviceRatePercentage = Number(options.serviceCommissionPercentage);
  } else if (options.commissionPercentage !== undefined && options.commissionPercentage !== null && !isNaN(Number(options.commissionPercentage))) {
    serviceRatePercentage = Number(options.commissionPercentage);
  } else if (options.commissionRate !== undefined && options.commissionRate !== null && !isNaN(Number(options.commissionRate))) {
    const cr = Number(options.commissionRate);
    serviceRatePercentage = cr > 0 && cr <= 1 ? Math.round(cr * 10000) / 100 : cr;
  } else if (booking.platformCommissionRate !== undefined && booking.platformCommissionRate !== null && !isNaN(Number(booking.platformCommissionRate))) {
    serviceRatePercentage = Number(booking.platformCommissionRate);
  } else if (booking.accounting?.platformCommissionRate !== undefined && booking.accounting?.platformCommissionRate !== null && !isNaN(Number(booking.accounting.platformCommissionRate))) {
    serviceRatePercentage = Number(booking.accounting.platformCommissionRate);
  } else if (booking.accounting?.serviceCommissionRate !== undefined && booking.accounting?.serviceCommissionRate !== null && !isNaN(Number(booking.accounting.serviceCommissionRate))) {
    serviceRatePercentage = Number(booking.accounting.serviceCommissionRate);
  }

  if (serviceRatePercentage === null || isNaN(serviceRatePercentage)) {
    const defaultConfig = getPlatformCommissionConfig();
    serviceRatePercentage = defaultConfig.ratePercentage;
  }

  serviceRatePercentage = Math.round(serviceRatePercentage * 100) / 100;
  const serviceRateDecimal = Math.round((serviceRatePercentage / 100) * 10000) / 10000;

  // -------------------------------------------------------------------------
  // 2. Labour Commission Rate Snapshot / Override
  // -------------------------------------------------------------------------
  let labourRatePercentage = null;

  if (options.labourCommissionPercentage !== undefined && options.labourCommissionPercentage !== null && !isNaN(Number(options.labourCommissionPercentage))) {
    labourRatePercentage = Number(options.labourCommissionPercentage);
  } else if (options.labourRate !== undefined && options.labourRate !== null && !isNaN(Number(options.labourRate))) {
    const lr = Number(options.labourRate);
    labourRatePercentage = lr > 0 && lr <= 1 ? Math.round(lr * 10000) / 100 : lr;
  } else if (booking.labourCommissionRate !== undefined && booking.labourCommissionRate !== null && !isNaN(Number(booking.labourCommissionRate))) {
    labourRatePercentage = Number(booking.labourCommissionRate);
  } else if (booking.accounting?.labourCommissionRate !== undefined && booking.accounting?.labourCommissionRate !== null && !isNaN(Number(booking.accounting.labourCommissionRate))) {
    labourRatePercentage = Number(booking.accounting.labourCommissionRate);
  } else if (options.isNewBooking) {
    // Only new bookings fallback to the current active global labour rate
    const defaultLabourConfig = getLabourCommissionConfig();
    labourRatePercentage = defaultLabourConfig.ratePercentage;
  } else {
    // CRITICAL: Existing historical bookings without labourCommissionRate snapshot default to 0%
    labourRatePercentage = 0;
  }

  labourRatePercentage = Math.round(labourRatePercentage * 100) / 100;
  const labourRateDecimal = Math.round((labourRatePercentage / 100) * 10000) / 10000;

  // -------------------------------------------------------------------------
  // 3. Original Service Price: Base price agreed at booking creation
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 4. Physical Parts vs Labour Charges
  // -------------------------------------------------------------------------
  let physicalPartsAmount = 0;
  let labourCharge = 0;
  let partsDescription = '';

  if (booking.spareParts && Array.isArray(booking.spareParts.items) && booking.spareParts.items.length > 0) {
    // Explicit partsSubtotal and labourSubtotal if available
    if (booking.spareParts.partsSubtotal !== undefined && booking.spareParts.labourSubtotal !== undefined) {
      physicalPartsAmount = Number(booking.spareParts.partsSubtotal || 0);
      labourCharge = Number(booking.spareParts.labourSubtotal || 0);
    } else {
      // Calculate from individual line items
      booking.spareParts.items.forEach(item => {
        const qty = Number(item.quantity) || 1;
        const up = Number(item.unitPrice) || 0;
        const lc = Number(item.labourCharge) || 0;
        physicalPartsAmount += qty * up;
        labourCharge += lc;
      });
    }

    partsDescription = booking.spareParts.items
      .map(item => {
        const base = `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}: ₹${item.totalPrice}`;
        return item.labourCharge > 0 ? `${base} (incl. ₹${item.labourCharge} labour)` : base;
      })
      .join(', ');
  } else if (booking.spareParts && (booking.spareParts.partsSubtotal !== undefined || booking.spareParts.labourSubtotal !== undefined)) {
    physicalPartsAmount = Number(booking.spareParts.partsSubtotal || 0);
    labourCharge = Number(booking.spareParts.labourSubtotal || 0);
  } else {
    physicalPartsAmount = Number(booking.additionalPartsAmount || booking.accounting?.additionalPartsAmount || 0);
    labourCharge = Number(booking.labourCharge || booking.approvedLabourCharge || booking.accounting?.labourCharge || booking.accounting?.approvedLabourCharge || 0);
  }

  physicalPartsAmount = Math.round(physicalPartsAmount * 100) / 100;
  labourCharge = Math.round(labourCharge * 100) / 100;

  // -------------------------------------------------------------------------
  // 5. Customer Approval Check
  // -------------------------------------------------------------------------
  const isCustomerApproved = Boolean(
    booking.spareParts &&
    booking.spareParts.status === 'approved'
  );

  const customerApprovedPartsAmount = isCustomerApproved ? physicalPartsAmount : 0;
  const approvedLabourCharge = isCustomerApproved
    ? labourCharge
    : (booking.approvedLabourCharge !== undefined ? Number(booking.approvedLabourCharge) : (Number(booking.accounting?.approvedLabourCharge) || 0));

  // Determine Labour Commission Status
  let labourCommissionStatus = 'not_applicable';
  if (labourCharge > 0) {
    if (isCustomerApproved) {
      labourCommissionStatus = 'approved';
    } else if (booking.spareParts?.status === 'rejected') {
      labourCommissionStatus = 'rejected';
    } else {
      labourCommissionStatus = 'pending_approval';
    }
  }

  // -------------------------------------------------------------------------
  // 6. Commission Calculations
  // -------------------------------------------------------------------------
  // Commissionable base for Service Commission: strictly original service price
  const commissionableAmount = originalServicePrice;
  const serviceCommissionAmount = Math.round(commissionableAmount * serviceRateDecimal * 100) / 100;

  // Commissionable base for Labour Commission: strictly customer-approved labour charge
  const labourCommissionAmount = isCustomerApproved && approvedLabourCharge > 0 && labourRateDecimal > 0
    ? Math.round(approvedLabourCharge * labourRateDecimal * 100) / 100
    : 0;

  // Total Platform Commission = Service Commission + Labour Commission
  const totalPlatformCommission = Math.round((serviceCommissionAmount + labourCommissionAmount) * 100) / 100;
  const platformCommissionAmount = totalPlatformCommission; // Backward-compatible alias

  // Physical Parts Commission is ALWAYS 0
  const partsCommission = 0;

  // -------------------------------------------------------------------------
  // 7. Customer Payable & Provider Net Earnings
  // -------------------------------------------------------------------------
  const tax = Number(booking.pricing?.tax || 0);
  const discount = Number(booking.pricing?.discount || 0);
  const baseServiceWithTaxAndDiscount = Math.round((originalServicePrice + tax - discount) * 100) / 100;

  // Customer pays: base service + approved parts + approved labour
  const totalCustomerPayable = Math.round(
    (baseServiceWithTaxAndDiscount + customerApprovedPartsAmount + approvedLabourCharge) * 100
  ) / 100;

  // Provider net earning: Customer payable - Total platform commission
  const providerNetEarning = Math.round((totalCustomerPayable - totalPlatformCommission) * 100) / 100;

  const totalAdditionalQuote = Math.round((physicalPartsAmount + labourCharge) * 100) / 100;

  return {
    originalServicePrice,
    additionalPartsAmount: totalAdditionalQuote,
    physicalPartsAmount,
    partsDescription,
    customerApprovedPartsAmount,
    labourCharge,
    approvedLabourCharge,
    totalCustomerPayable,
    commissionableAmount,
    platformCommissionRate: serviceRatePercentage,
    serviceCommissionRate: serviceRatePercentage,
    labourCommissionRate: labourRatePercentage,
    serviceCommissionAmount,
    labourCommissionAmount,
    totalPlatformCommission,
    platformCommissionAmount,
    labourCommissionStatus,
    providerNetEarning,
    partsCommission: 0,
    partsCommissionAmount: 0
  };
};

/**
 * Direct calculator helper for dual commission arithmetic
 */
const calculateDualCommission = ({
  servicePrice = 0,
  labourCharge = 0,
  partsAmount = 0,
  serviceRate = 15,
  labourRate = 0,
  isLabourApproved = true,
  isPartsApproved = true
} = {}) => {
  const originalServicePrice = Math.max(0, Number(servicePrice) || 0);
  const rawLabourCharge = Math.max(0, Number(labourCharge) || 0);
  const physicalParts = Math.max(0, Number(partsAmount) || 0);
  const sRate = Math.max(0, Math.min(100, Number(serviceRate) || 0));
  const lRate = Math.max(0, Math.min(100, Number(labourRate) || 0));

  const approvedLabour = isLabourApproved ? rawLabourCharge : 0;
  const approvedParts = isPartsApproved ? physicalParts : 0;

  const serviceCommissionAmount = Math.round(originalServicePrice * (sRate / 100) * 100) / 100;
  const labourCommissionAmount = Math.round(approvedLabour * (lRate / 100) * 100) / 100;
  const partsCommissionAmount = 0;
  const totalPlatformCommission = Math.round((serviceCommissionAmount + labourCommissionAmount) * 100) / 100;

  const totalCustomerPayable = Math.round((originalServicePrice + approvedParts + approvedLabour) * 100) / 100;
  const providerNetEarning = Math.round((totalCustomerPayable - totalPlatformCommission) * 100) / 100;

  return {
    originalServicePrice,
    approvedLabourCharge: approvedLabour,
    customerApprovedPartsAmount: approvedParts,
    serviceCommissionRate: sRate,
    labourCommissionRate: lRate,
    serviceCommissionAmount,
    labourCommissionAmount,
    partsCommissionAmount,
    totalPlatformCommission,
    totalCustomerPayable,
    providerNetEarning
  };
};

module.exports = {
  getPlatformCommissionConfig,
  getLabourCommissionConfig,
  getActiveCommissionRate,
  getActiveLabourCommissionRate,
  getActiveCommissionRates,
  calculateBookingCommission,
  calculateDualCommission
};
