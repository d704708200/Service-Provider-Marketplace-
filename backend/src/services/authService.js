const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const { generateToken } = require('../utils/jwt');

const SALT_ROUNDS = 10;

/**
 * Hash password securely
 */
const hashPassword = async (plaintextPassword) => {
  return await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
};

/**
 * Compare plaintext password with hashed password safely
 */
const comparePassword = async (plaintextPassword, hashedPassword) => {
  return await bcrypt.compare(plaintextPassword, hashedPassword);
};

/**
 * Format user and profile objects safely without returning password hash
 */
const formatSafeUser = (user, profile = null) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.__v;

  const result = { user: userObj };
  if (profile) {
    const profileObj = profile.toObject ? profile.toObject() : { ...profile };
    delete profileObj.__v;
    result.profile = profileObj;
  }
  return result;
};

/**
 * Check if session / replica set transactions are supported by MongoDB
 */
const canUseTransactions = () => {
  // If mongoose is connected and replica set is active
  const client = mongoose.connection.getClient ? mongoose.connection.getClient() : null;
  return Boolean(client && client.topology && client.topology.description && client.topology.description.type !== 'Single');
};

/**
 * Register Customer:
 * Creates User (role='customer') and Customer profile consistently.
 * Uses MongoDB transactions if replica set is available, or compensating rollback if standalone.
 */
const registerCustomer = async ({ name, email, phone, password, address, defaultPaymentMethod }) => {
  // Check for duplicate email or phone before proceeding
  const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
  if (existingEmail) {
    const err = new Error('An account with this email address already exists');
    err.statusCode = 409;
    throw err;
  }

  const existingPhone = await User.findOne({ phone: phone.trim() });
  if (existingPhone) {
    const err = new Error('An account with this phone number already exists');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await hashPassword(password);
  let session = null;
  let useTx = false;

  try {
    if (mongoose.connection.readyState === 1 && canUseTransactions()) {
      session = await mongoose.startSession();
      session.startTransaction();
      useTx = true;
    }
  } catch (sessErr) {
    useTx = false;
  }

  let createdUser = null;
  let createdCustomer = null;

  try {
    const sessionOption = useTx ? { session } : {};

    // 1. Create User
    const [user] = await User.create(
      [
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: hashedPassword,
          role: 'customer'
        }
      ],
      sessionOption
    );
    createdUser = user;

    // 2. Build Customer Profile
    const customerData = {
      user: user._id,
      addresses: [],
      defaultPaymentMethod: defaultPaymentMethod || 'cash'
    };

    if (address && address.street && address.city) {
      customerData.addresses.push({
        title: address.title || 'Home',
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state ? address.state.trim() : '',
        zipCode: address.zipCode ? address.zipCode.trim() : '',
        location: address.location || { type: 'Point', coordinates: [0, 0] },
        isDefault: true
      });
    }

    const [customer] = await Customer.create([customerData], sessionOption);
    createdCustomer = customer;

    if (useTx && session) {
      await session.commitTransaction();
      session.endSession();
    }

    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    return {
      token,
      ...formatSafeUser(user, customer)
    };
  } catch (error) {
    if (useTx && session) {
      await session.abortTransaction();
      session.endSession();
    } else if (createdUser && !createdCustomer) {
      // Compensating rollback for standalone MongoDB
      try {
        await User.findByIdAndDelete(createdUser._id);
      } catch (cleanupErr) {
        console.error('Compensating rollback failed for created user:', cleanupErr);
      }
    }
    throw error;
  }
};

/**
 * Register Provider:
 * Creates User (role='provider') and Provider profile consistently.
 * Provider verificationStatus is set to 'pending' as required.
 */
