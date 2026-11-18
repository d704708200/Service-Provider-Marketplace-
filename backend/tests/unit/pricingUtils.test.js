const {
  normalizePricingType,
  resolveProviderStandardRate,
  buildProviderStandardRateResponse
} = require('../../src/utils/pricingUtils');

describe('pricingUtils - resolveProviderStandardRate', () => {
  const mockTag1 = '6ae869add6c1e99aed96cb44';
  const mockTag2 = '6ae869add6c1e99aed96cb45';
  const mockCategory1 = '6ace42d4a9633c71a3f7ef0d';

  test('normalizes pricing types accurately', () => {
    expect(normalizePricingType('fixed')).toBe('fixed');
    expect(normalizePricingType('per_service')).toBe('fixed');
    expect(normalizePricingType('hourly')).toBe('hourly');
    expect(normalizePricingType('per_hour')).toBe('hourly');
    expect(normalizePricingType('hour')).toBe('hourly');
    expect(normalizePricingType('per_visit')).toBe('per_visit');
    expect(normalizePricingType('visit')).toBe('per_visit');
    expect(normalizePricingType('quote')).toBe('quote');
    expect(normalizePricingType(null)).toBe('fixed');
  });

  test('resolves specific tag with valid fixed price', () => {
    const provider = {
      _id: 'p1',
      serviceTags: [
        {
          tag: mockTag1,
          basePrice: 299,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'approved'
        }
      ]
    };

    const result = resolveProviderStandardRate(provider, { tagId: mockTag1 });
    expect(result.rateStatus).toBe('available');
    expect(result.standardRate).toEqual({
      amount: 299,
      min: 299,
      max: 299,
      pricingType: 'fixed',
      sourceType: 'tag',
      tagId: mockTag1,
      serviceId: null,
      isStartingFrom: false
    });
  });

  test('resolves specific tag with hourly pricing', () => {
    const provider = {
      _id: 'p1',
      serviceTags: [
        {
          tag: mockTag1,
          basePrice: 350,
          pricingType: 'hourly',
          isActive: true,
          approvalStatus: 'approved'
        }
      ]
    };

    const result = resolveProviderStandardRate(provider, { tagId: mockTag1 });
    expect(result.rateStatus).toBe('available');
    expect(result.standardRate.amount).toBe(350);
    expect(result.standardRate.pricingType).toBe('hourly');
    expect(result.standardRate.isStartingFrom).toBe(false);
  });

  test('returns not_configured when specific tag basePrice is 0', () => {
    const provider = {
      _id: 'p1',
      serviceTags: [
        {
          tag: mockTag1,
          basePrice: 0,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'approved'
        }
      ]
    };

    const result = resolveProviderStandardRate(provider, { tagId: mockTag1 });
    expect(result.rateStatus).toBe('not_configured');
    expect(result.standardRate).toBeNull();
  });

  test('ignores unapproved or inactive tags for specific tag request', () => {
    const provider = {
      _id: 'p1',
      serviceTags: [
        {
          tag: mockTag1,
          basePrice: 400,
          pricingType: 'fixed',
          isActive: false,
          approvalStatus: 'approved'
        },
        {
          tag: mockTag2,
          basePrice: 500,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'pending'
        }
      ]
    };

    expect(resolveProviderStandardRate(provider, { tagId: mockTag1 }).rateStatus).toBe('not_available');
    expect(resolveProviderStandardRate(provider, { tagId: mockTag2 }).rateStatus).toBe('not_available');
  });

  test('resolves lowest rate with isStartingFrom=true when multiple tags exist for category ("ALL")', () => {
    const provider = {
      _id: 'p1',
      categories: [mockCategory1],
      serviceTags: [
        {
          tag: { _id: mockTag1, category: mockCategory1 },
          basePrice: 499,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'approved'
        },
        {
          tag: { _id: mockTag2, category: mockCategory1 },
          basePrice: 299,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'approved'
        }
      ]
    };

    const result = resolveProviderStandardRate(provider, {
      categoryId: mockCategory1,
      tagId: 'ALL',
      eligibleTagIds: [mockTag1, mockTag2]
    });

    expect(result.rateStatus).toBe('available');
    expect(result.standardRate.amount).toBe(299);
    expect(result.standardRate.min).toBe(299);
    expect(result.standardRate.max).toBe(499);
    expect(result.standardRate.isStartingFrom).toBe(true);
    expect(result.standardRate.tagId).toBe(mockTag2);
  });

  test('resolves single tag without isStartingFrom when only one tag exists for category', () => {
    const provider = {
      _id: 'p1',
      categories: [mockCategory1],
      serviceTags: [
        {
          tag: { _id: mockTag1, category: mockCategory1 },
          basePrice: 499,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'approved'
        }
      ]
    };

    const result = resolveProviderStandardRate(provider, {
      categoryId: mockCategory1,
      tagId: 'ALL',
      eligibleTagIds: [mockTag1]
    });

    expect(result.rateStatus).toBe('available');
    expect(result.standardRate.amount).toBe(499);
    expect(result.standardRate.isStartingFrom).toBe(false);
  });

  test('buildProviderStandardRateResponse exposes all required root and nested fields', () => {
    const provider = {
      _id: 'p1',
      serviceTags: [
        {
          tag: mockTag1,
          basePrice: 499,
          pricingType: 'fixed',
          isActive: true,
          approvalStatus: 'approved'
        }
      ]
    };

    const response = buildProviderStandardRateResponse(provider, { tagId: mockTag1 });
    expect(response).toEqual({
      standardRate: {
        amount: 499,
        min: 499,
        max: 499,
        pricingType: 'fixed',
        sourceType: 'tag',
        tagId: mockTag1,
        serviceId: null,
        isStartingFrom: false
      },
      rateStatus: 'available',
      amount: 499,
      pricingType: 'fixed',
      sourceType: 'tag',
      tagId: mockTag1,
      serviceId: null,
      servicePrice: 499,
      pricing: {
        basePrice: 499,
        standardRate: {
          amount: 499,
          min: 499,
          max: 499,
          pricingType: 'fixed',
          sourceType: 'tag',
          tagId: mockTag1,
          serviceId: null,
          isStartingFrom: false
        }
      }
    });
  });
});
