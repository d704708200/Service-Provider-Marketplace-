const assert = require('assert');
const http = require('http');
const express = require('express');
const app = require('../src/app');

async function runTests() {
  console.log('--- STARTING PRIVACY POLICY & ACCOUNT DELETION ENDPOINT TESTS ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  function fetchUrl(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }).on('error', reject);
    });
  }

  try {
    // 1. Customer Privacy Policy
    console.log('Testing GET /privacy/customer ...');
    const custRes = await fetchUrl('/privacy/customer');
    assert.strictEqual(custRes.status, 200, 'Customer privacy must return 200');
    assert(custRes.body.includes('com.serviceprovider.customerapp'), 'Must contain customer package name');
    assert(custRes.body.includes('Razorpay'), 'Must disclose Razorpay payment gateway');
    assert(custRes.body.includes('ACCESS_FINE_LOCATION'), 'Must disclose location permissions');
    assert(custRes.body.includes('Account Deletion'), 'Must disclose account deletion');
    assert(custRes.body.includes('support@mendroo.com'), 'Must disclose support email');
    assert(custRes.body.includes('89277 21577'), 'Must disclose helpline phone');

    // Test alias /privacy-customer
    const custAliasRes = await fetchUrl('/privacy-customer');
    assert.strictEqual(custAliasRes.status, 200, 'Customer privacy alias must return 200');

    // 2. Provider Privacy Policy
    console.log('Testing GET /privacy/provider ...');
    const provRes = await fetchUrl('/privacy/provider');
    assert.strictEqual(provRes.status, 200, 'Provider privacy must return 200');
    assert(provRes.body.includes('com.mendroo.provider'), 'Must contain provider package name');
    assert(provRes.body.includes('Aadhaar'), 'Must disclose Aadhaar KYC collection');
    assert(provRes.body.includes('PAN Card'), 'Must disclose PAN KYC collection');
    assert(provRes.body.includes('ACCESS_FINE_LOCATION'), 'Must disclose provider location & radius');
    assert(provRes.body.includes('Wallet'), 'Must disclose wallet and banking details');
    assert(provRes.body.includes('Account Deletion'), 'Must disclose partner account deletion');

    // Test alias /privacy-provider
    const provAliasRes = await fetchUrl('/privacy-provider');
    assert.strictEqual(provAliasRes.status, 200, 'Provider privacy alias must return 200');

    // 3. Privacy Policy Hub
    console.log('Testing GET /privacy ...');
    const hubRes = await fetchUrl('/privacy');
    assert.strictEqual(hubRes.status, 200, 'Privacy hub must return 200');
    assert(hubRes.body.includes('/privacy/customer'), 'Must link to Customer Privacy Policy');
    assert(hubRes.body.includes('/privacy/provider'), 'Must link to Provider Privacy Policy');

    // 4. Dedicated Customer Account Deletion
    console.log('Testing GET /delete-account/customer ...');
    const delCustRes = await fetchUrl('/delete-account/customer');
    assert.strictEqual(delCustRes.status, 200, 'Customer deletion page must return 200');
    assert(delCustRes.body.includes('com.serviceprovider.customerapp'), 'Must reference Customer App');
    assert(delCustRes.body.includes('action="/delete-account"'), 'Must have form submitting to /delete-account');

    // 5. Dedicated Provider Account Deletion
    console.log('Testing GET /delete-account/provider ...');
    const delProvRes = await fetchUrl('/delete-account/provider');
    assert.strictEqual(delProvRes.status, 200, 'Provider deletion page must return 200');
    assert(delProvRes.body.includes('com.mendroo.provider'), 'Must reference Provider App');
    assert(delProvRes.body.includes('action="/delete-account"'), 'Must have form submitting to /delete-account');

    // 6. General Account Deletion Portal
    console.log('Testing GET /delete-account ...');
    const delGenRes = await fetchUrl('/delete-account');
    assert.strictEqual(delGenRes.status, 200, 'General deletion page must return 200');
    assert(delGenRes.body.includes('/delete-account/customer'), 'Must link to Customer deletion');
    assert(delGenRes.body.includes('/delete-account/provider'), 'Must link to Provider deletion');

    console.log('ALL PRIVACY POLICY & ACCOUNT DELETION TESTS PASSED! (12/12 assertions verified)');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
