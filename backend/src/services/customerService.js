const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const User = require('../models/User');

/**
 * Retrieve authenticated customer's profile
 */
const getCustomerProfileByUserId = async (userId) => {
  let customer = await Customer.findOne({ user: userId })
    .populate('user', 'name email phone avatar role isActive isVerified createdAt')
    .lean();

  if (!customer) {
    // If Customer document doesn't exist yet, lazily create it
    const newCustomer = await Customer.create({ user: userId, addresses: [] });
    customer = await Customer.findById(newCustomer._id)
      .populate('user', 'name email phone avatar role isActive isVerified createdAt')
      .lean();
  }

  return customer;
};

/**
 * Update authenticated customer's permitted profile fields
 */
const updateCustomerProfileByUserId = async (userId, updateData) => {
  let customer = await Customer.findOne({ user: userId });
  if (!customer) {
    customer = await Customer.create({ user: userId, addresses: [] });
  }

  const { name, phone, avatar, defaultPaymentMethod, emergencyContact } = updateData;

  // Update Customer specific fields
  if (defaultPaymentMethod !== undefined) {
    customer.defaultPaymentMethod = defaultPaymentMethod;
  }

  if (emergencyContact !== undefined) {
    customer.emergencyContact = {
      name: emergencyContact.name ? emergencyContact.name.trim() : '',
      phone: emergencyContact.phone ? emergencyContact.phone.trim() : ''
    };
  }

  await customer.save();

  // Update User fields if name, phone, or avatar supplied
  const user = await User.findById(userId);
  let userUpdated = false;

  if (name !== undefined) {
    user.name = name.trim();
    userUpdated = true;
  }

  if (avatar !== undefined) {
    user.avatar = avatar ? avatar.trim() : null;
    userUpdated = true;
  }

  if (phone !== undefined && phone.trim() !== user.phone) {
    const existingPhone = await User.findOne({ phone: phone.trim(), _id: { $ne: userId } });
    if (existingPhone) {
      const err = new Error('An account with this phone number already exists');
      err.statusCode = 409;
      throw err;
    }
    user.phone = phone.trim();
    userUpdated = true;
  }

  if (userUpdated) {
    await user.save();
  }

  return await getCustomerProfileByUserId(userId);
};

/**
 * List saved addresses for authenticated customer
 */
const getCustomerAddressesByUserId = async (userId) => {
  let customer = await Customer.findOne({ user: userId });
  if (!customer) {
    customer = await Customer.create({ user: userId, addresses: [] });
  }
  return customer.addresses;
};

/**
 * Add a new saved address for authenticated customer
 */
