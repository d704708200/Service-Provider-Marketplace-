/**
 * Pricing Resolution Utilities
 * Single source of truth for provider standard rates across marketplace API,
 * search results, category tag discovery, and checkout pricing calculations.
 */

/**
 * Normalizes pricing type values into standardized enum strings.
 * @param {string} type
 * @returns {'fixed' | 'hourly' | 'per_visit' | 'quote'}
 */
const normalizePricingType = (type) => {
  if (!type) return 'fixed';
  const lower = String(type).trim().toLowerCase();
  if (lower === 'hourly' || lower === 'hour' || lower === 'per_hour') {
    return 'hourly';
  }
  if (lower === 'per_visit' || lower === 'visit') {
    return 'per_visit';
  }
  if (lower === 'quote' || lower === 'quote_on_request') {
    return 'quote';
  }
  return 'fixed';
};

/**
 * Resolves standard rate and rateStatus for a provider.
 * Follows provider-configured serviceTags as the primary authority,
 * falling back to provider-owned custom services.
 *
 * @param {Object} provider - Provider document (plain object or Mongoose doc)
 * @param {Object} [options]
 * @param {string|ObjectId} [options.categoryId] - Filter by specific category
 * @param {string|ObjectId} [options.tagId] - Filter by specific service tag
 * @param {string|ObjectId} [options.serviceId] - Filter by specific custom/catalog service
 * @param {Array<string|ObjectId>} [options.eligibleTagIds] - List of tag IDs belonging to category
 * @param {Array<Object>} [options.providerServices] - Custom services owned by provider
 * @returns {{ standardRate: Object|null, rateStatus: string }}
 */
