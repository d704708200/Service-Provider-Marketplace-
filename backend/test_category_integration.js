const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Admin = require('./src/models/Admin');
const Category = require('./src/models/Category');
const Service = require('./src/models/Service');
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

async function runCategoryIntegrationTests() {
  if (!process.env.MONGODB_URI) {
    console.log('NOTICE: MONGODB_URI is not set. Skipping live DB category tests.');
    return;
  }

  const connected = await connectDB();
  if (!connected) {
    console.log('NOTICE: Could not connect to MongoDB. Skipping category tests.');
    return;
  }

  const testPort = 5088;
  const server = app.listen(testPort);

  const runId = Date.now();
  const testAdminEmail = `test.cat.admin.${runId}@example.com`;
  const testCustomerEmail = `test.cat.cust.${runId}@example.com`;
  const testPhoneAdmin = `+1555${runId.toString().slice(-6)}`;
  const testPhoneCust = `+1444${runId.toString().slice(-6)}`;

  let adminToken;
  let customerToken;
  let adminUserId;
  let customerUserId;

  const createdCategoryIds = [];
  const createdServiceIds = [];

  console.log('--- RUNNING LIVE CATEGORY INTEGRATION TESTS ---');

  try {
    // Setup Admin and Customer users
    const hashedPass = await hashPassword('SecurePass123!');
    const adminUser = await User.create({
      name: 'Category Test Admin',
      email: testAdminEmail,
      phone: testPhoneAdmin,
      password: hashedPass,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    adminUserId = adminUser._id;
    await Admin.create({
      user: adminUser._id,
      permissions: ['manage_categories', 'super_admin']
    });
    adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    const custUser = await User.create({
      name: 'Category Test Customer',
      email: testCustomerEmail,
      phone: testPhoneCust,
      password: hashedPass,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    customerUserId = custUser._id;
    customerToken = generateToken({
      userId: custUser._id,
      email: custUser.email,
      role: custUser.role
    });

    // 1. Unauthorized access (no token) -> 401
    const resNoAuth = await makeRequest(testPort, 'POST', '/api/categories', {}, {
      name: `Cleaning ${runId}`
    });
    console.log('1. Category create without token:', resNoAuth.status);
    if (resNoAuth.status !== 401) throw new Error('Expected 401 for unauthorized creation');
    console.log('✓ Unauthorized access rejected (401)');

    // 2. Non-admin access (Customer token) -> 403
    const resNonAdmin = await makeRequest(
      testPort,
      'POST',
      '/api/categories',
      { Authorization: `Bearer ${customerToken}` },
      { name: `Cleaning ${runId}` }
    );
    console.log('2. Category create with customer role:', resNonAdmin.status);
    if (resNonAdmin.status !== 403) throw new Error('Expected 403 for non-admin creation');
    console.log('✓ Non-admin role rejected (403)');

    // 3. Invalid payload validation -> 400
    const resBadPayload = await makeRequest(
      testPort,
      'POST',
      '/api/categories',
      { Authorization: `Bearer ${adminToken}` },
      { name: '' }
    );
    console.log('3. Category create empty name:', resBadPayload.status);
    if (resBadPayload.status !== 400) throw new Error('Expected 400 for empty name');
    console.log('✓ Empty name validation passed (400)');

    // 4. Successful Category Creation by Admin -> 201
    const catName1 = `Home Sanitization ${runId}`;
    const resCreate1 = await makeRequest(
      testPort,
      'POST',
      '/api/categories',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: catName1,
        description: 'Complete home disinfection and sanitation services',
        icon: 'Sparkles',
        isActive: true,
        displayOrder: 1
      }
    );
    console.log('4. Create category 1:', resCreate1.status);
    if (resCreate1.status !== 201) throw new Error('Failed to create category: ' + JSON.stringify(resCreate1.body));
    const cat1 = resCreate1.body.data;
    createdCategoryIds.push(cat1._id);
    if (!cat1.slug || !cat1.slug.startsWith('home-sanitization')) {
      throw new Error(`Unexpected generated slug: ${cat1.slug}`);
    }
    console.log(`✓ Category 1 created with normalized slug: ${cat1.slug}`);

    // 5. Automatic unique slug collision handling -> 201
    const resCreate2 = await makeRequest(
      testPort,
      'POST',
      '/api/categories',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Special Home Sanitization ${runId}`,
        slug: cat1.slug // purposely specify conflicting slug
      }
    );
    console.log('5. Collision slug category create:', resCreate2.status);
    if (resCreate2.status !== 201) throw new Error('Failed to create category with slug resolution');
    const cat2 = resCreate2.body.data;
    createdCategoryIds.push(cat2._id);
    if (cat2.slug === cat1.slug) throw new Error('Slug conflict was not resolved uniquely');
    console.log(`✓ Unique slug auto-generation verified: ${cat2.slug}`);

    // 6. Duplicate Name Rejection -> 409
    const resDupName = await makeRequest(
      testPort,
      'POST',
      '/api/categories',
      { Authorization: `Bearer ${adminToken}` },
      { name: catName1 }
    );
    console.log('6. Duplicate name rejection:', resDupName.status);
    if (resDupName.status !== 409) throw new Error('Expected 409 for duplicate category name');
    console.log('✓ Duplicate category name rejected (409)');

    // 7. GET /api/categories (Public) -> 200
    const resPublic = await makeRequest(testPort, 'GET', '/api/categories');
    console.log('7. Public categories list:', resPublic.status);
    if (resPublic.status !== 200) throw new Error('Failed to get public categories');
    const foundPub1 = resPublic.body.data.some((c) => c._id === cat1._id);
    if (!foundPub1) throw new Error('Created active category not found in public list');
    console.log('✓ Public active categories listing verified');

    // 8. GET /api/categories/:id Details -> 200
    const resGetOne = await makeRequest(testPort, 'GET', `/api/categories/${cat1._id}`);
    console.log('8. Get single category:', resGetOne.status);
    if (resGetOne.status !== 200 || resGetOne.body.data.name !== catName1) {
      throw new Error('Failed to get category details');
    }
    console.log('✓ Single category retrieval verified');

    // 9. Invalid ObjectId handling -> 400
    const resBadId = await makeRequest(testPort, 'GET', '/api/categories/invalid-not-an-id');
    console.log('9. Invalid ObjectId format:', resBadId.status);
    if (resBadId.status !== 400) throw new Error('Expected 400 for invalid ObjectId');
    console.log('✓ Invalid ObjectId properly validated (400)');

    // 10. Non-existent Category ID -> 404
    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await makeRequest(testPort, 'GET', `/api/categories/${fakeId}`);
    console.log('10. Non-existent category ID:', resNotFound.status);
    if (resNotFound.status !== 404) throw new Error('Expected 404 for non-existent category');
    console.log('✓ Non-existent category handled with 404');

    // 11. PUT /api/categories/:id Update Category -> 200
    const resUpdate = await makeRequest(
      testPort,
      'PUT',
      `/api/categories/${cat1._id}`,
      { Authorization: `Bearer ${adminToken}` },
      {
        description: 'Updated comprehensive sanitation protocol',
        displayOrder: 5
      }
    );
    console.log('11. Update category:', resUpdate.status);
    if (resUpdate.status !== 200 || resUpdate.body.data.displayOrder !== 5) {
      throw new Error('Update category failed');
    }
    console.log('✓ Category update verified');

    // 12. PATCH /api/categories/:id/status Deactivate -> 200
    const resDeactivate = await makeRequest(
      testPort,
      'PATCH',
      `/api/categories/${cat1._id}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isActive: false }
    );
    console.log('12. Deactivate category:', resDeactivate.status);
    if (resDeactivate.status !== 200 || resDeactivate.body.data.isActive !== false) {
      throw new Error('Deactivate category failed');
    }
    console.log('✓ Category status patch verified');

    // Check that deactivated category is omitted from public list
    const resPublicAfterDeact = await makeRequest(testPort, 'GET', '/api/categories');
    const isPresentPublic = resPublicAfterDeact.body.data.some((c) => c._id === cat1._id);
    if (isPresentPublic) throw new Error('Deactivated category should not appear in public listing');
    console.log('✓ Inactive category filtered from public endpoint verified');

    // 13. GET /api/categories/admin includes inactive categories
    const resAdminList = await makeRequest(
      testPort,
      'GET',
      '/api/categories/admin',
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log('13. Admin categories list:', resAdminList.status);
    if (resAdminList.status !== 200) throw new Error('Admin category listing failed');
    const isAdminPresent = resAdminList.body.data.some((c) => c._id === cat1._id);
    if (!isAdminPresent) throw new Error('Deactivated category missing from admin list');
    console.log('✓ Admin category listing includes inactive items');

    // 14. Safe Deletion Prevention when referenced by existing Service -> 409
    const testService = await Service.create({
      name: `Deep Sanitization Service ${runId}`,
      category: cat1._id,
      price: 99,
      priceType: 'fixed',
      estimatedDurationMinutes: 120,
      isActive: true
    });
    createdServiceIds.push(testService._id);

    const resDelBlocked = await makeRequest(
      testPort,
      'DELETE',
      `/api/categories/${cat1._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log('14. Delete category referenced by service:', resDelBlocked.status);
    if (resDelBlocked.status !== 409) {
      throw new Error('Expected 409 conflict when deleting category referenced by a service');
    }
    console.log('✓ Safe deletion prevention verified (409 conflict returned)');

    // 15. Delete unreferenced category -> 200
    const resDelAllowed = await makeRequest(
      testPort,
      'DELETE',
      `/api/categories/${cat2._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log('15. Delete unreferenced category:', resDelAllowed.status);
    if (resDelAllowed.status !== 200) throw new Error('Expected 200 deleting unreferenced category');
    console.log('✓ Safe category deletion verified');

    console.log('--- ALL CATEGORY INTEGRATION TESTS PASSED! ---');
  } finally {
    // Cleanup isolated test data
    try {
      if (createdServiceIds.length > 0) {
        await Service.deleteMany({ _id: { $in: createdServiceIds } });
      }
      if (createdCategoryIds.length > 0) {
        await Category.deleteMany({ _id: { $in: createdCategoryIds } });
      }
      if (adminUserId) {
        await Admin.deleteMany({ user: adminUserId });
        await User.findByIdAndDelete(adminUserId);
      }
      if (customerUserId) {
        await User.findByIdAndDelete(customerUserId);
      }
      console.log('✓ Isolated category test data cleaned up safely');
    } catch (e) {
      console.error('Error cleaning up category test data:', e);
    }

    server.close();
    await disconnectDB();
  }
}

runCategoryIntegrationTests().catch((err) => {
  console.error('Category integration test error:', err);
  process.exit(1);
});
