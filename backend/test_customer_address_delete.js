/**
 * Customer Saved Address Delete & Management Regression Tests
 *
 * Verifies:
 * 1. Customer can add a saved address and receive updated list
 * 2. Customer can delete an owned saved address and receive updated list
 * 3. Deleted address is completely removed from MongoDB
 * 4. Default address designation is preserved or automatically reassigned
 * 5. Reject deletion with invalid MongoDB ObjectId (400)
 * 6. Reject deletion of non-existent address ID (404)
 * 7. Reject customer A deleting customer B's address (404 / ownership isolation)
 * 8. Unauthenticated delete requests are rejected (401)
 * 9. Re-fetching customer profile confirms address remains deleted
 */

const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Customer = require('./src/models/Customer');
const { generateToken } = require('./src/utils/jwt');
const { hashPassword } = require('./src/services/authService');
const { connectDB, disconnectDB } = require('./src/config/db');

function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runAddressRegressionTests() {
  console.log('=== STARTING CUSTOMER ADDRESS REGRESSION TESTS ===\n');

  await connectDB();
  const server = app.listen(0);
  const testPort = server.address().port;

  const createdUserIds = [];
  const createdCustomerIds = [];

  try {
    const runId = Date.now();
    const hashedPassword = await hashPassword('CustPass@123');

    // 1. Create Customer A
    const userA = await User.create({
      name: `Address Test CustA ${runId}`,
      email: `custa.${runId}@example.com`,
      phone: `9100${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(userA._id);

    const customerA = await Customer.create({
      user: userA._id,
      addresses: []
    });
    createdCustomerIds.push(customerA._id);

    const tokenA = generateToken({
      userId: userA._id,
      email: userA.email,
      role: userA.role
    });

    // 2. Create Customer B (for ownership isolation test)
    const userB = await User.create({
      name: `Address Test CustB ${runId}`,
      email: `custb.${runId}@example.com`,
      phone: `9101${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(userB._id);

    const customerB = await Customer.create({
      user: userB._id,
      addresses: [
        {
          title: 'Office',
          street: '55 Corporate Blvd',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400051',
          isDefault: true
        }
      ]
    });
    createdCustomerIds.push(customerB._id);
    const customerBAddressId = customerB.addresses[0]._id;

    const tokenB = generateToken({
      userId: userB._id,
      email: userB.email,
      role: userB.role
    });

    // ------------------------------------------------------------
    // Test 1: Unauthenticated DELETE is rejected with 401
    // ------------------------------------------------------------
    const unauthRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/me/addresses/${customerBAddressId}`
    );
    assert(unauthRes.status === 401, 'TEST 1: Unauthenticated DELETE /api/customers/me/addresses/:id rejected (401)');

    // ------------------------------------------------------------
    // Test 2: Add two addresses for Customer A
    // ------------------------------------------------------------
    const add1Res = await makeRequest(
      testPort,
      'POST',
      '/api/customers/me/addresses',
      { Authorization: `Bearer ${tokenA}` },
      {
        title: 'Home',
        street: 'Flat 101, Sunshine Heights',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560001',
        isDefault: true
      }
    );
    assert(add1Res.status === 201, 'TEST 2.1: Add first address returns 201');
    const addr1Id = add1Res.body?.data?.[0]?._id;
    assert(Boolean(addr1Id), 'TEST 2.2: First address ID returned in list');

    const add2Res = await makeRequest(
      testPort,
      'POST',
      '/api/customers/me/addresses',
      { Authorization: `Bearer ${tokenA}` },
      {
        title: 'Work',
        street: 'Tech Park Tower 4',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipCode: '560100',
        isDefault: false
      }
    );
    assert(add2Res.status === 201, 'TEST 2.3: Add second address returns 201');
    assert(add2Res.body?.data?.length === 2, 'TEST 2.4: List now contains 2 addresses');
    const addr2Id = add2Res.body?.data?.find(a => a.title === 'Work')?._id;

    // ------------------------------------------------------------
    // Test 3: Invalid ObjectId returns 400
    // ------------------------------------------------------------
    const invalidIdRes = await makeRequest(
      testPort,
      'DELETE',
      '/api/customers/me/addresses/not-a-valid-id',
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(invalidIdRes.status === 400, 'TEST 3: DELETE with invalid address ObjectId returns 400');

    // ------------------------------------------------------------
    // Test 4: Non-existent address ID returns 404
    // ------------------------------------------------------------
    const nonExistentId = new mongoose.Types.ObjectId();
    const missingRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/me/addresses/${nonExistentId}`,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(missingRes.status === 404, 'TEST 4: DELETE non-existent address ID returns 404');

    // ------------------------------------------------------------
    // Test 5: Customer A cannot delete Customer B's address (ownership check)
    // ------------------------------------------------------------
    const crossDeleteRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/me/addresses/${customerBAddressId}`,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(crossDeleteRes.status === 404, 'TEST 5.1: Customer A cannot delete Customer B address (returns 404)');

    // Verify Customer B's address still exists intact
    const verifyB = await Customer.findById(customerB._id);
    assert(verifyB.addresses.length === 1, "TEST 5.2: Customer B's address remains intact in MongoDB");

    // ------------------------------------------------------------
    // Test 6: Customer A successfully deletes the default address (Home)
    // ------------------------------------------------------------
    const delete1Res = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/me/addresses/${addr1Id}`,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(delete1Res.status === 200, 'TEST 6.1: Customer A DELETE address returns HTTP 200');
    assert(delete1Res.body?.success === true, 'TEST 6.2: Response body indicates success');
    assert(delete1Res.body?.data?.length === 1, 'TEST 6.3: Returned addresses array has length 1');
    assert(delete1Res.body?.data?.[0]?._id === addr2Id, 'TEST 6.4: Remaining address is the Work address');
    assert(delete1Res.body?.data?.[0]?.isDefault === true, 'TEST 6.5: Remaining address was designated as new default');

    // ------------------------------------------------------------
    // Test 7: Confirm address remains deleted after fetching profile
    // ------------------------------------------------------------
    const profileRes = await makeRequest(
      testPort,
      'GET',
      '/api/customers/me',
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(profileRes.status === 200, 'TEST 7.1: GET /api/customers/me returns 200');
    const profileAddrs = profileRes.body?.data?.addresses || [];
    assert(profileAddrs.length === 1, 'TEST 7.2: Profile still reflects exactly 1 address');
    assert(!profileAddrs.some(a => a._id === addr1Id), 'TEST 7.3: Deleted address does not reappear on refresh');

    // ------------------------------------------------------------
    // Test 8: Delete remaining address -> list becomes empty
    // ------------------------------------------------------------
    const delete2Res = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/me/addresses/${addr2Id}`,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert(delete2Res.status === 200, 'TEST 8.1: Deleting last address returns 200');
    assert(delete2Res.body?.data?.length === 0, 'TEST 8.2: Address list is now empty');

    const mongoCust = await Customer.findOne({ user: userA._id });
    assert(mongoCust.addresses.length === 0, 'TEST 8.3: Direct MongoDB query confirms addresses array is empty');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup created test records
    console.log('\n--- Cleaning up test records ---');
    try {
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (createdCustomerIds.length > 0) {
        await Customer.deleteMany({ _id: { $in: createdCustomerIds } });
      }
    } catch (cleanupErr) {
      console.warn('Cleanup error:', cleanupErr.message);
    }

    server.close();
    await disconnectDB();
  }

  console.log('\n==================================================');
  if (process.exitCode) {
    console.log('SOME TESTS FAILED.');
  } else {
    console.log('ALL CUSTOMER ADDRESS REGRESSION TESTS PASSED!');
  }
  console.log('==================================================\n');
}

runAddressRegressionTests();
