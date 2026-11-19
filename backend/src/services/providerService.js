const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Category = require('../models/Category');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const ServiceArea = require('../models/ServiceArea');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const ServiceTag = require('../models/ServiceTag');
const ProviderSlotReservation = require('../models/ProviderSlotReservation');
const ServiceRadiusConfig = require('../models/ServiceRadiusConfig');
const {
  calculateHaversineDistanceKm,
  isValidLatitude,
  isValidLongitude,
  isValidGeoJsonCoordinates
} = require('../utils/geoUtils');
const { buildProviderStandardRateResponse } = require('../utils/pricingUtils');
const serviceRadiusService = require('./serviceRadiusService');
const {
  parseTimeToMinutes,
  minutesToHHmm,
  normalizeTimeSlot,
  doIntervalsOverlap,
  generateSlotTicks,
  formatDateToDateStr
} = require('../utils/timeSlotUtils');

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const KYC_DOCUMENT_FIELDS = {
  aadhaar_front: { label: 'Aadhaar Front', image: 'aadhaarFrontImage', publicId: 'aadhaarFrontImagePublicId' },
  aadhaar_back: { label: 'Aadhaar Back', image: 'aadhaarBackImage', publicId: 'aadhaarBackImagePublicId' },
  pan_front: { label: 'PAN Front', image: 'panFrontImage', publicId: 'panFrontImagePublicId' },
  pan_back: { label: 'PAN Back', image: 'panBackImage', publicId: 'panBackImagePublicId' }
};

const getKycReviewEntries = (provider) =>
  Object.entries(KYC_DOCUMENT_FIELDS).map(([type, fields]) => {
    const sameTypeDocuments = (provider.documents || []).filter(
      (document) => document.type.toLowerCase() === type
    );
    return {
      type,
      ...fields,
      document: sameTypeDocuments.find(
        (document) => document.documentUrl === provider[fields.image]
      ),
      hasDocumentOfType: sameTypeDocuments.length > 0
    };
  });

const getKycReviewIssues = (provider, rejectedTypes = [], normalizedReviewStatus = 'approved') => {
  const rejectedTypeSet = new Set(rejectedTypes);
  const issues = [];

  for (const entry of getKycReviewEntries(provider)) {
    if (!provider[entry.image]) {
      issues.push(`${entry.label} is missing.`);
      continue;
    }
    if (!entry.document) {
      issues.push(
        entry.hasDocumentOfType
          ? `${entry.label} review does not match the current upload.`
          : `${entry.label} has no individual review record.`
      );
      continue;
    }
    if (rejectedTypeSet.has(entry.type)) continue;
    if (entry.document.verificationStatus === 'rejected') {
      issues.push(`${entry.label} was rejected.`);
    } else if (normalizedReviewStatus === 'approved' && entry.document.verificationStatus === 'pending') {
      issues.push(`${entry.label} must be approved before final KYC approval.`);
    }
  }

  return issues;
};

const normalizeKycStatus = (provider) => {
  if (!provider) return 'NOT_SUBMITTED';
  const status = String(provider.kycStatus || 'NOT_SUBMITTED').toUpperCase();
  if (status === 'DRAFT') return 'NOT_SUBMITTED';
  if (status === 'VERIFIED' || status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'UNDER_REVIEW' || status === 'PENDING') {
    const hasCompletePackage = Object.values(KYC_DOCUMENT_FIELDS).every(
      ({ image }) => Boolean(provider[image])
    );
    return provider.kycSubmittedAt || hasCompletePackage ? 'PENDING' : 'NOT_SUBMITTED';
  }
  return status;
};

const assertKycEditable = (provider) => {
  const status = normalizeKycStatus(provider);
  if (status !== 'NOT_SUBMITTED') {
    const err = new Error('Submitted KYC documents are locked and cannot be changed');
    err.statusCode = 409;
    throw err;
  }
};

const assertKycDocumentEditable = (provider, docType) => {
  if (normalizeKycStatus(provider) === 'NOT_SUBMITTED') return;

  const reviewedDocument = (provider.documents || []).find(
    (document) => document.type.toLowerCase() === docType
  );
  if (
    normalizeKycStatus(provider) === 'REJECTED' &&
    reviewedDocument?.verificationStatus === 'rejected'
  ) {
    return;
  }

  const err = new Error('Only unsubmitted or rejected KYC documents can be changed');
  err.statusCode = 409;
  throw err;
};

const assertKycSubmittable = (provider) => {
  if (['NOT_SUBMITTED', 'REJECTED'].includes(normalizeKycStatus(provider))) return;
  const err = new Error('KYC can only be submitted once or resubmitted after rejection');
  err.statusCode = 409;
  throw err;
};

