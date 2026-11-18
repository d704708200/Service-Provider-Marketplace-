const dotenv = require('dotenv');
dotenv.config();

const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Customer = require('./src/models/Customer');
const Provider = require('./src/models/Provider');
const Category = require('./src/models/Category');
const Service = require('./src/models/Service');
const Booking = require('./src/models/Booking');
const { generateToken } = require('./src/utils/jwt');
const app = require('./src/app');

const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let server;
let baseUrl;
let customerUser;
let customerProfile;
let providerUsers = [];
let providerProfiles = [];
let category;
let service;

const request = (method, path, token, body) =>
  new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

const createBooking = (bookingMode, provider = null) => {
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 10);

  return Booking.create({
    bookingReference: `CONTACT-${bookingMode}-${uniqueId}-${Math.random().toString(36).slice(2, 7)}`,
    customer: customerProfile._id,
    provider,
    candidateProviders: provider ? [] : providerProfiles.map((item) => item._id),
    service: service._id,
    category: category._id,
    bookingMode,
    status: 'pending',
    ...(bookingMode === 'scheduled'
      ? {
          scheduledDate,
          scheduledTimeSlot: { startTime: '15:00', endTime: '17:00' }
        }
      : {}),
    address: { street: '1 Test Street', city: 'Test City' },
    pricing: { basePrice: 500, totalAmount: 500 }
  });
};

async function setup() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to run provider contact visibility tests');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  customerUser = await User.create({
    name: `Contact Customer ${uniqueId}`,
    email: `contact-customer-${uniqueId}@example.com`,
    phone: `91${String(Date.now()).slice(-8)}`,
    password: 'Password123',
    role: 'customer'
  });
  customerProfile = await Customer.create({ user: customerUser._id });

  category = await Category.create({
    name: `Contact Category ${uniqueId}`,
    slug: `contact-category-${uniqueId}`,
    isActive: true
  });
  service = await Service.create({
    name: `Contact Service ${uniqueId}`,
    category: category._id,
    price: 500,
    priceType: 'fixed',
    estimatedDurationMinutes: 60,
    isActive: true
  });

  for (let index = 0; index < 2; index += 1) {
    const user = await User.create({
      name: `Contact Provider ${index + 1} ${uniqueId}`,
      email: `contact-provider-${index + 1}-${uniqueId}@example.com`,
      phone: `${92 + index}${String(Date.now()).slice(-8)}`,
      password: 'Password123',
      role: 'provider'
    });
    providerUsers.push(user);
    providerProfiles.push(await Provider.create({
      user: user._id,
      businessName: `Contact Provider ${index + 1}`,
      acceptedTermsVersion: '2026-11-17',
      acceptedTermsAt: new Date(),
      categories: [category._id],
      verificationStatus: 'verified',
      isAvailable: true
    }));
  }

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
}

async function teardown() {
  if (customerProfile) await Booking.deleteMany({ customer: customerProfile._id });
  if (service) await Service.deleteOne({ _id: service._id });
  if (category) await Category.deleteOne({ _id: category._id });
  if (providerProfiles.length) {
    await Provider.deleteMany({ _id: { $in: providerProfiles.map((item) => item._id) } });
  }
  if (customerProfile) await Customer.deleteOne({ _id: customerProfile._id });
  const userIds = [...providerUsers.map((item) => item._id), customerUser?._id].filter(Boolean);
  if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
}

