/**
 * Warranty and Provider Contact Access Utility
 *
 * Rules:
 * - Warranty expiry is calculated from the actual warranty end date stored against booking/service.
 * - A configurable grace period of 15 or 20 days (default: 15) is allowed.
 * - After warranty end date + grace period (at end of day 23:59:59.999), provider contact expires.
 * - If booking has no warranty or null end date, contact does NOT expire (missing warranty != expired).
 */

const getWarrantyContactStatus = (booking, options = {}) => {
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

  // Extract warranty end date from booking or service
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

  // Configurable grace period: explicit option > booking.warranty > booking root > service > env > default 15
  const graceDays =
    typeof options.gracePeriodDays === 'number'
      ? options.gracePeriodDays
      : typeof booking.warranty?.gracePeriodDays === 'number'
      ? booking.warranty.gracePeriodDays
      : typeof booking.warrantyGracePeriodDays === 'number'
      ? booking.warrantyGracePeriodDays
      : typeof booking.service?.warranty?.gracePeriodDays === 'number'
      ? booking.service.warranty.gracePeriodDays
      : (parseInt(process.env.WARRANTY_GRACE_PERIOD_DAYS, 10) || 15);

  const expiryDate = new Date(endDate.getTime());
  expiryDate.setDate(expiryDate.getDate() + graceDays);
  // End of day to avoid timezone off-by-one errors
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

/**
 * Apply warranty contact security policy to a booking object before returning to customer.
 * Redacts provider phone number if contact access has expired.
 */
const applyWarrantyContactPolicy = (bookingDoc, options = {}) => {
  if (!bookingDoc) return bookingDoc;

  // Convert Mongoose document to plain object if needed
  const booking = typeof bookingDoc.toObject === 'function' ? bookingDoc.toObject() : { ...bookingDoc };

  const status = getWarrantyContactStatus(booking, options);

  booking.canCallProvider = status.canCallProvider;
  booking.isWarrantyContactExpired = status.isContactExpired;
  booking.warrantyContactExpiryDate = status.contactExpiryDate;

  if (status.hasWarranty) {
    booking.warranty = {
      ...(booking.warranty || {}),
      hasWarranty: true,
      endDate: status.warrantyEndDate,
      gracePeriodDays: status.gracePeriodDays,
      contactExpiryDate: status.contactExpiryDate,
      isExpired: status.isContactExpired
    };
    booking.warrantyEndDate = status.warrantyEndDate;
    booking.warrantyGracePeriodDays = status.gracePeriodDays;
  }

  // Backend Security: Redact provider phone number if expired
  if (status.isContactExpired) {
    if (booking.provider) {
      if (booking.provider.user) {
        booking.provider.user.phone = null;
      }
      booking.provider.phone = null;
    }
  }

  return booking;
};

module.exports = {
  getWarrantyContactStatus,
  applyWarrantyContactPolicy
};