const buildEditableKycFilter = (provider, docType) => {
  const status = normalizeKycStatus(provider);
  if (status === 'REJECTED') {
    return {
      _id: provider._id,
      kycStatus: { $in: ['REJECTED', 'rejected'] },
      documents: {
        $elemMatch: {
          type: docType,
          verificationStatus: 'rejected'
        }
      }
    };
  }

  return {
    _id: provider._id,
    $or: [
      { kycStatus: { $in: ['NOT_SUBMITTED', 'DRAFT'] } },
      { kycStatus: { $exists: false } },
      { kycStatus: null },
      {
        $and: [
          { kycStatus: { $in: ['pending', 'PENDING'] } },
          { kycSubmittedAt: null }
        ]
      }
    ]
  };
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
    .populate('serviceCertification.category', 'name slug icon')
    .populate('serviceCertification.tag', 'name slug subcategory')
    .lean();

  if (!provider) {
    const err = new Error('Provider profile not found for authenticated user');
    err.statusCode = 404;
    throw err;
  }

  return {
    ...provider,
    kycStatus: normalizeKycStatus(provider)
  };
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

  // Attach booking count for each service
  const servicesWithBookingCounts = await Promise.all(
    services.map(async (srv) => {
      const bookingCount = await Booking.countDocuments({ service: srv._id });
      return {
        ...srv,
        bookingCount
      };
    })
  );

  return servicesWithBookingCounts;
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

  // Verification check: Only verified providers can publish custom services
  if (provider.verificationStatus !== 'verified') {
    const err = new Error('Only verified service providers are eligible to publish or manage custom services');
    err.statusCode = 403;
    throw err;
  }

  const {
    name,
    category: categoryId,
    price,
    priceType = 'fixed',
    estimatedDurationMinutes = 60,
    description,
    image,
    isActive = true
  } = serviceData;

  const category = await Category.findById(categoryId);
  if (!category || !category.isActive) {
    const err = new Error('Category not found or inactive');
    err.statusCode = 400;
    throw err;
  }

  // Price validation
  if (price === undefined || price === null || typeof price !== 'number' || Number.isNaN(price) || price < 0) {
    const err = new Error('Price is required and must be a positive number');
    err.statusCode = 400;
    throw err;
  }

  if ((priceType === 'fixed' || priceType === 'hourly') && price <= 0) {
    const err = new Error(`Price must be greater than 0 for ${priceType} pricing model`);
    err.statusCode = 400;
    throw err;
  }

  // Duration validation
  const durationNum = Number(estimatedDurationMinutes);
  if (!Number.isInteger(durationNum) || durationNum < 1) {
    const err = new Error('Estimated duration must be an integer of at least 1 minute');
    err.statusCode = 400;
    throw err;
  }

  const newService = await Service.create({
    name: name.trim(),
    category: categoryId,
    provider: provider._id,
    price: Number(price),
    priceType,
    estimatedDurationMinutes: durationNum,
    description: description ? description.trim() : '',
    image: image ? image.trim() : null,
    isActive: Boolean(isActive)
  });

  const created = await Service.findById(newService._id).populate('category', 'name slug icon isActive').lean();
  return {
    ...created,
    bookingCount: 0
  };
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

  // Verification check
  if (provider.verificationStatus !== 'verified') {
    const err = new Error('Only verified service providers are eligible to publish or manage custom services');
    err.statusCode = 403;
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

  if (updateData.category !== undefined) {
    const category = await Category.findById(updateData.category);
    if (!category || !category.isActive) {
      const err = new Error('Category not found or inactive');
      err.statusCode = 400;
      throw err;
    }
    service.category = category._id;
  }

  if (updateData.name !== undefined) {
    if (!updateData.name || typeof updateData.name !== 'string' || !updateData.name.trim()) {
      const err = new Error('Service name cannot be empty');
      err.statusCode = 400;
      throw err;
    }
    service.name = updateData.name.trim();
  }

  if (updateData.description !== undefined) {
    service.description = typeof updateData.description === 'string' ? updateData.description.trim() : '';
  }

  const targetPriceType = updateData.priceType !== undefined ? updateData.priceType : service.priceType;
  if (updateData.price !== undefined) {
    const numPrice = Number(updateData.price);
    if (typeof numPrice !== 'number' || Number.isNaN(numPrice) || numPrice < 0) {
      const err = new Error('Price must be a positive number');
      err.statusCode = 400;
      throw err;
    }
    if ((targetPriceType === 'fixed' || targetPriceType === 'hourly') && numPrice <= 0) {
      const err = new Error(`Price must be greater than 0 for ${targetPriceType} pricing model`);
      err.statusCode = 400;
      throw err;
    }
    service.price = numPrice;
  }

  if (updateData.priceType !== undefined) {
    service.priceType = updateData.priceType;
  }

  if (updateData.estimatedDurationMinutes !== undefined) {
    const dur = Number(updateData.estimatedDurationMinutes);
    if (!Number.isInteger(dur) || dur < 1) {
      const err = new Error('Estimated duration must be an integer of at least 1 minute');
      err.statusCode = 400;
      throw err;
    }
    service.estimatedDurationMinutes = dur;
  }

  if (updateData.image !== undefined) {
    service.image = updateData.image ? String(updateData.image).trim() : null;
  }

  if (updateData.isActive !== undefined) {
    service.isActive = Boolean(updateData.isActive);
  }

  await service.save();

  const updated = await Service.findById(serviceId).populate('category', 'name slug icon isActive').lean();
  const bookingCount = await Booking.countDocuments({ service: serviceId });
  return {
    ...updated,
    bookingCount
  };
};

/**
 * Update status (active/inactive) of an owned provider service
 */
const updateProviderServiceStatusByUserId = async (userId, serviceId, isActive) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (provider.verificationStatus !== 'verified') {
    const err = new Error('Only verified service providers are eligible to publish or manage custom services');
    err.statusCode = 403;
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

  service.isActive = Boolean(isActive);
  await service.save();

  const updated = await Service.findById(serviceId).populate('category', 'name slug icon isActive').lean();
  const bookingCount = await Booking.countDocuments({ service: serviceId });
  return {
    ...updated,
    bookingCount
  };
};

/**
 * Delete an owned provider service (only if safe; otherwise reject and recommend deactivation)
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
    const err = new Error(
      `Cannot delete service with ${bookingsCount} existing booking(s). Please deactivate the service instead to stop receiving new bookings.`
    );
    err.statusCode = 400;
    err.canDeactivate = true;
    throw err;
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
  const isKycDocument = Boolean(KYC_DOCUMENT_FIELDS[normalizedType]);
  if (isKycDocument) {
    assertKycEditable(provider);
  }
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
    provider.documents[existingDocIndex].reviewedBy = null;
  } else {
    // New document submission
    provider.documents.push({
      type: normalizedType,
      documentUrl: documentUrl.trim(),
      verificationStatus: 'pending',
      uploadedAt: new Date(),
      reviewNote: '',
      reviewedAt: null,
      reviewedBy: null
    });
  }

  // General provider verification is independent of mandatory KYC document uploads.
  const updates = { documents: provider.documents };
  if (!isKycDocument && provider.verificationStatus === 'rejected') {
    provider.verificationStatus = 'pending';
    provider.rejectionReason = null;
    updates.verificationStatus = 'pending';
    updates.rejectionReason = null;
  }

  if (isKycDocument) {
    const updatedProvider = await Provider.findOneAndUpdate(
      buildEditableKycFilter(provider),
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updatedProvider) {
      const err = new Error('KYC status changed while updating the document. Reload and try again.');
      err.statusCode = 409;
      throw err;
    }

    return {
      verificationStatus: updatedProvider.verificationStatus,
      documents: updatedProvider.documents
    };
  }

  await provider.save();

  return {
    verificationStatus: provider.verificationStatus,
    documents: provider.documents
  };
};

/**
 * Upload a KYC document to the provider's editable draft.
 */
const uploadKYCDocument = async (userId, docType, file) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const normalizedDocType = String(docType || '').toLowerCase();
  const fields = KYC_DOCUMENT_FIELDS[normalizedDocType];
  if (!fields) {
    const err = new Error('Document type must be aadhaar_front, aadhaar_back, pan_front, or pan_back');
    err.statusCode = 400;
    throw err;
  }
  assertKycDocumentEditable(provider, normalizedDocType);

  if (!file?.buffer) {
    const err = new Error('No KYC document file provided');
    err.statusCode = 400;
    throw err;
  }

  const { uploadImage, deleteAsset } = require('../config/cloudinary');
  const statusBeforeUpload = normalizeKycStatus(provider);
  const uploadedAt = new Date(Math.max(
    Date.now(),
    (provider.kycReviewedAt?.getTime() || 0) + 1
  ));
  const uploadResult = await uploadImage(file, {
    folder: 'marketplace/kyc_documents',
    public_id: `kyc_${provider._id}_${normalizedDocType}_${Date.now()}`
  });
  const previousPublicId = provider[fields.publicId];
  const matchingDocumentIndex = provider.documents.findIndex(
    (document) => document.type.toLowerCase() === normalizedDocType
  );
  if (matchingDocumentIndex >= 0) {
    provider.documents[matchingDocumentIndex].documentUrl = uploadResult.url;
    provider.documents[matchingDocumentIndex].uploadedAt = uploadedAt;
    if (statusBeforeUpload !== 'REJECTED') {
      provider.documents[matchingDocumentIndex].verificationStatus = 'pending';
      provider.documents[matchingDocumentIndex].reviewNote = '';
      provider.documents[matchingDocumentIndex].reviewedAt = null;
      provider.documents[matchingDocumentIndex].reviewedBy = null;
    }
  } else {
    provider.documents.push({
      type: normalizedDocType,
      documentUrl: uploadResult.url,
      verificationStatus: 'pending',
      uploadedAt,
      reviewNote: '',
      reviewedAt: null,
      reviewedBy: null
    });
  }

  const updates = {
    [fields.image]: uploadResult.url,
    [fields.publicId]: uploadResult.public_id,
    documents: provider.documents
  };
  if (statusBeforeUpload === 'NOT_SUBMITTED') updates.kycStatus = 'NOT_SUBMITTED';

  const updatedProvider = await Provider.findOneAndUpdate(
    buildEditableKycFilter(provider, normalizedDocType),
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!updatedProvider) {
    await deleteAsset(uploadResult.public_id);
    const err = new Error('KYC status changed while uploading. Reload the documents and try again.');
    err.statusCode = 409;
    throw err;
  }

  if (previousPublicId) {
    await deleteAsset(previousPublicId);
  }

  return {
    documentUrl: uploadResult.url,
    docType: normalizedDocType,
    kycStatus: normalizeKycStatus(updatedProvider),
    documents: updatedProvider.documents,
    uploadedAt
  };
};

const deleteKYCDocument = async (userId, docType) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const normalizedDocType = String(docType || '').toLowerCase();
  const fields = KYC_DOCUMENT_FIELDS[normalizedDocType];
  if (!fields) {
    const err = new Error('Invalid KYC document type');
    err.statusCode = 400;
    throw err;
  }
  assertKycEditable(provider);

  const previousPublicId = provider[fields.publicId];
  const matchingDocumentIndex = provider.documents.findIndex(
    (doc) => doc.type.toLowerCase() === normalizedDocType
  );
  if (matchingDocumentIndex >= 0) provider.documents.splice(matchingDocumentIndex, 1);

  const updatedProvider = await Provider.findOneAndUpdate(
    buildEditableKycFilter(provider),
    {
      $set: {
        [fields.image]: null,
        [fields.publicId]: null,
        documents: provider.documents
      }
    },
    { new: true, runValidators: true }
  );
  if (!updatedProvider) {
    const err = new Error('KYC status changed while deleting. Reload the documents and try again.');
    err.statusCode = 409;
    throw err;
  }

  if (previousPublicId) {
    const { deleteAsset } = require('../config/cloudinary');
    await deleteAsset(previousPublicId);
  }

  return { docType: normalizedDocType, kycStatus: normalizeKycStatus(updatedProvider) };
};

/**
 * Submit complete KYC package (Aadhaar Front & Back, PAN Front & Back)
 */
