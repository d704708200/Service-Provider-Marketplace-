/**
 * Customer App Integration Verification Test Suite
 * Tests actual API contracts, authentication, error handling, category/service/provider endpoints.
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true // handle all statuses manually
});

let testCustomerToken = null;
let testCustomerId = null;
let testCategoryId = null;
let testServiceId = null;
let testProviderId = null;

const uniqueSuffix = Date.now();
const testEmail = `cust_flow_${uniqueSuffix}@example.com`;
const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

async function runTests() {
  console.log('====================================================');
  console.log('   CUSTOMER APP BACKEND INTEGRATION TEST SUITE      ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Customer Registration Validation
  console.log('--- 1. Testing Registration Validation ---');
  const invalidReg = await client.post('/auth/register/customer', {
    name: '',
    email: 'notanemail',
    phone: '123',
    password: 'short'
  });
  assert(
    invalidReg.status === 400 && invalidReg.data.success === false,
    `Rejects invalid registration with 400 (Received: ${invalidReg.status})`
  );

  // 2. Successful Customer Registration
  console.log('\n--- 2. Testing Customer Registration Contract ---');
  const validReg = await client.post('/auth/register/customer', {
    name: 'Test Customer App',
    email: testEmail,
    phone: testPhone,
    password: 'Password123'
  });
  assert(
    validReg.status === 201 && validReg.data.success === true,
    `Creates customer account successfully (Status: ${validReg.status})`
  );
  assert(
    validReg.data.data.token && validReg.data.data.user.role === 'customer',
    `Returns JWT token and user with role='customer'`
  );
  testCustomerToken = validReg.data.data.token;
  testCustomerId = validReg.data.data.user._id;

  // 3. Duplicate Registration Prevention
  console.log('\n--- 3. Testing Duplicate Registration Prevention ---');
  const dupReg = await client.post('/auth/register/customer', {
    name: 'Duplicate Customer',
    email: testEmail,
    phone: testPhone,
    password: 'Password123'
  });
  assert(
    dupReg.status === 409 && dupReg.data.success === false,
    `Rejects duplicate email with 409 Conflict (Received: ${dupReg.status})`
  );

  // 4. Customer Login Contract
  console.log('\n--- 4. Testing Customer Login Contract ---');
  const validLogin = await client.post('/auth/login/customer', {
    email: testEmail,
    password: 'Password123'
  });
  assert(
    validLogin.status === 200 && validLogin.data.success === true,
    `Authenticates customer with valid credentials (Status: ${validLogin.status})`
  );
  assert(
    validLogin.data.data.token && validLogin.data.data.user.email === testEmail,
    `Returns valid JWT token and user profile object`
  );

  // 5. Invalid Credentials Rejection
  console.log('\n--- 5. Testing Invalid Login Credentials ---');
  const badLogin = await client.post('/auth/login/customer', {
    email: testEmail,
    password: 'WrongPassword999'
  });
  assert(
    badLogin.status === 401 && badLogin.data.success === false,
    `Rejects bad password with 401 Unauthorized (Received: ${badLogin.status})`
  );

  // 6. Session Restoration via /api/auth/me
  console.log('\n--- 6. Testing Session Restoration (/api/auth/me) ---');
  const authMe = await client.get('/auth/me', {
    headers: { Authorization: `Bearer ${testCustomerToken}` }
  });
  assert(
    authMe.status === 200 && authMe.data.success === true,
    `Successfully restores session with stored token (Status: ${authMe.status})`
  );
  assert(
    authMe.data.data.user.role === 'customer' && authMe.data.data.user._id === testCustomerId,
    `Restored session matches authenticated customer identity`
  );

  // 7. Invalid Token Handling
  console.log('\n--- 7. Testing Invalid Token Handling ---');
  const badTokenReq = await client.get('/auth/me', {
    headers: { Authorization: 'Bearer invalid.bogus.jwt.token' }
  });
  assert(
    badTokenReq.status === 401 && badTokenReq.data.success === false,
    `Rejects invalid JWT token with 401 (Received: ${badTokenReq.status})`
  );

  // 8. Categories API Integration
  console.log('\n--- 8. Testing Categories API (GET /api/categories) ---');
  const categoriesRes = await client.get('/categories');
  assert(
    categoriesRes.status === 200 && categoriesRes.data.success === true,
    `Fetches active categories successfully (Status: ${categoriesRes.status})`
  );
  assert(
    Array.isArray(categoriesRes.data.data),
    `Returns categories array (Count: ${categoriesRes.data.data.length})`
  );
  if (categoriesRes.data.data.length > 0) {
    testCategoryId = categoriesRes.data.data[0]._id;
    console.log(`    Active category sample: "${categoriesRes.data.data[0].name}" (${testCategoryId})`);
  }

  // 9. Services Catalog API Integration
  console.log('\n--- 9. Testing Services Catalog API (GET /api/services) ---');
  const servicesRes = await client.get('/services');
  assert(
    servicesRes.status === 200 && servicesRes.data.success === true,
    `Fetches public active services catalog (Status: ${servicesRes.status})`
  );
  assert(
    Array.isArray(servicesRes.data.data),
    `Returns services array (Count: ${servicesRes.data.data.length})`
  );
  if (servicesRes.data.data.length > 0) {
    testServiceId = servicesRes.data.data[0]._id;
    console.log(`    Sample service: "${servicesRes.data.data[0].name}" (Price: ₹${servicesRes.data.data[0].basePrice})`);

    // 9b. Service Details by ID
    const detailRes = await client.get(`/services/${testServiceId}`);
    assert(
      detailRes.status === 200 && detailRes.data.success === true && detailRes.data.data._id === testServiceId,
      `Fetches individual service details by ObjectId (Status: ${detailRes.status})`
    );
  }

  // 10. Provider Discovery API Integration
  console.log('\n--- 10. Testing Provider Discovery API (GET /api/providers) ---');
  const providersRes = await client.get('/providers');
  assert(
    providersRes.status === 200 && providersRes.data.success === true,
    `Fetches verified public providers (Status: ${providersRes.status})`
  );
  assert(
    Array.isArray(providersRes.data.data),
    `Returns public provider list (Count: ${providersRes.data.data.length})`
  );
  if (providersRes.data.data.length > 0) {
    testProviderId = providersRes.data.data[0]._id;
    console.log(`    Sample provider: "${providersRes.data.data[0].businessName || providersRes.data.data[0].user?.name}"`);

    // 10b. Provider Details by ID
    const provDetailRes = await client.get(`/providers/${testProviderId}`);
    assert(
      provDetailRes.status === 200 && provDetailRes.data.success === true,
      `Fetches individual provider details (Status: ${provDetailRes.status})`
    );
    assert(
      !provDetailRes.data.data.documents || provDetailRes.data.data.documents.length === 0,
      `Ensures private verification documents are NOT exposed on public profile`
    );
  }

  // 11. Verification that unsupported booking submission is deferred
  console.log('\n--- 11. Testing Booking Endpoint Boundaries ---');
  const fakeBooking = await client.post('/bookings', { test: true }, {
    headers: { Authorization: `Bearer ${testCustomerToken}` }
  });
  assert(
    fakeBooking.status === 404,
    `Confirms /api/bookings is not yet implemented (Phase 10 boundary preserved, Status: ${fakeBooking.status})`
  );

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
