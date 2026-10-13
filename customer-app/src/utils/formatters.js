/**
 * Safe formatting utilities for numbers, ratings, currency, and counts.
 */

/**
 * Safely extracts and formats a rating to 1 decimal place.
 * Handles:
 *  - Numbers: 4.8 -> "4.8"
 *  - Numeric strings: "4.8", "5" -> "4.8", "5.0"
 *  - Object formats: { average: 4.8 }, { rating: "4.5" } -> "4.8", "4.5"
 *  - Missing, null, undefined, empty, NaN, or invalid: fallback (default "0.0")
 *
 * @param {any} ratingValue
 * @param {string} fallback
 * @returns {string}
 */
export const formatRating = (ratingValue, fallback = '0.0') => {
  if (ratingValue === null || ratingValue === undefined || ratingValue === '') {
    return fallback;
  }

  let num = NaN;

  if (typeof ratingValue === 'number') {
    num = ratingValue;
  } else if (typeof ratingValue === 'string') {
    num = parseFloat(ratingValue);
  } else if (typeof ratingValue === 'object') {
    const raw = ratingValue.average ?? ratingValue.rating ?? ratingValue.value;
    if (typeof raw === 'number') {
      num = raw;
    } else if (typeof raw === 'string') {
      num = parseFloat(raw);
    }
  }

  if (Number.isFinite(num) && num >= 0) {
    return num.toFixed(1);
  }

  return fallback;
};

/**
 * Safely extracts review count from a provider object or raw value.
 *
 * @param {any} reviewCountValue
 * @param {any} ratingObj
 * @returns {number}
 */
export const formatReviewCount = (reviewCountValue, ratingObj) => {
  if (typeof reviewCountValue === 'number' && Number.isFinite(reviewCountValue)) {
    return reviewCountValue;
  }
  if (typeof reviewCountValue === 'string') {
    const parsed = parseInt(reviewCountValue, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (ratingObj && typeof ratingObj === 'object') {
    const count = ratingObj.count ?? ratingObj.reviewCount;
    if (typeof count === 'number' && Number.isFinite(count)) {
      return count;
    }
    if (typeof count === 'string') {
      const parsed = parseInt(count, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

/**
 * Safely formats experience years.
 *
 * @param {any} years
 * @param {number} fallback
 * @returns {number}
 */
export const formatExperience = (years, fallback = 0) => {
  if (typeof years === 'number' && Number.isFinite(years)) {
    return years;
  }
  if (typeof years === 'string') {
    const parsed = parseInt(years, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

/**
 * Safely formats currency amounts.
 *
 * @param {any} amount
 * @param {number} fallback
 * @returns {string}
 */
export const formatPrice = (amount, fallback = 0) => {
  let num = NaN;
  if (typeof amount === 'number') {
    num = amount;
  } else if (typeof amount === 'string') {
    num = parseFloat(amount);
  }
  if (Number.isFinite(num)) {
    return num.toLocaleString('en-IN');
  }
  return String(fallback);
};
