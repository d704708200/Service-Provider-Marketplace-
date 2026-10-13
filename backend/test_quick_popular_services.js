const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Admin = require('./src/models/Admin');
const Category = require('./src/models/Category');
const { generateToken } = require('./src/utils/jwt');
const { hashPassword } = require('./src/services/authService');
const { connectDB } = require('./src/config/db');

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

async function runQuickAndPopularServicesTests() {
  const connected = await connectDB();
  if (!connected) {
    console.error('Failed to connect to DB');
    process.exit(1);
  }

  const testPort = 5092;
  const server = app.listen(testPort);

  const runId = Date.now();
  const testAdminEmail = `test.quickpop.admin.${runId}@example.com`;
  const createdCategoryIds = [];

  try {
    const hashedPass = await hashPassword('AdminPass123!');
    const adminUser = await User.create({
      name: 'QuickPop Admin',
      email: testAdminEmail,
      phone: `+1888${runId.toString().slice(-6)}`,
      password: hashedPass,
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    const adminDoc = await Admin.create({
      user: adminUser._id,
      permissions: ['super_admin']
    });

    const adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: 'admin',
      adminId: adminDoc._id
    });

    console.log('✓ Admin user setup completed');

    // 1. Create Category with Quick Services enabled and Popular Services disabled
    const cat1Res = await makeRequest(testPort, 'POST', '/api/categories', {
      Authorization: `Bearer ${adminToken}`
    }, {
      name: `Electrician Service ${runId}`,
      description: 'Expert electrical repairs and wiring',
      icon: 'flash-outline',
      showInQuickServices: true,
      quickServicesOrder: 1,
      showInPopularServices: false,
      popularServicesOrder: 0,
      isActive: true
    });

    console.assert(cat1Res.status === 201, `Expected 201, got ${cat1Res.status}`);
    console.assert(cat1Res.body.data.showInQuickServices === true, 'showInQuickServices should be true');
    console.assert(cat1Res.body.data.quickServicesOrder === 1, 'quickServicesOrder should be 1');
    console.assert(cat1Res.body.data.showInPopularServices === false, 'showInPopularServices should be false');
    createdCategoryIds.push(cat1Res.body.data._id);
    console.log('✓ Step 1: Admin created category with Quick Services enabled');

    // 2. Create Category with Popular Services enabled and Quick Services disabled
    const cat2Res = await makeRequest(testPort, 'POST', '/api/categories', {
      Authorization: `Bearer ${adminToken}`
    }, {
      name: `AC Service & Repair ${runId}`,
      description: 'Cooling installation and maintenance',
      icon: 'snow-outline',
      showInQuickServices: false,
      quickServicesOrder: 0,
      showInPopularServices: true,
      popularServicesOrder: 1,
      isActive: true
    });

    console.assert(cat2Res.status === 201, `Expected 201, got ${cat2Res.status}`);
    console.assert(cat2Res.body.data.showInPopularServices === true, 'showInPopularServices should be true');
    console.assert(cat2Res.body.data.popularServicesOrder === 1, 'popularServicesOrder should be 1');
    createdCategoryIds.push(cat2Res.body.data._id);
    console.log('✓ Step 2: Admin created category with Popular Services enabled');

    // 3. Query public endpoint for Quick Services
    const publicQuickRes = await makeRequest(testPort, 'GET', '/api/categories?quickServices=true');
    console.assert(publicQuickRes.status === 200, `Expected 200, got ${publicQuickRes.status}`);
    const quickNames = publicQuickRes.body.data.map((c) => c.name);
    console.assert(quickNames.includes(`Electrician Service ${runId}`), 'Quick services must contain Cat 1');
    console.assert(!quickNames.includes(`AC Service & Repair ${runId}`), 'Quick services must NOT contain Cat 2');
    console.log('✓ Step 3: GET /api/categories?quickServices=true correctly returns only quick services');

    // 4. Query public endpoint for Popular Services
    const publicPopRes = await makeRequest(testPort, 'GET', '/api/categories?popularServices=true');
    console.assert(publicPopRes.status === 200, `Expected 200, got ${publicPopRes.status}`);
    const popNames = publicPopRes.body.data.map((c) => c.name);
    console.assert(popNames.includes(`AC Service & Repair ${runId}`), 'Popular services must contain Cat 2');
    console.assert(!popNames.includes(`Electrician Service ${runId}`), 'Popular services must NOT contain Cat 1');
    console.log('✓ Step 4: GET /api/categories?popularServices=true correctly returns only popular services');

    // 5. Update Cat 1 to enable Popular Services as well, and edit name
    const updateRes = await makeRequest(testPort, 'PUT', `/api/categories/${cat1Res.body.data._id}`, {
      Authorization: `Bearer ${adminToken}`
    }, {
      name: `Electrical Master ${runId}`,
      showInPopularServices: true,
      popularServicesOrder: 2
    });

    console.assert(updateRes.status === 200, `Expected 200, got ${updateRes.status}`);
    console.assert(updateRes.body.data.name === `Electrical Master ${runId}`, 'Name should be updated');
    console.assert(updateRes.body.data.showInPopularServices === true, 'showInPopularServices should be updated to true');
    console.assert(updateRes.body.data.popularServicesOrder === 2, 'popularServicesOrder should be 2');
    console.log('✓ Step 5: Admin edited category name and enabled Popular Services');

    // 6. Verify Cat 1 appears in Popular Services now
    const verifyPopRes = await makeRequest(testPort, 'GET', '/api/categories?popularServices=true');
    const updatedPopNames = verifyPopRes.body.data.map((c) => c.name);
    console.assert(updatedPopNames.includes(`Electrical Master ${runId}`), 'Updated Cat 1 must now appear in popular services');
    console.log('✓ Step 6: Verified updated category is returned with new name in Popular Services');

    // 7. Disable Cat 1 active status and verify it vanishes from public endpoints
    await makeRequest(testPort, 'PATCH', `/api/categories/${cat1Res.body.data._id}/status`, {
      Authorization: `Bearer ${adminToken}`
    }, { isActive: false });

    const deactivatedQuickRes = await makeRequest(testPort, 'GET', '/api/categories?quickServices=true');
    const deactivatedQuickNames = deactivatedQuickRes.body.data.map((c) => c.name);
    console.assert(!deactivatedQuickNames.includes(`Electrical Master ${runId}`), 'Inactive category must not appear in public quick services');

    const deactivatedPopRes = await makeRequest(testPort, 'GET', '/api/categories?popularServices=true');
    const deactivatedPopNames = deactivatedPopRes.body.data.map((c) => c.name);
    console.assert(!deactivatedPopNames.includes(`Electrical Master ${runId}`), 'Inactive category must not appear in public popular services');
    console.log('✓ Step 7: Deactivated category correctly excluded from all public customer endpoints');

    // Clean up
    for (const catId of createdCategoryIds) {
      await Category.findByIdAndDelete(catId);
    }
    await User.findByIdAndDelete(adminUser._id);
    await Admin.findByIdAndDelete(adminDoc._id);

    console.log('====================================================');
    console.log('ALL QUICK SERVICES & POPULAR SERVICES TESTS PASSED!');
    console.log('====================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    server.close();
    process.exit(1);
  }
}

runQuickAndPopularServicesTests();