async function run() {
  try {
    await setup();
    const providerTokens = providerUsers.map((user) =>
      generateToken({ userId: user._id, email: user.email, role: 'provider' })
    );

    const instantBooking = await createBooking('instant');
    const pendingRequests = await request('GET', '/bookings/provider/requests', providerTokens[0]);
    const pendingInstant = pendingRequests.body.data.find(
      (booking) => booking._id === instantBooking._id.toString()
    );
    assert.ok(pendingInstant, 'Provider should receive the pending instant booking');
    assert.strictEqual(pendingInstant.customer.user.phone, undefined);

    const otherPendingRequests = await request(
      'GET',
      '/bookings/provider/requests',
      providerTokens[1]
    );
    const otherPendingInstant = otherPendingRequests.body.data.find(
      (booking) => booking._id === instantBooking._id.toString()
    );
    assert.ok(otherPendingInstant, 'Other eligible provider should receive the pending instant booking');
    assert.strictEqual(otherPendingInstant.customer.user.phone, undefined);

    const pendingInstantDetail = await request(
      'GET',
      `/bookings/provider/${instantBooking._id}`,
      providerTokens[0]
    );
    assert.strictEqual(pendingInstantDetail.status, 200);
    assert.strictEqual(pendingInstantDetail.body.data.customer.user.phone, undefined);

    const otherPendingDetail = await request(
      'GET',
      `/bookings/provider/${instantBooking._id}`,
      providerTokens[1]
    );
    assert.strictEqual(otherPendingDetail.status, 200);
    assert.strictEqual(otherPendingDetail.body.data.customer.user.phone, undefined);

    const instantAccept = await request(
      'PATCH',
      `/bookings/provider/${instantBooking._id}/accept`,
      providerTokens[0],
      {}
    );
    assert.strictEqual(instantAccept.status, 200);
    assert.strictEqual(instantAccept.body.data.status, 'accepted');
    assert.strictEqual(instantAccept.body.data.customer.user.phone, customerUser.phone);

    const providerHistory = await request(
      'GET',
      '/bookings/provider/history',
      providerTokens[0]
    );
    const acceptedInstantHistory = providerHistory.body.data.find(
      (booking) => booking._id === instantBooking._id.toString()
    );
    assert.ok(acceptedInstantHistory, 'Assigned provider history should include the accepted booking');
    assert.strictEqual(acceptedInstantHistory.customer.user.phone, undefined);

    const competingAccept = await request(
      'PATCH',
      `/bookings/provider/${instantBooking._id}/accept`,
      providerTokens[1],
      {}
    );
    assert.strictEqual(competingAccept.status, 409);
    assert.strictEqual(competingAccept.body.data, undefined);

    const otherAssignedDetail = await request(
      'GET',
      `/bookings/provider/${instantBooking._id}`,
      providerTokens[1]
    );
    assert.strictEqual(otherAssignedDetail.status, 403);

    await Booking.updateOne(
      { _id: instantBooking._id },
      { $set: { provider: providerProfiles[1]._id } }
    );
    const reassignedOldProviderDetail = await request(
      'GET',
      `/bookings/provider/${instantBooking._id}`,
      providerTokens[0]
    );
    assert.strictEqual(reassignedOldProviderDetail.status, 403);
    const reassignedProviderDetail = await request(
      'GET',
      `/bookings/provider/${instantBooking._id}`,
      providerTokens[1]
    );
    assert.strictEqual(reassignedProviderDetail.body.data.customer.user.phone, customerUser.phone);

    const scheduledBooking = await createBooking('scheduled', providerProfiles[0]._id);
    const pendingScheduledDetail = await request(
      'GET',
      `/bookings/provider/${scheduledBooking._id}`,
      providerTokens[0]
    );
    assert.strictEqual(pendingScheduledDetail.status, 200);
    assert.strictEqual(pendingScheduledDetail.body.data.customer.user.phone, undefined);

    const unauthorizedScheduledDetail = await request(
      'GET',
      `/bookings/provider/${scheduledBooking._id}`,
      providerTokens[1]
    );
    assert.strictEqual(unauthorizedScheduledDetail.status, 403);

    const scheduledAccept = await request(
      'PATCH',
      `/bookings/provider/${scheduledBooking._id}/accept`,
      providerTokens[0],
      {}
    );
    assert.strictEqual(scheduledAccept.status, 200);
    assert.strictEqual(scheduledAccept.body.data.customer.user.phone, customerUser.phone);

    await Booking.updateOne(
      { _id: scheduledBooking._id },
      { $set: { status: 'cancelled', 'statusTimestamps.cancelledAt': new Date() } }
    );
    const cancelledScheduledDetail = await request(
      'GET',
      `/bookings/provider/${scheduledBooking._id}`,
      providerTokens[0]
    );
    assert.strictEqual(cancelledScheduledDetail.status, 200);
    assert.strictEqual(cancelledScheduledDetail.body.data.customer.user.phone, undefined);

    console.log('Provider contact visibility tests passed for instant and scheduled bookings.');
  } finally {
    await teardown();
  }
}

run().catch((error) => {
  console.error('Provider contact visibility tests failed:', error);
  process.exitCode = 1;
});
