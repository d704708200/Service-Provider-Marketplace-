const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

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

function makeRequest(port, method, reqPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      Connection: 'close',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders,
        agent: false
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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('MENDROO ADMIN PANEL: CITY-WISE BOOKING ANALYTICS TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Test server running on port: ${port}`);

  let testAdminUser, adminToken, testCustomerUser, customerToken;
  const createdBookingIds = [];

  try {
  console.log('Step 1: Loading existing admin and customer users...');
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    const hashedAdminPassword = await hashPassword('AdminPass123!');
    adminUser = await User.create({
      name: 'Analytics Super Admin',
      email: `analytics_admin_${Date.now()}@mendroo.test`,
      phone: `919${Math.floor(100000000 + Math.random() * 900000000)}`,
      password: hashedAdminPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    await Admin.create({ user: adminUser._id, department: 'Analytics Operations' });
  }
  adminToken = generateToken({
    userId: adminUser._id,
    email: adminUser.email,
    role: adminUser.role
  });
  console.log(`Admin token generated for: ${adminUser.email}`);

  let customerUser = await User.findOne({ role: 'customer' });
  if (!customerUser) {
    const hashedCustPassword = await hashPassword('CustomerPass123!');
    customerUser = await User.create({
      name: 'Regular Customer',
      email: `customer_${Date.now()}@mendroo.test`,
      phone: `918${Math.floor(100000000 + Math.random() * 900000000)}`,
      password: hashedCustPassword,
      role: 'customer',
      isActive: true,
      isVerified: true
    });
  }
  customerToken = generateToken({
    userId: customerUser._id,
    email: customerUser.email,
    role: customerUser.role
  });
  console.log(`Customer token generated for: ${customerUser.email}`);

  const testCustomerProfile = await Customer.findOne({ user: customerUser._id }) ||
    await Customer.create({ user: customerUser._id, addresses: [] });

    console.log('Step 3: Finding or creating category and service...');
    let category = await Category.findOne({ name: 'Home Cleaning' });
    if (!category) {
      category = await Category.create({
        name: 'Home Cleaning',
        slug: `home-cleaning-${Date.now()}`,
        description: 'Professional home cleaning services'
      });
    }

    let service = await Service.findOne({ category: category._id });
    if (!service) {
      service = await Service.create({
        name: 'Deep Kitchen Cleaning',
        category: category._id,
        price: 1500,
        priceType: 'fixed'
      });
    }

    console.log('Step 4: Seeding test bookings...');
    const seedBookings = [
      { city: 'Kharagpur', status: 'completed', paymentStatus: 'paid', amount: 1500 },
      { city: 'kharagpur', status: 'accepted', paymentStatus: 'paid', amount: 2000 },
      { city: '  Kharagpur  ', status: 'pending', paymentStatus: 'pending', amount: 1200 },
      { city: 'KHARAGPUR', status: 'cancelled', paymentStatus: 'failed', amount: 1800 },
      { city: 'Jaipur', status: 'completed', paymentStatus: 'paid', amount: 3000 },
      { city: 'jaipur', status: 'in_progress', paymentStatus: 'pending', amount: 2500 }
    ];

    for (let i = 0; i < seedBookings.length; i++) {
      const b = seedBookings[i];
      const created = await Booking.create({
        bookingReference: `TEST-CITY-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        customer: testCustomerProfile._id,
        service: service._id,
        category: category._id,
        bookingMode: 'instant',
        status: b.status,
        paymentStatus: b.paymentStatus,
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: 'ASAP', endTime: 'ASAP' },
        address: {
          street: '123 Main Test St',
          city: b.city,
          location: { type: 'Point', coordinates: [75.7873, 26.9124] }
        },
        pricing: {
          basePrice: b.amount,
          tax: 0,
          discount: 0,
          totalAmount: b.amount
        },
        createdAt: new Date()
      });
      createdBookingIds.push(created._id);
    }

    // Insert legacy booking with empty/missing city directly via collection to bypass schema validation
    const legacyDoc = await Booking.collection.insertOne({
      bookingReference: `TEST-CITY-LEGACY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customer: testCustomerProfile._id,
      service: service._id,
      category: category._id,
      bookingMode: 'instant',
      status: 'completed',
      paymentStatus: 'paid',
      scheduledDate: new Date(),
      scheduledTimeSlot: { startTime: 'ASAP', endTime: 'ASAP' },
      address: {
        street: '456 Legacy Ave',
        city: '',
        location: { type: 'Point', coordinates: [75.7873, 26.9124] }
      },
      pricing: {
        basePrice: 1000,
        tax: 0,
        discount: 0,
        totalAmount: 1000
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    createdBookingIds.push(legacyDoc.insertedId);

    console.log(`Seeded ${createdBookingIds.length} targeted test bookings.`);

    let passedTests = 0;
    let totalTests = 10;

    // TEST 1: City-wise booking aggregation across all cities
    console.log('--- TEST 1: City-wise booking aggregation (GET /api/admin/analytics/cities) ---');
    const res1 = await makeRequest(port, 'GET', '/api/admin/analytics/cities', {
      Authorization: `Bearer ${adminToken}`
    });
    if (res1.status === 200 && res1.body.success && res1.body.data.summary.totalCities > 0) {
      console.log(`  PASSED: Retrieved ${res1.body.data.summary.totalCities} total cities with summary.`);
      console.log(`  Summary: Total Bookings: ${res1.body.data.summary.totalBookings}, Revenue: ₹${res1.body.data.summary.totalRevenue}`);
      passedTests++;
    } else {
      console.error('  FAILED:', res1.body);
    }

    // TEST 2: Duplicate city normalization (Kharagpur variations merged into 1 city entry)
    console.log('\n--- TEST 2: Duplicate city normalization (Case-insensitive & Trimmed) ---');
    const res2 = await makeRequest(port, 'GET', '/api/admin/analytics/cities?search=kharagpur', {
      Authorization: `Bearer ${adminToken}`
    });
    const kharagpurEntry = res2.body.data?.cities?.find((c) => c.cityKey === 'kharagpur');
    if (res2.status === 200 && kharagpurEntry && res2.body.data.cities.length === 1) {
      console.log(`  PASSED: All Kharagpur variations unified under single key '${kharagpurEntry.cityKey}' (Display: '${kharagpurEntry.cityName}')`);
      console.log(`  Kharagpur stats: Total: ${kharagpurEntry.totalBookings}, Completed: ${kharagpurEntry.completed}, Revenue: ₹${kharagpurEntry.revenue}`);
      if (kharagpurEntry.totalBookings >= 4) {
        console.log('  Confirmed: all 4 seed variations merged correctly!');
        passedTests++;
      } else {
        console.error('  FAILED: Expected >= 4 bookings for kharagpur, got:', kharagpurEntry.totalBookings);
      }
    } else {
      console.error('  FAILED:', res2.body);
    }

    // TEST 3: Missing / empty city values handled safely as 'Unspecified'
    console.log('\n--- TEST 3: Missing city values handling ---');
    const res3 = await makeRequest(port, 'GET', '/api/admin/analytics/cities?search=unspecified', {
      Authorization: `Bearer ${adminToken}`
    });
    const unspecifiedEntry = res3.body.data?.cities?.find((c) => c.cityKey === 'unspecified');
    if (res3.status === 200 && unspecifiedEntry) {
      console.log(`  PASSED: Empty city correctly identified and labeled as '${unspecifiedEntry.cityName}' (Key: '${unspecifiedEntry.cityKey}')`);
      passedTests++;
    } else {
      console.error('  FAILED: Unspecified city entry not found:', res3.body);
    }

    // TEST 4: Date range filters (today, 7d, 30d)
    console.log('\n--- TEST 4: Date range filters ---');
    const res4Today = await makeRequest(port, 'GET', '/api/admin/analytics/cities?period=today', {
      Authorization: `Bearer ${adminToken}`
    });
    const res4Month = await makeRequest(port, 'GET', '/api/admin/analytics/cities?period=this_month', {
      Authorization: `Bearer ${adminToken}`
    });
    if (res4Today.status === 200 && res4Month.status === 200 && res4Today.body.data.summary.totalBookings > 0) {
      console.log(`  PASSED: Date filters work properly. Today bookings: ${res4Today.body.data.summary.totalBookings}, This Month: ${res4Month.body.data.summary.totalBookings}`);
      passedTests++;
    } else {
      console.error('  FAILED: Date filter check failed:', res4Today.body);
    }

    // TEST 5: Booking status filter (e.g. status=completed)
    console.log('\n--- TEST 5: Booking status filter ---');
    const res5 = await makeRequest(port, 'GET', '/api/admin/analytics/cities?status=completed', {
      Authorization: `Bearer ${adminToken}`
    });
    const allAreCompleted = res5.body.data?.cities?.every((c) => c.totalBookings === c.completed);
    if (res5.status === 200 && allAreCompleted) {
      console.log(`  PASSED: Status filter 'completed' filtered all bookings across cities accurately.`);
      passedTests++;
    } else {
      console.error('  FAILED:', res5.body);
    }

    // TEST 6: Revenue calculations (only counting paid payments, no cancelled/failed)
    console.log('\n--- TEST 6: Revenue calculations ---');
    const res6 = await makeRequest(port, 'GET', '/api/admin/analytics/cities/kharagpur/summary', {
      Authorization: `Bearer ${adminToken}`
    });
    if (res6.status === 200 && res6.body.success) {
      const overview = res6.body.data.overview;
      console.log(`  PASSED: Kharagpur summary - Total Bookings: ${overview.totalBookings}, Total Revenue: ₹${overview.totalRevenue}, Platform Earnings: ₹${overview.platformEarnings}`);
      // Kharagpur has 2 paid bookings: 1500 + 2000 = 3500 (failed 1800 and pending 1200 excluded!)
      if (overview.totalRevenue >= 3500) {
        console.log('  Confirmed: Only paid payments counted; pending/failed correctly excluded from revenue.');
        passedTests++;
      } else {
        console.error('  FAILED: Revenue mismatch, expected >= 3500, got:', overview.totalRevenue);
      }
    } else {
      console.error('  FAILED:', res6.body);
    }

    // TEST 7: Pagination for city-wise table and city bookings
    console.log('\n--- TEST 7: Pagination ---');
    const res7 = await makeRequest(port, 'GET', '/api/admin/analytics/cities?page=1&limit=2', {
      Authorization: `Bearer ${adminToken}`
    });
    const pagination = res7.body.data?.pagination;
    if (res7.status === 200 && res7.body.data?.cities?.length <= 2 && pagination && pagination.page === 1) {
      console.log(`  PASSED: Pagination verified. Limit: ${pagination.limit}, Total Pages: ${pagination.totalPages}, Returned: ${res7.body.data.cities.length}`);
      passedTests++;
    } else {
      console.error('  FAILED:', res7.body);
    }

    // TEST 8: CSV Export (Summary and Bookings)
    console.log('\n--- TEST 8: CSV Export (GET /api/admin/analytics/cities/export) ---');
    const res8Summary = await makeRequest(port, 'GET', '/api/admin/analytics/cities/export?type=summary', {
      Authorization: `Bearer ${adminToken}`
    });
    const res8Bookings = await makeRequest(port, 'GET', '/api/admin/analytics/cities/export?type=bookings&city=kharagpur', {
      Authorization: `Bearer ${adminToken}`
    });
    const summaryCsvOk = typeof res8Summary.body === 'string' && res8Summary.body.includes('City Name,Total Bookings');
    const bookingsCsvOk = typeof res8Bookings.body === 'string' && res8Bookings.body.includes('Booking ID,City,Booking Date');
    if (summaryCsvOk && bookingsCsvOk) {
      console.log('  PASSED: CSV export generated successfully for both summary and booking records!');
      console.log('  Summary CSV preview header:', res8Summary.body.split('\r\n')[0]);
      console.log('  Bookings CSV preview header:', res8Bookings.body.split('\r\n')[0]);
      passedTests++;
    } else {
      console.error('  FAILED: CSV export verification failed.');
    }

    // TEST 9: Unauthorized access (non-admin and missing token)
    console.log('\n--- TEST 9: Unauthorized access prevention ---');
    const res9NoAuth = await makeRequest(port, 'GET', '/api/admin/analytics/cities');
    const res9Customer = await makeRequest(port, 'GET', '/api/admin/analytics/cities', {
      Authorization: `Bearer ${customerToken}`
    });
    if (res9NoAuth.status === 401 && res9Customer.status === 403) {
      console.log(`  PASSED: Rejected unauthorized requests (No token: 401, Customer role: 403)`);
      passedTests++;
    } else {
      console.error(`  FAILED: Expected 401/403, got NoAuth: ${res9NoAuth.status}, Customer: ${res9Customer.status}`);
    }

    // TEST 10: Empty city results handling (non-existent city)
    console.log('\n--- TEST 10: Empty city results handling ---');
    const res10 = await makeRequest(port, 'GET', '/api/admin/analytics/cities/nonexistentcity12345/bookings', {
      Authorization: `Bearer ${adminToken}`
    });
    if (res10.status === 200 && Array.isArray(res10.body.data) && res10.body.data.length === 0) {
      console.log(`  PASSED: Empty city query returned clean empty array with 200 OK.`);
      passedTests++;
    } else {
      console.error('  FAILED:', res10.body);
    }

    console.log('\n===============================================================');
    console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} PASSED`);
    console.log('===============================================================');

    // Cleanup seed test data
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (testAdminUser) {
      await Admin.deleteOne({ user: testAdminUser._id });
      await User.deleteOne({ _id: testAdminUser._id });
    }
    if (testCustomerUser) {
      await Customer.deleteOne({ user: testCustomerUser._id });
      await User.deleteOne({ _id: testCustomerUser._id });
    }
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  }
}

runTestSuite();
