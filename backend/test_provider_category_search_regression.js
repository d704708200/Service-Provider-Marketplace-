/**
 * test_provider_category_search_regression.js
 * Regression tests covering:
 * 1. Multiple providers in the same category (Electrician: 3 verified providers)
 * 2. Category matching by Name ("Electrician")
 * 3. Category matching by ID
 * 4. Free-text search matching provider businessName or bio
 * 5. Free-text search matching Category name / slug
 * 6. Free-text search matching associated active Service name
 * 7. Combined category filter + free-text search (Raj Electrical Services)
 * 8. Combined category filter + mismatching free-text search (0 results)
 * 9. Verification status safety check (unverified / pending providers excluded)
 * 10. Availability safety check (isAvailable: false excluded)
 * 11. Pagination: limit, page, total, and totalPages metadata
 * 12. Legacy category fields fallback support
 */

const http = require('http');

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000/api${path}`, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${rawData}`));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== STARTING REGRESSION TEST SUITE FOR PROVIDER CATEGORY & SEARCH ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - Detail: ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Category Name "Electrician" should return 3 providers
    const resCatName = await apiGet('/providers?category=Electrician');
    assert(
      resCatName.status === 200 && Array.isArray(resCatName.body.data) && resCatName.body.data.length === 3,
      'Test 1: GET /providers?category=Electrician returns all 3 verified Electrician providers',
      `Got length: ${resCatName.body.data?.length}`
    );

    // Verify all 3 provider names are present
    const names1 = (resCatName.body.data || []).map((p) => p.businessName);
    assert(
      names1.includes('Raj Electrical Services') &&
      names1.includes('Demo Service Provider') &&
      names1.includes('Vikram Technical Services'),
      'Test 1b: Electrician category result includes Raj, Demo, and Vikram',
      `Names: ${names1.join(', ')}`
    );

    // 2. Category ID should return same 3 providers
    const electricianCatId = '6ace42d4a9633c71a3f7ef0d';
    const resCatId = await apiGet(`/providers?category=${electricianCatId}`);
    assert(
      resCatId.status === 200 && Array.isArray(resCatId.body.data) && resCatId.body.data.length === 3,
      'Test 2: GET /providers?category=<id> returns all 3 Electrician providers by Category ObjectId',
      `Got length: ${resCatId.body.data?.length}`
    );

    // 3. Category case-insensitivity: "electrician"
    const resCatLower = await apiGet('/providers?category=electrician');
    assert(
      resCatLower.status === 200 && resCatLower.body.data?.length === 3,
      'Test 3: GET /providers?category=electrician (lowercase) returns 3 providers',
      `Got length: ${resCatLower.body.data?.length}`
    );

    // 4. Free-text search "Electrician" should return all 3 providers
    const resSearchElectrician = await apiGet('/providers?search=Electrician');
    assert(
      resSearchElectrician.status === 200 && resSearchElectrician.body.data?.length === 3,
      'Test 4: GET /providers?search=Electrician matches category name and returns 3 providers',
      `Got length: ${resSearchElectrician.body.data?.length}`
    );

    // 5. Free-text search matching Service Name ("Wiring")
    const resSearchWiring = await apiGet('/providers?search=Wiring');
    assert(
      resSearchWiring.status === 200 && resSearchWiring.body.data?.length >= 1,
      'Test 5: GET /providers?search=Wiring returns providers offering wiring services',
      `Got length: ${resSearchWiring.body.data?.length}`
    );

    // 6. Free-text search matching Provider Name ("Raj")
    const resSearchRaj = await apiGet('/providers?search=Raj');
    assert(
      resSearchRaj.status === 200 && resSearchRaj.body.data?.length === 1 &&
      resSearchRaj.body.data[0].businessName === 'Raj Electrical Services',
      'Test 6: GET /providers?search=Raj returns Raj Electrical Services',
      `Names: ${(resSearchRaj.body.data || []).map(p => p.businessName).join(', ')}`
    );

    // 7. Combined Category + Free-text Search ("Electrician" + "Raj")
    const resCombinedMatch = await apiGet('/providers?category=Electrician&search=Raj');
    assert(
      resCombinedMatch.status === 200 && resCombinedMatch.body.data?.length === 1 &&
      resCombinedMatch.body.data[0].businessName === 'Raj Electrical Services',
      'Test 7: Coexistence of category=Electrician & search=Raj filters correctly to 1 provider',
      `Got length: ${resCombinedMatch.body.data?.length}`
    );

    // 8. Combined Category + Non-matching Free-text Search ("Electrician" + "PlumberXYZ")
    const resCombinedMismatch = await apiGet('/providers?category=Electrician&search=PlumberXYZ');
    assert(
      resCombinedMismatch.status === 200 && resCombinedMismatch.body.data?.length === 0,
      'Test 8: Combined category=Electrician & search=PlumberXYZ returns empty array (0 results)',
      `Got length: ${resCombinedMismatch.body.data?.length}`
    );

    // 9. Safety Check: Verify unverified / pending providers are never returned
    const resAll = await apiGet('/providers');
    const allProviders = resAll.body.data || [];
    const hasUnverified = allProviders.some(p => p.verificationStatus && p.verificationStatus !== 'verified');
    assert(
      resAll.status === 200 && !hasUnverified,
      'Test 9: Verification status safety check - unverified/pending providers are excluded',
      `Total returned: ${allProviders.length}`
    );

    // 10. Safety Check: Verify unavailable providers (isAvailable: false) are excluded
    const hasUnavailable = allProviders.some(p => p.isAvailable === false);
    assert(
      !hasUnavailable,
      'Test 10: Availability safety check - isAvailable=false providers are excluded'
    );

    // 11. Pagination: page=1&limit=2
    const resPage1 = await apiGet('/providers?category=Electrician&page=1&limit=2');
    assert(
      resPage1.status === 200 &&
      resPage1.body.data?.length === 2 &&
      resPage1.body.pagination?.total === 3 &&
      resPage1.body.pagination?.page === 1 &&
      resPage1.body.pagination?.limit === 2 &&
      resPage1.body.pagination?.totalPages === 2,
      'Test 11a: Pagination page 1 (limit=2) returns 2 items and total=3, totalPages=2',
      `Pagination: ${JSON.stringify(resPage1.body.pagination)}`
    );

    // 11b. Pagination: page=2&limit=2
    const resPage2 = await apiGet('/providers?category=Electrician&page=2&limit=2');
    assert(
      resPage2.status === 200 &&
      resPage2.body.data?.length === 1 &&
      resPage2.body.pagination?.page === 2,
      'Test 11b: Pagination page 2 (limit=2) returns the 3rd provider',
      `Pagination: ${JSON.stringify(resPage2.body.pagination)}`
    );

    // 12. Non-existent category returns 0 results cleanly without crash
    const resNonExistent = await apiGet('/providers?category=NonExistentCategory999');
    assert(
      resNonExistent.status === 200 && resNonExistent.body.data?.length === 0,
      'Test 12: Non-existent category returns empty array (0 results) with 200 OK',
      `Got length: ${resNonExistent.body.data?.length}`
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
