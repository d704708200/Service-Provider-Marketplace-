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
    customer.addresses[0].isDefault = true;
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

module.exports = {
  getCustomerProfileByUserId,
  updateCustomerProfileByUserId,
  getCustomerAddressesByUserId,
  addCustomerAddressByUserId,
  updateCustomerAddressByUserId,
  deleteCustomerAddressByUserId,
  setDefaultCustomerAddressByUserId
};