const submitKYCDocuments = async (userId, submittedDocuments = {}) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  assertKycSubmittable(provider);
  const requiredImages = Object.values(KYC_DOCUMENT_FIELDS).map(({ image }) => image);
  const missingImages = requiredImages.filter((field) => !provider[field]);
  if (missingImages.length > 0) {
    const err = new Error('Aadhaar front and back and PAN front and back documents are required');
    err.statusCode = 400;
    throw err;
  }

  const statusBeforeSubmission = normalizeKycStatus(provider);
  const rejectedDocuments = statusBeforeSubmission === 'REJECTED'
    ? provider.documents.filter(
      (document) =>
        Object.prototype.hasOwnProperty.call(KYC_DOCUMENT_FIELDS, document.type.toLowerCase()) &&
        document.verificationStatus === 'rejected'
    )
    : [];
  if (statusBeforeSubmission === 'REJECTED') {
    if (!rejectedDocuments.length) {
      const err = new Error('No rejected KYC documents are available for correction');
      err.statusCode = 409;
      throw err;
    }
    const uncorrectedDocuments = rejectedDocuments.filter(
      (document) =>
        !document.uploadedAt ||
        !provider.kycReviewedAt ||
        document.uploadedAt.getTime() <= provider.kycReviewedAt.getTime()
    );
    if (uncorrectedDocuments.length) {
      const err = new Error('Replace every rejected KYC document before resubmitting');
      err.statusCode = 400;
      throw err;
    }
  }

  for (const imageField of requiredImages) {
    const suppliedUrl = submittedDocuments[imageField];
    if (suppliedUrl !== undefined && suppliedUrl !== provider[imageField]) {
      const err = new Error('KYC documents must be uploaded through the secure document upload endpoint');
      err.statusCode = 400;
      throw err;
    }
  }

  const submittedAt = new Date();
  const submissionFilter = buildEditableKycFilter(
    provider,
    rejectedDocuments[0]?.type
  );
  for (const [type, { image }] of Object.entries(KYC_DOCUMENT_FIELDS)) {
    submissionFilter[image] = provider[image];
    const existingDoc = provider.documents.find((doc) => doc.type.toLowerCase() === type);
    if (existingDoc) {
      existingDoc.documentUrl = provider[image];
      if (statusBeforeSubmission !== 'REJECTED' || existingDoc.verificationStatus !== 'approved') {
        existingDoc.verificationStatus = 'pending';
        existingDoc.reviewNote = '';
        existingDoc.reviewedAt = null;
        existingDoc.reviewedBy = null;
        if (statusBeforeSubmission !== 'REJECTED') existingDoc.uploadedAt = submittedAt;
      }
    } else {
      provider.documents.push({
        type,
        documentUrl: provider[image],
        verificationStatus: 'pending',
        uploadedAt: submittedAt,
        reviewNote: '',
        reviewedAt: null,
        reviewedBy: null
      });
    }
  }

  const submissionUpdates = {
    kycStatus: 'PENDING',
    kycSubmittedAt: submittedAt,
    kycReviewedAt: null,
    kycReviewedBy: null,
    kycRejectionReason: null,
    documents: provider.documents
  };
  const submittedProvider = await Provider.findOneAndUpdate(
    submissionFilter,
    { $set: submissionUpdates },
    { new: true, runValidators: true }
  )
    .populate('user', 'name email phone avatar role isActive isVerified createdAt')
    .lean();
  if (!submittedProvider) {
    const err = new Error('KYC status or documents changed during submission. Reload and submit again.');
    err.statusCode = 409;
    throw err;
  }

  return submittedProvider;
};

/**
 * Admin: Review KYC Package (Approve or Reject with reason)
 */