const addCustomerAddressByUserId = async (userId, addressData) => {
  let customer = await Customer.findOne({ user: userId });
  if (!customer) {
    customer = await Customer.create({ user: userId, addresses: [] });
  }

  const isFirst = customer.addresses.length === 0;
  const isDefault = addressData.isDefault === true || isFirst;

  if (isDefault) {
    customer.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  const newAddress = {
    title: (addressData.title || 'Home').trim(),
    street: addressData.street.trim(),
    city: addressData.city.trim(),
    state: addressData.state ? addressData.state.trim() : '',
    zipCode: addressData.zipCode ? addressData.zipCode.trim() : '',
    isDefault
  };

  if (addressData.location && Array.isArray(addressData.location.coordinates)) {
    newAddress.location = {
      type: 'Point',
      coordinates: addressData.location.coordinates
    };
  }

  customer.addresses.push(newAddress);
  await customer.save();

  return customer.addresses;
};

/**
 * Update an existing saved address for authenticated customer
 */
const updateCustomerAddressByUserId = async (userId, addressId, addressData) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const addr = customer.addresses.id(addressId);
  if (!addr) {
    const err = new Error(`Address with ID '${addressId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (addressData.isDefault === true) {
    customer.addresses.forEach((a) => {
      a.isDefault = false;
    });
    addr.isDefault = true;
  } else if (addressData.isDefault === false && addr.isDefault) {
    // If unsetting default and other addresses exist, designate another address as default
    addr.isDefault = false;
    const another = customer.addresses.find((a) => a._id.toString() !== addressId.toString());
    if (another) {
      another.isDefault = true;
    }
  }

  if (addressData.title !== undefined) addr.title = addressData.title.trim();
  if (addressData.street !== undefined) addr.street = addressData.street.trim();
  if (addressData.city !== undefined) addr.city = addressData.city.trim();
  if (addressData.state !== undefined) addr.state = addressData.state.trim();
  if (addressData.zipCode !== undefined) addr.zipCode = addressData.zipCode.trim();

  if (addressData.location && Array.isArray(addressData.location.coordinates)) {
    addr.location = {
      type: 'Point',
      coordinates: addressData.location.coordinates
    };
  }

  await customer.save();
  return customer.addresses;
};

/**
 * Delete a saved address for authenticated customer
 */
const deleteCustomerAddressByUserId = async (userId, addressId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const addr = customer.addresses.id(addressId);
  if (!addr) {
    const err = new Error(`Address with ID '${addressId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  const wasDefault = addr.isDefault;
  customer.addresses.pull(addressId);

  // If deleted address was default and other addresses remain, designate the first remaining address as default
  if (wasDefault && customer.addresses.length > 0) {
    const hasDefault = customer.addresses.some((a) => a.isDefault);
    if (!hasDefault) {
      customer.addresses[0].isDefault = true;
    }
  }

  await customer.save();
  return customer.addresses;
};

/**
 * Set an address as the default address
 */
const setDefaultCustomerAddressByUserId = async (userId, addressId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const targetAddr = customer.addresses.id(addressId);
  if (!targetAddr) {
    const err = new Error(`Address with ID '${addressId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  customer.addresses.forEach((a) => {
    a.isDefault = a._id.toString() === addressId.toString();
  });

  await customer.save();
  return customer.addresses;
};

/**
 * =========================================================
 * ADMINISTRATIVE CUSTOMER MANAGEMENT METHODS
 * =========================================================
 */

/**
 * List registered customers with search, status filter, and pagination
 */
const getAdminCustomers = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  // 1. Build User query for customers
  const userFilter = { role: 'customer' };

  if (query.status && query.status !== 'all') {
    if (query.status === 'active') {
      userFilter.isActive = true;
      userFilter.isDeleted = { $ne: true };
    } else if (query.status === 'inactive' || query.status === 'suspended') {
      userFilter.isActive = false;
      userFilter.isDeleted = { $ne: true };
    } else if (query.status === 'deleted') {
      userFilter.isDeleted = true;
    }
  } else {
    // Default 'all' view shows all non-deleted customers
    userFilter.isDeleted = { $ne: true };
  }

  if (query.search && query.search.trim()) {
    const rawSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(rawSearch, 'i');
    userFilter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(userFilter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(userFilter)
  ]);

  if (users.length === 0) {
    return {
      customers: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 1
      }
    };
  }

  const userIds = users.map((u) => u._id);

  // 2. Load linked Customer profiles
  const customerProfiles = await Customer.find({ user: { $in: userIds } }).lean();
  const profileMap = new Map();
  customerProfiles.forEach((p) => {
    profileMap.set(p.user.toString(), p);
  });

  // 3. Load booking counts for each customer profile
  const Booking = require('../models/Booking');
  const customerProfileIds = customerProfiles.map((p) => p._id);
  const bookingCounts = await Booking.aggregate([
    { $match: { customer: { $in: customerProfileIds } } },
    { $group: { _id: '$customer', count: { $sum: 1 } } }
  ]);
  const bookingCountMap = new Map();
  bookingCounts.forEach((b) => {
    bookingCountMap.set(b._id.toString(), b.count);
  });

  // 4. Merge results
  const customers = users.map((u) => {
    const profile = profileMap.get(u._id.toString()) || null;
    const totalBookings = profile ? bookingCountMap.get(profile._id.toString()) || 0 : 0;
    return {
      _id: profile ? profile._id : u._id,
      userId: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      avatar: u.avatar,
      role: u.role,
      isActive: u.isActive,
      isVerified: u.isVerified,
      isDeleted: u.isDeleted || false,
      deletedAt: u.deletedAt || null,
      createdAt: u.createdAt,
      totalBookings,
      addressesCount: profile?.addresses ? profile.addresses.length : 0,
      defaultPaymentMethod: profile?.defaultPaymentMethod || 'cash'
    };
  });

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Safe Admin Delete / Deactivation of Customer Account
 * Preserves financial transaction integrity and legal booking history.
 */
const deleteCustomerByAdmin = async (identifier, adminUserId) => {
  // 1. Resolve Customer or User
  let user = null;
  let customer = null;

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    // Check if identifier is Customer._id
    customer = await Customer.findById(identifier);
    if (customer) {
      user = await User.findById(customer.user);
    } else {
      // Check if identifier is User._id
      user = await User.findById(identifier);
      if (user && user.role === 'customer') {
        customer = await Customer.findOne({ user: user._id });
      }
    }
  }

  if (!user || user.role !== 'customer') {
    const err = new Error(`Customer not found with ID '${identifier}'`);
    err.statusCode = 404;
    throw err;
  }

  // Guard: Cannot delete administrator
  if (user.role === 'admin') {
    const err = new Error('Cannot delete an administrator account');
    err.statusCode = 403;
    throw err;
  }

  // Guard: Self deletion protection
  if (adminUserId && user._id.toString() === adminUserId.toString()) {
    const err = new Error('Administrators cannot delete their own authenticated account');
    err.statusCode = 403;
    throw err;
  }

  // 2. Perform safe deactivation and persist deletion flags
  const now = new Date();
  user.isActive = false;
  user.isDeleted = true;
  user.deletedAt = now;
  const userSaveResult = await user.save();

  let customerSaveResult = null;
  if (customer) {
    customer.isDeleted = true;
    customer.deletedAt = now;
    customerSaveResult = await customer.save();
  }

  // Cancel any active / pending bookings to avoid orphaned active dispatches
  const Booking = require('../models/Booking');
  let cancelledBookingsCount = 0;
  if (customer) {
    const cancelResult = await Booking.updateMany(
      { customer: customer._id, status: { $in: ['pending', 'accepted'] } },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: 'admin',
          cancellationReason: 'Account terminated by platform administrator'
        }
      }
    );
    cancelledBookingsCount = cancelResult.modifiedCount || 0;
  }

  // Safe diagnostics log (no secrets or sensitive PII)
  console.log(
    `[ADMIN DELETE] Resource: Customer | TargetID: ${identifier} | UserID: ${user._id} | isDeleted: true | CancelledBookings: ${cancelledBookingsCount} | AdminID: ${adminUserId || 'system'}`
  );

  return {
    success: true,
    deleted: true,
    deletedId: customer ? customer._id : user._id,
    userId: user._id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    isDeleted: user.isDeleted,
    deletedAt: user.deletedAt
  };
};

module.exports = {
  getCustomerProfileByUserId,
  updateCustomerProfileByUserId,
  getCustomerAddressesByUserId,
  addCustomerAddressByUserId,
  updateCustomerAddressByUserId,
  deleteCustomerAddressByUserId,
  setDefaultCustomerAddressByUserId,
  getAdminCustomers,
  deleteCustomerByAdmin
};
