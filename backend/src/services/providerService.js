const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Category = require('../models/Category');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const ServiceArea = require('../models/ServiceArea');

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * =========================================================
 * 1. PROVIDER-FACING PROFILE & DOCUMENT METHODS
 * =========================================================
 */

/**
 * Retrieve authenticated provider's complete profile
 */
const getProviderProfileByUserId = async (userId) => {
  const provider = await Provider.findOne({ user: userId })
    .populate('user', 'name email phone avatar role isActive isVerified createdAt')
    .populate('categories', 'name slug icon isActive')
    .populate('serviceAreas', 'name city zipCodes isActive')
    .lean();

  if (!provider) {
    const err = new Error('Provider profile not found for authenticated user');
    err.statusCode = 404;
    throw err;
  }

  return provider;
};

/**
 * Update authenticated provider's editable profile fields
 */
const updateProviderProfileByUserId = async (userId, updateData) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found for authenticated user');
    err.statusCode = 404;
    throw err;
  }

  const { businessName, bio, experienceYears, avatar, phone, categories, isAvailable } = updateData;

  // Validate active categories if updating categories
  if (categories !== undefined) {
    if (categories.length > 0) {
      const activeCategories = await Category.find({
        _id: { $in: categories },
        isActive: true
      });
      if (activeCategories.length !== categories.length) {
        const err = new Error(
          'One or more selected categories do not exist or are currently inactive. Providers may only link active categories.'
        );
        err.statusCode = 400;
        throw err;
      }
    }
    provider.categories = categories;
  }

  // Update business fields
  if (businessName !== undefined) provider.businessName = businessName.trim();
  if (bio !== undefined) provider.bio = bio.trim();
  if (experienceYears !== undefined) provider.experienceYears = Number(experienceYears);
  if (isAvailable !== undefined) provider.isAvailable = Boolean(isAvailable);

  await provider.save();

  // Update User fields if phone or avatar provided
  const user = await User.findById(userId);
  let userUpdated = false;

  if (avatar !== undefined) {
    user.avatar = avatar ? avatar.trim() : null;
    userUpdated = true;
  }

  if (phone !== undefined && phone.trim() !== user.phone) {
    // Check uniqueness
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

  return await getProviderProfileByUserId(userId);
};

/**
 * Retrieve services belonging to authenticated provider
 */
const getProviderServicesByUserId = async (userId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const services = await Service.find({ provider: provider._id })
    .populate('category', 'name slug icon isActive')
    .sort({ createdAt: -1 })
    .lean();

  return services;
};

/**
 * Retrieve availability schedule belonging to authenticated provider
 */
const getProviderAvailabilityByUserId = async (userId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const availabilities = await Availability.find({ provider: provider._id })
    .sort({ dayOfWeek: 1 })
    .lean();

  return availabilities;
};

/**
 * Retrieve service areas belonging to authenticated provider
 */
const getProviderServiceAreasByUserId = async (userId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const areas = await ServiceArea.find({ _id: { $in: provider.serviceAreas || [] } })
    .lean();

  return areas;
};

/**
 * Submit or update a verification document for authenticated provider.
 * Document workflow: NOT_SUBMITTED -> pending -> approved / rejected.
 * Allows resubmission of rejected documents.
 */
const submitDocument = async (userId, { type, documentUrl, title }) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const normalizedType = type.trim().toLowerCase();
  const existingDocIndex = provider.documents.findIndex(
    (doc) => doc.type.toLowerCase() === normalizedType
  );

  if (existingDocIndex >= 0) {
    // Resubmission of document: reset status to 'pending', clear reviewNote
    provider.documents[existingDocIndex].documentUrl = documentUrl.trim();
    provider.documents[existingDocIndex].verificationStatus = 'pending';
    provider.documents[existingDocIndex].uploadedAt = new Date();
    provider.documents[existingDocIndex].reviewNote = '';
    provider.documents[existingDocIndex].reviewedAt = null;
  } else {
    // New document submission
    provider.documents.push({
      type: normalizedType,
      documentUrl: documentUrl.trim(),
      verificationStatus: 'pending',
      uploadedAt: new Date(),
      reviewNote: '',
      reviewedAt: null
    });
  }

  // If provider was previously rejected, resubmission moves overall status back to pending
  if (provider.verificationStatus === 'rejected') {
    provider.verificationStatus = 'pending';
    provider.rejectionReason = null;
  }

  await provider.save();

  return {
    verificationStatus: provider.verificationStatus,
    documents: provider.documents
  };
};

/**
 * Delete a document before it is approved
 */
const deleteDocument = async (userId, documentId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const doc = provider.documents.id(documentId);
  if (!doc) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  if (doc.verificationStatus === 'approved') {
    const err = new Error(
      'Cannot delete an already approved verification document. Contact administration for updates.'
    );
    err.statusCode = 400;
    throw err;
  }

  provider.documents.pull(documentId);
  await provider.save();

  return {
    verificationStatus: provider.verificationStatus,
    documents: provider.documents
  };
};

/**
 * =========================================================
 * 2. PUBLIC PROVIDER DISCOVERY METHODS
 * =========================================================
 */

/**
 * Public listing of verified & active providers
 * Excludes pending, rejected, or suspended providers.
 * Excludes private documents and sensitive tokens.
 */
