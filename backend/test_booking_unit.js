/**
 * Phase 10: Booking & Scheduling Lifecycle Unit & Validation Tests
 */

const assert = require('assert');
const mongoose = require('mongoose');
const {
  validateCreateBooking,
  validateCancelBooking,
  validateRejectBooking
} = require('./src/middleware/validation');

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

console.log('--- RUNNING PHASE 10 BOOKING UNIT & VALIDATION TESTS ---');

let passed = 0;

// Test 1: Missing serviceId
{
  const req = { body: {} };
  const res = mockRes();
  let nextCalled = false;
  validateCreateBooking(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 400, 'Should reject missing serviceId with 400');
  assert.strictEqual(res.body.success, false);
  console.log('✓ Missing serviceId properly validated (400)');
  passed++;
}

// Test 2: Invalid serviceId format
{
  const req = { body: { serviceId: 'invalid-id' } };
  const res = mockRes();
  let nextCalled = false;
  validateCreateBooking(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 400, 'Should reject invalid serviceId format with 400');
  console.log('✓ Invalid serviceId format properly validated (400)');
  passed++;
}

// Test 3: Invalid bookingMode
{
  const req = {
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      bookingMode: 'teleport'
    }
  };
  const res = mockRes();
  validateCreateBooking(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should reject invalid bookingMode');
  console.log('✓ Invalid bookingMode properly rejected (400)');
  passed++;
}

// Test 4: Missing address
{
  const req = {
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      bookingMode: 'instant'
    }
  };
  const res = mockRes();
  validateCreateBooking(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should reject missing address');
  console.log('✓ Missing address properly rejected (400)');
  passed++;
}

// Test 5: Scheduled booking missing date and time
{
  const req = {
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      bookingMode: 'scheduled',
      address: { street: '123 Main St', city: 'Mumbai' }
    }
  };
  const res = mockRes();
  validateCreateBooking(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should reject scheduled booking missing schedule');
  console.log('✓ Scheduled booking missing date/time rejected (400)');
  passed++;
}

// Test 6: Scheduled booking with past date
{
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);
  const req = {
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      bookingMode: 'scheduled',
      address: { street: '123 Main St', city: 'Mumbai' },
      scheduledDate: pastDate.toISOString(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' }
    }
  };
  const res = mockRes();
  validateCreateBooking(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should reject past scheduled date');
  console.log('✓ Past scheduled date properly rejected (400)');
  passed++;
}

// Test 7: Valid scheduled booking
{
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 2);
  const req = {
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      bookingMode: 'scheduled',
      address: { street: '123 Main St', city: 'Mumbai', zipCode: '400001' },
      scheduledDate: futureDate.toISOString(),
      scheduledTimeSlot: { startTime: '10:00', endTime: '12:00' }
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateCreateBooking(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Valid scheduled booking should pass validation');
  console.log('✓ Valid scheduled booking payload accepted');
  passed++;
}

// Test 8: Valid instant booking without explicit schedule
{
  const req = {
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      bookingMode: 'instant',
      address: { street: '123 Main St', city: 'Mumbai' }
    }
  };
  const res = mockRes();
  let nextCalled = false;
  validateCreateBooking(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Valid instant booking should pass validation');
  console.log('✓ Valid instant booking payload accepted');
  passed++;
}

// Test 9: Cancellation reason non-string rejected
{
  const req = { body: { cancellationReason: 12345 } };
  const res = mockRes();
  validateCancelBooking(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should reject non-string cancellationReason');
  console.log('✓ Non-string cancellationReason rejected (400)');
  passed++;
}

// Test 10: Rejection reason non-string rejected
{
  const req = { body: { rejectionReason: ['invalid'] } };
  const res = mockRes();
  validateRejectBooking(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should reject non-string rejectionReason');
  console.log('✓ Non-string rejectionReason rejected (400)');
  passed++;
}

console.log(`\n--- ALL ${passed} BOOKING UNIT & VALIDATION TESTS PASSED! ---\n`);