const reviewKYC = async (
  providerId,
  adminUserId,
  { status, rejectionReason, rejectedDocuments }
) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (normalizeKycStatus(provider) !== 'PENDING') {
    const err = new Error('Only submitted KYC applications awaiting review can be approved or rejected');
    err.statusCode = 409;
    throw err;
  }

  const normalizedReviewStatus = String(status || '').toLowerCase();
  if (!['verified', 'approved', 'rejected'].includes(normalizedReviewStatus)) {
    const err = new Error('KYC review status must be approved or rejected');
    err.statusCode = 400;
    throw err;
  }

  const requiredDocumentTypes = Object.keys(KYC_DOCUMENT_FIELDS);
  const rejectedDocumentTypes = normalizedReviewStatus === 'rejected'
    ? (rejectedDocuments === undefined ? requiredDocumentTypes : rejectedDocuments)
    : [];
  if (
    normalizedReviewStatus === 'rejected' &&
    (
      !Array.isArray(rejectedDocumentTypes) ||
      rejectedDocumentTypes.length === 0 ||
      rejectedDocumentTypes.some((type) => !requiredDocumentTypes.includes(type)) ||
      new Set(rejectedDocumentTypes).size !== rejectedDocumentTypes.length
    )
  ) {
    const err = new Error('Select one or more valid KYC documents to reject');
    err.statusCode = 400;
    throw err;
  }

  if (normalizedReviewStatus === 'rejected' && !String(rejectionReason || '').trim()) {
    const err = new Error('A rejection reason is mandatory when rejecting KYC verification');
    err.statusCode = 400;
    throw err;
  }

  const rejectedTypes = normalizedReviewStatus === 'rejected' ? rejectedDocumentTypes : [];
  const reviewIssues = getKycReviewIssues(provider, rejectedTypes, normalizedReviewStatus);
  if (reviewIssues.length) {
    const err = new Error(
      normalizedReviewStatus === 'rejected'
        ? `KYC cannot be rejected: ${reviewIssues.join(' ')}`
        : `KYC cannot be approved: ${reviewIssues.join(' ')}`
    );
    err.statusCode = 409;
    throw err;
  }

  const reviewEntries = getKycReviewEntries(provider);
  const reviewFilter = {
    _id: provider._id,
    kycStatus: provider.kycStatus
  };
  for (const { image } of Object.values(KYC_DOCUMENT_FIELDS)) {
    reviewFilter[image] = provider[image];
  }

  const reviewedAt = new Date();
  const isApproved = normalizedReviewStatus !== 'rejected';
  provider.kycStatus = isApproved ? 'APPROVED' : 'REJECTED';
  provider.kycReviewedAt = reviewedAt;
  provider.kycReviewedBy = adminUserId;

  if (isApproved) {
    provider.kycRejectionReason = null;
    // Approve all mandatory KYC documents in provider.documents, preserving individual review history
    for (const entry of reviewEntries) {
      if (entry.document) {
        if (entry.document.verificationStatus !== 'approved') {
          entry.document.verificationStatus = 'approved';
          entry.document.reviewedAt = reviewedAt;
          entry.document.reviewedBy = adminUserId;
          entry.document.reviewNote = '';
        } else {
          if (!entry.document.reviewedAt) entry.document.reviewedAt = reviewedAt;
          if (!entry.document.reviewedBy) entry.document.reviewedBy = adminUserId;
        }
      }
    }
  } else {
    provider.kycRejectionReason = rejectionReason.trim();
    for (const type of rejectedDocumentTypes) {
      const match = reviewEntries.find((entry) => entry.type === type);
      if (match && match.document) {
        match.document.verificationStatus = 'rejected';
        match.document.reviewNote = rejectionReason.trim();
        match.document.reviewedAt = reviewedAt;
        match.document.reviewedBy = adminUserId;
      }
    }
  }

  const updates = {
    kycStatus: provider.kycStatus,
    kycReviewedAt: provider.kycReviewedAt,
    kycReviewedBy: provider.kycReviewedBy,
    kycRejectionReason: provider.kycRejectionReason,
    documents: provider.documents
  };

  const reviewedProvider = await Provider.findOneAndUpdate(
    reviewFilter,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!reviewedProvider) {
    const err = new Error('KYC status or documents changed during review. Reload the application and try again.');
    err.statusCode = 409;
    throw err;
  }

  return await getAdminProviderById(reviewedProvider._id);
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

  const isKycDocument = Boolean(KYC_DOCUMENT_FIELDS[doc.type.toLowerCase()]);
  if (isKycDocument) {
    assertKycEditable(provider);
  }

  if (doc.verificationStatus === 'approved') {
    const err = new Error(
      'Cannot delete an already approved verification document. Contact administration for updates.'
    );
    err.statusCode = 400;
    throw err;
  }

  provider.documents.pull(documentId);

  if (isKycDocument) {
    const updatedProvider = await Provider.findOneAndUpdate(
      buildEditableKycFilter(provider),
      { $set: { documents: provider.documents } },
      { new: true, runValidators: true }
    );
    if (!updatedProvider) {
      const err = new Error('KYC status changed while deleting the document. Reload and try again.');
      err.statusCode = 409;
      throw err;
    }

    return {
      verificationStatus: updatedProvider.verificationStatus,
      documents: updatedProvider.documents
    };
  }

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
  let requestedService = null;

  const isTopRatedOnly = query.topRated === 'true' || query.topRated === true;
  if (isTopRatedOnly) {
    filter.showInTopRated = true;
  }

  // 1. Resolve Category Filter (supports ObjectId, slug, or exact name)
  if (query.category && String(query.category).trim() && query.category !== 'all') {
    const rawCategory = String(query.category).trim();
    let categoryIds = [];

    if (mongoose.Types.ObjectId.isValid(rawCategory)) {
      categoryIds.push(new mongoose.Types.ObjectId(rawCategory));
    } else {
      // Find matching categories by exact name or slug
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

    if (categoryIds.length > 0) {
      // A provider's category is the exact category assigned during registration (categories array or legacy category field)
      filter.$or = [
        { categories: { $in: categoryIds } },
        { category: { $in: categoryIds } }
      ];
    } else {
      // Unmatched category name passed; return empty results
      filter._id = new mongoose.Types.ObjectId();
    }
  }

  // 1b. Resolve Specific Service Filter
  // If query.service is provided:
  // - If it's a provider-owned custom service (service.provider != null), match only that provider.
  // - If it's an admin catalog service (service.provider == null), match verified providers whose categories include service.category.
  if (query.service && String(query.service).trim()) {
    const rawService = String(query.service).trim();
    if (mongoose.Types.ObjectId.isValid(rawService)) {
      requestedService = await Service.findOne({ _id: rawService, isActive: true }).lean();
    } else {
      requestedService = await Service.findOne({
        name: new RegExp(`^${escapeRegex(rawService)}$`, 'i'),
        isActive: true
      }).lean();
    }

    if (requestedService) {
      if (requestedService.provider) {
        // Provider-owned custom service: match exact provider owner
        filter._id = requestedService.provider;
      } else if (requestedService.category) {
        // Platform catalog service: match providers who offer this category
        filter.categories = { $in: [requestedService.category] };
      }
    } else {
      // Specified service was not found; return empty match
      filter._id = new mongoose.Types.ObjectId();
    }
  }

  // 1c. Resolve Dynamic Service Tag Filter (by tagId or tag name)
  let requestedTagDoc = null;
  const requestedTag = query.tagId || query.tag;
  if (requestedTag && String(requestedTag).trim() && String(requestedTag).trim() !== 'all') {
    const rawTag = String(requestedTag).trim();
    let tagDoc = null;
    if (mongoose.Types.ObjectId.isValid(rawTag)) {
      tagDoc = await ServiceTag.findOne({
        _id: rawTag,
        isActive: true,
        isCustomerVisible: true,
        isArchived: false
      }).lean();
    } else {
      tagDoc = await ServiceTag.findOne({
        name: new RegExp(`^${escapeRegex(rawTag)}$`, 'i'),
        isActive: true,
        isCustomerVisible: true,
        isArchived: false
      }).lean();
    }
    requestedTagDoc = tagDoc;

    if (tagDoc) {
      filter.serviceTags = {
        $elemMatch: {
          tag: tagDoc._id,
          isActive: true,
          approvalStatus: 'approved'
        }
      };
    } else {
      filter._id = new mongoose.Types.ObjectId();
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

  // 3. Optional Location / City / Service Area filtering
  if (query.city && String(query.city).trim()) {
    const cityRegex = new RegExp(escapeRegex(query.city.trim()), 'i');
    const matchedAreas = await ServiceArea.find({
      city: cityRegex,
      isActive: true
    }).select('_id').lean();

    if (matchedAreas.length > 0) {
      const areaIds = matchedAreas.map((a) => a._id);
      // Filter providers who serve these areas, or if none have explicit areas configured, keep all active providers in marketplace
      const providersInArea = await Provider.countDocuments({
        serviceAreas: { $in: areaIds },
        verificationStatus: 'verified',
        isDeleted: { $ne: true }
      });
      if (providersInArea > 0) {
        filter.serviceAreas = { $in: areaIds };
      }
    }
  }

  // Parse customer coordinates if passed
  const customerLat = query.latitude !== undefined && !Number.isNaN(Number(query.latitude))
    ? Number(query.latitude)
    : null;
  const customerLng = query.longitude !== undefined && !Number.isNaN(Number(query.longitude))
    ? Number(query.longitude)
    : null;

  // Haversine formula to compute distance in km between two geo coordinates
  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

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
    .populate('serviceTags.tag', 'name slug category subcategory icon image')
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

  const categoryFilterId = query.category || query.categoryId;
  let eligibleCategoryTagIds = null;
  if (categoryFilterId) {
    eligibleCategoryTagIds = await ServiceTag.find({
      category: categoryFilterId,
      isActive: true,
      isCustomerVisible: true,
      isArchived: false
    }).distinct('_id');
  }

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

      // Use configured rates from provider's serviceTags and custom services
      const categoryIds = Array.isArray(p.categories) ? p.categories.map((c) => c._id || c) : [];
      const providerOwnedServices = await Service.find({ provider: p._id, isActive: true })
        .select('price priceType category')
        .lean();

      const rateInfo = buildProviderStandardRateResponse(p, {
        categoryId: categoryFilterId,
        tagId: requestedTagDoc?._id || query.tagId,
        serviceId: requestedService?._id,
        eligibleTagIds: eligibleCategoryTagIds,
        providerServices: providerOwnedServices
      });

      const specialization =
        p.categories && p.categories.length > 0 ? p.categories[0].name : (p.specialization || '');

      // Compute geographic distance & service radius matching
      let distanceKm = null;
      let isWithinRadius = true;
      let matchedServiceArea = null;

      if (categoryIds.length > 0 && Array.isArray(p.serviceAreasConfig)) {
        matchedServiceArea = p.serviceAreasConfig.find(
          (a) => a.isActive !== false && categoryIds.some((cid) => cid.toString() === (a.category?._id || a.category)?.toString())
        );
      } else if (Array.isArray(p.serviceAreasConfig) && p.serviceAreasConfig.length > 0) {
        matchedServiceArea = p.serviceAreasConfig.find((a) => a.isActive !== false);
      }

      if (customerLat != null && customerLng != null) {
        if (matchedServiceArea && isValidGeoJsonCoordinates(matchedServiceArea.location?.coordinates)) {
          const [pLng, pLat] = matchedServiceArea.location.coordinates;
          distanceKm = calculateHaversineDistanceKm(customerLat, customerLng, pLat, pLng);
          isWithinRadius = distanceKm <= matchedServiceArea.radiusKm;
        } else if (categoryIds.length > 0) {
          // Provider has not configured an area for this requested service
          isWithinRadius = false;
        } else if (p.location?.coordinates?.length === 2 && isValidGeoJsonCoordinates(p.location.coordinates)) {
          const [pLng, pLat] = p.location.coordinates;
          distanceKm = calculateHaversineDistanceKm(customerLat, customerLng, pLat, pLng);
          isWithinRadius = true;
        } else {
          isWithinRadius = false;
        }
      }

      return {
        _id: p._id,
        businessName: p.businessName || p.user?.name || '',
        bio: p.bio,
        avatar: p.user?.avatar || null,
        experienceYears: p.experienceYears || 0,
        categories: p.categories,
        specialization,
        rating: ratingObj,
        pricing: rateInfo.pricing,
        standardRate: rateInfo.standardRate,
        rateStatus: rateInfo.rateStatus,
        amount: rateInfo.amount,
        pricingType: rateInfo.pricingType,
        sourceType: rateInfo.sourceType,
        tagId: rateInfo.tagId,
        serviceId: rateInfo.serviceId,
        servicePrice: rateInfo.servicePrice,
        completedBookingsCount: p.completedBookingsCount,
        showInTopRated: Boolean(p.showInTopRated),
        topRatedOrder: p.topRatedOrder || 0,
        user: p.user,
        isAvailable: p.isAvailable,
        businessAddress: p.businessAddress || null,
        location: matchedServiceArea?.location || p.location || null,
        serviceArea: matchedServiceArea || null,
        serviceRadiusKm: matchedServiceArea?.radiusKm || null,
        distance: distanceKm, // Real distance in km, or null if coordinates unavailable
        distanceKm,
        isWithinRadius,
        activeTags: (p.serviceTags || [])
          .filter((st) => st.isActive !== false && st.approvalStatus === 'approved' && st.tag)
          .map((st) => ({
            _id: st.tag?._id || st.tag,
            name: st.tag?.name,
            subcategory: st.tag?.subcategory?.name
          }))
      };
    })
  );

  let finalProviders = enrichedProviders;
  if (customerLat != null && customerLng != null) {
    finalProviders = enrichedProviders
      .filter((p) => p.isWithinRadius)
      .sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
  }

  // If pagination parameters were explicitly passed, return pagination object
  if (page !== undefined || (query.limit !== undefined && query.includePagination === 'true')) {
    const currentLimit = limit || finalProviders.length;
    const paginatedProviders = finalProviders.slice(0, currentLimit);
    return {
      providers: paginatedProviders,
      pagination: {
        page: page || 1,
        limit: currentLimit,
        total: finalProviders.length,
        totalPages: Math.ceil(finalProviders.length / (currentLimit || 1)) || 1
      }
    };
  }

  // Default array return for direct compatibility with existing clients
  finalProviders.pagination = {
    page: 1,
    limit: limit || finalProviders.length,
    total: finalProviders.length,
    totalPages: limit ? (Math.ceil(finalProviders.length / limit) || 1) : 1
  };

  return finalProviders;
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
    .populate('serviceTags.tag', 'name slug category subcategory icon image')
    .lean();

  if (!provider || provider.verificationStatus !== 'verified' || !provider.user || !provider.user.isActive) {
    const err = new Error('Provider not found or not currently available');
    err.statusCode = 404;
    throw err;
  }

  // Find provider-specific services OR platform-standard services matching the provider's registered categories
  const categoryIds = Array.isArray(provider.categories) ? provider.categories.map((c) => c._id || c) : [];
  const rawServices = await Service.find({
    $or: [
      { provider: provider._id },
      { category: { $in: categoryIds }, provider: null }
    ],
    isActive: true
  })
    .populate('category', 'name slug icon')
    .lean();

  const services = rawServices.map((s) => ({
    ...s,
    basePrice: s.price,
    pricingType: s.priceType || 'fixed'
  }));

  const providerOwnedServices = rawServices.filter(
    (s) => s.provider && String(s.provider) === String(provider._id)
  );
  const rateInfo = buildProviderStandardRateResponse(provider, {
    providerServices: providerOwnedServices
  });

  return {
    _id: provider._id,
    businessName: provider.businessName,
    bio: provider.bio,
    experienceYears: provider.experienceYears,
    categories: provider.categories,
    serviceAreas: provider.serviceAreas,
    rating: provider.rating,
    pricing: rateInfo.pricing,
    standardRate: rateInfo.standardRate,
    rateStatus: rateInfo.rateStatus,
    amount: rateInfo.amount,
    pricingType: rateInfo.pricingType,
    sourceType: rateInfo.sourceType,
    tagId: rateInfo.tagId,
    serviceId: rateInfo.serviceId,
    servicePrice: rateInfo.servicePrice,
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
    reviewCount: provider.rating?.count || 0,
    activeTags: (provider.serviceTags || [])
      .filter((st) => st.isActive !== false && st.approvalStatus === 'approved' && st.tag)
      .map((st) => ({
        _id: st.tag?._id || st.tag,
        name: st.tag?.name,
        subcategory: st.tag?.subcategory?.name
      }))
  };
};

