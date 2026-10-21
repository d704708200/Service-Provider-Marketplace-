const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://service-provider-marketplace.onrender.com/api';

async function runRegressionTests() {
  console.log(`Running Home Screen regression tests against: ${BASE_URL}\n`);

  let failures = 0;

  // Test 1: Categories - Quick Services
  try {
    const res = await axios.get(`${BASE_URL}/categories?quickServices=true`);
    const data = res.data?.data;
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      console.log(`✓ Quick Services endpoint returned ${data.length} categories (non-empty)`);
    } else {
      console.error(`✗ Quick Services returned unexpected payload:`, res.data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Quick Services request failed:`, e.message);
    failures++;
  }

  // Test 2: Categories - Popular Services
  try {
    const res = await axios.get(`${BASE_URL}/categories?popularServices=true`);
    const data = res.data?.data;
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      console.log(`✓ Popular Services endpoint returned ${data.length} categories (non-empty)`);
    } else {
      console.error(`✗ Popular Services returned unexpected payload:`, res.data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Popular Services request failed:`, e.message);
    failures++;
  }

  // Test 3: Categories - Genuinely empty / non-matching filter
  try {
    const res = await axios.get(`${BASE_URL}/categories?search=non_existent_category_xyz123`);
    const data = res.data?.data;
    if (res.status === 200 && Array.isArray(data) && data.length === 0) {
      console.log(`✓ Non-existent search returns genuinely empty array (length 0)`);
    } else {
      console.error(`✗ Expected empty array for non-existent search, got:`, data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Non-existent search request failed:`, e.message);
    failures++;
  }

  // Test 4: Top Rated Providers
  try {
    const res = await axios.get(`${BASE_URL}/providers?topRated=true`);
    const data = res.data?.data;
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      console.log(`✓ Top Rated Providers endpoint returned ${data.length} providers`);
      const sample = data[0];
      if (sample.rating && typeof sample.rating.average === 'number') {
        console.log(`✓ Provider rating format verified: average=${sample.rating.average}, count=${sample.rating.count}`);
      } else {
        console.warn(`! Provider rating format check:`, sample.rating);
      }
    } else {
      console.error(`✗ Top Rated Providers returned unexpected payload:`, res.data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Top Rated Providers request failed:`, e.message);
    failures++;
  }

  // Test 5: Nearby / Discovery Providers with limit=6
  try {
    const res = await axios.get(`${BASE_URL}/providers?limit=6`);
    const data = res.data?.data;
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      console.log(`✓ Discovery Providers limit=6 returned ${data.length} providers`);
    } else {
      console.error(`✗ Discovery Providers returned unexpected payload:`, res.data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Discovery Providers request failed:`, e.message);
    failures++;
  }

  // Test 6: Services with limit=6
  try {
    const res = await axios.get(`${BASE_URL}/services?limit=6`);
    const data = res.data?.data;
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      console.log(`✓ Services limit=6 returned ${data.length} services`);
    } else {
      console.error(`✗ Services limit=6 returned unexpected payload:`, res.data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Services limit=6 request failed:`, e.message);
    failures++;
  }

  // Test 7: Banner endpoint
  try {
    const res = await axios.get(`${BASE_URL}/banner`);
    const data = res.data?.data;
    if (res.status === 200 && data && typeof data === 'object') {
      console.log(`✓ Banner endpoint returned banner config: "${data.title}" (isEnabled: ${data.isEnabled})`);
    } else {
      console.error(`✗ Banner endpoint returned unexpected payload:`, res.data);
      failures++;
    }
  } catch (e) {
    console.error(`✗ Banner request failed:`, e.message);
    failures++;
  }

  console.log(`\nRegression test suite completed with ${failures} failures.`);
  process.exit(failures > 0 ? 1 : 0);
}

runRegressionTests();