const registerProvider = async ({ name, email, phone, password, businessName, bio, experienceYears }) => {
  const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
  if (existingEmail) {
    const err = new Error('An account with this email address already exists');
    err.statusCode = 409;
    throw err;
  }

  const existingPhone = await User.findOne({ phone: phone.trim() });
  if (existingPhone) {
    const err = new Error('An account with this phone number already exists');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await hashPassword(password);
  let session = null;
  let useTx = false;

  try {
    if (mongoose.connection.readyState === 1 && canUseTransactions()) {
      session = await mongoose.startSession();
      session.startTransaction();
      useTx = true;
    }
  } catch (sessErr) {
    useTx = false;
  }

  let createdUser = null;
  let createdProvider = null;

  try {
    const sessionOption = useTx ? { session } : {};

    // 1. Create User
    const [user] = await User.create(
      [
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: hashedPassword,
          role: 'provider'
        }
      ],
      sessionOption
    );
    createdUser = user;

    // 2. Create Provider Profile (Always pending admin verification)
    const [provider] = await Provider.create(
      [
        {
          user: user._id,
          businessName: businessName ? businessName.trim() : '',
          bio: bio ? bio.trim() : '',
          experienceYears: experienceYears || 0,
          verificationStatus: 'pending',
          isAvailable: true
        }
      ],
      sessionOption
    );
    createdProvider = provider;

    if (useTx && session) {
      await session.commitTransaction();
      session.endSession();
    }

    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    return {
      token,
      ...formatSafeUser(user, provider)
    };
  } catch (error) {
    if (useTx && session) {
      await session.abortTransaction();
      session.endSession();
    } else if (createdUser && !createdProvider) {
      try {
        await User.findByIdAndDelete(createdUser._id);
      } catch (cleanupErr) {
        console.error('Compensating rollback failed for created user:', cleanupErr);
      }
    }
    throw error;
  }
};

/**
 * Customer Login:
 * Authenticates user, checks password, role === 'customer', returns token and profile.
 */
const loginCustomer = async ({ email, password }) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (user.role !== 'customer') {
    const err = new Error('Access denied: Account is not registered as a customer');
    err.statusCode = 403;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account suspended or deactivated: Please contact support');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const customer = await Customer.findOne({ user: user._id });
  const token = generateToken({
    userId: user._id,
    email: user.email,
    role: user.role
  });

  return {
    token,
    ...formatSafeUser(user, customer)
  };
};

/**
 * Provider Login:
 * Authenticates user, checks password, role === 'provider', returns token and profile.
 */
const loginProvider = async ({ email, password }) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (user.role !== 'provider') {
    const err = new Error('Access denied: Account is not registered as a service provider');
    err.statusCode = 403;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account suspended or deactivated: Please contact support');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const provider = await Provider.findOne({ user: user._id });
  const token = generateToken({
    userId: user._id,
    email: user.email,
    role: user.role
  });

  return {
    token,
    ...formatSafeUser(user, provider)
  };
};

/**
 * Admin Login:
 * Authenticates user, checks password, role === 'admin', and checks existence of Admin profile.
 */
const loginAdmin = async ({ email, password }) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    const err = new Error('Invalid administrator credentials');
    err.statusCode = 401;
    throw err;
  }

  if (user.role !== 'admin') {
    const err = new Error('Access denied: Unauthorized role for administrative portal');
    err.statusCode = 403;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Administrator account is deactivated');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    const err = new Error('Invalid administrator credentials');
    err.statusCode = 401;
    throw err;
  }

  const adminProfile = await Admin.findOne({ user: user._id });
  if (!adminProfile) {
    const err = new Error('Administrator configuration incomplete: No associated Admin profile record');
    err.statusCode = 403;
    throw err;
  }

  const token = generateToken({
    userId: user._id,
    email: user.email,
    role: user.role
  });

  return {
    token,
    ...formatSafeUser(user, adminProfile)
  };
};

/**
 * Get Current User Profile:
 * Retrieves user profile according to user.role.
 */
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const err = new Error('User account not found');
    err.statusCode = 404;
    throw err;
  }

  let profile = null;
  if (user.role === 'customer') {
    profile = await Customer.findOne({ user: user._id });
  } else if (user.role === 'provider') {
    profile = await Provider.findOne({ user: user._id });
  } else if (user.role === 'admin') {
    profile = await Admin.findOne({ user: user._id });
  }

  return formatSafeUser(user, profile);
};

module.exports = {
  hashPassword,
  comparePassword,
  formatSafeUser,
  registerCustomer,
  loginCustomer,
  registerProvider,
  loginProvider,
  loginAdmin,
  getCurrentUser
};
