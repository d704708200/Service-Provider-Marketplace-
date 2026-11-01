/**
 * Evaluates whether provider contact access is active or has expired after warranty + grace period.
 *
 * Business Rules:
 * - End date derived from booking.warranty?.endDate, booking.warrantyEndDate,
 *   booking.service?.warranty?.endDate, or booking.service?.warrantyEndDate.
 * - Grace period: 15 or 20 days (default: 15 days).
 * - Expiry occurs when currentDate > warrantyEndDate + gracePeriodDays (at end of day 23:59:59.999).
 * - If booking has no warranty or null endDate, isContactExpired is false (missing info != expired).
 */
export const getWarrantyContactStatus = (booking, options = {}) => {
  if (!booking) {
    return {
      hasWarranty: false,
      warrantyEndDate: null,
      gracePeriodDays: 15,
      contactExpiryDate: null,
      isContactExpired: false,
      canCallProvider: false
    };
  }

  // If backend already resolved this via secure serialization
  if (typeof booking.canCallProvider === 'boolean' && !options.overrideBackend) {
    return {
      hasWarranty: Boolean(booking.warranty?.hasWarranty || booking.warrantyEndDate),
      warrantyEndDate: booking.warranty?.endDate || booking.warrantyEndDate || null,
      gracePeriodDays: booking.warranty?.gracePeriodDays || booking.warrantyGracePeriodDays || 15,
      contactExpiryDate: booking.warrantyContactExpiryDate || null,
      isContactExpired: booking.isWarrantyContactExpired === true,
      canCallProvider: booking.canCallProvider
    };
  }

  const rawEndDate =
    booking.warranty?.endDate ||
    booking.warranty?.warrantyEndDate ||
    booking.warrantyEndDate ||
    booking.service?.warranty?.endDate ||
    booking.service?.warrantyEndDate ||
    null;

  if (!rawEndDate) {
    return {
      hasWarranty: false,
      warrantyEndDate: null,
      gracePeriodDays: 15,
      contactExpiryDate: null,
      isContactExpired: false,
      canCallProvider: true
    };
  }

  const endDate = new Date(rawEndDate);
  if (isNaN(endDate.getTime())) {
    return {
      hasWarranty: false,
      warrantyEndDate: null,
      gracePeriodDays: 15,
      contactExpiryDate: null,
      isContactExpired: false,
      canCallProvider: true
    };
  }

  const graceDays =
    typeof options.gracePeriodDays === 'number'
      ? options.gracePeriodDays
      : typeof booking.warranty?.gracePeriodDays === 'number'
      ? booking.warranty.gracePeriodDays
      : typeof booking.warrantyGracePeriodDays === 'number'
      ? booking.warrantyGracePeriodDays
      : typeof booking.service?.warranty?.gracePeriodDays === 'number'
      ? booking.service.warranty.gracePeriodDays
      : 15;

  const expiryDate = new Date(endDate.getTime());
  expiryDate.setDate(expiryDate.getDate() + graceDays);
  expiryDate.setHours(23, 59, 59, 999);

  const now = options.currentDate ? new Date(options.currentDate) : new Date();
  const isContactExpired = now.getTime() > expiryDate.getTime();

  return {
    hasWarranty: true,
    warrantyEndDate: endDate,
    gracePeriodDays: graceDays,
    contactExpiryDate: expiryDate,
    isContactExpired,
    canCallProvider: !isContactExpired
  };
};

