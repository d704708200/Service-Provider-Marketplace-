/**
 * test_admin_auth_production_flow.js
 * Comprehensive test suite for Admin authentication, CORS, security, and error handling:
 * 1. Health endpoint returns 200 with DB status
 * 2. Preflight OPTIONS request from https://serviceprovider3.netlify.app is allowed with proper CORS headers
 * 3. POST /api/auth/login/admin with empty body is rejected (400 validation error)
 * 4. POST /api/auth/login/admin with unknown email is rejected (401 invalid credentials)
 * 5. POST /api/auth/login/admin with invalid password is rejected (401 invalid credentials)
 * 6. Non-admin user (customer/provider) cannot log into /api/auth/login/admin (403 forbidden)
 * 7. Protected admin endpoints cannot be accessed without token (401 access denied)
 * 8. Protected admin endpoints cannot be accessed with invalid/fake token (401 invalid token)
 * 9. Customer auth continues to work properly
 * 10. Provider auth continues to work properly
 */

const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(rawData);
        } catch (e) {
          parsed = rawData;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING ADMIN AUTHENTICATION & SECURITY TEST SUITE ===\n');
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
    // 1. Health check
    const healthRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET'
    });
    assert(
      healthRes.statusCode === 200 && healthRes.body.success === true && healthRes.body.database?.connected === true,
      'Test 1: GET /api/health responds with 200 OK and connected database'
    );

    // 2. CORS Preflight check from production Netlify domain
    const corsRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/admin',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://serviceprovider3.netlify.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    assert(
      corsRes.statusCode === 204 && corsRes.headers['access-control-allow-origin'] === 'https://serviceprovider3.netlify.app',
      'Test 2: CORS Preflight allows origin https://serviceprovider3.netlify.app',
      `Status: ${corsRes.statusCode}, Allow-Origin: ${corsRes.headers['access-control-allow-origin']}`
    );

    // 3. Validation error on missing body fields
    const emptyLoginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    assert(
      emptyLoginRes.statusCode === 400 && emptyLoginRes.body.success === false,
      'Test 3: POST /api/auth/login/admin rejects missing email/password with 400 Validation Error',
      `Message: ${emptyLoginRes.body?.error?.message}`
    );

    // 4. Unknown administrator email
    const unknownAdminRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/admin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://serviceprovider3.netlify.app'
      }
    }, {
      email: 'nonexistent.admin@marketplace.org',
      password: 'SomePassword123!'
    });
    assert(
      unknownAdminRes.statusCode === 401 &&
      unknownAdminRes.body?.error?.message === 'Invalid administrator credentials' &&
      unknownAdminRes.headers['access-control-allow-origin'] === 'https://serviceprovider3.netlify.app',
      'Test 4: Unknown admin email is safely rejected with 401 and valid CORS headers',
      `Status: ${unknownAdminRes.statusCode}, Message: ${unknownAdminRes.body?.error?.message}`
    );

    // 5. Invalid password for admin
    const invalidPwRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@gmail.com',
      password: 'DefinitelyWrongPassword999!'
    });
    assert(
      invalidPwRes.statusCode === 401 &&
      invalidPwRes.body?.error?.message === 'Invalid administrator credentials',
      'Test 5: Invalid password for existing admin is rejected with 401',
      `Status: ${invalidPwRes.statusCode}, Message: ${invalidPwRes.body?.error?.message}`
    );

    // 6. Role protection: customer account cannot log in via /auth/login/admin
    const customerLoginAdminRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'customer.demo@gmail.com',
      password: 'Password@123'
    });
    assert(
      customerLoginAdminRes.statusCode === 403,
      'Test 6: Customer account attempting admin portal login is rejected with 403 Forbidden',
      `Status: ${customerLoginAdminRes.statusCode}, Message: ${customerLoginAdminRes.body?.error?.message}`
    );

    // 7. Protected admin endpoints cannot be accessed without token
    const noTokenRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/categories/admin',
      method: 'GET'
    });
    assert(
      noTokenRes.statusCode === 401 && noTokenRes.body?.success === false,
      'Test 7: Protected administrative endpoint rejected with 401 when no token is provided',
      `Status: ${noTokenRes.statusCode}`
    );

    // 8. Protected admin endpoints cannot be accessed with forged/malformed token
    const fakeTokenRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/categories/admin',
      method: 'GET',
      headers: { 'Authorization': 'Bearer forged.invalid.token' }
    });
    assert(
      fakeTokenRes.statusCode === 401,
      'Test 8: Protected administrative endpoint rejected with 401 on forged token',
      `Status: ${fakeTokenRes.statusCode}`
    );

    // 9. Customer auth continues to function
    const customerAuthRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/customer',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'customer.demo@gmail.com',
      password: 'Customer@123'
    });
    assert(
      customerAuthRes.statusCode === 200 && customerAuthRes.body?.data?.token && customerAuthRes.body?.data?.user?.role === 'customer',
      'Test 9: Customer authentication continues to succeed and issues customer JWT'
    );

    // 10. Provider auth continues to function
    const providerAuthRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login/provider',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'provider.demo@gmail.com',
      password: 'Provider@123'
    });
    assert(
      providerAuthRes.statusCode === 200 && providerAuthRes.body?.data?.token && providerAuthRes.body?.data?.user?.role === 'provider',
      'Test 10: Provider authentication continues to succeed and issues provider JWT'
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