const resolveProviderStandardRate = (provider, options = {}) => {
  if (!provider) {
    return { standardRate: null, rateStatus: 'not_available' };
  }

  const {
    categoryId,
    tagId,
    serviceId,
    eligibleTagIds = null,
    providerServices = []
  } = options;

  const rawTags = Array.isArray(provider.serviceTags) ? provider.serviceTags : [];
  const activeApprovedTags = rawTags.filter(
    (st) => st && st.isActive !== false && st.approvalStatus === 'approved'
  );

  const normalizedTagId =
    tagId && String(tagId).trim() && String(tagId).trim().toUpperCase() !== 'ALL'
      ? String(tagId).trim()
      : null;

  // Case 1: Specific Service Tag requested
  if (normalizedTagId) {
    const matchedTag = activeApprovedTags.find(
      (st) => String(st.tag?._id || st.tag) === normalizedTagId
    );

    if (!matchedTag) {
      return { standardRate: null, rateStatus: 'not_available' };
    }

    const priceType = normalizePricingType(matchedTag.pricingType);
    const priceNum = Number(matchedTag.basePrice);

    if (priceType === 'quote') {
      const quoteAmount = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null;
      return {
        standardRate: {
          amount: quoteAmount,
          min: quoteAmount,
          max: quoteAmount,
          pricingType: 'quote',
          sourceType: 'tag',
          tagId: matchedTag.tag?._id || matchedTag.tag,
          serviceId: null,
          isStartingFrom: false
        },
        rateStatus: 'quote'
      };
    }

    if (Number.isFinite(priceNum) && priceNum > 0) {
      return {
        standardRate: {
          amount: priceNum,
          min: priceNum,
          max: priceNum,
          pricingType: priceType,
          sourceType: 'tag',
          tagId: matchedTag.tag?._id || matchedTag.tag,
          serviceId: null,
          isStartingFrom: false
        },
        rateStatus: 'available'
      };
    }

    return { standardRate: null, rateStatus: 'not_configured' };
  }

  // Case 2: Specific Service ID requested (check provider custom service)
  if (serviceId) {
    const exactService = providerServices.find(
      (s) => String(s._id) === String(serviceId)
    );
    if (exactService) {
      const priceNum = Number(exactService.price);
      const priceType = normalizePricingType(exactService.priceType);
      if (Number.isFinite(priceNum) && priceNum > 0) {
        return {
          standardRate: {
            amount: priceNum,
            min: priceNum,
            max: priceNum,
            pricingType: priceType,
            sourceType: 'service',
            tagId: null,
            serviceId: exactService._id,
            isStartingFrom: false
          },
          rateStatus: 'available'
        };
      }
    }
  }

  // Case 3: Category filter or Global ("All")
  let candidateTags = activeApprovedTags;
  if (categoryId) {
    const strCatId = String(categoryId);
    const eligibleSet = Array.isArray(eligibleTagIds)
      ? new Set(eligibleTagIds.map(String))
      : null;

    candidateTags = activeApprovedTags.filter((st) => {
      const currentTagId = String(st.tag?._id || st.tag);
      if (eligibleSet) {
        return eligibleSet.has(currentTagId);
      }
      const tagCat = st.tag?.category?._id || st.tag?.category;
      if (tagCat && String(tagCat) === strCatId) {
        return true;
      }
      // If tag is unpopulated and eligibleSet not provided, check provider's categories
      if (!tagCat || tagCat === currentTagId) {
        const provCats = Array.isArray(provider.categories)
          ? provider.categories.map((c) => String(c?._id || c))
          : [];
        return provCats.includes(strCatId);
      }
      return false;
    });
  }

  // Extract positive configured rates from candidate tags
  const validTagRates = candidateTags
    .filter((st) => Number.isFinite(Number(st.basePrice)) && Number(st.basePrice) > 0 && normalizePricingType(st.pricingType) !== 'quote')
    .map((st) => ({
      amount: Number(st.basePrice),
      pricingType: normalizePricingType(st.pricingType),
      sourceType: 'tag',
      tagId: st.tag?._id || st.tag,
      serviceId: null
    }));

  // Extract rates from provider services (if any)
  const validServiceRates = (providerServices || [])
    .filter((s) => {
      if (categoryId) {
        const sCat = s.category?._id || s.category;
        if (sCat && String(sCat) !== String(categoryId)) return false;
      }
      return Number.isFinite(Number(s.price)) && Number(s.price) > 0;
    })
    .map((s) => ({
      amount: Number(s.price),
      pricingType: normalizePricingType(s.priceType),
      sourceType: 'service',
      tagId: null,
      serviceId: s._id
    }));

  // Primary rates from provider serviceTags; fallback to custom provider services
  const combinedRates = validTagRates.length > 0 ? validTagRates : validServiceRates;

  if (combinedRates.length > 0) {
    combinedRates.sort((a, b) => a.amount - b.amount);
    const lowestRate = combinedRates[0];
    const highestRate = combinedRates[combinedRates.length - 1];
    const isStartingFrom = combinedRates.length > 1;

    return {
      standardRate: {
        amount: lowestRate.amount,
        min: lowestRate.amount,
        max: highestRate.amount,
        pricingType: lowestRate.pricingType,
        sourceType: lowestRate.sourceType,
        tagId: lowestRate.tagId,
        serviceId: lowestRate.serviceId,
        isStartingFrom
      },
      rateStatus: 'available'
    };
  }

  // Check if provider has quote tags
  const hasQuoteTag = candidateTags.some(
    (st) => normalizePricingType(st.pricingType) === 'quote'
  );
  if (hasQuoteTag) {
    return {
      standardRate: {
        amount: null,
        min: null,
        max: null,
        pricingType: 'quote',
        sourceType: 'tag',
        tagId: null,
        serviceId: null,
        isStartingFrom: false
      },
      rateStatus: 'quote'
    };
  }

  // Check if provider configured tags or services but price is 0 / not configured
  if (candidateTags.length > 0 || (providerServices && providerServices.length > 0)) {
    return { standardRate: null, rateStatus: 'not_configured' };
  }

  return { standardRate: null, rateStatus: 'not_available' };
};

/**
 * Builds standard rate payload for provider API responses.
 * Ensures consistent output structure across all provider listing endpoints.
 */
const buildProviderStandardRateResponse = (provider, options = {}) => {
  const { standardRate, rateStatus } = resolveProviderStandardRate(provider, options);

  const amount = standardRate ? standardRate.amount : null;
  const pricingType = standardRate ? standardRate.pricingType : 'fixed';
  const sourceType = standardRate ? standardRate.sourceType : null;
  const tagId = standardRate ? standardRate.tagId : null;
  const serviceId = standardRate ? standardRate.serviceId : null;

  return {
    standardRate,
    rateStatus,
    amount,
    pricingType,
    sourceType,
    tagId,
    serviceId,
    servicePrice: amount,
    pricing: {
      basePrice: amount,
      standardRate
    }
  };
};

module.exports = {
  normalizePricingType,
  resolveProviderStandardRate,
  buildProviderStandardRateResponse
};
