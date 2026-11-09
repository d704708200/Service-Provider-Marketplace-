const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const emailService = require('./emailService');
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
const registerProvider = async ({ name, email, phone, password, businessName, bio, experienceYears, categories }) => {
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

  // Validate categories: ensure at least one active category is selected
  const Category = require('../models/Category');
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    const err = new Error('At least one service category is required for provider registration');
    err.statusCode = 400;
    throw err;
  }

  // Deduplicate category IDs
  const uniqueCategoryIds = [...new Set(categories.map((c) => c.toString()))];
  const activeCategories = await Category.find({
    _id: { $in: uniqueCategoryIds },
    isActive: true
  });

  if (activeCategories.length !== uniqueCategoryIds.length) {
    const err = new Error('One or more selected categories are invalid, inactive, or do not exist');
    err.statusCode = 400;
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
          categories: activeCategories.map((cat) => cat._id),
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

/**
 * Request Password Reset (Forgot Password)
 * Generates single-use 15-min token, hashes with SHA-256 before saving to DB,
 * and sends email via emailService.
 * Returns identical generic response to prevent user enumeration.
 */
const forgotPassword = async ({ email, origin }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
    const err = new Error('A valid email address is required');
    err.statusCode = 400;
    throw err;
  }

  const genericResponse = {
    success: true,
    message: 'If an account exists with this email address, a password reset link has been sent.'
  };

  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: { $ne: true }
  }).select('+passwordResetToken +passwordResetExpires +passwordResetLastRequestedAt');

  if (!user) {
    // Prevent user enumeration
    return genericResponse;
  }

  // Rate-limiting / resend protection (60 second cooldown)
  const now = Date.now();
  if (user.passwordResetLastRequestedAt && (now - new Date(user.passwordResetLastRequestedAt).getTime()) < 60 * 1000) {
    // Suppress email within cooldown, return same generic response
    return genericResponse;
  }

  // Generate 32-byte cryptographic random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Token expires in 15 minutes
  const expiresInMs = 15 * 60 * 1000;
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(now + expiresInMs);
  user.passwordResetLastRequestedAt = new Date(now);

  await user.save({ validateModifiedOnly: true });

  // Determine reset URL:
  const baseUrl = process.env.RESET_PASSWORD_BASE_URL || origin || `http://localhost:${process.env.PORT || 5000}`;
  const resetUrl = baseUrl.includes('/reset-password')
    ? `${baseUrl}?token=${rawToken}`
    : `${baseUrl}/api/auth/reset-password?token=${rawToken}`;

  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: 15
    });
  } catch (emailErr) {
    console.error('[AUTH SERVICE] Error sending reset email:', emailErr.message);
  }

  return {
    ...genericResponse,
    ...(process.env.NODE_ENV === 'test' ? { testToken: rawToken } : {})
  };
};

/**
 * Reset Password using cryptographic token
 */
const resetPassword = async ({ token, newPassword, confirmPassword }) => {
  if (!token || typeof token !== 'string' || !token.trim()) {
    const err = new Error('Reset token is required');
    err.statusCode = 400;
    throw err;
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    const err = new Error('New password is required and must be at least 6 characters long');
    err.statusCode = 400;
    throw err;
  }

  if (newPassword !== confirmPassword) {
    const err = new Error('New password and confirm password do not match');
    err.statusCode = 400;
    throw err;
  }

  // Hash incoming raw token to compare with DB
  const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    isDeleted: { $ne: true }
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    const err = new Error('Invalid or expired password reset token');
    err.statusCode = 400;
    throw err;
  }

  // Check expiration
  if (!user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save({ validateModifiedOnly: true });

    const err = new Error('Password reset token has expired. Please request a new link.');
    err.statusCode = 400;
    throw err;
  }

  // Update password and clear reset tokens
  user.password = await hashPassword(newPassword);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.passwordChangedAt = new Date();

  await user.save({ validateModifiedOnly: true });

  return {
    success: true,
    message: 'Password has been reset successfully. You can now log in with your new password.'
  };
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
  getCurrentUser,
  forgotPassword,
  resetPassword
};
