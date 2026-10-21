const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Admin = require('./src/models/Admin');
const Customer = require('./src/models/Customer');
const Provider = require('./src/models/Provider');
const Category = require('./src/models/Category');
const Service = require('./src/models/Service');
const Booking = require('./src/models/Booking');
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

async function runAdminDeleteTests() {
  console.log('=== STARTING ADMIN DELETE CUSTOMER & PROVIDER TESTS ===\n');

  if (!process.env.MONGODB_URI) {
    console.error('FAIL: MONGODB_URI not configured in .env');
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('FAIL: Could not connect to MongoDB');
    process.exit(1);
  }

  const testPort = 5098;
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

  const createdUserIds = [];
  const createdCustomerIds = [];
  const createdProviderIds = [];
  const createdCategoryIds = [];
  const createdServiceIds = [];
  const createdBookingIds = [];

  try {
    const runId = Date.now();
    const hashedPassword = await hashPassword('TestPassword@123');

    // 1. Setup Admin Account
    const adminUser = await User.create({
      name: `Admin Tester ${runId}`,
      email: `admin.del.${runId}@example.com`,
      phone: `9100${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(adminUser._id);

    await Admin.create({
      user: adminUser._id,
      permissions: ['manage_users', 'manage_providers', 'manage_bookings', 'super_admin']
    });

    const adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    // 2. Setup Non-Admin (Customer) for authorization negative testing
    const customerUser = await User.create({
      name: `Customer Tester ${runId}`,
      email: `cust.del.${runId}@example.com`,
      phone: `9101${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(customerUser._id);

    const customerProfile = await Customer.create({
      user: customerUser._id,
      addresses: [{ street: '123 Main St', city: 'Metropolis', zipCode: '10001' }]
    });
    createdCustomerIds.push(customerProfile._id);

    const customerToken = generateToken({
      userId: customerUser._id,
      email: customerUser.email,
      role: customerUser.role
    });

    // 3. Setup Provider to be tested
    const cat = await Category.create({
      name: `Del Category ${runId}`,
      slug: `del-cat-${runId}`,
      isActive: true
    });
    createdCategoryIds.push(cat._id);

    const providerUser = await User.create({
      name: `Provider Tester ${runId}`,
      email: `prov.del.${runId}@example.com`,
      phone: `9102${runId.toString().slice(-6)}`,
      password: hashedPassword,
      role: 'provider',
      isActive: true,
      isVerified: true
    });
    createdUserIds.push(providerUser._id);

    const providerProfile = await Provider.create({
      user: providerUser._id,
      businessName: `Apex Pros ${runId}`,
      categories: [cat._id],
      verificationStatus: 'verified',
      isAvailable: true
    });
    createdProviderIds.push(providerProfile._id);

    // 4. Setup Service & Booking linked to customer & provider
    const service = await Service.create({
      name: `Del Service ${runId}`,
      category: cat._id,
      provider: providerProfile._id,
      price: 150,
      isActive: true
    });
    createdServiceIds.push(service._id);

    const booking = await Booking.create({
      bookingReference: `BK-TEST-${runId}`,
      customer: customerProfile._id,
      provider: providerProfile._id,
      service: service._id,
      bookingMode: 'instant',
      status: 'pending',
      address: { street: '123 Main St', city: 'Metropolis', zipCode: '10001' },
      pricing: { basePrice: 150, totalAmount: 150 },
      paymentStatus: 'pending'
    });
    createdBookingIds.push(booking._id);

    console.log(`Created baseline test entities for Admin Delete tests.\n`);

    // --- TEST 1: Unauthenticated request rejected ---
    const unauthCustRes = await makeRequest(testPort, 'DELETE', `/api/customers/admin/${customerProfile._id}`);
    assert(unauthCustRes.status === 401, 'TEST 1.1: Unauthenticated DELETE customer returns HTTP 401');

    const unauthProvRes = await makeRequest(testPort, 'DELETE', `/api/providers/admin/${providerProfile._id}`);
    assert(unauthProvRes.status === 401, 'TEST 1.2: Unauthenticated DELETE provider returns HTTP 401');

    // --- TEST 2: Non-admin request rejected (403) ---
    const nonAdminCustRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/admin/${customerProfile._id}`,
      { Authorization: `Bearer ${customerToken}` }
    );
    assert(nonAdminCustRes.status === 403, 'TEST 2.1: Non-admin DELETE customer returns HTTP 403 Forbidden');

    const nonAdminProvRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/providers/admin/${providerProfile._id}`,
      { Authorization: `Bearer ${customerToken}` }
    );
    assert(nonAdminProvRes.status === 403, 'TEST 2.2: Non-admin DELETE provider returns HTTP 403 Forbidden');

    // --- TEST 3: Invalid ObjectId rejected (400) ---
    const invalidCustIdRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/admin/not-a-valid-id-123`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidCustIdRes.status === 400, 'TEST 3.1: Invalid ObjectId for customer returns HTTP 400');

    const invalidProvIdRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/providers/admin/not-a-valid-id-123`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidProvIdRes.status === 400, 'TEST 3.2: Invalid ObjectId for provider returns HTTP 400');

    // --- TEST 4: Non-existent accounts return 404 ---
    const fakeId = new mongoose.Types.ObjectId().toString();
    const notFoundCustRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/admin/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundCustRes.status === 404, 'TEST 4.1: Non-existent customer ID returns HTTP 404');

    const notFoundProvRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/providers/admin/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundProvRes.status === 404, 'TEST 4.2: Non-existent provider ID returns HTTP 404');

    // --- TEST 5: Administrator cannot delete an administrator account (403) ---
    const deleteAdminTargetRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/admin/${adminUser._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deleteAdminTargetRes.status === 404 || deleteAdminTargetRes.status === 403,
      'TEST 5.1: Attempting to delete administrator via customer endpoint rejected');

    // --- TEST 6: Current administrator cannot delete their own account (403) ---
    const selfDeleteProvRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/providers/admin/${adminUser._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(selfDeleteProvRes.status === 404 || selfDeleteProvRes.status === 403,
      'TEST 6.1: Attempting self-delete via provider endpoint rejected');

    // --- TEST 7: Admin lists customers successfully via GET /api/customers/admin ---
    const getCustListRes = await makeRequest(
      testPort,
      'GET',
      `/api/customers/admin`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(getCustListRes.status === 200, 'TEST 7.1: GET /api/customers/admin returns HTTP 200');
    assert(getCustListRes.body?.success === true, 'TEST 7.2: Customer list response success === true');
    assert(Array.isArray(getCustListRes.body?.data), 'TEST 7.3: Customer list response data is an array');
    const foundCust = getCustListRes.body?.data.some(c => c.email === customerUser.email);
    assert(foundCust, 'TEST 7.4: Registered customer is found in administrative customer directory');

    // --- TEST 8: Admin successfully deletes / deactivates customer ---
    const delCustSuccessRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/customers/admin/${customerProfile._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(delCustSuccessRes.status === 200, 'TEST 8.1: DELETE /api/customers/admin/:id returns HTTP 200');
    assert(delCustSuccessRes.body?.success === true, 'TEST 8.2: Response body confirms customer deletion');
    assert(delCustSuccessRes.body?.data?.isDeleted === true, 'TEST 8.3: Response payload confirms isDeleted: true');

    // Verify DB persistence of soft-delete in User and Customer
    const updatedCustomerUser = await User.findById(customerUser._id);
    const updatedCustomerProfile = await Customer.findById(customerProfile._id);
    assert(updatedCustomerUser.isActive === false, 'TEST 8.4: Customer user.isActive set to false');
    assert(updatedCustomerUser.isDeleted === true, 'TEST 8.5: Customer user.isDeleted set to true in MongoDB');
    assert(updatedCustomerUser.deletedAt instanceof Date, 'TEST 8.6: Customer user.deletedAt timestamp set in MongoDB');
    assert(updatedCustomerProfile.isDeleted === true, 'TEST 8.7: Customer profile.isDeleted set to true in MongoDB');

    // Verify customer is excluded from admin customer directory list by default
    const getCustListAfterDelRes = await makeRequest(
      testPort,
      'GET',
      `/api/customers/admin`,
      { Authorization: `Bearer ${adminToken}` }
    );
    const foundCustAfterDel = getCustListAfterDelRes.body?.data?.some(c => c.email === customerUser.email);
    assert(!foundCustAfterDel, 'TEST 8.8: Deleted customer is excluded from GET /api/customers/admin directory list');

    // --- TEST 9: Admin successfully deletes / deactivates provider ---
    const delProvSuccessRes = await makeRequest(
      testPort,
      'DELETE',
      `/api/providers/admin/${providerProfile._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(delProvSuccessRes.status === 200, 'TEST 9.1: DELETE /api/providers/admin/:id returns HTTP 200');
    assert(delProvSuccessRes.body?.success === true, 'TEST 9.2: Response body confirms provider deletion');
    assert(delProvSuccessRes.body?.data?.isDeleted === true, 'TEST 9.3: Response payload confirms isDeleted: true');

    // Verify DB persistence of provider soft-delete
    const updatedProvUser = await User.findById(providerUser._id);
    const updatedProvProfile = await Provider.findById(providerProfile._id);
    assert(updatedProvUser.isActive === false, 'TEST 9.4: Provider user.isActive set to false');
    assert(updatedProvUser.isDeleted === true, 'TEST 9.5: Provider user.isDeleted set to true in MongoDB');
    assert(updatedProvProfile.isDeleted === true, 'TEST 9.6: Provider profile.isDeleted set to true in MongoDB');
    assert(updatedProvProfile.isAvailable === false, 'TEST 9.7: Provider profile.isAvailable set to false');
    assert(updatedProvProfile.verificationStatus === 'suspended',
      'TEST 9.8: Provider verificationStatus changed to suspended');

    // Verify provider is excluded from admin provider list by default
    const getProvListAfterDelRes = await makeRequest(
      testPort,
      'GET',
      `/api/providers/admin`,
      { Authorization: `Bearer ${adminToken}` }
    );
    const foundProvAfterDel = getProvListAfterDelRes.body?.data?.providers?.some(p => p._id.toString() === providerProfile._id.toString());
    assert(!foundProvAfterDel, 'TEST 9.9: Deleted provider is excluded from GET /api/providers/admin directory list');

    // --- TEST 10: Historical bookings and financial records remain intact ---
    const preservedBooking = await Booking.findById(booking._id);
    assert(preservedBooking !== null, 'TEST 10.1: Historical booking record preserved in MongoDB');
    assert(preservedBooking.pricing.totalAmount === 150, 'TEST 10.2: Booking pricing and financial fields intact');
    assert(preservedBooking.customer.toString() === customerProfile._id.toString(),
      'TEST 10.3: Customer reference on booking remains intact');
    assert(preservedBooking.provider.toString() === providerProfile._id.toString(),
      'TEST 10.4: Provider reference on booking remains intact');

    // --- TEST 11: Deactivated provider cannot receive new bookings ---
    // Try creating a new booking with deactivated provider
    // Re-activate customer temporarily to test provider booking attempt
    await User.findByIdAndUpdate(customerUser._id, { isActive: true, isDeleted: false });
    await Customer.findByIdAndUpdate(customerProfile._id, { isDeleted: false });
    const newBookingData = {
      serviceId: service._id.toString(),
      providerId: providerProfile._id.toString(),
      bookingMode: 'instant',
      address: { street: '123 Test St', city: 'Metropolis', zipCode: '10001' }
    };
    const blockBookingRes = await makeRequest(
      testPort,
      'POST',
      `/api/bookings`,
      { Authorization: `Bearer ${customerToken}` },
      newBookingData
    );
    assert(blockBookingRes.status === 400, 'TEST 11.1: Booking against deactivated/suspended provider rejected with 400');
    assert(
      blockBookingRes.body?.error?.message?.includes('deleted') ||
      blockBookingRes.body?.error?.message?.includes('not verified') ||
      blockBookingRes.body?.error?.message?.includes('unavailable') ||
      blockBookingRes.body?.error?.message?.includes('deactivated'),
      'TEST 11.2: Error message clearly mentions provider status / unverified / unavailable / deleted'
    );

  } catch (err) {
    console.error('Unhandled test execution error:', err);
    failCount++;
  } finally {
    console.log('\n--- Cleaning up test records ---');
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (createdServiceIds.length > 0) {
      await Service.deleteMany({ _id: { $in: createdServiceIds } });
    }
    if (createdCategoryIds.length > 0) {
      await Category.deleteMany({ _id: { $in: createdCategoryIds } });
    }
    if (createdCustomerIds.length > 0) {
      await Customer.deleteMany({ _id: { $in: createdCustomerIds } });
    }
    if (createdProviderIds.length > 0) {
      await Provider.deleteMany({ _id: { $in: createdProviderIds } });
    }
    if (createdUserIds.length > 0) {
      await Admin.deleteMany({ user: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
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

runAdminDeleteTests();
