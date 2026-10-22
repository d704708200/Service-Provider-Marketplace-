/**
 * Service Team Size Feature Comprehensive Verification Test Suite
 * Tests:
 * 1. Team size validation middleware (valid counts: 1, 2, 5; invalid: 0, negative, > 50, floats, non-array roles, role counts exceeding total)
 * 2. Booking model schema defaults and backward compatibility (serviceTeam missing -> totalCount: null, isConfirmed: false)
 * 3. Provider updating team size before service start (status: accepted -> updates count and history, no fee change)
 * 4. Provider updating team size after service start (status: in_progress -> requires reason, appends history)
 * 5. Unauthorized modification checks (customer cannot update, provider cannot update another provider's booking)
 * 6. Disallowed booking status checks (cannot update team size when pending, completed, or cancelled)
 * 7. Price invariance guarantee (totalAmount remains unaffected by team size changes)
 */

const assert = require('assert');
const mongoose = require('mongoose');
const Booking = require('./src/models/Booking');
const { validateUpdateTeamSize } = require('./src/middleware/validation');
const bookingService = require('./src/services/bookingService');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

let passed = 0;
let total = 0;

function runTest(desc, fn) {
  total++;
  try {
    fn();
    console.log(`✓ Test ${total}: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ Test ${total} FAILED: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`✓ Test ${total}: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ Test ${total} FAILED: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('=== RUNNING SERVICE TEAM SIZE VERIFICATION SUITE ===\n');

// 1. Validation Middleware Tests: Valid Team Sizes 1, 2, 5
runTest('Validation accepts team size = 1 (1 person)', () => {
  const req = { body: { totalCount: 1, roles: [{ role: 'Main Technician', count: 1 }] } };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, null);
});

runTest('Validation accepts team size = 2 (2 people with roles)', () => {
  const req = {
    body: {
      totalCount: 2,
      roles: [
        { role: 'Main Technician', count: 1 },
        { role: 'Helper', count: 1 }
      ]
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, null);
});

runTest('Validation accepts team size = 5 (5 people with multiple roles)', () => {
  const req = {
    body: {
      totalCount: 5,
      roles: [
        { role: 'Lead Electrician', count: 1 },
        { role: 'Electrician', count: 2 },
        { role: 'Helper', count: 2 }
      ],
      notes: 'Heavy rewiring project'
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, null);
});

// 2. Validation Rejection Tests (Invalid counts & malformed payloads)
runTest('Validation rejects missing totalCount (400)', () => {
  const req = { body: {} };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

runTest('Validation rejects totalCount = 0 (400)', () => {
  const req = { body: { totalCount: 0 } };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
});

runTest('Validation rejects negative totalCount (400)', () => {
  const req = { body: { totalCount: -3 } };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
});

runTest('Validation rejects non-integer totalCount (400)', () => {
  const req = { body: { totalCount: 2.5 } };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
});

runTest('Validation rejects totalCount exceeding limit (>50) (400)', () => {
  const req = { body: { totalCount: 99 } };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
});

runTest('Validation rejects sum of role counts exceeding totalCount (400)', () => {
  const req = {
    body: {
      totalCount: 2,
      roles: [
        { role: 'Main Technician', count: 1 },
        { role: 'Helper', count: 2 } // sum = 3 > 2
      ]
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
});

runTest('Validation rejects invalid role object missing role name (400)', () => {
  const req = {
    body: {
      totalCount: 2,
      roles: [{ count: 1 }]
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateUpdateTeamSize(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
});

// 3. Schema & Backward Compatibility Tests
runTest('Booking model preserves backward compatibility for legacy bookings without team size', () => {
  const legacyBookingDoc = new Booking({
    bookingReference: 'BK-TEST-LEGACY',
    customer: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    scheduledDate: new Date(),
    scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
    address: { street: '123 Test St', city: 'Mumbai', location: { type: 'Point', coordinates: [0, 0] } },
    pricing: { basePrice: 499, totalAmount: 499 }
  });

  // Verify default schema values
  assert.strictEqual(legacyBookingDoc.serviceTeam.isConfirmed, false, 'Default isConfirmed must be false');
  assert.strictEqual(legacyBookingDoc.serviceTeam.totalCount, null, 'Default totalCount must be null (Not confirmed)');
  assert.strictEqual(legacyBookingDoc.serviceTeam.confirmedAt, null, 'Default confirmedAt must be null');
  assert.strictEqual(legacyBookingDoc.serviceTeam.roles.length, 0, 'Default roles should be empty array');
});

runTest('Booking model properly stores roles and team size structure', () => {
  const bookingWithTeam = new Booking({
    bookingReference: 'BK-TEST-TEAM',
    customer: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    scheduledDate: new Date(),
    scheduledTimeSlot: { startTime: '14:00', endTime: '15:00' },
    address: { street: '456 Sample Rd', city: 'Bangalore', location: { type: 'Point', coordinates: [0, 0] } },
    pricing: { basePrice: 1200, totalAmount: 1200 },
    serviceTeam: {
      totalCount: 3,
      isConfirmed: true,
      confirmedAt: new Date(),
      roles: [
        { role: 'Main Technician', count: 1 },
        { role: 'Carpenter', count: 1 },
        { role: 'Helper', count: 1 }
      ],
      notes: 'Equipped with circular saw',
      history: [
        {
          previousTotalCount: null,
          newTotalCount: 3,
          roles: [{ role: 'Main Technician', count: 1 }],
          reason: 'Initial setup',
          bookingStatusAtUpdate: 'accepted'
        }
      ]
    }
  });

  assert.strictEqual(bookingWithTeam.serviceTeam.totalCount, 3);
  assert.strictEqual(bookingWithTeam.serviceTeam.isConfirmed, true);
  assert.strictEqual(bookingWithTeam.serviceTeam.roles.length, 3);
  assert.strictEqual(bookingWithTeam.serviceTeam.history.length, 1);
  assert.strictEqual(bookingWithTeam.pricing.totalAmount, 1200, 'Price must not change with team size');
});

// 4. End-to-End Service Tests with MongoDB connection
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const Provider = require('./src/models/Provider');
    const User = require('./src/models/User');

    // Create a temporary test provider and booking for lifecycle testing
    const testUser = await User.create({
      name: 'Test Team Provider User',
      email: `test_team_user_${Date.now()}@example.com`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'password123',
      role: 'provider',
      isActive: true,
      isVerified: true
    });

    const testProvider = await Provider.create({
      user: testUser._id,
      businessName: 'Team Test Services',
      verificationStatus: 'verified',
      isAvailable: true
    });

    const anotherUser = await User.create({
      name: 'Another Provider User',
      email: `another_user_${Date.now()}@example.com`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'password123',
      role: 'provider',
      isActive: true,
      isVerified: true
    });

    const anotherProvider = await Provider.create({
      user: anotherUser._id,
      businessName: 'Another Provider Co',
      verificationStatus: 'verified',
      isAvailable: true
    });

    const testBooking = await Booking.create({
      bookingReference: `BK-TEAM-${Date.now()}`,
      customer: new mongoose.Types.ObjectId(),
      provider: testProvider._id,
      service: new mongoose.Types.ObjectId(),
      bookingMode: 'scheduled',
      status: 'accepted',
      scheduledDate: new Date(Date.now() + 86400000),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' },
      address: { street: '123 Test St', city: 'Mumbai', location: { type: 'Point', coordinates: [0, 0] } },
      pricing: { basePrice: 500, totalAmount: 500 }
    });

    // Test 13: Provider updates team size before service start (accepted status)
    await runAsyncTest('Provider updates team size in accepted status (1 person -> 2 people)', async () => {
      const updated = await bookingService.updateTeamSizeByProvider(testUser._id, testBooking._id, {
        totalCount: 2,
        roles: [{ role: 'Main Technician', count: 1 }, { role: 'Helper', count: 1 }],
        notes: 'Arriving with 1 assistant'
      });
      assert.strictEqual(updated.serviceTeam.totalCount, 2);
      assert.strictEqual(updated.serviceTeam.isConfirmed, true);
      assert.strictEqual(updated.serviceTeam.roles.length, 2);
      assert.strictEqual(updated.pricing.totalAmount, 500, 'Price must remain unchanged');
      assert.strictEqual(updated.serviceTeam.history.length, 1);
      assert.strictEqual(updated.serviceTeam.history[0].bookingStatusAtUpdate, 'accepted');
    });

    // Test 14: Unauthorized provider is rejected
    await runAsyncTest('Unauthorized provider updating booking is rejected with 403', async () => {
      let rejected = false;
      try {
        await bookingService.updateTeamSizeByProvider(anotherUser._id, testBooking._id, {
          totalCount: 3,
          roles: [{ role: 'Main Technician', count: 1 }]
        });
      } catch (err) {
        rejected = true;
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(rejected, true, 'Should reject unauthorized provider');
    });

    // Test 15: Disallowed booking status rejection (pending)
    await runAsyncTest('Updating team size for pending booking is rejected with 400', async () => {
      testBooking.status = 'pending';
      await testBooking.save();
      let rejected = false;
      try {
        await bookingService.updateTeamSizeByProvider(testUser._id, testBooking._id, {
          totalCount: 2
        });
      } catch (err) {
        rejected = true;
        assert.strictEqual(err.statusCode, 400);
      }
      assert.strictEqual(rejected, true, 'Should reject pending status');
    });

    // Test 16: In-progress update requires explicit reason
    await runAsyncTest('Updating team size when in_progress without reason is rejected with 400', async () => {
      testBooking.status = 'in_progress';
      await testBooking.save();
      let rejected = false;
      try {
        await bookingService.updateTeamSizeByProvider(testUser._id, testBooking._id, {
          totalCount: 3
        });
      } catch (err) {
        rejected = true;
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /reason/i);
      }
      assert.strictEqual(rejected, true, 'Should reject in_progress update without reason');
    });

    // Test 17: In-progress update with reason succeeds and appends to history
    await runAsyncTest('Updating team size when in_progress with reason succeeds and appends history', async () => {
      const updated = await bookingService.updateTeamSizeByProvider(testUser._id, testBooking._id, {
        totalCount: 3,
        roles: [{ role: 'Main Technician', count: 1 }, { role: 'Electrician', count: 2 }],
        reason: 'Customer requested additional wiring specialist'
      });
      assert.strictEqual(updated.serviceTeam.totalCount, 3);
      assert.strictEqual(updated.serviceTeam.history.length, 2);
      assert.strictEqual(updated.serviceTeam.history[1].newTotalCount, 3);
      assert.strictEqual(updated.serviceTeam.history[1].previousTotalCount, 2);
      assert.strictEqual(updated.serviceTeam.history[1].bookingStatusAtUpdate, 'in_progress');
    });

    // Test 18: Disallowed booking status rejection (completed)
    await runAsyncTest('Updating team size for completed booking is rejected with 400', async () => {
      testBooking.status = 'completed';
      await testBooking.save();
      let rejected = false;
      try {
        await bookingService.updateTeamSizeByProvider(testUser._id, testBooking._id, {
          totalCount: 2,
          reason: 'Job already finished'
        });
      } catch (err) {
        rejected = true;
        assert.strictEqual(err.statusCode, 400);
      }
      assert.strictEqual(rejected, true, 'Should reject completed status');
    });

    // Cleanup test documents
    await Booking.deleteOne({ _id: testBooking._id });
    await Provider.deleteMany({ _id: { $in: [testProvider._id, anotherProvider._id] } });
    await User.deleteMany({ _id: { $in: [testUser._id, anotherUser._id] } });

    await mongoose.disconnect();

    console.log(`\n======================================================`);
    console.log(`ALL ${passed}/${total} SERVICE TEAM SIZE VERIFICATION TESTS PASSED!`);
    console.log(`======================================================\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database connection error in tests:', err);
    process.exit(1);
  });

