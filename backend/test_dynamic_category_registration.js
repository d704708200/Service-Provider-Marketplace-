const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Provider = require('./src/models/Provider');
const Category = require('./src/models/Category');
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

async function runDynamicCategoryRegistrationTests() {
  console.log('=== STARTING DYNAMIC ADMIN CATEGORIES IN PROVIDER REGISTRATION TESTS ===\n');

  if (!process.env.MONGODB_URI) {
    console.error('FAIL: MONGODB_URI not configured in .env');
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('FAIL: Could not connect to MongoDB');
    process.exit(1);
  }

  const testPort = 5099;
  const server = app.listen(testPort);

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failCount++;
    }
  }

  const createdCategoryIds = [];
  const createdUserIds = [];
  const createdProviderIds = [];

  try {
    const runId = Date.now();

    // 1. Setup active and inactive test categories in MongoDB
    const activeCat1 = await Category.create({
      name: `Test Cleaning ${runId}`,
      slug: `test-cleaning-${runId}`,
      description: 'Professional cleaning services',
      isActive: true,
      displayOrder: 1
    });
    createdCategoryIds.push(activeCat1._id);

    const activeCat2 = await Category.create({
      name: `Test Plumbing ${runId}`,
      slug: `test-plumbing-${runId}`,
      description: 'Expert plumbing repairs',
      isActive: true,
      displayOrder: 2
    });
    createdCategoryIds.push(activeCat2._id);

    const inactiveCat = await Category.create({
      name: `Test Inactive Category ${runId}`,
      slug: `test-inactive-${runId}`,
      description: 'Disabled service category',
      isActive: false,
      displayOrder: 99
    });
    createdCategoryIds.push(inactiveCat._id);

    console.log(`Created test categories:
  - Active 1: ${activeCat1._id} (${activeCat1.name})
  - Active 2: ${activeCat2._id} (${activeCat2.name})
  - Inactive: ${inactiveCat._id} (${inactiveCat.name})\n`);

    // TEST 1: Active categories load successfully via GET /api/categories
    const listRes = await makeRequest(testPort, 'GET', '/api/categories');
    assert(listRes.status === 200, 'TEST 1.1: GET /api/categories returns HTTP 200');
    assert(listRes.body?.success === true, 'TEST 1.2: Response indicates success === true');
    assert(Array.isArray(listRes.body?.data), 'TEST 1.3: Response data is an array');

    const catList = listRes.body?.data || [];
    const foundActive1 = catList.some(c => c._id === activeCat1._id.toString());
    const foundActive2 = catList.some(c => c._id === activeCat2._id.toString());
    const foundInactive = catList.some(c => c._id === inactiveCat._id.toString());

    assert(foundActive1 && foundActive2, 'TEST 1.4: Newly created active categories are included in public categories API');
    assert(!foundInactive, 'TEST 1.5: Inactive category is excluded from public categories API');

    // TEST 2: Registration blocked when no category is selected (empty array)
    const emptyCatPayload = {
      name: 'No Cat Provider',
      businessName: 'No Cat Business',
      email: `nocat.${runId}@example.com`,
      phone: `9800${runId.toString().slice(-6)}`,
      password: 'Password@123',
      categories: []
    };
    const emptyCatRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, emptyCatPayload);
    assert(emptyCatRes.status === 400, 'TEST 2.1: HTTP 400 returned when categories array is empty');
    assert(emptyCatRes.body?.error?.message?.includes('category') || emptyCatRes.body?.message?.includes('category'),
      'TEST 2.2: Error message clearly mentions category requirement');

    // TEST 3: Registration blocked when categories field is missing completely
    const missingCatPayload = {
      name: 'Missing Cat Provider',
      businessName: 'Missing Cat Business',
      email: `missingcat.${runId}@example.com`,
      phone: `9801${runId.toString().slice(-6)}`,
      password: 'Password@123'
    };
    const missingCatRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, missingCatPayload);
    assert(missingCatRes.status === 400, 'TEST 3.1: HTTP 400 returned when categories field is missing');

    // TEST 4: Invalid category ID rejected
    const invalidIdPayload = {
      name: 'Invalid ID Provider',
      businessName: 'Invalid ID Business',
      email: `invalidid.${runId}@example.com`,
      phone: `9802${runId.toString().slice(-6)}`,
      password: 'Password@123',
      categories: ['not-a-mongo-id-123']
    };
    const invalidIdRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, invalidIdPayload);
    assert(invalidIdRes.status === 400, 'TEST 4.1: HTTP 400 returned when category ID format is invalid');

    // TEST 5: Non-existent MongoDB category ID rejected
    const fakeObjectId = new mongoose.Types.ObjectId().toString();
    const nonExistentPayload = {
      name: 'Non Existent Provider',
      businessName: 'Non Existent Business',
      email: `nonexist.${runId}@example.com`,
      phone: `9803${runId.toString().slice(-6)}`,
      password: 'Password@123',
      categories: [fakeObjectId]
    };
    const nonExistRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, nonExistentPayload);
    assert(nonExistRes.status === 400, 'TEST 5.1: HTTP 400 returned when category ID does not exist in MongoDB');
    assert(nonExistRes.body?.error?.message?.includes('valid') || nonExistRes.body?.error?.message?.includes('active'),
      'TEST 5.2: Error message rejects non-existent category reference');

    // TEST 6: Inactive category ID rejected
    const inactivePayload = {
      name: 'Inactive Cat Provider',
      businessName: 'Inactive Cat Business',
      email: `inactivecat.${runId}@example.com`,
      phone: `9804${runId.toString().slice(-6)}`,
      password: 'Password@123',
      categories: [inactiveCat._id.toString()]
    };
    const inactiveRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, inactivePayload);
    assert(inactiveRes.status === 400, 'TEST 6.1: HTTP 400 returned when category is inactive in MongoDB');

    // TEST 7: Successful registration with a single active category
    const singleCatPayload = {
      name: 'Single Cat Provider',
      businessName: 'Single Cleaning Co',
      email: `single.${runId}@example.com`,
      phone: `9805${runId.toString().slice(-6)}`,
      password: 'Password@123',
      categories: [activeCat1._id.toString()]
    };
    const singleRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, singleCatPayload);
    assert(singleRes.status === 201, 'TEST 7.1: HTTP 201 returned on successful single-category provider registration');
    assert(singleRes.body?.success === true, 'TEST 7.2: Response body success === true');
    assert(singleRes.body?.data?.token, 'TEST 7.3: Registration returns JWT auth token');

    const singleUserId = singleRes.body?.data?.user?._id || singleRes.body?.data?.user?.id;
    if (singleUserId) createdUserIds.push(singleUserId);

    // Verify persistence in MongoDB Provider document
    const singleProvider = await Provider.findOne({ user: singleUserId }).populate('categories').populate('user');
    assert(singleProvider !== null, 'TEST 7.4: Provider record found in MongoDB');
    if (singleProvider) {
      createdProviderIds.push(singleProvider._id);
      assert(singleProvider.categories.length === 1, 'TEST 7.5: Provider has exactly 1 category persisted');
      assert(singleProvider.categories[0]._id.toString() === activeCat1._id.toString(),
        'TEST 7.6: Persisted category ID matches activeCat1');
      assert(singleProvider.verificationStatus === 'pending',
        'TEST 7.7: Verification status is "pending" (not auto-approved)');
      assert(singleProvider.user.isVerified === false,
        'TEST 7.8: User isVerified is false (KYC compliance preserved)');
    }

    // TEST 8: Successful registration with multiple active categories and duplicate deduplication
    const multiCatPayload = {
      name: 'Multi Cat Provider',
      businessName: 'Multi Trades Co',
      email: `multi.${runId}@example.com`,
      phone: `9806${runId.toString().slice(-6)}`,
      password: 'Password@123',
      // Pass activeCat1, activeCat2, and duplicate activeCat1
      categories: [activeCat1._id.toString(), activeCat2._id.toString(), activeCat1._id.toString()]
    };
    const multiRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, multiCatPayload);
    assert(multiRes.status === 201, 'TEST 8.1: HTTP 201 returned on multi-category provider registration');
    const multiToken = multiRes.body?.data?.token;
    const multiUserId = multiRes.body?.data?.user?._id || multiRes.body?.data?.user?.id;
    if (multiUserId) createdUserIds.push(multiUserId);

    const multiProvider = await Provider.findOne({ user: multiUserId }).populate('categories').populate('user');
    assert(multiProvider !== null, 'TEST 8.2: Multi-category provider record found in MongoDB');
    if (multiProvider) {
      createdProviderIds.push(multiProvider._id);
      assert(multiProvider.categories.length === 2,
        'TEST 8.3: Duplicates deduplicated: exactly 2 distinct categories persisted');
      const ids = multiProvider.categories.map(c => c._id.toString());
      assert(ids.includes(activeCat1._id.toString()) && ids.includes(activeCat2._id.toString()),
        'TEST 8.4: Both active categories persisted in Provider profile');
      assert(multiProvider.verificationStatus === 'pending',
        'TEST 8.5: Verification status remains pending');
      assert(multiProvider.user.isVerified === false,
        'TEST 8.6: User isVerified remains false');
    }

    // TEST 9: Provider Profile API (/api/providers/me) returns populated categories
    const profileRes = await makeRequest(testPort, 'GET', '/api/providers/me', {
      Authorization: `Bearer ${multiToken}`
    });
    assert(profileRes.status === 200, 'TEST 9.1: GET /api/providers/me returns HTTP 200');
    assert(profileRes.body?.success === true, 'TEST 9.2: Profile response indicates success');
    const fetchedCategories = profileRes.body?.data?.categories;
    assert(Array.isArray(fetchedCategories), 'TEST 9.3: Profile categories is an array');
    assert(fetchedCategories.length === 2, 'TEST 9.4: Profile categories contains both selected categories');
    const fetchedNames = fetchedCategories.map(c => c.name);
    assert(fetchedNames.includes(activeCat1.name) && fetchedNames.includes(activeCat2.name),
      'TEST 9.5: Category names properly populated on profile refresh');

  } catch (err) {
    console.error('Unhandled test execution error:', err);
    failCount++;
  } finally {
    // Cleanup test records
    console.log('\n--- Cleaning up test records ---');
    if (createdCategoryIds.length > 0) {
      await Category.deleteMany({ _id: { $in: createdCategoryIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdProviderIds.length > 0) {
      await Provider.deleteMany({ _id: { $in: createdProviderIds } });
    }
    await disconnectDB();
    server.close();

    console.log(`\n==================================================`);
    console.log(`TOTAL TESTS RUN: ${passCount + failCount}`);
    console.log(`PASSED: ${passCount}`);
    console.log(`FAILED: ${failCount}`);
    console.log(`==================================================\n`);

    if (failCount > 0) {
      process.exit(1);
    }
  }
}

runDynamicCategoryRegistrationTests();
