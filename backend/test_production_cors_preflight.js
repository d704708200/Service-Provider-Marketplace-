const http = require('http');
const assert = require('assert');

function sendOptionsRequest(path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'OPTIONS',
        headers
      },
      (res) => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== RUNNING PRODUCTION CORS PREFLIGHT VERIFICATION ===\n');

  // Test 1: OPTIONS /api/providers/admin/pending with authorization & cache-control
  console.log('Test 1: OPTIONS /api/providers/admin/pending from Netlify with authorization,cache-control...');
  const res1 = await sendOptionsRequest('/api/providers/admin/pending', {
    Origin: 'https://serviceprovider3.netlify.app',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization,cache-control'
  });

  assert.strictEqual(res1.statusCode, 204, 'Preflight must return 204 No Content');
  assert.strictEqual(
    res1.headers['access-control-allow-origin'],
    'https://serviceprovider3.netlify.app',
    'Allow-Origin must match Netlify domain'
  );
  assert.strictEqual(res1.headers['access-control-allow-credentials'], 'true', 'Credentials must be true');

  const allowHeaders1 = (res1.headers['access-control-allow-headers'] || '').toLowerCase();
  assert(allowHeaders1.includes('authorization'), 'Allow-Headers must include Authorization');
  assert(allowHeaders1.includes('cache-control'), 'Allow-Headers must include Cache-Control');
  assert(allowHeaders1.includes('content-type'), 'Allow-Headers must include Content-Type');
  console.log('[PASS] Test 1: Verified 204 status, Netlify origin, credentials, and allowed headers:', res1.headers['access-control-allow-headers']);

  // Test 2: OPTIONS /api/auth/login/admin with content-type,authorization,cache-control
  console.log('\nTest 2: OPTIONS /api/auth/login/admin from Netlify with POST and requested headers...');
  const res2 = await sendOptionsRequest('/api/auth/login/admin', {
    Origin: 'https://serviceprovider3.netlify.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type,authorization,cache-control'
  });

  assert.strictEqual(res2.statusCode, 204, 'Preflight must return 204');
  assert.strictEqual(
    res2.headers['access-control-allow-origin'],
    'https://serviceprovider3.netlify.app',
    'Allow-Origin must match Netlify domain'
  );
  console.log('[PASS] Test 2: Verified 204 status for admin login preflight');

  // Test 3: Unauthorized origin is rejected
  console.log('\nTest 3: OPTIONS from unauthorized origin is safely blocked...');
  const res3 = await sendOptionsRequest('/api/providers/admin/pending', {
    Origin: 'https://malicious-site.com',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization,cache-control'
  });

  assert(
    res3.statusCode === 403 || !res3.headers['access-control-allow-origin'],
    'Unauthorized origin must be blocked'
  );
  console.log('[PASS] Test 3: Unauthorized origin blocked (Status:', res3.statusCode, ')');

  console.log('\n=== ALL CORS PREFLIGHT TESTS PASSED (3/3) ===\n');
}

run().catch((err) => {
  console.error('[FAIL] CORS test failed:', err);
  process.exit(1);
});
