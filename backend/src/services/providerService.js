const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Category = require('../models/Category');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const ServiceArea = require('../models/ServiceArea');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

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
 * Update availability schedule belonging to authenticated provider
 * Supports updating single days or whole weekly schedule (0-6)
 */
const updateProviderAvailabilityByUserId = async (userId, schedule) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Update or insert each day's availability
  const updatePromises = schedule.map(async (entry) => {
    const dayOfWeek = Number(entry.dayOfWeek);
    const isAvailable = entry.isAvailable !== undefined ? Boolean(entry.isAvailable) : true;
    const slots = (entry.slots || []).map((s) => ({
      startTime: s.startTime.trim(),
      endTime: s.endTime.trim(),
      maxBookings: Number(s.maxBookings) || 1
    }));

    return Availability.findOneAndUpdate(
      { provider: provider._id, dayOfWeek },
      {
        $set: {
          provider: provider._id,
          dayOfWeek,
          isAvailable,
          slots
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });

  await Promise.all(updatePromises);

  return await Availability.find({ provider: provider._id })
    .sort({ dayOfWeek: 1 })
    .lean();
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
 * Add a service area for authenticated provider
 */
const addProviderServiceAreaByUserId = async (userId, areaData) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const newArea = new ServiceArea({
    name: areaData.name.trim(),
    city: areaData.city.trim(),
    state: areaData.state ? areaData.state.trim() : '',
    zipCodes: (areaData.zipCodes || []).map((z) => z.trim()),
    isActive: areaData.isActive !== undefined ? Boolean(areaData.isActive) : true
  });

  if (areaData.polygon && areaData.polygon.coordinates) {
    newArea.polygon = {
      type: 'Polygon',
      coordinates: areaData.polygon.coordinates
    };
  }

  await newArea.save();

  if (!provider.serviceAreas) {
    provider.serviceAreas = [];
  }
  provider.serviceAreas.push(newArea._id);
  await provider.save();

  return await ServiceArea.find({ _id: { $in: provider.serviceAreas } }).lean();
};

/**
 * Update an owned service area for authenticated provider
 */
const updateProviderServiceAreaByUserId = async (userId, serviceAreaId, areaData) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwned = provider.serviceAreas && provider.serviceAreas.some((sa) => sa.toString() === serviceAreaId.toString());
  if (!isOwned) {
    const err = new Error('Access denied: Service area not owned by this provider');
    err.statusCode = 403;
    throw err;
  }

  const area = await ServiceArea.findById(serviceAreaId);
  if (!area) {
    const err = new Error(`Service area not found with ID '${serviceAreaId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (areaData.name !== undefined) area.name = areaData.name.trim();
  if (areaData.city !== undefined) area.city = areaData.city.trim();
  if (areaData.state !== undefined) area.state = areaData.state.trim();
  if (areaData.zipCodes !== undefined) area.zipCodes = areaData.zipCodes.map((z) => z.trim());
  if (areaData.isActive !== undefined) area.isActive = Boolean(areaData.isActive);

  if (areaData.polygon !== undefined) {
    if (areaData.polygon && areaData.polygon.coordinates) {
      area.polygon = {
        type: 'Polygon',
        coordinates: areaData.polygon.coordinates
      };
    } else {
      area.polygon = undefined;
    }
  }

  await area.save();
  return await ServiceArea.find({ _id: { $in: provider.serviceAreas } }).lean();
};

/**
 * Delete an owned service area for authenticated provider
 */
const deleteProviderServiceAreaByUserId = async (userId, serviceAreaId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwned = provider.serviceAreas && provider.serviceAreas.some((sa) => sa.toString() === serviceAreaId.toString());
  if (!isOwned) {
    const err = new Error('Access denied: Service area not owned by this provider');
    err.statusCode = 403;
    throw err;
  }

  provider.serviceAreas = provider.serviceAreas.filter((sa) => sa.toString() !== serviceAreaId.toString());
  await provider.save();
  await ServiceArea.findByIdAndDelete(serviceAreaId);

  return await ServiceArea.find({ _id: { $in: provider.serviceAreas } }).lean();
};

/**
 * Add a provider-offered service
 */
const addProviderServiceByUserId = async (userId, serviceData) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const { name, category: categoryId, price, priceType = 'fixed', estimatedDurationMinutes = 60, description, image, isActive = true } = serviceData;

  const category = await Category.findById(categoryId);
  if (!category || !category.isActive) {
    const err = new Error('Category not found or inactive');
    err.statusCode = 400;
    throw err;
  }

  // Price validation
  if ((priceType === 'fixed' || priceType === 'hourly') && price <= 0) {
    const err = new Error(`Price must be greater than 0 for ${priceType} pricing model`);
    err.statusCode = 400;
    throw err;
  }

  const newService = await Service.create({
    name: name.trim(),
    category: categoryId,
    provider: provider._id,
    price: Number(price),
    priceType,
    estimatedDurationMinutes: Number(estimatedDurationMinutes) || 60,
    description: description ? description.trim() : '',
    image: image ? image.trim() : null,
    isActive: Boolean(isActive)
  });

  return await Service.findById(newService._id).populate('category', 'name slug icon isActive').lean();
};

/**
 * Update an owned provider service
 */
const updateProviderServiceByUserId = async (userId, serviceId, updateData) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    const err = new Error(`Service not found with ID '${serviceId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (!service.provider || service.provider.toString() !== provider._id.toString()) {
    const err = new Error('Access denied: You do not own this service');
    err.statusCode = 403;
    throw err;
  }

  if (updateData.name !== undefined) service.name = updateData.name.trim();
  if (updateData.description !== undefined) service.description = updateData.description.trim();
  if (updateData.price !== undefined) service.price = Number(updateData.price);
  if (updateData.priceType !== undefined) service.priceType = updateData.priceType;
  if (updateData.estimatedDurationMinutes !== undefined) service.estimatedDurationMinutes = Number(updateData.estimatedDurationMinutes);
  if (updateData.image !== undefined) service.image = updateData.image ? updateData.image.trim() : null;
  if (updateData.isActive !== undefined) service.isActive = Boolean(updateData.isActive);

  await service.save();

  return await Service.findById(serviceId).populate('category', 'name slug icon isActive').lean();
};

/**
 * Deactivate or Delete an owned provider service
 */
const deleteProviderServiceByUserId = async (userId, serviceId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    const err = new Error(`Service not found with ID '${serviceId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (!service.provider || service.provider.toString() !== provider._id.toString()) {
    const err = new Error('Access denied: You do not own this service');
    err.statusCode = 403;
    throw err;
  }

  // Check if existing bookings reference this service
  const bookingsCount = await Booking.countDocuments({ service: serviceId });
  if (bookingsCount > 0) {
    // Soft-deactivate to preserve historical booking records
    service.isActive = false;
    await service.save();
    return {
      message: 'Service deactivated to preserve booking history',
      deactivated: true,
      serviceId
    };
  }

  await Service.findByIdAndDelete(serviceId);
  return {
    message: 'Service deleted successfully',
    deleted: true,
    serviceId
  };
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
 * Submit complete KYC package (Aadhaar Front & Back, PAN Front & Back)
 */
const submitKYCDocuments = async (userId, { aadhaarFrontImage, aadhaarBackImage, panFrontImage, panBackImage }) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Set explicit KYC fields
  provider.aadhaarFrontImage = aadhaarFrontImage.trim();
  provider.aadhaarBackImage = aadhaarBackImage.trim();
  provider.panFrontImage = panFrontImage.trim();
  if (panBackImage && typeof panBackImage === 'string' && panBackImage.trim()) {
    provider.panBackImage = panBackImage.trim();
  }

  provider.kycStatus = 'under_review';
  provider.kycSubmittedAt = new Date();
  provider.kycRejectionReason = null;

  // If overall provider verification was rejected, move it back to pending for review
  if (provider.verificationStatus === 'rejected') {
    provider.verificationStatus = 'pending';
    provider.rejectionReason = null;
  }

  // Synchronize documents array for unified admin audit
  const kycDocsToUpsert = [
    { type: 'aadhaar_front', url: provider.aadhaarFrontImage },
    { type: 'aadhaar_back', url: provider.aadhaarBackImage },
    { type: 'pan_front', url: provider.panFrontImage },
    ...(provider.panBackImage ? [{ type: 'pan_back', url: provider.panBackImage }] : [])
  ];

  for (const item of kycDocsToUpsert) {
    const existingIdx = provider.documents.findIndex(
      (d) => d.type.toLowerCase() === item.type
    );
    if (existingIdx >= 0) {
      provider.documents[existingIdx].documentUrl = item.url;
      provider.documents[existingIdx].verificationStatus = 'pending';
      provider.documents[existingIdx].uploadedAt = new Date();
      provider.documents[existingIdx].reviewNote = '';
      provider.documents[existingIdx].reviewedAt = null;
    } else {
      provider.documents.push({
        type: item.type,
        documentUrl: item.url,
        verificationStatus: 'pending',
        uploadedAt: new Date(),
        reviewNote: '',
        reviewedAt: null
      });
    }
  }

  await provider.save();

  return await Provider.findById(provider._id)
    .populate('user', 'name email phone avatar role isActive isVerified createdAt')
    .lean();
};

/**
 * Admin: Review KYC Package (Approve or Reject with reason)
 */
const reviewKYC = async (providerId, adminUserId, { status, rejectionReason }) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  provider.kycStatus = status; // 'verified' or 'rejected'
  provider.kycReviewedAt = new Date();
  provider.kycReviewedBy = adminUserId;

  if (status === 'verified') {
    provider.kycRejectionReason = null;
    provider.verificationStatus = 'verified';
    provider.verifiedAt = new Date();
    provider.rejectionReason = null;

    // Mark documents approved
    provider.documents.forEach((doc) => {
      if (['aadhaar_front', 'aadhaar_back', 'pan_front', 'pan_back'].includes(doc.type.toLowerCase())) {
        doc.verificationStatus = 'approved';
        doc.reviewedAt = new Date();
      }
    });

    await User.findByIdAndUpdate(provider.user, { isVerified: true });
  } else if (status === 'rejected') {
    provider.kycRejectionReason = rejectionReason.trim();
    provider.verificationStatus = 'rejected';
    provider.rejectionReason = rejectionReason.trim();
    provider.verifiedAt = null;

    // Mark documents rejected
    provider.documents.forEach((doc) => {
      if (['aadhaar_front', 'aadhaar_back', 'pan_front', 'pan_back'].includes(doc.type.toLowerCase())) {
        doc.verificationStatus = 'rejected';
        doc.reviewNote = rejectionReason.trim();
        doc.reviewedAt = new Date();
      }
    });

    await User.findByIdAndUpdate(provider.user, { isVerified: false });
  }

  await provider.save();

  return await Provider.findById(providerId)
    .populate('user', 'name email phone avatar role isActive isVerified createdAt')
    .populate('kycReviewedBy', 'name email role')
    .lean();
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
    isAvailable: true,
    isDeleted: { $ne: true }
  };

  const isTopRatedOnly = query.topRated === 'true' || query.topRated === true;
  if (isTopRatedOnly) {
    filter.showInTopRated = true;
  }

  // 1. Resolve Category Filter (supports ObjectId, slug, name, or legacy string)
  if (query.category && String(query.category).trim() && query.category !== 'all') {
    const rawCategory = String(query.category).trim();
    let categoryIds = [];

    if (mongoose.Types.ObjectId.isValid(rawCategory)) {
      categoryIds.push(new mongoose.Types.ObjectId(rawCategory));
    } else {
      // Find matching categories by exact name, slug, or partial name
      const catRegex = new RegExp(`^${escapeRegex(rawCategory)}$`, 'i');
      const matchingCats = await Category.find({
        $or: [
          { name: catRegex },
          { slug: rawCategory.toLowerCase() }
        ]
      }).select('_id').lean();

      if (matchingCats.length > 0) {
        categoryIds = matchingCats.map((c) => c._id);
      }
    }

    // Match on current categories array, or legacy category / specialization fields
    const categoryConditions = [];
    if (categoryIds.length > 0) {
      categoryConditions.push({ categories: { $in: categoryIds } });
      categoryConditions.push({ category: { $in: categoryIds } });
    }
    // Also match legacy text fields if string was passed
    const textCatRegex = new RegExp(escapeRegex(rawCategory), 'i');
    categoryConditions.push({ category: textCatRegex });
    categoryConditions.push({ serviceCategories: textCatRegex });
    categoryConditions.push({ specialization: textCatRegex });

    if (categoryConditions.length === 1) {
      Object.assign(filter, categoryConditions[0]);
    } else {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: categoryConditions });
    }
  }

  // 2. Comprehensive Search Query: match businessName, bio, category name/slug, or service name
  if (query.search && query.search.trim()) {
    const trimmedSearch = query.search.trim();
    const searchRegex = new RegExp(escapeRegex(trimmedSearch), 'i');

    // Find any categories matching the search text
    const matchedCategories = await Category.find({
      $or: [
        { name: searchRegex },
        { slug: searchRegex }
      ]
    }).select('_id').lean();
    const matchedCategoryIds = matchedCategories.map((c) => c._id);

    // Find any services matching the search text
    const matchedServices = await Service.find({
      name: searchRegex,
      isActive: true
    }).select('provider category').lean();

    const providerIdsFromServices = matchedServices
      .map((s) => s.provider)
      .filter((p) => p && mongoose.Types.ObjectId.isValid(p));

    // Also collect category IDs from matched services
    const categoryIdsFromServices = matchedServices
      .map((s) => s.category)
      .filter((c) => c && mongoose.Types.ObjectId.isValid(c));

    const combinedCategoryIds = [
      ...matchedCategoryIds,
      ...categoryIdsFromServices
    ];

    const searchConditions = [
      { businessName: searchRegex },
      { bio: searchRegex },
      { specialization: searchRegex },
      { category: searchRegex },
      { serviceCategories: searchRegex }
    ];

    if (combinedCategoryIds.length > 0) {
      searchConditions.push({ categories: { $in: combinedCategoryIds } });
    }

    if (providerIdsFromServices.length > 0) {
      searchConditions.push({ _id: { $in: providerIdsFromServices } });
    }

    filter.$and = filter.$and || [];
    filter.$and.push({ $or: searchConditions });
  }

  const sortOrder = isTopRatedOnly
    ? { topRatedOrder: 1, 'rating.average': -1, createdAt: -1 }
    : { 'rating.average': -1, completedBookingsCount: -1 };

  const page = query.page ? Math.max(1, parseInt(query.page, 10)) : undefined;
  const limit = query.limit ? Math.max(1, parseInt(query.limit, 10)) : undefined;

  let queryBuilder = Provider.find(filter)
    .populate({
      path: 'user',
      match: { isActive: true },
      select: 'name avatar createdAt'
    })
    .populate('categories', 'name slug icon')
    .sort(sortOrder);

  if (page && limit) {
    queryBuilder = queryBuilder.skip((page - 1) * limit).limit(limit);
  } else if (limit) {
    queryBuilder = queryBuilder.limit(limit);
  }

  const [providers, totalCount] = await Promise.all([
    queryBuilder.lean(),
    Provider.countDocuments(filter)
  ]);

  // Filter out any where user account is inactive (user was matched null)
  const activeProviders = providers.filter((p) => p.user);

  // Augment with base price from services & persisted reviews calculation
  const enrichedProviders = await Promise.all(
    activeProviders.map(async (p) => {
      // Calculate rating from persistent reviews if available
      const reviews = await Review.find({ provider: p._id, isPublic: true }).lean();
      let ratingObj = p.rating || { average: 0, count: 0 };
      if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        ratingObj = {
          average: Number((totalRating / reviews.length).toFixed(1)),
          count: reviews.length
        };
      }

      // Get starting price from active services
      const minService = await Service.findOne({ provider: p._id, isActive: true })
        .sort({ price: 1 })
        .select('price')
        .lean();

      const startingPrice = minService ? minService.price : null;

      const specialization =
        p.categories && p.categories.length > 0 ? p.categories[0].name : (p.specialization || '');

      return {
        _id: p._id,
        businessName: p.businessName || p.user?.name || '',
        bio: p.bio,
        avatar: p.user?.avatar || null,
        experienceYears: p.experienceYears || 0,
        categories: p.categories,
        specialization,
        rating: ratingObj,
        pricing: {
          basePrice: startingPrice
        },
        completedBookingsCount: p.completedBookingsCount,
        showInTopRated: Boolean(p.showInTopRated),
        topRatedOrder: p.topRatedOrder || 0,
        user: p.user,
        isAvailable: p.isAvailable
      };
    })
  );

  // If pagination parameters were explicitly passed, return pagination object
  if (page !== undefined || (query.limit !== undefined && query.includePagination === 'true')) {
    const currentLimit = limit || enrichedProviders.length;
    const currentPage = page || 1;
    return {
      providers: enrichedProviders,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / currentLimit) || 1
      }
    };
  }

  // Default array return for direct compatibility with existing clients
  enrichedProviders.pagination = {
    page: 1,
    limit: limit || totalCount,
    total: totalCount,
    totalPages: limit ? (Math.ceil(totalCount / limit) || 1) : 1
  };

  return enrichedProviders;
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

  const rawServices = await Service.find({ provider: provider._id, isActive: true })
    .populate('category', 'name slug icon')
    .lean();

  const services = rawServices.map((s) => ({
    ...s,
    basePrice: s.price,
    pricingType: s.priceType || 'fixed'
  }));

  return {
    _id: provider._id,
    businessName: provider.businessName,
    bio: provider.bio,
    experienceYears: provider.experienceYears,
    categories: provider.categories,
    serviceAreas: provider.serviceAreas,
    rating: provider.rating,
    completedBookingsCount: provider.completedBookingsCount,
    showInTopRated: Boolean(provider.showInTopRated),
    topRatedOrder: provider.topRatedOrder || 0,
    user: {
      name: provider.user.name,
      avatar: provider.user.avatar,
      createdAt: provider.user.createdAt
    },
    isAvailable: provider.isAvailable,
    services,
    reviewCount: provider.rating?.count || 0
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
    if (query.verificationStatus === 'deleted') {
      filter.isDeleted = true;
    } else {
      filter.verificationStatus = query.verificationStatus;
      filter.isDeleted = { $ne: true };
    }
  } else {
    // Default: exclude soft-deleted providers from directory lists
    filter.isDeleted = { $ne: true };
  }

  if (query.topRated !== undefined && query.topRated !== 'all') {
    filter.showInTopRated = query.topRated === 'true' || query.topRated === true;
  }

  if (query.category && query.category !== 'all') {
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
      .populate('user', 'name email phone avatar role isActive isVerified isDeleted createdAt')
      .populate('categories', 'name slug icon isActive')
      .sort({ showInTopRated: -1, topRatedOrder: 1, createdAt: -1 })
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

/**
 * Admin: Toggle provider Top Rated status & display order
 * Only verified providers with active user accounts are eligible for public display.
 */
const updateTopRatedStatus = async (providerId, { showInTopRated, topRatedOrder }) => {
  const provider = await Provider.findById(providerId).populate('user');
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  // If enabling in Top Rated, enforce that provider is verified and user account is active
  if (showInTopRated) {
    if (provider.verificationStatus !== 'verified') {
      const err = new Error(
        'Only verified providers can be featured in Top Rated Professionals. Please verify the provider first.'
      );
      err.statusCode = 400;
      throw err;
    }

    if (!provider.user || !provider.user.isActive) {
      const err = new Error(
        'Cannot feature a provider whose account is inactive or suspended.'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  if (showInTopRated !== undefined) {
    provider.showInTopRated = Boolean(showInTopRated);
  }

  if (topRatedOrder !== undefined) {
    provider.topRatedOrder = Number(topRatedOrder) || 0;
  }

  await provider.save();

  return await getAdminProviderById(providerId);
};

/**
 * Admin: Safe Delete / Deactivation of Provider Account
 * Preserves financial transaction integrity, completed service histories, reviews, and legal records.
 */
const deleteProviderByAdmin = async (identifier, adminUserId) => {
  let provider = null;
  let user = null;

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    // Check if identifier is Provider._id
    provider = await Provider.findById(identifier);
    if (provider) {
      user = await User.findById(provider.user);
    } else {
      // Check if identifier is User._id
      user = await User.findById(identifier);
      if (user && user.role === 'provider') {
        provider = await Provider.findOne({ user: user._id });
      }
    }
  }

  if (!user || user.role !== 'provider' || !provider) {
    const err = new Error(`Provider not found with ID '${identifier}'`);
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

  // 1. Deactivate and mark User account as deleted
  const now = new Date();
  user.isActive = false;
  user.isDeleted = true;
  user.deletedAt = now;
  await user.save();

  // 2. Deactivate Provider profile availability and suspend verification
  provider.isAvailable = false;
  provider.isDeleted = true;
  provider.deletedAt = now;
  provider.verificationStatus = 'suspended';
  provider.showInTopRated = false;
  await provider.save();

  // 3. Deactivate custom services offered by this provider
  await Service.updateMany({ provider: provider._id }, { $set: { isActive: false } });

  // 4. Cancel active/pending bookings to prevent orphaned dispatches
  const cancelResult = await Booking.updateMany(
    { provider: provider._id, status: { $in: ['pending', 'accepted'] } },
    {
      $set: {
        status: 'cancelled',
        cancelledBy: 'admin',
        cancellationReason: 'Provider account terminated by platform administrator'
      }
    }
  );
  const cancelledBookingsCount = cancelResult.modifiedCount || 0;

  // Safe diagnostics log (no secrets or sensitive PII)
  console.log(
    `[ADMIN DELETE] Resource: Provider | TargetID: ${identifier} | ProviderID: ${provider._id} | UserID: ${user._id} | isDeleted: true | CancelledBookings: ${cancelledBookingsCount} | AdminID: ${adminUserId || 'system'}`
  );

  return {
    success: true,
    deleted: true,
    deletedId: provider._id,
    userId: user._id,
    businessName: provider.businessName,
    email: user.email,
    isActive: user.isActive,
    isDeleted: provider.isDeleted,
    deletedAt: provider.deletedAt,
    verificationStatus: provider.verificationStatus
  };
};

module.exports = {
  getProviderProfileByUserId,
  updateProviderProfileByUserId,
  getProviderServicesByUserId,
  getProviderAvailabilityByUserId,
  updateProviderAvailabilityByUserId,
  getProviderServiceAreasByUserId,
  addProviderServiceAreaByUserId,
  updateProviderServiceAreaByUserId,
  deleteProviderServiceAreaByUserId,
  addProviderServiceByUserId,
  updateProviderServiceByUserId,
  deleteProviderServiceByUserId,
  submitDocument,
  submitKYCDocuments,
  reviewKYC,
  deleteDocument,
  getPublicProviders,
  getPublicProviderById,
  getAdminProviders,
  getAdminProviderById,
  reviewDocument,
  updateProviderVerification,
  updateProviderAccountStatus,
  updateTopRatedStatus,
  deleteProviderByAdmin
};
