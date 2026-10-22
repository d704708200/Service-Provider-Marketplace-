const mongoose = require('mongoose');
require('dotenv').config();

const providerService = require('./src/services/providerService');
const bookingService = require('./src/services/bookingService');
const Provider = require('./src/models/Provider');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const Booking = require('./src/models/Booking');
const Customer = require('./src/models/Customer');
const User = require('./src/models/User');

async function runTestSuite() {
  console.log('=== RUNNING CATEGORY-WISE WORKER LISTING & BUSY-WORKER ALTERNATIVE TEST SUITE ===');
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // ----------------------------------------------------
    // TEST 1: Category with multiple providers lists ALL and ONLY matching providers
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Exact category-wise provider listing ---');
    const carpenterCategory = await Category.findOne({
      $or: [{ name: 'CARPENTER' }, { slug: 'carpenter' }]
    }).lean();

    if (!carpenterCategory) {
      throw new Error('CARPENTER category not found in DB');
    }
    console.log(`Found CARPENTER category ID: ${carpenterCategory._id}`);

    const carpenterProviders = await providerService.getPublicProviders({
      category: carpenterCategory._id.toString()
    });

    console.log(`Returned ${carpenterProviders.length} providers for CARPENTER category:`);
    carpenterProviders.forEach((p) => {
      console.log(`  - ${p.businessName} (ID: ${p._id}, categories: ${p.categories.map((c) => c.name || c).join(', ')})`);
    });

    const onlyCarpenters = carpenterProviders.every((p) =>
      p.categories.some((c) => (c._id || c).toString() === carpenterCategory._id.toString())
    );
    console.log('Assertion [All returned providers have CARPENTER category]:', onlyCarpenters ? 'PASSED' : 'FAILED');
    if (!onlyCarpenters) throw new Error('Providers from unrelated categories appeared in category search!');

    // Check electrician providers to ensure separation
    const electricianCategory = await Category.findOne({
      $or: [{ name: 'Electrician' }, { slug: 'electrician' }]
    }).lean();

    const electricianProviders = await providerService.getPublicProviders({
      category: electricianCategory._id.toString()
    });
    console.log(`Returned ${electricianProviders.length} providers for Electrician category.`);

    const noCrossPollution = !carpenterProviders.some((cp) =>
      electricianProviders.some((ep) => ep._id.toString() === cp._id.toString())
    );
    console.log('Assertion [Zero overlap between Carpenter and Electrician providers]:', noCrossPollution ? 'PASSED' : 'FAILED');
    if (!noCrossPollution) throw new Error('Overlap detected between distinct categories!');

    // ----------------------------------------------------
    // TEST 2: Setup test providers in same category to verify busy detection & alternative worker suggestions
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Busy worker detection & same-category alternatives ---');
    const testCatId = carpenterCategory._id;

    // Pick two carpenter providers from DB or create two test carpenter providers
    const testUserA = await User.create({
      name: 'Test Carpenter A',
      email: `test.carpenter.a.${Date.now()}@example.com`,
      phone: `99${Date.now().toString().slice(-8)}`,
      password: 'hashedpassword123',
      role: 'provider'
    });
    const providerA = await Provider.create({
      user: testUserA._id,
      businessName: 'Ace Carpentry Studio',
      categories: [testCatId],
      verificationStatus: 'verified',
      isAvailable: true
    });

    const testUserB = await User.create({
      name: 'Test Carpenter B',
      email: `test.carpenter.b.${Date.now()}@example.com`,
      phone: `98${Date.now().toString().slice(-8)}`,
      password: 'hashedpassword123',
      role: 'provider'
    });
    const providerB = await Provider.create({
      user: testUserB._id,
      businessName: 'Birchwood Furniture Craft',
      categories: [testCatId],
      verificationStatus: 'verified',
      isAvailable: true
    });

    // Create a customer to book
    const custUser = await User.create({
      name: 'Customer Test',
      email: `cust.test.${Date.now()}@example.com`,
      phone: `97${Date.now().toString().slice(-8)}`,
      password: 'hashedpassword123',
      role: 'customer'
    });
    const customer = await Customer.create({
      user: custUser._id,
      addresses: [{ street: '123 Main St', city: 'Test City', zipCode: '123456' }]
    });

    // Create a service under CARPENTER
    const carpenterService = await Service.create({
      name: 'Custom Woodwork Repair',
      category: testCatId,
      price: 450,
      estimatedDurationMinutes: 60,
      isActive: true
    });

    const testDate = '2026-10-30';
    const testSlot = { startTime: '11:00', endTime: '13:00' };

    // Initially both providers should be available
    const initAvailA = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: testSlot.startTime,
      endTime: testSlot.endTime
    });
    console.log('Provider A initial availability:', initAvailA.status);
    if (!initAvailA.isAvailable) throw new Error('Expected Provider A to be initially available');

    // Create a booking for Provider A in this slot
    const bookingA = await Booking.create({
      bookingReference: `BK-TEST-${Date.now()}`,
      customer: customer._id,
      provider: providerA._id,
      service: carpenterService._id,
      bookingMode: 'scheduled',
      status: 'accepted',
      scheduledDate: new Date(testDate),
      scheduledTimeSlot: testSlot,
      address: { street: '123 Main St', city: 'Test City' },
      pricing: { basePrice: 450, totalAmount: 450 }
    });

    console.log(`Created conflicting booking for Provider A: ref ${bookingA.bookingReference}`);

    // Check availability of Provider A now for the same slot
    const busyAvailA = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: testSlot.startTime,
      endTime: testSlot.endTime
    });

    console.log('Provider A status at conflicting slot:', busyAvailA.status);
    console.log('Provider A busy reason:', busyAvailA.reason);
    console.log(`Provider A alternatives count: ${busyAvailA.alternativeProviders.length}`);

    const isMarkedBusy = !busyAvailA.isAvailable && busyAvailA.status === 'busy';
    console.log('Assertion [Provider with conflicting booking is detected as busy]:', isMarkedBusy ? 'PASSED' : 'FAILED');
    if (!isMarkedBusy) throw new Error('Conflicting provider was not detected as busy!');

    // Check that alternative suggestions contain Provider B (same category) and NOT electricians
    const suggestedProviderB = busyAvailA.alternativeProviders.some(
      (alt) => alt._id.toString() === providerB._id.toString()
    );
    console.log('Assertion [Alternative suggestions include same-category Provider B]:', suggestedProviderB ? 'PASSED' : 'FAILED');
    if (!suggestedProviderB) throw new Error('Available same-category provider was not suggested!');

    const allAlternativesInSameCat = busyAvailA.alternativeProviders.every((alt) =>
      alt.categories.some((c) => (c._id || c).toString() === testCatId.toString())
    );
    console.log('Assertion [All alternatives belong strictly to CARPENTER category]:', allAlternativesInSameCat ? 'PASSED' : 'FAILED');
    if (!allAlternativesInSameCat) throw new Error('Unrelated category providers appeared in alternatives!');

    // ----------------------------------------------------
    // TEST 3: Provider booked at a different time remains available
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Provider booked at a different time remains available ---');
    const differentSlotAvailA = await providerService.getProviderSlotAvailability({
      providerId: providerA._id.toString(),
      date: testDate,
      startTime: '14:00',
      endTime: '16:00'
    });

    console.log('Provider A status at different time (14:00 - 16:00):', differentSlotAvailA.status);
    const availableAtDifferentTime = differentSlotAvailA.isAvailable;
    console.log('Assertion [Provider remains available at non-overlapping time]:', availableAtDifferentTime ? 'PASSED' : 'FAILED');
    if (!availableAtDifferentTime) throw new Error('Provider incorrectly marked busy for non-overlapping time!');

    // ----------------------------------------------------
    // TEST 4: Backend rejects booking creation if slot conflicts with existing booking
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Backend booking creation rejects overlapping slot ---');
    let rejectedAsConflict = false;
    try {
      await bookingService.createBooking(custUser._id.toString(), {
        providerId: providerA._id.toString(),
        serviceId: carpenterService._id.toString(),
        bookingMode: 'scheduled',
        scheduledDate: testDate,
        scheduledTimeSlot: testSlot,
        address: { street: '123 Main St', city: 'Test City' }
      });
    } catch (err) {
      console.log('Backend rejection error message:', err.message);
      if (err.statusCode === 409 || err.message.includes('already booked')) {
        rejectedAsConflict = true;
      }
    }
    console.log('Assertion [Backend rejects booking overlapping slot]:', rejectedAsConflict ? 'PASSED' : 'FAILED');
    if (!rejectedAsConflict) throw new Error('Backend permitted overlapping confirmed booking!');

    // ----------------------------------------------------
    // TEST 5: Cleanup temporary test records
    // ----------------------------------------------------
    console.log('\n--- Cleaning up temporary test data ---');
    await Booking.deleteMany({ customer: customer._id });
    await Service.deleteOne({ _id: carpenterService._id });
    await Provider.deleteMany({ _id: { $in: [providerA._id, providerB._id] } });
    await Customer.deleteOne({ _id: customer._id });
    await User.deleteMany({ _id: { $in: [testUserA._id, testUserB._id, custUser._id] } });

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
