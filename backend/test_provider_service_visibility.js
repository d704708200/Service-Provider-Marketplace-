/**
 * Regression Test Suite: Provider Service Visibility & Discovery
 *
 * Verifies:
 * 1. Provider with one category-linked catalog service resolves and returns the service.
 * 2. Provider with provider-specific services returns those services.
 * 3. Provider with both provider-specific and category catalog services returns merged list without duplicates.
 * 4. Empty service response handling (provider has categories with no active catalog services -> returns empty array safely).
 * 5. Provider without categories / missing category IDs returns empty array gracefully.
 * 6. API error resilience when category service call fails.
 * 7. Category filter query format: serviceApi.getAll({ category: catId }) accepts category parameter and returns expected data shape.
 * 8. Booking creation with the selected service ID is accepted and valid.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { validateCreateBooking } = require('./src/middleware/validation');

let passed = 0;
let total = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`✓ Test ${total}: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ Test ${total} FAILED: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`✓ Test ${total}: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ Test ${total} FAILED: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// Emulate client-side service merging function used in ProviderDetailScreen and RequestServiceScreen
async function resolveProviderServices(providerData, mockServiceApi) {
  const providerSpecificServices = Array.isArray(providerData?.services) ? providerData.services : [];

  const rawCategories = Array.isArray(providerData?.categories)
    ? providerData.categories
    : Array.isArray(providerData?.serviceCategories)
    ? providerData.serviceCategories
    : [];

  const categoryIds = [
    ...new Set(
      rawCategories
        .map((c) => (c && typeof c === 'object' ? c._id || c.id : c))
        .filter((id) => typeof id === 'string' && id.trim().length > 0)
    )
  ];

  let catalogServices = [];
  if (categoryIds.length > 0) {
    try {
      const catalogResponses = await Promise.all(
        categoryIds.map((catId) =>
          mockServiceApi.getAll({ category: catId }).catch((catErr) => {
            return null;
          })
        )
      );

      catalogResponses.forEach((srvRes) => {
        const list = Array.isArray(srvRes?.data)
          ? srvRes.data
          : Array.isArray(srvRes?.data?.services)
          ? srvRes.data.services
          : [];
        catalogServices.push(...list);
      });
    } catch (catErr) {
      // Graceful fallback
    }
  }

  const seenServiceIds = new Set();
  const combinedServices = [];

  for (const srv of [...providerSpecificServices, ...catalogServices]) {
    if (!srv || !srv._id) continue;
    const sid = String(srv._id);
    if (!seenServiceIds.has(sid)) {
      seenServiceIds.add(sid);
      combinedServices.push(srv);
    }
  }

  return {
    categoryIds,
    services: combinedServices
  };
}

async function runSuite() {
  console.log('=== RUNNING PROVIDER SERVICE VISIBILITY TEST SUITE ===\n');

  const cat1 = new mongoose.Types.ObjectId().toString();
  const cat2 = new mongoose.Types.ObjectId().toString();
  const service1Id = new mongoose.Types.ObjectId().toString();
  const service2Id = new mongoose.Types.ObjectId().toString();
  const service3Id = new mongoose.Types.ObjectId().toString();

  // Test 1: Provider with one category-linked catalog service
  await runAsyncTest('Provider with one category-linked catalog service returns service with matching ID', async () => {
    const mockProvider = {
      _id: 'prov-1',
      businessName: 'harshs carpenter',
      categories: [{ _id: cat1, name: 'CARPENTER' }],
      services: []
    };

    const mockServiceApi = {
      getAll: async (params) => {
        assert.strictEqual(params.category, cat1);
        return {
          success: true,
          data: [{ _id: service1Id, name: 'Shsh', category: cat1, price: 50 }]
        };
      }
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 1);
    assert.strictEqual(result.services[0]._id, service1Id);
    assert.strictEqual(result.services[0].name, 'Shsh');
    assert.deepStrictEqual(result.categoryIds, [cat1]);
  });

  // Test 2: Provider with provider-specific services
  await runAsyncTest('Provider with provider-specific services returns those services directly', async () => {
    const mockProvider = {
      _id: 'prov-2',
      businessName: 'Custom Woodworks',
      categories: [{ _id: cat1, name: 'CARPENTER' }],
      services: [{ _id: service2Id, name: 'Custom Wardrobe Build', price: 1500 }]
    };

    const mockServiceApi = {
      getAll: async () => ({ success: true, data: [] })
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 1);
    assert.strictEqual(result.services[0]._id, service2Id);
    assert.strictEqual(result.services[0].name, 'Custom Wardrobe Build');
  });

  // Test 3: Provider with both provider-specific and category catalog services (deduplication)
  await runAsyncTest('Provider with duplicate service IDs deduplicates correctly', async () => {
    const mockProvider = {
      _id: 'prov-3',
      businessName: 'Master Carpentry',
      categories: [{ _id: cat1, name: 'CARPENTER' }],
      services: [{ _id: service1Id, name: 'Shsh (Provider Offer)', price: 50 }]
    };

    const mockServiceApi = {
      getAll: async () => ({
        success: true,
        data: [{ _id: service1Id, name: 'Shsh (Catalog)', price: 50 }]
      })
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 1, 'Duplicate service IDs must be deduplicated');
    assert.strictEqual(result.services[0]._id, service1Id);
  });

  // Test 4: Empty service response
  await runAsyncTest('Empty catalog response gracefully yields empty services array', async () => {
    const mockProvider = {
      _id: 'prov-4',
      businessName: 'New Provider',
      categories: [{ _id: cat2, name: 'Plumber' }],
      services: []
    };

    const mockServiceApi = {
      getAll: async () => ({ success: true, data: [] })
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 0);
  });

  // Test 5: Missing or empty category IDs
  await runAsyncTest('Provider without categories returns empty services without calling serviceApi', async () => {
    const mockProvider = {
      _id: 'prov-5',
      businessName: 'No Category Provider',
      categories: [],
      services: []
    };

    let called = false;
    const mockServiceApi = {
      getAll: async () => {
        called = true;
        return { success: true, data: [] };
      }
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 0);
    assert.strictEqual(called, false, 'serviceApi should not be called when categoryIds is empty');
  });

  // Test 6: API error resilience
  await runAsyncTest('API error in serviceApi.getAll is caught and does not crash app', async () => {
    const mockProvider = {
      _id: 'prov-6',
      businessName: 'Error Test Provider',
      categories: [{ _id: cat1, name: 'CARPENTER' }],
      services: [{ _id: service3Id, name: 'Fallback Existing Service', price: 100 }]
    };

    const mockServiceApi = {
      getAll: async () => {
        throw new Error('Network timeout / 500 server error');
      }
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 1);
    assert.strictEqual(result.services[0]._id, service3Id);
  });

  // Test 7: Handles response pagination wrapper data.services
  await runAsyncTest('Handles serviceApi response shape with data.services wrapper', async () => {
    const mockProvider = {
      _id: 'prov-7',
      businessName: 'Wrapped Response Provider',
      categories: [{ _id: cat1, name: 'CARPENTER' }],
      services: []
    };

    const mockServiceApi = {
      getAll: async () => ({
        success: true,
        data: {
          services: [{ _id: service1Id, name: 'Shsh' }],
          total: 1
        }
      })
    };

    const result = await resolveProviderServices(mockProvider, mockServiceApi);
    assert.strictEqual(result.services.length, 1);
    assert.strictEqual(result.services[0]._id, service1Id);
  });

  // Test 8: Booking with the selected service ID passes validation
  runTest('Booking validation passes when selected service ID is a valid MongoDB ObjectId', () => {
    const req = {
      body: {
        serviceId: service1Id,
        providerId: new mongoose.Types.ObjectId().toString(),
        bookingMode: 'scheduled',
        scheduledDate: new Date().toISOString(),
        scheduledTimeSlot: { startTime: '09:00', endTime: '11:00' },
        address: {
          street: '123 Test St',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001'
        }
      }
    };

    let nextCalled = false;
    const res = {
      status: () => res,
      json: () => res
    };

    validateCreateBooking(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Valid booking payload should pass validation middleware');
  });

  console.log(`\n======================================================`);
  console.log(`ALL ${passed}/${total} PROVIDER VISIBILITY TESTS PASSED!`);
  console.log(`======================================================\n`);
}

runSuite().catch((err) => {
  console.error('Test suite execution failed:', err);
  process.exit(1);
});
