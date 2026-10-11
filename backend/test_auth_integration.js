const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Customer = require('./src/models/Customer');
const Provider = require('./src/models/Provider');
const Admin = require('./src/models/Admin');
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

async function runLiveDbIntegrationTests() {
  if (!process.env.MONGODB_URI) {
    console.log('NOTICE: MONGODB_URI is not set in environment. Skipping database-backed integration tests.');
    return;
  }

  const connected = await connectDB();
  if (!connected) {
    console.log('NOTICE: Could not connect to MongoDB with provided MONGODB_URI. Skipping database-backed integration tests.');
    return;
  }

  const testPort = 5077;
  const server = app.listen(testPort);

  // Unique prefix to guarantee test isolation
  const runId = Date.now();
  const testCustomerEmail = `test.customer.${runId}@example.com`;
  const testCustomerPhone = `+1999${runId.toString().slice(-6)}`;
  const testProviderEmail = `test.provider.${runId}@example.com`;
  const testProviderPhone = `+1888${runId.toString().slice(-6)}`;
  const testAdminEmail = `test.admin.${runId}@example.com`;
  const testAdminPhone = `+1777${runId.toString().slice(-6)}`;
  const rawPassword = 'SecurePassword123!';

  console.log('--- RUNNING LIVE DATABASE AUTH INTEGRATION TESTS ---');

  try {
    // 1. Successful Customer Registration
    const regCustRes = await makeRequest(testPort, 'POST', '/api/auth/register/customer', {}, {
      name: 'Test Customer',
      email: testCustomerEmail,
      phone: testCustomerPhone,
      password: rawPassword,
      address: { street: '100 Test Blvd', city: 'Testville' }
    });
    console.log('1. Customer Registration Status:', regCustRes.status);
    if (regCustRes.status !== 201) throw new Error('Customer registration failed: ' + JSON.stringify(regCustRes.body));
    if (regCustRes.body.data.user.password) throw new Error('Password hash leaked in registration response!');
    if (!regCustRes.body.data.token) throw new Error('Missing token in registration response');
    const customerToken = regCustRes.body.data.token;
    console.log('✓ Customer registration and safe response verified');

    // 2. Duplicate Registration Rejection (Email)
    const dupEmailRes = await makeRequest(testPort, 'POST', '/api/auth/register/customer', {}, {
      name: 'Duplicate Test',
      email: testCustomerEmail,
      phone: '+1000000000',
      password: rawPassword
    });
    console.log('2. Duplicate Email Status:', dupEmailRes.status);
    if (dupEmailRes.status !== 409) throw new Error('Expected 409 for duplicate email');
    console.log('✓ Duplicate email prevention verified (409)');

    // 3. Customer Login - Incorrect Password
    const badPassRes = await makeRequest(testPort, 'POST', '/api/auth/login/customer', {}, {
      email: testCustomerEmail,
      password: 'WrongPassword'
    });
    console.log('3. Incorrect Password Status:', badPassRes.status);
    if (badPassRes.status !== 401) throw new Error('Expected 401 for incorrect password');
    console.log('✓ Incorrect password rejection verified (401)');

    // 4. Successful Customer Login
    const loginCustRes = await makeRequest(testPort, 'POST', '/api/auth/login/customer', {}, {
      email: testCustomerEmail,
      password: rawPassword
    });
    console.log('4. Customer Login Status:', loginCustRes.status);
    if (loginCustRes.status !== 200) throw new Error('Customer login failed: ' + JSON.stringify(loginCustRes.body));
    if (loginCustRes.body.data.user.password) throw new Error('Password hash leaked in login response!');
    console.log('✓ Customer login and password hash protection verified');

    // 5. Successful Provider Registration
    const regProvRes = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, {
      name: 'Test Pro',
      email: testProviderEmail,
      phone: testProviderPhone,
      password: rawPassword,
      businessName: 'Pro Repairs Ltd',
      experienceYears: 4
    });
    console.log('5. Provider Registration Status:', regProvRes.status);
    if (regProvRes.status !== 201) throw new Error('Provider registration failed: ' + JSON.stringify(regProvRes.body));
    if (regProvRes.body.data.profile.verificationStatus !== 'pending') {
      throw new Error('New provider must have verificationStatus: pending');
    }
    const providerToken = regProvRes.body.data.token;
    console.log('✓ Provider registration verified (pending status confirmed)');

    // 6. Successful Provider Login
    const loginProvRes = await makeRequest(testPort, 'POST', '/api/auth/login/provider', {}, {
      email: testProviderEmail,
      password: rawPassword
    });
    console.log('6. Provider Login Status:', loginProvRes.status);
    if (loginProvRes.status !== 200) throw new Error('Provider login failed: ' + JSON.stringify(loginProvRes.body));
    console.log('✓ Provider login verified');

    // 7. Role Mismatch: Provider trying to login at Customer login endpoint
    const roleMismatchRes = await makeRequest(testPort, 'POST', '/api/auth/login/customer', {}, {
      email: testProviderEmail,
      password: rawPassword
    });
    console.log('7. Role Mismatch Status:', roleMismatchRes.status);
    if (roleMismatchRes.status !== 403) throw new Error('Expected 403 for provider accessing customer login');
    console.log('✓ Role boundary enforcement verified (403)');

    // 8. Admin Account Seed & Login
    const hashedAdminPass = await hashPassword(rawPassword);
    const adminUser = await User.create({
      name: 'Master Admin',
      email: testAdminEmail,
      phone: testAdminPhone,
      password: hashedAdminPass,
      role: 'admin'
    });
    const adminProfile = await Admin.create({
      user: adminUser._id,
      permissions: ['super_admin']
    });

    const loginAdminRes = await makeRequest(testPort, 'POST', '/api/auth/login/admin', {}, {
      email: testAdminEmail,
      password: rawPassword
    });
    console.log('8. Admin Login Status:', loginAdminRes.status);
    if (loginAdminRes.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(loginAdminRes.body));
    const adminToken = loginAdminRes.body.data.token;
    console.log('✓ Admin login and profile association verified');

    // 9. GET /api/auth/me with Valid Customer Token
    const meCustRes = await makeRequest(testPort, 'GET', '/api/auth/me', {
      Authorization: `Bearer ${customerToken}`
    });
    console.log('9. GET /api/auth/me (Customer) Status:', meCustRes.status);
    if (meCustRes.status !== 200) throw new Error('GET /api/auth/me failed for customer');
    if (meCustRes.body.data.user.email !== testCustomerEmail) throw new Error('Mismatched user email in /api/auth/me');
    if (meCustRes.body.data.user.password) throw new Error('Password hash leaked in /api/auth/me');
    console.log('✓ GET /api/auth/me profile verification passed');

    // 10. Inactive Account Access
    await User.updateOne({ email: testCustomerEmail }, { isActive: false });
    const meInactiveRes = await makeRequest(testPort, 'GET', '/api/auth/me', {
      Authorization: `Bearer ${customerToken}`
    });
    console.log('10. Inactive Account Access Status:', meInactiveRes.status);
    if (meInactiveRes.status !== 403) throw new Error('Expected 403 for deactivated account');
    console.log('✓ Inactive account rejection verified (403)');

    console.log('--- ALL LIVE DATABASE INTEGRATION TESTS PASSED! ---');
  } finally {
    // Cleanup isolated test accounts
    try {
      const testUsers = await User.find({
        email: { $in: [testCustomerEmail, testProviderEmail, testAdminEmail] }
      });
      const userIds = testUsers.map(u => u._id);
      await Customer.deleteMany({ user: { $in: userIds } });
      await Provider.deleteMany({ user: { $in: userIds } });
      await Admin.deleteMany({ user: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
      console.log('✓ Isolated test data safely cleaned up');
    } catch (cleanErr) {
      console.error('Error cleaning up test data:', cleanErr);
    }

    server.close();
    await disconnectDB();
  }
}

runLiveDbIntegrationTests().catch(err => {
  console.error('Live DB test failure:', err);
  process.exit(1);
});
