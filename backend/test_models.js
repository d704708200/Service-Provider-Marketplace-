const assert = require('assert');
const mongoose = require('mongoose');
const {
  User,
  Customer,
  Provider,
  Category,
  Service,
  ServiceArea,
  Availability,
  Booking,
  Review,
  Notification,
  Admin
} = require('./src/models');

console.log('--- Running Schema & Model Unit Tests ---');

// Test 1: User Validation
const userValid = new User({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  password: 'hashed_password_123',
  role: 'customer'
});
const userErr = userValid.validateSync();
assert.strictEqual(userErr, undefined, 'Valid user should not produce validation errors');
console.log('✓ User model validation passed');

// Test User Invalid Email
const userBadEmail = new User({
  name: 'John Doe',
  email: 'invalid-email',
  phone: '+1234567890',
  password: 'pass',
  role: 'invalid_role'
});
const badEmailErr = userBadEmail.validateSync();
assert.ok(badEmailErr.errors.email, 'Should catch invalid email');
assert.ok(badEmailErr.errors.role, 'Should catch invalid role');
console.log('✓ User model negative validation passed');

// Test 2: Category
const category = new Category({
  name: 'Plumbing',
  slug: 'plumbing',
  description: 'Water pipe repair and installation'
});
assert.strictEqual(category.validateSync(), undefined);
console.log('✓ Category model validation passed');

// Test 3: Service
const service = new Service({
  name: 'Pipe Leak Repair',
  category: new mongoose.Types.ObjectId(),
  price: 50,
  priceType: 'fixed',
  estimatedDurationMinutes: 60
});
assert.strictEqual(service.validateSync(), undefined);
console.log('✓ Service model validation passed');

// Test 4: Customer
const customer = new Customer({
  user: new mongoose.Types.ObjectId(),
  addresses: [{
    street: '123 Main St',
    city: 'Springfield',
    location: { type: 'Point', coordinates: [-73.935242, 40.73061] }
  }]
});
assert.strictEqual(customer.validateSync(), undefined);
console.log('✓ Customer model validation passed');

// Test 5: Provider
const provider = new Provider({
  user: new mongoose.Types.ObjectId(),
  businessName: 'Ace Plumbing Co',
  categories: [new mongoose.Types.ObjectId()],
  experienceYears: 5
});
assert.strictEqual(provider.validateSync(), undefined);
console.log('✓ Provider model validation passed');

// Test 6: ServiceArea
const serviceArea = new ServiceArea({
  name: 'Downtown Springfield',
  city: 'Springfield',
  zipCodes: ['12345', '12346']
});
assert.strictEqual(serviceArea.validateSync(), undefined);
console.log('✓ ServiceArea model validation passed');

// Test 7: Availability
const availability = new Availability({
  provider: new mongoose.Types.ObjectId(),
  dayOfWeek: 1,
  slots: [{ startTime: '09:00', endTime: '12:00', maxBookings: 2 }]
});
assert.strictEqual(availability.validateSync(), undefined);
console.log('✓ Availability model validation passed');

// Test 8: Booking
const booking = new Booking({
  bookingReference: 'BK-2026-0001',
  customer: new mongoose.Types.ObjectId(),
  service: new mongoose.Types.ObjectId(),
  scheduledDate: new Date(),
  scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
  address: { street: '456 Oak Rd', city: 'Springfield' },
  pricing: { basePrice: 100, totalAmount: 100 }
});
assert.strictEqual(booking.validateSync(), undefined);
console.log('✓ Booking model validation passed');

// Test 9: Review
const review = new Review({
  booking: new mongoose.Types.ObjectId(),
  customer: new mongoose.Types.ObjectId(),
  provider: new mongoose.Types.ObjectId(),
  service: new mongoose.Types.ObjectId(),
  rating: 5,
  comment: 'Excellent plumbing work!'
});
assert.strictEqual(review.validateSync(), undefined);
console.log('✓ Review model validation passed');

// Test 10: Notification
const notification = new Notification({
  recipient: new mongoose.Types.ObjectId(),
  title: 'Booking Confirmed',
  message: 'Your booking has been received.',
  type: 'booking'
});
assert.strictEqual(notification.validateSync(), undefined);
console.log('✓ Notification model validation passed');

// Test 11: Admin
const admin = new Admin({
  user: new mongoose.Types.ObjectId(),
  permissions: ['super_admin']
});
assert.strictEqual(admin.validateSync(), undefined);
console.log('✓ Admin model validation passed');

console.log('--- ALL 11 MODEL TESTS PASSED SUCCESSFULLY! ---');