/**
 * Check provider availability for a requested date and time slot.
 * If provider is busy or unavailable, returns alternatives from the EXACT SAME category.
 */
const getProviderSlotAvailability = async ({ providerId, date, startTime, endTime, serviceId }) => {
  if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
    const err = new Error('A valid providerId is required');
    err.statusCode = 400;
    throw err;
  }

  if (!date || !startTime || !endTime) {
    const err = new Error('Date, startTime, and endTime are required to check slot availability');
    err.statusCode = 400;
    throw err;
  }

  let provider = await Provider.findById(providerId)
    .populate('user', 'name avatar isActive')
    .populate('categories', 'name slug icon')
    .lean();

  if (!provider) {
    provider = await Provider.findOne({ user: providerId })
      .populate('user', 'name avatar isActive')
      .populate('categories', 'name slug icon')
      .lean();
  }

  if (!provider || provider.verificationStatus !== 'verified' || !provider.user?.isActive || provider.isDeleted) {
    const err = new Error('Provider not found or not active');
    err.statusCode = 404;
    throw err;
  }

  // Parse target date and day of week
  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    const err = new Error('Invalid date provided');
    err.statusCode = 400;
    throw err;
  }

  const dateStr = formatDateToDateStr(targetDate);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dayOfWeek = targetDate.getDay();

  // Normalize requested slot
  const normSlot = normalizeTimeSlot({ startTime, endTime });
  const reqStartMin = normSlot?.startMinutes ?? parseTimeToMinutes(startTime);
  const reqEndMin = normSlot?.endMinutes ?? parseTimeToMinutes(endTime);
  const canonicalStart = normSlot?.startTime || startTime;
  const canonicalEnd = normSlot?.endTime || endTime;
  const requestedTicks = (reqStartMin !== null && reqEndMin !== null)
    ? generateSlotTicks(reqStartMin, reqEndMin)
    : [];

  // 1. Check working hours schedule in Availability collection
  const availabilityDoc = await Availability.findOne({
    provider: provider._id,
    dayOfWeek
  }).lean();

  let isWorkingHours = true;
  let workingHoursReason = null;

  if (availabilityDoc) {
    if (!availabilityDoc.isAvailable) {
      isWorkingHours = false;
      workingHoursReason = `Provider is off duty on this day of the week`;
    } else if (availabilityDoc.slots && availabilityDoc.slots.length > 0) {
      const slotMatch = availabilityDoc.slots.some((slot) => {
        const sMin = parseTimeToMinutes(slot.startTime);
        const eMin = parseTimeToMinutes(slot.endTime);
        if (sMin !== null && eMin !== null && reqStartMin !== null) {
          return reqStartMin >= sMin && reqStartMin < eMin;
        }
        return canonicalStart >= slot.startTime && canonicalStart < slot.endTime;
      });
      if (!slotMatch) {
        isWorkingHours = false;
        workingHoursReason = `The requested time ${startTime} is outside provider's scheduled working hours`;
      }
    }
  }

  // 2. Check for overlapping active bookings and slot reservations
  const activeBookings = await Booking.find({
    provider: provider._id,
    status: { $in: ['pending', 'accepted', 'in_progress'] },
    bookingMode: 'scheduled',
    scheduledDate: { $gte: startOfDay, $lte: endOfDay }
  })
    .select('bookingReference status scheduledDate scheduledTimeSlot service')
    .lean();

  const conflictingBookings = activeBookings.filter((b) => {
    if (!b.scheduledTimeSlot) return false;
    const bSlot = normalizeTimeSlot(b.scheduledTimeSlot);
    if (bSlot && reqStartMin !== null && reqEndMin !== null) {
      return doIntervalsOverlap(reqStartMin, reqEndMin, bSlot.startMinutes, bSlot.endMinutes);
    }
    const bStart = (b.scheduledTimeSlot.startTime || '').trim();
    const bEnd = (b.scheduledTimeSlot.endTime || '').trim();
    return bStart < canonicalEnd && bEnd > canonicalStart;
  });

  let hasReservationConflict = false;
  if (requestedTicks.length > 0) {
    const existingReservation = await ProviderSlotReservation.findOne({
      provider: provider._id,
      dateStr,
      timeSlot: { $in: requestedTicks }
    }).lean();
    if (existingReservation) {
      hasReservationConflict = true;
    }
  }

  const hasBookingConflict = conflictingBookings.length > 0 || hasReservationConflict;
  const isAvailable = provider.isAvailable && isWorkingHours && !hasBookingConflict;

  let busyReason = null;
  if (!provider.isAvailable) {
    busyReason = 'Provider is currently offline/unavailable';
  } else if (!isWorkingHours) {
    busyReason = workingHoursReason || 'Outside working hours';
  } else if (hasBookingConflict) {
    busyReason = 'This provider is already booked for the selected time. Please choose another time or provider.';
  }

  // 3. If busy/unavailable, find alternatives from the EXACT SAME category
  let alternativeProviders = [];
  let primaryCategory = null;
  let categoryId = null;

  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    const s = await Service.findById(serviceId).populate('category', 'name slug icon').lean();
    if (s && s.category) {
      primaryCategory = s.category;
      categoryId = s.category._id || s.category;
    }
  }

  if (!categoryId && Array.isArray(provider.categories) && provider.categories.length > 0) {
    primaryCategory = provider.categories[0];
    categoryId = primaryCategory?._id || primaryCategory;
  }

  if (!isAvailable && categoryId) {
    // Find all other verified active providers in this exact category
    const otherProviders = await Provider.find({
      _id: { $ne: provider._id },
      verificationStatus: 'verified',
      isAvailable: true,
      isDeleted: { $ne: true },
      categories: { $in: [categoryId] }
    })
      .populate('user', 'name avatar isActive')
      .populate('categories', 'name slug icon')
      .lean();

    const activeOtherProviders = otherProviders.filter((p) => p.user && p.user.isActive);

    // Filter which ones are free during this time slot
    for (const alt of activeOtherProviders) {
      // Check schedule
      const altAvail = await Availability.findOne({
        provider: alt._id,
        dayOfWeek
      }).lean();

      if (altAvail && !altAvail.isAvailable) {
        continue;
      }
      if (altAvail && altAvail.slots && altAvail.slots.length > 0) {
        const slotMatch = altAvail.slots.some((s) => {
          const sMin = parseTimeToMinutes(s.startTime);
          const eMin = parseTimeToMinutes(s.endTime);
          if (sMin !== null && eMin !== null && reqStartMin !== null) {
            return reqStartMin >= sMin && reqStartMin < eMin;
          }
          return canonicalStart >= s.startTime && canonicalStart < s.endTime;
        });
        if (!slotMatch) continue;
      }

      // Check overlapping bookings
      const altBookings = await Booking.find({
        provider: alt._id,
        status: { $in: ['pending', 'accepted', 'in_progress'] },
        bookingMode: 'scheduled',
        scheduledDate: { $gte: startOfDay, $lte: endOfDay }
      }).select('scheduledTimeSlot').lean();

      const altHasConflict = altBookings.some((b) => {
        if (!b.scheduledTimeSlot) return false;
        const bSlot = normalizeTimeSlot(b.scheduledTimeSlot);
        if (bSlot && reqStartMin !== null && reqEndMin !== null) {
          return doIntervalsOverlap(reqStartMin, reqEndMin, bSlot.startMinutes, bSlot.endMinutes);
        }
        return (b.scheduledTimeSlot.startTime || '') < canonicalEnd && (b.scheduledTimeSlot.endTime || '') > canonicalStart;
      });

      if (!altHasConflict) {
        if (requestedTicks.length > 0) {
          const resConflict = await ProviderSlotReservation.findOne({
            provider: alt._id,
            dateStr,
            timeSlot: { $in: requestedTicks }
          }).lean();
          if (resConflict) continue;
        }

        // Compute starting price
        const altService = await Service.findOne({
          $or: [
            { provider: alt._id },
            { category: categoryId, provider: null }
          ],
          isActive: true
        })
          .sort({ price: 1 })
          .select('price')
          .lean();

        alternativeProviders.push({
          _id: alt._id,
          businessName: alt.businessName || alt.user?.name || 'Verified Provider',
          avatar: alt.user?.avatar || null,
          rating: alt.rating || 0,
          reviewCount: alt.reviewCount || 0,
          startingPrice: altService ? altService.price : null
        });
      }
    }
  }

  return {
    providerId: provider._id,
    businessName: provider.businessName || provider.user?.name,
    requestedDate: date,
    requestedSlot: { startTime, endTime },
    isAvailable,
    status: isAvailable ? 'available' : 'busy',
    reason: busyReason,
    category: primaryCategory,
    alternativeProviders
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

  if (query.pendingQueue) {
    filter.isDeleted = { $ne: true };
    const pendingConditions = [
      { verificationStatus: 'pending' },
      {
        kycStatus: { $in: ['PENDING', 'under_review'] },
        kycSubmittedAt: { $ne: null }
      },
      {
        kycStatus: 'pending',
        kycSubmittedAt: { $ne: null },
        aadhaarFrontImage: { $ne: null },
        aadhaarBackImage: { $ne: null },
        panFrontImage: { $ne: null },
        panBackImage: { $ne: null }
      },
      {
        'serviceCertification.documentUrl': { $ne: null },
        'serviceCertification.verificationStatus': 'PENDING'
      }
    ];
    if (filter.$or) {
      filter.$and = [{ $or: pendingConditions }, { $or: filter.$or }];
      delete filter.$or;
    } else {
      filter.$or = pendingConditions;
    }
  } else if (query.verificationStatus && query.verificationStatus !== 'all') {
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
    const searchConditions = [{ businessName: searchRegex }, { bio: searchRegex }];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .populate('user', 'name email phone avatar role isActive isVerified isDeleted createdAt')
      .populate('categories', 'name slug icon isActive')
      .populate('serviceCertification.category', 'name slug icon')
      .populate('serviceCertification.tag', 'name slug subcategory')
      .populate('serviceCertification.reviewedBy', 'name email')
      .populate('verificationReviewedBy', 'name email')
      .populate('documents.reviewedBy', 'name email')
      .sort({ showInTopRated: -1, topRatedOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Provider.countDocuments(filter)
  ]);

  return {
    providers: providers.map((provider) => ({
      ...provider,
      kycStatus: normalizeKycStatus(provider)
    })),
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
    .populate('serviceCertification.category', 'name slug icon')
    .populate('serviceCertification.tag', 'name slug subcategory')
    .populate('serviceCertification.reviewedBy', 'name email')
    .populate('kycReviewedBy', 'name email')
    .populate('verificationReviewedBy', 'name email')
    .populate('documents.reviewedBy', 'name email')
    .lean();

  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  return {
    ...provider,
    kycStatus: normalizeKycStatus(provider)
  };
};

/**
 * Admin: Review an individual document
 */
const reviewDocument = async (providerId, documentId, adminUserId, { status, reviewNote }) => {
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

  if (KYC_DOCUMENT_FIELDS[doc.type.toLowerCase()]) {
    const fields = KYC_DOCUMENT_FIELDS[doc.type.toLowerCase()];
    if (normalizeKycStatus(provider) !== 'PENDING') {
      const err = new Error('KYC documents can only be individually reviewed while the KYC application is pending');
      err.statusCode = 409;
      throw err;
    }
    if (status !== 'approved') {
      const err = new Error('Reject KYC documents through the dedicated KYC review action');
      err.statusCode = 400;
      throw err;
    }
    if (!provider[fields.image] || doc.documentUrl !== provider[fields.image]) {
      const err = new Error("KYC document does not match the provider's current uploaded document");
      err.statusCode = 409;
      throw err;
    }
    if (doc.verificationStatus !== 'pending') {
      const err = new Error('Only pending KYC documents can be individually approved');
      err.statusCode = 409;
      throw err;
    }
  }

  const reviewedAt = new Date();
  const reviewFilter = {
    _id: provider._id,
    documents: {
      $elemMatch: {
        _id: doc._id,
        type: doc.type,
        documentUrl: doc.documentUrl,
        verificationStatus: doc.verificationStatus
      }
    }
  };
  const kycFields = KYC_DOCUMENT_FIELDS[doc.type.toLowerCase()];
  if (kycFields) {
    reviewFilter.kycStatus = provider.kycStatus;
    reviewFilter[kycFields.image] = doc.documentUrl;
  }
  const reviewedProvider = await Provider.findOneAndUpdate(
    reviewFilter,
    {
      $set: {
        'documents.$.verificationStatus': status,
        'documents.$.reviewNote': reviewNote ? reviewNote.trim() : '',
        'documents.$.reviewedAt': reviewedAt,
        'documents.$.reviewedBy': adminUserId
      }
    },
    { new: true, runValidators: true }
  );
  if (!reviewedProvider) {
    const err = new Error('Document status changed during review. Reload the provider and try again.');
    err.statusCode = 409;
    throw err;
  }

  return await getAdminProviderById(providerId);
};

/**
 * Admin: Approve, Reject or Suspend overall provider verification
 */
const updateProviderVerification = async (providerId, adminUserId, { status, rejectionReason }) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  const reviewedAt = new Date();
  provider.verificationReviewedAt = reviewedAt;
  provider.verificationReviewedBy = adminUserId;

  if (status === 'verified') {
    provider.verificationStatus = 'verified';
    provider.rejectionReason = null;
    provider.verifiedAt = reviewedAt;

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

/**
 * Upload or replace optional service certification document
 */
const uploadServiceCertification = async (userId, file, { categoryId, tagId }) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (!file) {
    const err = new Error('No certificate file provided');
    err.statusCode = 400;
    throw err;
  }

  if (!categoryId || !tagId) {
    const err = new Error('Category ID and Service Tag ID are required');
    err.statusCode = 400;
    throw err;
  }

  // Validate Category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error('Selected category not found');
    err.statusCode = 404;
    throw err;
  }

  // Validate ServiceTag exists and belongs to the selected Category
  const serviceTag = await ServiceTag.findById(tagId);
  if (!serviceTag) {
    const err = new Error('Selected service tag not found');
    err.statusCode = 404;
    throw err;
  }

  if (serviceTag.category.toString() !== category._id.toString()) {
    const err = new Error('Selected service tag does not belong to the selected category');
    err.statusCode = 400;
    throw err;
  }

  // Validate Provider has this category or service tag selected
  const hasCategory = (provider.categories || []).some(
    (c) => c.toString() === category._id.toString()
  );
  const hasTag = (provider.serviceTags || []).some(
    (st) => st.tag && st.tag.toString() === serviceTag._id.toString()
  );

  // If provider has configured categories or tags, ensure association matches provider's services
  if (!hasCategory && !hasTag && (provider.categories?.length > 0 || provider.serviceTags?.length > 0)) {
    const err = new Error('Cannot upload certification for a service category or tag you do not provide');
    err.statusCode = 400;
    throw err;
  }

  // Ensure matching provider service tag is active and not rejected
  const providerTag = (provider.serviceTags || []).find(
    (st) => st.tag && st.tag.toString() === serviceTag._id.toString()
  );
  if (provider.serviceTags?.length > 0 && providerTag && (providerTag.isActive === false || providerTag.approvalStatus === 'rejected')) {
    const err = new Error('Cannot upload certification for an inactive or rejected service tag');
    err.statusCode = 400;
    throw err;
  }

  const { uploadDocument, deleteAsset } = require('../config/cloudinary');
  let uploadResult;
  try {
    uploadResult = await uploadDocument(file, {
      folder: 'marketplace/certifications',
      public_id: `cert_${provider._id}_${Date.now()}`
    });
  } catch (uploadErr) {
    const err = new Error(`Certificate upload to Cloudinary failed: ${uploadErr.message}`);
    err.statusCode = 502;
    throw err;
  }

  const previousCertification = provider.serviceCertification;
  const isNewPdf = (file.mimetype || '').toLowerCase().includes('pdf') ||
                   (file.originalname || '').toLowerCase().endsWith('.pdf');
  const certification = {
    documentUrl: uploadResult.url,
    publicId: uploadResult.public_id,
    originalFileName: file.originalname || 'certificate',
    category: category._id,
    tag: serviceTag._id,
    uploadedAt: new Date(),
    verificationStatus: 'PENDING',
    rejectionReason: null,
    reviewedAt: null,
    reviewedBy: null
  };

  const updatedProvider = await Provider.findByIdAndUpdate(
    provider._id,
    { $set: { serviceCertification: certification } },
    { new: true, runValidators: true }
  );
  if (!updatedProvider) {
    await deleteAsset(uploadResult.public_id, isNewPdf ? 'raw' : 'auto').catch(() => {});
    const err = new Error('Failed to update provider record with certificate metadata.');
    err.statusCode = 500;
    throw err;
  }

  // If replacing an existing certificate, clean up the old asset from storage
  if (previousCertification?.publicId && previousCertification.publicId !== uploadResult.public_id) {
    const wasOldPdf = (previousCertification.originalFileName || '').toLowerCase().endsWith('.pdf');
    await deleteAsset(previousCertification.publicId, wasOldPdf ? 'raw' : 'auto').catch((delErr) => {
      console.warn('[Cloudinary deleteAsset warning]:', delErr.message);
    });
  }

  return await Provider.findById(updatedProvider._id)
    .populate('serviceCertification.category', 'name slug icon')
    .populate('serviceCertification.tag', 'name slug subcategory')
    .select('serviceCertification')
    .lean();
};

/**
 * Get current provider's service certification
 */
const getServiceCertification = async (userId) => {
  const provider = await Provider.findOne({ user: userId })
    .populate('serviceCertification.category', 'name slug icon')
    .populate('serviceCertification.tag', 'name slug subcategory')
    .select('serviceCertification')
    .lean();

  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  return provider.serviceCertification || null;
};

/**
 * Remove optional service certification
 */
const removeServiceCertification = async (userId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (!provider.serviceCertification?.documentUrl) {
    return { message: 'No certification document to remove' };
  }

  const previousCertification = provider.serviceCertification;
  const updatedProvider = await Provider.findByIdAndUpdate(
    provider._id,
    {
      $set: {
        serviceCertification: {
          documentUrl: null,
          publicId: null,
          originalFileName: null,
          category: null,
          tag: null,
          uploadedAt: null,
          verificationStatus: 'PENDING',
          rejectionReason: null,
          reviewedAt: null,
          reviewedBy: null
        }
      }
    },
    { new: true, runValidators: true }
  );
  if (!updatedProvider) {
    const err = new Error('Failed to update provider profile to remove certificate.');
    err.statusCode = 500;
    throw err;
  }

  if (previousCertification?.publicId) {
    const { deleteAsset } = require('../config/cloudinary');
    const isPdf = (previousCertification.originalFileName || '').toLowerCase().endsWith('.pdf');
    await deleteAsset(previousCertification.publicId, isPdf ? 'raw' : 'auto').catch((delErr) => {
      console.warn('[Cloudinary deleteAsset warning]:', delErr.message);
    });
  }

  return { message: 'Service certification removed successfully' };
};

/**
 * Admin: Review / Verify service certification
 */
const reviewServiceCertification = async (providerId, adminUserId, { status, rejectionReason }) => {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    const err = new Error(`Provider not found with ID '${providerId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (!provider.serviceCertification?.documentUrl) {
    const err = new Error('Provider does not have an uploaded service certification to review');
    err.statusCode = 400;
    throw err;
  }

  if (!['VERIFIED', 'REJECTED'].includes(status)) {
    const err = new Error("Status must be either 'VERIFIED' or 'REJECTED'");
    err.statusCode = 400;
    throw err;
  }

  if (status === 'REJECTED') {
    if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      const err = new Error('Rejection reason is mandatory when rejecting a certification');
      err.statusCode = 400;
      throw err;
    }
    provider.serviceCertification.verificationStatus = 'REJECTED';
    provider.serviceCertification.rejectionReason = rejectionReason.trim();
  } else {
    provider.serviceCertification.verificationStatus = 'VERIFIED';
    provider.serviceCertification.rejectionReason = null;
  }

  provider.serviceCertification.reviewedAt = new Date();
  provider.serviceCertification.reviewedBy = adminUserId;

  // IMPORTANT: Do not modify provider.kycStatus or provider.verificationStatus
  await provider.save();

  return await Provider.findById(provider._id)
    .populate('serviceCertification.category', 'name slug icon')
    .populate('serviceCertification.tag', 'name slug subcategory')
    .populate('serviceCertification.reviewedBy', 'name email')
    .lean();
};

/**
 * ------------------------------------------------------------------
 * SERVICE-LEVEL RADIUS & LOCATION MANAGEMENT (PROVIDER APP)
 * ------------------------------------------------------------------
 */

const getProviderServiceAreaConfigs = async (userId) => {
  const provider = await Provider.findOne({ user: userId })
    .populate('categories', 'name slug icon')
    .populate('serviceAreasConfig.category', 'name slug icon');

  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Ensure default radius configs are seeded
  await serviceRadiusService.listRadiusConfigs();

  // Find all categories offered by the provider
  const categoryIds = (provider.categories || []).map((c) => (c._id || c).toString());

  // Also include any categories present in approved serviceTags
  if (provider.serviceTags && provider.serviceTags.length > 0) {
    const tagIds = provider.serviceTags
      .filter((st) => st.isActive && st.approvalStatus === 'approved')
      .map((st) => st.tag);
    const tags = await ServiceTag.find({ _id: { $in: tagIds } }).select('category').lean();
    for (const t of tags) {
      if (t.category && !categoryIds.includes(t.category.toString())) {
        categoryIds.push(t.category.toString());
      }
    }
  }

  // Fetch admin radius configs for these categories
  const radiusConfigs = await ServiceRadiusConfig.find({
    category: { $in: categoryIds },
    isActive: true
  })
    .populate('category', 'name slug icon')
    .lean();

  const configsMap = {};
  for (const rc of radiusConfigs) {
    const catId = (rc.category?._id || rc.category).toString();
    configsMap[catId] = {
      _id: rc._id,
      category: rc.category,
      serviceName: rc.serviceName,
      maxRadiusKm: rc.maxRadiusKm,
      allowedRadii: (rc.allowedRadii || []).filter((r) => r.isActive !== false)
    };
  }

  // Build combined summary per category
  const categoriesList = await Category.find({ _id: { $in: categoryIds } }).lean();

  const services = categoriesList.map((cat) => {
    const catIdStr = cat._id.toString();
    const existingArea = (provider.serviceAreasConfig || []).find(
      (a) => (a.category?._id || a.category)?.toString() === catIdStr
    );
    const radiusRule = configsMap[catIdStr] || {
      category: cat,
      serviceName: cat.name,
      maxRadiusKm: 15,
      allowedRadii: [
        { km: 2, isActive: true },
        { km: 5, isActive: true },
        { km: 10, isActive: true }
      ]
    };

    return {
      category: cat,
      serviceName: cat.name,
      isConfigured: Boolean(existingArea && existingArea.isActive),
      serviceArea: existingArea || null,
      radiusRule
    };
  });

  return {
    providerId: provider._id,
    serviceAreas: provider.serviceAreasConfig || [],
    services
  };
};

const getProviderAllowedRadiusOptions = async (userId, categoryId) => {
  const config = await serviceRadiusService.getRadiusConfigByCategory(categoryId);
  if (!config || !config.isActive) {
    const err = new Error('No active radius configuration found for this service');
    err.statusCode = 404;
    throw err;
  }

  return {
    category: config.category,
    serviceName: config.serviceName,
    maxRadiusKm: config.maxRadiusKm,
    allowedRadii: (config.allowedRadii || []).filter((r) => r.isActive !== false)
  };
};

const updateProviderServiceAreaConfig = async (userId, categoryOrPayload, maybePayload) => {
  let categoryId = null;
  let payload = {};

  if (maybePayload && typeof maybePayload === 'object') {
    payload = maybePayload;
    categoryId = categoryOrPayload?._id || categoryOrPayload;
  } else if (categoryOrPayload && typeof categoryOrPayload === 'object' && !(categoryOrPayload instanceof mongoose.Types.ObjectId)) {
    payload = categoryOrPayload;
    categoryId = payload.categoryId?._id || payload.categoryId || payload.category?._id || payload.category;
  } else {
    categoryId = categoryOrPayload?._id || categoryOrPayload;
    payload = maybePayload || {};
  }

  const { radiusKm, address, coordinates, locationSource = 'gps' } = payload;

  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (provider.isDeleted) {
    const err = new Error('Provider profile is inactive or deleted');
    err.statusCode = 403;
    throw err;
  }

  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    const err = new Error('Valid category ID is required');
    err.statusCode = 400;
    throw err;
  }

  const category = await Category.findById(categoryId);
  if (!category || category.isActive === false) {
    const err = new Error('Service category is not active or not found');
    err.statusCode = 400;
    throw err;
  }

  let cleanCoords = null;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    cleanCoords = [Number(coordinates[0]), Number(coordinates[1])];
  } else if (payload.location?.coordinates && Array.isArray(payload.location.coordinates)) {
    cleanCoords = [Number(payload.location.coordinates[0]), Number(payload.location.coordinates[1])];
  } else if (payload.latitude !== undefined && payload.longitude !== undefined) {
    cleanCoords = [Number(payload.longitude), Number(payload.latitude)];
  } else if (address?.location?.coordinates && Array.isArray(address.location.coordinates)) {
    cleanCoords = [Number(address.location.coordinates[0]), Number(address.location.coordinates[1])];
  }

  if (!isValidGeoJsonCoordinates(cleanCoords, false)) {
    const err = new Error(
      'Valid coordinates (latitude and longitude) are required. Dummy or missing coordinates are rejected.'
    );
    err.statusCode = 400;
    throw err;
  }

  const numRadius = Number(radiusKm);
  if (isNaN(numRadius) || numRadius <= 0) {
    const err = new Error('Selected radius must be a positive number greater than 0 KM');
    err.statusCode = 400;
    throw err;
  }

  const radiusRule = await serviceRadiusService.getRadiusConfigByCategory(categoryId);
  if (!radiusRule || !radiusRule.isActive) {
    const err = new Error(`Admin has not activated radius configurations for '${category.name}'`);
    err.statusCode = 400;
    throw err;
  }

  if (numRadius > radiusRule.maxRadiusKm) {
    const err = new Error(
      `Selected radius of ${numRadius} KM exceeds Admin maximum limit of ${radiusRule.maxRadiusKm} KM for '${category.name}'`
    );
    err.statusCode = 400;
    throw err;
  }

  const activeRadii = (radiusRule.allowedRadii || []).filter((r) => r.isActive !== false);
  const isValidOption = activeRadii.some((r) => Number(r.km) === numRadius);
  if (!isValidOption) {
    const allowedList = activeRadii.map((r) => `${r.km} KM`).join(', ');
    const err = new Error(
      `Selected radius of ${numRadius} KM is not an approved active option. Allowed options: ${allowedList}`
    );
    err.statusCode = 400;
    throw err;
  }

  const addrObj = address || {};
  const formattedAddress = (
    addrObj.formattedAddress ||
    [addrObj.street, addrObj.locality, addrObj.city, addrObj.state, addrObj.zipCode]
      .filter(Boolean)
      .join(', ') ||
    'Service Location'
  ).trim();

  const areaConfigData = {
    category: category._id,
    serviceName: category.name,
    radiusKm: numRadius,
    address: {
      street: (addrObj.street || '').trim(),
      locality: (addrObj.locality || '').trim(),
      city: (addrObj.city || '').trim(),
      state: (addrObj.state || '').trim(),
      zipCode: (addrObj.zipCode || '').trim(),
      formattedAddress
    },
    location: {
      type: 'Point',
      coordinates: cleanCoords
    },
    locationSource: locationSource === 'manual' ? 'manual' : 'gps',
    isActive: true,
    updatedAt: new Date()
  };

  if (!Array.isArray(provider.serviceAreasConfig)) {
    provider.serviceAreasConfig = [];
  }

  const existingIdx = provider.serviceAreasConfig.findIndex(
    (a) => a.category?.toString() === category._id.toString()
  );

  if (existingIdx >= 0) {
    provider.serviceAreasConfig[existingIdx] = {
      ...provider.serviceAreasConfig[existingIdx].toObject(),
      ...areaConfigData
    };
  } else {
    provider.serviceAreasConfig.push(areaConfigData);
  }

  if (!provider.categories.some((c) => c.toString() === category._id.toString())) {
    provider.categories.push(category._id);
  }

  if (!provider.location || !isValidGeoJsonCoordinates(provider.location.coordinates)) {
    provider.location = {
      type: 'Point',
      coordinates: cleanCoords
    };
  }

  await provider.save();

  return await getProviderServiceAreaConfigs(userId);
};

const deleteProviderServiceAreaConfig = async (userId, categoryId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (Array.isArray(provider.serviceAreasConfig)) {
    provider.serviceAreasConfig = provider.serviceAreasConfig.filter(
      (a) => a.category?.toString() !== categoryId.toString()
    );
    await provider.save();
  }

  return await getProviderServiceAreaConfigs(userId);
};

/**
 * Retrieve current Terms metadata and optional authenticated provider acceptance status
 */
const getTerms = async (userId = null) => {
  const {
    CURRENT_TERMS_VERSION,
    TERMS_EFFECTIVE_DATE,
    PLATFORM_NAME,
    COUNTRY,
    TERMS_SECTIONS,
    TERMS_HASH,
    RAW_TERMS_TEXT
  } = require('../constants/providerTerms');

  let acceptedInfo = null;
  if (userId) {
    const provider = await Provider.findOne({ user: userId })
      .select('acceptedTermsVersion acceptedTermsAt acceptedTermsHash acceptedTermsSource')
      .lean();
    if (provider) {
      const isAccepted =
        provider.acceptedTermsVersion === CURRENT_TERMS_VERSION &&
        Boolean(provider.acceptedTermsAt);
      acceptedInfo = {
        hasAccepted: isAccepted,
        acceptedVersion: provider.acceptedTermsVersion || null,
        acceptedAt: provider.acceptedTermsAt || null,
        acceptedSource: provider.acceptedTermsSource || null
      };
    }
  }

  return {
    version: CURRENT_TERMS_VERSION,
    effectiveDate: TERMS_EFFECTIVE_DATE,
    platformName: PLATFORM_NAME,
    country: COUNTRY,
    hash: TERMS_HASH,
    sections: TERMS_SECTIONS,
    rawText: RAW_TERMS_TEXT,
    acceptedInfo
  };
};

/**
 * Record explicit terms acceptance for authenticated existing provider
 */
const acceptTerms = async (userId, { termsVersion, termsHash, ipAddress = null } = {}) => {
  const { CURRENT_TERMS_VERSION, TERMS_HASH } = require('../constants/providerTerms');

  if (!termsVersion || termsVersion !== CURRENT_TERMS_VERSION) {
    const err = new Error(`Invalid terms version. Expected current version ${CURRENT_TERMS_VERSION}`);
    err.statusCode = 400;
    throw err;
  }

  if (termsHash && termsHash !== TERMS_HASH) {
    const err = new Error('Terms content verification failed. Supplied document hash does not match canonical version.');
    err.statusCode = 400;
    throw err;
  }

  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found for this authenticated user');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  provider.acceptedTermsVersion = CURRENT_TERMS_VERSION;
  provider.acceptedTermsAt = now;
  provider.acceptedTermsSource = 'existing_provider_login';
  provider.acceptedTermsHash = TERMS_HASH;

  if (!Array.isArray(provider.termsAcceptanceHistory)) {
    provider.termsAcceptanceHistory = [];
  }
  provider.termsAcceptanceHistory.push({
    version: CURRENT_TERMS_VERSION,
    acceptedAt: now,
    source: 'existing_provider_login',
    termsHash: TERMS_HASH,
    ipAddress: ipAddress || null
  });

  await provider.save();

  return {
    providerId: provider._id,
    acceptedTermsVersion: provider.acceptedTermsVersion,
    acceptedTermsAt: provider.acceptedTermsAt,
    acceptedTermsSource: provider.acceptedTermsSource,
    acceptedTermsHash: provider.acceptedTermsHash,
    requiresTermsAcceptance: false
  };
};

/**
 * Self-Service Provider Account Deletion (Google Play Compliance)
 * - Validates authentication & optional password confirmation
 * - Prevents deletion if provider has active ongoing jobs
 * - Cancels pending / accepted jobs
 * - Deactivates custom offered services
 * - Permanently anonymizes personal PII and suspends verification
 * - Removes device push notification tokens
 */
const deleteProviderSelf = async (userId, password) => {
  const user = await User.findById(userId);
  if (!user || user.role !== 'provider') {
    const err = new Error('Provider account not found');
    err.statusCode = 404;
    throw err;
  }

  if (user.isDeleted) {
    return {
      success: true,
      message: 'Account is already deleted.'
    };
  }

  if (password) {
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('Invalid password confirmation. Account deletion cancelled.');
      err.statusCode = 401;
      throw err;
    }
  }

  const provider = await Provider.findOne({ user: user._id });

  // Guard: Check for ongoing/in-progress bookings
  if (provider) {
    const Booking = require('../models/Booking');
    const Service = require('../models/Service');
    const activeBooking = await Booking.findOne({
      provider: provider._id,
      status: 'in_progress'
    });
    if (activeBooking) {
      const err = new Error(
        'Cannot delete provider account while a service job is in progress. Please complete or resolve active jobs first.'
      );
      err.statusCode = 400;
      throw err;
    }

    // Cancel pending and accepted bookings
    await Booking.updateMany(
      { provider: provider._id, status: { $in: ['pending', 'accepted'] } },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: 'provider',
          cancellationReason: 'Provider closed account'
        }
      }
    );

    // Deactivate custom services
    await Service.updateMany({ provider: provider._id }, { $set: { isActive: false } });
  }

  // Anonymize personal data & mark deleted
  const now = new Date();
  const anonId = user._id.toString();
  user.isActive = false;
  user.isDeleted = true;
  user.deletedAt = now;
  user.name = 'Deleted Provider';
  user.email = `deleted_${anonId}@deleted.mendroo.com`;
  user.phone = `deleted_${anonId}`;
  user.avatar = null;
  await user.save();

  if (provider) {
    provider.isAvailable = false;
    provider.isDeleted = true;
    provider.deletedAt = now;
    provider.verificationStatus = 'suspended';
    provider.showInTopRated = false;
    provider.avatar = null;
    await provider.save();
  }

  // Remove push notification tokens
  try {
    const DeviceToken = require('../models/DeviceToken');
    await DeviceToken.deleteMany({ user: user._id });
  } catch (_) {
    // Ignore if device tokens don't exist
  }

  console.log(`[USER DELETE] Provider self-deleted: ${anonId} at ${now.toISOString()}`);

  return {
    success: true,
    message: 'Your MENDROO provider account and personal data have been permanently deleted in accordance with our data retention policy.'
  };
};

module.exports = {
  getTerms,
  acceptTerms,
  getProviderProfileByUserId,
  updateProviderProfileByUserId,
  getProviderServicesByUserId,
  getProviderAvailabilityByUserId,
  updateProviderAvailabilityByUserId,
  getProviderServiceAreasByUserId,
  addProviderServiceAreaByUserId,
  updateProviderServiceAreaByUserId,
  deleteProviderServiceAreaByUserId,
  getProviderServiceAreaConfigs,
  getProviderAllowedRadiusOptions,
  updateProviderServiceAreaConfig,
  deleteProviderServiceAreaConfig,
  addProviderServiceByUserId,
  updateProviderServiceByUserId,
  updateProviderServiceStatusByUserId,
  deleteProviderServiceByUserId,
  submitDocument,
  uploadKYCDocument,
  deleteKYCDocument,
  submitKYCDocuments,
  reviewKYC,
  deleteDocument,
  uploadServiceCertification,
  getServiceCertification,
  removeServiceCertification,
  reviewServiceCertification,
  getPublicProviders,
  getPublicProviderById,
  getProviderSlotAvailability,
  getAdminProviders,
  getAdminProviderById,
  reviewDocument,
  updateProviderVerification,
  updateProviderAccountStatus,
  updateTopRatedStatus,
  deleteProviderByAdmin,
  deleteProviderSelf
};
