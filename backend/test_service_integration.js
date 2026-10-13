const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const app = require('./src/app');
const User = require('./src/models/User');
const Admin = require('./src/models/Admin');
const Customer = require('./src/models/Customer');
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

async function runServiceIntegrationTests() {
  if (!process.env.MONGODB_URI) {
    console.log('NOTICE: MONGODB_URI is not set. Skipping live DB service tests.');
    return;
  }

  const connected = await connectDB();
  if (!connected) {
    console.log('NOTICE: Could not connect to MongoDB Atlas (network/whitelist restriction). Skipping live DB service tests.');
    return;
  }

  const testPort = 5096;
  const server = app.listen(testPort);

  const runId = Date.now();
  const testAdminEmail = `test.srv.admin.${runId}@example.com`;
  const testCustomerEmail = `test.srv.cust.${runId}@example.com`;
  const testPhoneAdmin = `+1666${runId.toString().slice(-6)}`;
  const testPhoneCust = `+1777${runId.toString().slice(-6)}`;

  let adminToken;
  let customerToken;
  let adminUserId;
  let customerUserId;
  let customerProfileId;

  const createdCategoryIds = [];
  const createdServiceIds = [];
  const createdBookingIds = [];

  console.log('--- RUNNING LIVE SERVICE INTEGRATION TESTS ---');

  try {
    // 1. Setup Admin and Customer users
    const hashedPass = await hashPassword('SecurePass123!');
    const adminUser = await User.create({
      name: 'Service Test Admin',
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
      permissions: ['manage_services', 'super_admin']
    });
    adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    const custUser = await User.create({
      name: 'Service Test Customer',
      email: testCustomerEmail,
      phone: testPhoneCust,
      password: hashedPass,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    customerUserId = custUser._id;
    const custProfile = await Customer.create({
      user: custUser._id,
      addresses: [{ street: '123 Test St', city: 'Test City', state: 'TS', zipCode: '12345' }]
    });
    customerProfileId = custProfile._id;
    customerToken = generateToken({
      userId: custUser._id,
      email: custUser.email,
      role: custUser.role
    });

    // 2. Setup active and inactive Categories
    const activeCategory = await Category.create({
      name: `Active Cat ${runId}`,
      slug: `active-cat-${runId}`,
      description: 'Active test category',
      isActive: true
    });
    createdCategoryIds.push(activeCategory._id);

    const inactiveCategory = await Category.create({
      name: `Inactive Cat ${runId}`,
      slug: `inactive-cat-${runId}`,
      description: 'Inactive test category',
      isActive: false
    });
    createdCategoryIds.push(inactiveCategory._id);

    // 3. Verify Customer role gets 403 on admin-only routes
    const resCustForbidden = await makeRequest(
      testPort,
      'GET',
      '/api/services/admin',
      { Authorization: `Bearer ${customerToken}` }
    );
    console.log('1. Customer access to /api/services/admin:', resCustForbidden.status);
    if (resCustForbidden.status !== 403) throw new Error('Expected 403 for customer on admin service route');
    console.log('✓ Non-admin role forbidden (403)');

    // 4. Create active service in inactive category -> 400 Bad Request
    const resInactiveCatCreate = await makeRequest(
      testPort,
      'POST',
      '/api/services',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Service in Inactive ${runId}`,
        category: inactiveCategory._id.toString(),
        price: 99,
        priceType: 'fixed',
        isActive: true
      }
    );
    console.log('2. Create active service in inactive category:', resInactiveCatCreate.status);
    if (resInactiveCatCreate.status !== 400) throw new Error('Expected 400 when creating active service in inactive category');
    console.log('✓ Inactive category constraint verified (400)');

    // 5. Create service with nonexistent category -> 404
    const resNonexistentCat = await makeRequest(
      testPort,
      'POST',
      '/api/services',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Service Missing Cat ${runId}`,
        category: new mongoose.Types.ObjectId().toString(),
        price: 99
      }
    );
    console.log('3. Create service with nonexistent category:', resNonexistentCat.status);
    if (resNonexistentCat.status !== 404) throw new Error('Expected 404 for nonexistent category');
    console.log('✓ Nonexistent category returns 404 Not Found');

    // 6. Valid service creation -> 201
    const resCreateService1 = await makeRequest(
      testPort,
      'POST',
      '/api/services',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Drain Cleaning ${runId}`,
        category: activeCategory._id.toString(),
        description: 'Complete drain clearing service',
        price: 120,
        priceType: 'fixed',
        estimatedDurationMinutes: 90,
        isActive: true
      }
    );
    console.log('4. Create valid service:', resCreateService1.status);
    if (resCreateService1.status !== 201) throw new Error('Expected 201 creating valid service');
    const service1 = resCreateService1.body.data;
    createdServiceIds.push(service1._id);
    console.log('✓ Service created successfully (201)');

    // 7. Duplicate service name in same category -> 409
    const resDuplicate = await makeRequest(
      testPort,
      'POST',
      '/api/services',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Drain Cleaning ${runId}`,
        category: activeCategory._id.toString(),
        price: 150
      }
    );
    console.log('5. Create duplicate service in same category:', resDuplicate.status);
    if (resDuplicate.status !== 409) throw new Error('Expected 409 for duplicate service in category');
    console.log('✓ Duplicate service name rejected (409 Conflict)');

    // 8. Create inactive service -> 201
    const resCreateService2 = await makeRequest(
      testPort,
      'POST',
      '/api/services',
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Water Heater Inspection ${runId}`,
        category: activeCategory._id.toString(),
        description: 'Full inspection of water heaters',
        price: 75,
        priceType: 'hourly',
        estimatedDurationMinutes: 60,
        isActive: false
      }
    );
    console.log('6. Create inactive service:', resCreateService2.status);
    if (resCreateService2.status !== 201) throw new Error('Expected 201 creating inactive service');
    const service2 = resCreateService2.body.data;
    createdServiceIds.push(service2._id);
    console.log('✓ Inactive service created successfully');

    // 9. Public listing excludes inactive services
    const resPublicList = await makeRequest(
      testPort,
      'GET',
      `/api/services?category=${activeCategory._id}`
    );
    console.log('7. Public services list:', resPublicList.status);
    if (resPublicList.status !== 200) throw new Error('Expected 200 for public services list');
    const publicServices = resPublicList.body.data;
    const hasInactive = publicServices.some((s) => s._id.toString() === service2._id.toString());
    const hasActive = publicServices.some((s) => s._id.toString() === service1._id.toString());
    if (hasInactive || !hasActive) {
      throw new Error('Public services list should include active service and exclude inactive service');
    }
    console.log('✓ Public listing correctly filters out inactive services');

    // 10. Admin listing includes inactive services and has pagination
    const resAdminList = await makeRequest(
      testPort,
      'GET',
      `/api/services/admin?category=${activeCategory._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log('8. Admin services list:', resAdminList.status);
    if (resAdminList.status !== 200) throw new Error('Expected 200 for admin services list');
    const adminServices = resAdminList.body.data;
    const hasBoth =
      adminServices.some((s) => s._id.toString() === service1._id.toString()) &&
      adminServices.some((s) => s._id.toString() === service2._id.toString());
    if (!hasBoth) throw new Error('Admin listing should include both active and inactive services');
    if (!resAdminList.body.pagination) throw new Error('Admin listing must include pagination');
    console.log('✓ Admin listing returns all services with pagination metadata');

    // 11. Retrieve single service by ID
    const resGetById = await makeRequest(testPort, 'GET', `/api/services/${service1._id}`);
    console.log('9. GET /api/services/:id:', resGetById.status);
    if (resGetById.status !== 200) throw new Error('Expected 200 retrieving service by id');
    if (resGetById.body.data.name !== service1.name) throw new Error('Service data mismatch');
    console.log('✓ Single service retrieval verified');

    // 12. Update service details
    const resUpdate = await makeRequest(
      testPort,
      'PUT',
      `/api/services/${service1._id}`,
      { Authorization: `Bearer ${adminToken}` },
      {
        name: `Drain Cleaning Deluxe ${runId}`,
        price: 140,
        estimatedDurationMinutes: 120
      }
    );
    console.log('10. PUT /api/services/:id:', resUpdate.status);
    if (resUpdate.status !== 200) throw new Error('Expected 200 updating service');
    if (resUpdate.body.data.price !== 140) throw new Error('Price update failed');
    console.log('✓ Service details updated successfully');

    // 13. Update service status (Activate / Deactivate)
    const resToggleStatus = await makeRequest(
      testPort,
      'PATCH',
      `/api/services/${service1._id}/status`,
      { Authorization: `Bearer ${adminToken}` },
      { isActive: false }
    );
    console.log('11. PATCH /api/services/:id/status (deactivate):', resToggleStatus.status);
    if (resToggleStatus.status !== 200 || resToggleStatus.body.data.isActive !== false) {
      throw new Error('Service deactivation failed');
    }
    console.log('✓ Service deactivation verified');

    // 14. Booking reference protection: prevent deleting service referenced by booking
    const testBooking = await Booking.create({
      bookingReference: `BK-TEST-${runId}`,
      customer: customerProfileId,
      service: service1._id,
      scheduledDate: new Date(Date.now() + 86400000),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: { street: '456 Test Ave', city: 'Test City' },
      pricing: { basePrice: 140, tax: 0, discount: 0, totalAmount: 140 }
    });
    createdBookingIds.push(testBooking._id);

    const resDelBlocked = await makeRequest(
      testPort,
      'DELETE',
      `/api/services/${service1._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log('12. Delete service referenced by booking:', resDelBlocked.status);
    if (resDelBlocked.status !== 409) {
      throw new Error('Expected 409 conflict when deleting service referenced by booking');
    }
    console.log('✓ Safe deletion prevention verified (409 Conflict returned)');

    // 15. Delete unreferenced service -> 200
    const resDelAllowed = await makeRequest(
      testPort,
      'DELETE',
      `/api/services/${service2._id}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    console.log('13. Delete unreferenced service:', resDelAllowed.status);
    if (resDelAllowed.status !== 200) throw new Error('Expected 200 deleting unreferenced service');
    console.log('✓ Safe service deletion verified (200 OK)');

    console.log('--- ALL SERVICE INTEGRATION TESTS PASSED! ---');
  } finally {
    // Cleanup isolated test data
    try {
      if (createdBookingIds.length > 0) {
        await Booking.deleteMany({ _id: { $in: createdBookingIds } });
      }
      if (createdServiceIds.length > 0) {
        await Service.deleteMany({ _id: { $in: createdServiceIds } });
      }
      if (createdCategoryIds.length > 0) {
        await Category.deleteMany({ _id: { $in: createdCategoryIds } });
      }
      if (customerProfileId) {
        await Customer.findByIdAndDelete(customerProfileId);
      }
      if (customerUserId) {
        await User.findByIdAndDelete(customerUserId);
      }
      if (adminUserId) {
        await Admin.deleteMany({ user: adminUserId });
        await User.findByIdAndDelete(adminUserId);
      }
      console.log('✓ Isolated service test data cleaned up safely');
    } catch (e) {
      console.error('Error cleaning up service test data:', e);
    }

    server.close();
    await disconnectDB();
  }
}

runServiceIntegrationTests().catch((err) => {
  console.error('Service integration test error:', err);
  process.exit(1);
});