const getPublicProviders = async (query = {}) => {
  const filter = {
    verificationStatus: 'verified',
    isAvailable: true
  };

  if (query.category) {
    filter.categories = query.category;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ businessName: searchRegex }, { bio: searchRegex }];
  }

  const providers = await Provider.find(filter)
    .populate({
      path: 'user',
      match: { isActive: true },
      select: 'name avatar createdAt'
    })
    .populate('categories', 'name slug icon')
    .sort({ 'rating.average': -1, completedBookingsCount: -1 })
    .lean();

  // Filter out any where user account is inactive (user was matched null)
  return providers
    .filter((p) => p.user)
    .map((p) => ({
      _id: p._id,
      businessName: p.businessName,
      bio: p.bio,
      experienceYears: p.experienceYears,
      categories: p.categories,
      rating: p.rating,
      completedBookingsCount: p.completedBookingsCount,
      user: p.user,
      isAvailable: p.isAvailable
    }));
};

/**
 * Public provider detail
 */
const getPublicProviderById = async (providerId) => {
  const provider = await Provider.findById(providerId)
    .populate({
      path: 'user',
      select: 'name avatar createdAt isActive'
    })
    .populate('categories', 'name slug icon description')
    .populate('serviceAreas', 'name city zipCodes')
    .lean();

  if (!provider || provider.verificationStatus !== 'verified' || !provider.user || !provider.user.isActive) {
    const err = new Error('Provider not found or not currently available');
    err.statusCode = 404;
    throw err;
  }

  const services = await Service.find({ provider: provider._id, isActive: true })
    .populate('category', 'name slug icon')
    .lean();

  return {
    _id: provider._id,
    businessName: provider.businessName,
    bio: provider.bio,
    experienceYears: provider.experienceYears,
    categories: provider.categories,
    serviceAreas: provider.serviceAreas,
    rating: provider.rating,
    completedBookingsCount: provider.completedBookingsCount,
    user: {
      name: provider.user.name,
      avatar: provider.user.avatar,
      createdAt: provider.user.createdAt
    },
    isAvailable: provider.isAvailable,
    services
  };
};

/**
 * =========================================================
 * 3. ADMIN-ONLY VERIFICATION & MANAGEMENT METHODS
 * =========================================================
 */

/**
 * List all providers for administrative monitoring & queue
 */
const getAdminProviders = async (query = {}) => {
  const filter = {};

  if (query.verificationStatus && query.verificationStatus !== 'all') {
    filter.verificationStatus = query.verificationStatus;
  }

  if (query.category) {
    filter.categories = query.category;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ businessName: searchRegex }, { bio: searchRegex }];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .populate('user', 'name email phone avatar role isActive isVerified createdAt')
      .populate('categories', 'name slug icon isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Provider.countDocuments(filter)
  ]);

  return {
    providers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Retrieve single provider full details for admin review
 */
const getAdminProviderById = async (providerId) => {
  const provider = await Provider.findById(providerId)
    .populate('user', 'name email phone avatar role isActive isVerified createdAt')
    .populate('categories', 'name slug icon isActive')
    .populate('serviceAreas', 'name city zipCodes')
    .lean();

  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  return provider;
};

/**
 * Admin: Review an individual document
 */
const reviewDocument = async (providerId, documentId, { status, reviewNote }) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  const doc = provider.documents.id(documentId);
  if (!doc) {
    const err = new Error(`Document not found with ID '${documentId}'`);
    err.statusCode = 404;
    throw err;
  }

  doc.verificationStatus = status;
  doc.reviewNote = reviewNote ? reviewNote.trim() : '';
  doc.reviewedAt = new Date();

  await provider.save();

  return await getAdminProviderById(providerId);
};

/**
 * Admin: Approve, Reject or Suspend overall provider verification
 */
const updateProviderVerification = async (providerId, { status, rejectionReason }) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (status === 'verified') {
    provider.verificationStatus = 'verified';
    provider.rejectionReason = null;
    provider.verifiedAt = new Date();

    // Mark pending documents as approved
    provider.documents.forEach((doc) => {
      if (doc.verificationStatus === 'pending') {
        doc.verificationStatus = 'approved';
        doc.reviewedAt = new Date();
      }
    });

    // Update user isVerified
    await User.findByIdAndUpdate(provider.user, { isVerified: true });
  } else if (status === 'rejected') {
    provider.verificationStatus = 'rejected';
    provider.rejectionReason = rejectionReason.trim();
    provider.verifiedAt = null;

    await User.findByIdAndUpdate(provider.user, { isVerified: false });
  } else if (status === 'suspended') {
    provider.verificationStatus = 'suspended';
    provider.rejectionReason = rejectionReason.trim();
  }

  await provider.save();

  return await getAdminProviderById(providerId);
};

/**
 * Admin: Toggle provider account active/inactive
 */
const updateProviderAccountStatus = async (providerId, isActive) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  await User.findByIdAndUpdate(provider.user, { isActive: Boolean(isActive) });

  return await getAdminProviderById(providerId);
};

module.exports = {
  getProviderProfileByUserId,
  updateProviderProfileByUserId,
  getProviderServicesByUserId,
  getProviderAvailabilityByUserId,
  getProviderServiceAreasByUserId,
  submitDocument,
  deleteDocument,
  getPublicProviders,
  getPublicProviderById,
  getAdminProviders,
  getAdminProviderById,
  reviewDocument,
  updateProviderVerification,
  updateProviderAccountStatus
};
