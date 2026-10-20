const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Availability = require('../models/Availability');
const ServiceArea = require('../models/ServiceArea');
const User = require('../models/User');
const paymentService = require('./paymentService');

/**
 * Generate unique, human-readable booking reference (e.g. BK-20261013-A1B2)
 */
const generateBookingReference = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${dateStr}-${randomChars}`;
};

/**
 * Customer creates a new booking (instant or scheduled)
 */
const createBooking = async (userId, bookingData) => {
  // 1. Verify active customer profile
  const user = await User.findById(userId);
  if (!user || user.role !== 'customer' || !user.isActive) {
    const err = new Error('Authenticated customer account is inactive or not found');
    err.statusCode = 403;
    throw err;
  }

  let customer = await Customer.findOne({ user: userId });
  if (!customer) {
    // Gracefully initialize customer profile if not yet created
    customer = await Customer.create({ user: userId, addresses: [] });
  }

  // 2. Validate Service
  const service = await Service.findById(bookingData.serviceId).populate('category');
  if (!service) {
    const err = new Error(`Service with ID '${bookingData.serviceId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (!service.isActive) {
    const err = new Error(`Service '${service.name}' is currently deactivated and cannot be booked`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate Category
  if (!service.category || !service.category.isActive) {
    const err = new Error('The category associated with this service is inactive');
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate Provider (if specified by customer)
  let assignedProvider = null;
  let candidateProviders = [];

  if (bookingData.providerId) {
    const provider = await Provider.findById(bookingData.providerId).populate('user');
    if (!provider) {
      const err = new Error(`Provider with ID '${bookingData.providerId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (provider.verificationStatus !== 'verified') {
      const err = new Error(`Provider '${provider.businessName || 'Selected'}' is not verified (status: ${provider.verificationStatus})`);
      err.statusCode = 400;
      throw err;
    }

    if (!provider.user || !provider.user.isActive || !provider.isAvailable) {
      const err = new Error('Selected provider is currently unavailable or inactive');
      err.statusCode = 400;
      throw err;
    }

    // Verify service ownership if service is provider-specific
    if (service.provider && service.provider.toString() !== provider._id.toString()) {
      const err = new Error('The selected provider does not offer this specific service');
      err.statusCode = 400;
      throw err;
    }

    // Verify provider offers category
    const offersCategory = provider.categories && provider.categories.some(
      (catId) => catId.toString() === service.category._id.toString()
    );
    if (!offersCategory) {
      const err = new Error('The selected provider does not offer this service category');
      err.statusCode = 400;
      throw err;
    }

    // Verify Provider Weekly Availability for scheduled booking
    if ((bookingData.bookingMode || 'scheduled') === 'scheduled' && bookingData.scheduledDate) {
      const targetDate = new Date(bookingData.scheduledDate);
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      const availabilityDoc = await Availability.findOne({
        provider: provider._id,
        dayOfWeek
      });

      if (availabilityDoc && !availabilityDoc.isAvailable) {
        const err = new Error(
          `Provider '${provider.businessName || 'Selected'}' is not available on this day of the week`
        );
        err.statusCode = 400;
        throw err;
      }

      if (
        availabilityDoc &&
        availabilityDoc.isAvailable &&
        availabilityDoc.slots &&
        availabilityDoc.slots.length > 0 &&
        bookingData.scheduledTimeSlot?.startTime
      ) {
        const slotMatch = availabilityDoc.slots.some(
          (slot) =>
            bookingData.scheduledTimeSlot.startTime >= slot.startTime &&
            bookingData.scheduledTimeSlot.startTime < slot.endTime
        );
        if (!slotMatch) {
          const err = new Error(
            `The requested time slot '${bookingData.scheduledTimeSlot.startTime}' is outside the provider's available working hours for this day`
          );
          err.statusCode = 400;
          throw err;
        }
      }
    }

    // Verify Provider Service Area if provider has designated service areas
    if (provider.serviceAreas && provider.serviceAreas.length > 0 && bookingData.address) {
      const providerAreas = await ServiceArea.find({
        _id: { $in: provider.serviceAreas },
        isActive: true
      });

      if (providerAreas.length > 0) {
        const bookingCity = (bookingData.address.city || '').trim().toLowerCase();
        const bookingZip = (bookingData.address.zipCode || '').trim();

        const matchesArea = providerAreas.some((area) => {
          const cityMatches = area.city && area.city.trim().toLowerCase() === bookingCity;
          const zipMatches =
            bookingZip &&
            Array.isArray(area.zipCodes) &&
            area.zipCodes.some((z) => z.trim() === bookingZip);
          return cityMatches || zipMatches;
        });

        if (!matchesArea) {
          const err = new Error(
            `Selected provider does not service this location (${bookingData.address.city || ''} ${bookingZip})`
          );
          err.statusCode = 400;
          throw err;
        }
      }
    }

    assignedProvider = provider._id;
  } else {
    // Instant or unassigned broadcast: find candidate eligible providers
    const eligibleProviders = await Provider.find({
      verificationStatus: 'verified',
      isAvailable: true,
      categories: service.category._id
    }).populate('user');

    candidateProviders = eligibleProviders
      .filter((p) => p.user && p.user.isActive)
      .map((p) => p._id);
  }

  // 5. Pricing calculation from trusted database values
  const basePrice = Number(service.price);
  const tax = 0;
  const discount = 0;
  const totalAmount = basePrice + tax - discount;

  // 6. Schedule setup
  const bookingMode = bookingData.bookingMode || 'scheduled';
  let scheduledDate;
  let scheduledTimeSlot;

  if (bookingMode === 'instant') {
    scheduledDate = new Date();
    scheduledTimeSlot = {
      startTime: 'ASAP',
      endTime: 'ASAP'
    };
  } else {
    scheduledDate = new Date(bookingData.scheduledDate);
    scheduledTimeSlot = {
      startTime: bookingData.scheduledTimeSlot.startTime.trim(),
      endTime: bookingData.scheduledTimeSlot.endTime.trim()
    };
  }

  // 7. Generate reference and persist
  let bookingReference = generateBookingReference();
  let exists = await Booking.findOne({ bookingReference });
  while (exists) {
    bookingReference = generateBookingReference();
    exists = await Booking.findOne({ bookingReference });
  }

  const effectiveNotes = (bookingData.notes || bookingData.problemDescription || '').trim();

  const newBooking = await Booking.create({
    bookingReference,
    customer: customer._id,
    provider: assignedProvider,
    service: service._id,
    bookingMode,
    status: 'pending',
    scheduledDate,
    scheduledTimeSlot,
    address: {
      street: bookingData.address.street.trim(),
      city: bookingData.address.city.trim(),
      state: bookingData.address.state ? bookingData.address.state.trim() : '',
      zipCode: bookingData.address.zipCode ? bookingData.address.zipCode.trim() : '',
      location: bookingData.address.location || { type: 'Point', coordinates: [0, 0] }
    },
    pricing: {
      basePrice,
      tax,
      discount,
      totalAmount
    },
    paymentStatus: 'pending',
    paymentMethod: bookingData.paymentMethod || 'cash',
    candidateProviders,
    notes: effectiveNotes
  });

  return await Booking.findById(newBooking._id)
    .populate('service', 'name price priceType estimatedDurationMinutes description')
    .populate({
      path: 'provider',
      select: 'businessName rating experienceYears bio',
      populate: { path: 'user', select: 'name phone email' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name email phone' }
    });
};

/**
 * Customer lists their own bookings
 */
const getCustomerBookings = async (userId, query = {}) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    return { bookings: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } };
  }

  const filter = { customer: customer._id };
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.bookingMode) {
    filter.bookingMode = query.bookingMode;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('service', 'name price priceType estimatedDurationMinutes')
      .populate({
        path: 'provider',
        select: 'businessName rating experienceYears bio',
        populate: { path: 'user', select: 'name phone' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter)
  ]);

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Customer retrieves single booking detail (ownership enforced)
 */
const getCustomerBookingById = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId)
    .populate('service')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone email' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name email phone' }
    });

  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.customer._id.toString() !== customer._id.toString()) {
    const err = new Error('Access denied: You do not own this booking');
    err.statusCode = 403;
    throw err;
  }

  return booking;
};

/**
 * Customer cancels a booking
 */
const cancelBookingByCustomer = async (userId, bookingId, cancellationReason) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.customer.toString() !== customer._id.toString()) {
    const err = new Error('Access denied: You do not own this booking');
    err.statusCode = 403;
    throw err;
  }

  // Allowed only from pending or accepted
  if (booking.status === 'in_progress') {
    const err = new Error('Cannot cancel a service that is currently in progress');
    err.statusCode = 400;
    throw err;
  }
  if (booking.status === 'completed') {
    const err = new Error('Cannot cancel a completed service');
    err.statusCode = 400;
    throw err;
  }
  if (booking.status === 'cancelled') {
    const err = new Error('This booking has already been cancelled');
    err.statusCode = 400;
    throw err;
  }
  if (booking.status === 'rejected') {
    const err = new Error('Cannot cancel a rejected booking');
    err.statusCode = 400;
    throw err;
  }

  booking.status = 'cancelled';
  booking.cancelledBy = 'customer';
  booking.cancellationReason = (cancellationReason || 'Customer requested cancellation').trim();
  booking.statusTimestamps.cancelledAt = new Date();
  await booking.save();

  return await Booking.findById(bookingId)
    .populate('service')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Provider lists pending requests (direct assignments or eligible instant broadcasts)
 */
const getProviderRequests = async (userId, query = {}) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Pending directly assigned to this provider OR unassigned instant pool candidate
  const filter = {
    status: 'pending',
    $or: [
      { provider: provider._id },
      {
        provider: null,
        $or: [
          { candidateProviders: provider._id },
          { candidateProviders: { $size: 0 } }
        ]
      }
    ]
  };

  const bookings = await Booking.find(filter)
    .populate('service', 'name price priceType estimatedDurationMinutes')
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone' }
    })
    .sort({ createdAt: -1 });

  return bookings;
};

/**
 * Provider lists assigned booking history (accepted, in_progress, completed, etc.)
 */
const getProviderHistory = async (userId, query = {}) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const filter = { provider: provider._id };
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('service', 'name price priceType estimatedDurationMinutes')
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name phone' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter)
  ]);

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Provider gets single booking details (must be assigned or candidate)
 */
const getProviderBookingById = async (userId, bookingId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId)
    .populate('service')
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone email' }
    });

  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization check: assigned or candidate
  const isAssigned = booking.provider && booking.provider.toString() === provider._id.toString();
  const isCandidate =
    !booking.provider &&
    (booking.candidateProviders.some((c) => c.toString() === provider._id.toString()) ||
      booking.candidateProviders.length === 0);

  if (!isAssigned && !isCandidate) {
    const err = new Error('Access denied: You are not authorized to view this booking');
    err.statusCode = 403;
    throw err;
  }

  return booking;
};

/**
 * Concurrency-safe atomic booking acceptance by provider
 */
const acceptBookingByProvider = async (userId, bookingId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  if (provider.verificationStatus !== 'verified') {
    const err = new Error('Provider is not verified and cannot accept bookings');
    err.statusCode = 403;
    throw err;
  }

  const now = new Date();

  // Concurrency-safe atomic conditional update:
  // Matches either:
  // A) Assigned directly to this provider: { _id, status: 'pending', provider: provider._id }
  // B) Unassigned pool: { _id, status: 'pending', provider: null }
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'pending',
      $or: [{ provider: provider._id }, { provider: null }]
    },
    {
      $set: {
        status: 'accepted',
        provider: provider._id,
        'statusTimestamps.acceptedAt': now
      }
    },
    { new: true }
  )
    .populate('service')
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone email' }
    });

  if (!updatedBooking) {
    // Determine exact conflict cause
    const existing = await Booking.findById(bookingId);
    if (!existing) {
      const err = new Error(`Booking with ID '${bookingId}' not found`);
      err.statusCode = 404;
      throw err;
    }
    if (existing.status !== 'pending') {
      const err = new Error(`Booking is no longer pending (current status: '${existing.status}'). Already claimed or cancelled.`);
      err.statusCode = 409;
      err.data = { currentStatus: existing.status };
      throw err;
    }
    if (existing.provider && existing.provider.toString() !== provider._id.toString()) {
      const err = new Error('This booking is assigned to another service provider');
      err.statusCode = 403;
      throw err;
    }

    const err = new Error('Failed to accept booking. State conflict detected.');
    err.statusCode = 409;
    throw err;
  }

  return updatedBooking;
};

/**
 * Provider rejects a pending request
 */
const rejectBookingByProvider = async (userId, bookingId, rejectionReason) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.status !== 'pending') {
    const err = new Error(`Only pending bookings can be rejected (current status: '${booking.status}')`);
    err.statusCode = 400;
    throw err;
  }

  // If directly assigned, mark rejected
  if (booking.provider && booking.provider.toString() === provider._id.toString()) {
    booking.status = 'rejected';
    booking.rejectionReason = (rejectionReason || 'Provider declined request').trim();
    booking.statusTimestamps.rejectedAt = new Date();
    await booking.save();
    return booking;
  }

  // If pool broadcast, remove this provider from candidates
  if (!booking.provider) {
    await Booking.findByIdAndUpdate(bookingId, {
      $pull: { candidateProviders: provider._id }
    });
    return await Booking.findById(bookingId);
  }

  const err = new Error('Access denied: You are not assigned to this booking');
  err.statusCode = 403;
  throw err;
};

/**
 * Provider starts service (accepted -> in_progress)
 */
const startServiceByProvider = async (userId, bookingId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'accepted',
      provider: provider._id
    },
    {
      $set: {
        status: 'in_progress',
        'statusTimestamps.inProgressAt': now
      }
    },
    { new: true }
  )
    .populate('service')
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone' }
    });

  if (!updatedBooking) {
    const existing = await Booking.findById(bookingId);
    if (!existing) {
      const err = new Error(`Booking with ID '${bookingId}' not found`);
      err.statusCode = 404;
      throw err;
    }
    if (existing.provider?.toString() !== provider._id.toString()) {
      const err = new Error('Access denied: You are not the assigned provider for this booking');
      err.statusCode = 403;
      throw err;
    }
    const err = new Error(`Cannot start service from '${existing.status}' status. Must be in 'accepted' status.`);
    err.statusCode = 400;
    throw err;
  }

  return updatedBooking;
};

/**
 * Provider completes service (in_progress -> completed)
 */
const completeServiceByProvider = async (userId, bookingId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const existing = await Booking.findById(bookingId);
  if (!existing) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }
  if (existing.provider?.toString() !== provider._id.toString()) {
    const err = new Error('Access denied: You are not the assigned provider for this booking');
    err.statusCode = 403;
    throw err;
  }
  if (existing.status !== 'in_progress') {
    const err = new Error(`Cannot complete service from '${existing.status}' status. Must be in 'in_progress' status.`);
    err.statusCode = 400;
    throw err;
  }

  // Ensure any proposed extra materials have customer resolution before completion
  if (
    existing.spareParts &&
    ['pending_approval', 'pending_customer_approval'].includes(existing.spareParts.status)
  ) {
    const err = new Error(
      'Cannot complete service: Extra materials proposal is awaiting customer approval. Customer must approve or reject before completion.'
    );
    err.statusCode = 400;
    throw err;
  }

  // If spare parts were approved and booking is online payment with payment pending, require additional payment completion
  if (
    existing.spareParts &&
    existing.spareParts.status === 'approved' &&
    existing.paymentMethod === 'online' &&
    existing.paymentStatus === 'paid' &&
    existing.spareParts.paymentStatus !== 'paid' &&
    existing.spareParts.totalAdditionalAmount > 0
  ) {
    const err = new Error(
      'Cannot complete service: Approved additional materials amount has not been paid yet by the customer.'
    );
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'in_progress',
      provider: provider._id
    },
    {
      $set: {
        status: 'completed',
        'statusTimestamps.completedAt': now
      }
    },
    { new: true }
  )
    .populate('service')
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone' }
    });

  if (!updatedBooking) {
    const err = new Error('Service completion failed due to concurrent modification');
    err.statusCode = 409;
    throw err;
  }

  // Increment completed bookings count on provider
  await Provider.findByIdAndUpdate(provider._id, {
    $inc: { completedBookingsCount: 1 }
  });

  return updatedBooking;
};

/**
 * Admin lists all bookings with filters, search, and pagination
 */
const getAdminBookings = async (query = {}) => {
  const filter = {};
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.bookingMode && query.bookingMode !== 'all') {
    filter.bookingMode = query.bookingMode;
  }
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { bookingReference: searchRegex },
      { 'address.city': searchRegex },
      { 'address.street': searchRegex }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('service', 'name price priceType')
      .populate({
        path: 'provider',
        select: 'businessName rating',
        populate: { path: 'user', select: 'name email phone' }
      })
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name email phone' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter)
  ]);

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Admin views single booking
 */
const getAdminBookingById = async (bookingId) => {
  const booking = await Booking.findById(bookingId)
    .populate('service')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name email phone' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name email phone' }
    });

  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  return booking;
};

/**
 * Admin cancels booking with supervision note
 */
const cancelBookingByAdmin = async (bookingId, cancellationReason) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.status === 'completed') {
    const err = new Error('Cannot cancel an already completed booking');
    err.statusCode = 400;
    throw err;
  }
  if (booking.status === 'cancelled') {
    const err = new Error('Booking is already cancelled');
    err.statusCode = 400;
    throw err;
  }

  booking.status = 'cancelled';
  booking.cancelledBy = 'admin';
  booking.cancellationReason = (cancellationReason || 'Cancelled by platform administrator').trim();
  booking.statusTimestamps.cancelledAt = new Date();
  await booking.save();

  return await Booking.findById(bookingId)
    .populate('service')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name' }
    });
};

/**
 * Creates or retrieves existing Razorpay order for an eligible booking
 */
const createPaymentOrder = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id })
    .populate('service', 'name price');

  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    const err = new Error(`Cannot initiate payment for '${booking.status}' booking`);
    err.statusCode = 400;
    throw err;
  }

  if (booking.paymentStatus === 'paid') {
    const err = new Error('This booking has already been paid for');
    err.statusCode = 400;
    throw err;
  }

  const totalAmount = booking.pricing?.totalAmount || booking.service?.price;
  if (!totalAmount || totalAmount <= 0) {
    const err = new Error('Invalid booking amount for online payment');
    err.statusCode = 400;
    throw err;
  }

  // Idempotency: if already has order and still pending, return current order info
  const existingOrderId = booking.paymentDetails?.razorpayOrderId;
  const { keyId } = paymentService.getSanitizedRazorpayConfig();

  let order;
  try {
    order = await paymentService.createOrder({
      amountInRupees: totalAmount,
      receipt: booking.bookingReference,
      notes: {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        customerId: customer._id.toString()
      }
    });
  } catch (err) {
    console.error('Error creating payment order:', err);
    err.statusCode = err.statusCode || 500;
    throw err;
  }

  // Persist Razorpay order details on booking
  booking.paymentMethod = 'online';
  if (!booking.paymentDetails) {
    booking.paymentDetails = {};
  }
  booking.paymentDetails.razorpayOrderId = order.id;
  await booking.save();

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency || 'INR',
    keyId,
    bookingReference: booking.bookingReference,
    customer: {
      name: (await User.findById(userId))?.name || 'Customer',
      phone: (await User.findById(userId))?.phone || ''
    }
  };
};

/**
 * Verifies Razorpay payment signature and confirms payment
 */
const verifyPayment = async (userId, bookingId, paymentPayload) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = paymentPayload;

  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.paymentStatus === 'paid') {
    return booking;
  }

  // Ensure orderId matches the booking's initiated Razorpay order
  if (booking.paymentDetails?.razorpayOrderId && booking.paymentDetails.razorpayOrderId !== razorpayOrderId) {
    const err = new Error('Payment verification failed: Razorpay order ID does not match this booking');
    err.statusCode = 400;
    throw err;
  }

  // Verify HMAC SHA-256 signature
  const isValid = paymentService.verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature
  });

  if (!isValid) {
    if (!booking.paymentDetails) booking.paymentDetails = {};
    booking.paymentDetails.failureReason = 'Invalid Razorpay payment signature';
    booking.paymentStatus = 'failed';
    await booking.save();

    const err = new Error('Payment verification failed: Invalid payment signature');
    err.statusCode = 400;
    throw err;
  }

  // Mark paid
  booking.paymentStatus = 'paid';
  booking.paymentMethod = 'online';
  if (!booking.paymentDetails) booking.paymentDetails = {};
  booking.paymentDetails.razorpayOrderId = razorpayOrderId;
  booking.paymentDetails.razorpayPaymentId = razorpayPaymentId;
  booking.paymentDetails.razorpaySignature = razorpaySignature;
  booking.paymentDetails.paidAt = new Date();
  booking.paymentDetails.failureReason = null;
  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType estimatedDurationMinutes')
    .populate({
      path: 'provider',
      select: 'businessName rating experienceYears',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Customer reports payment cancelled or failed
 */
const recordPaymentFailure = async (userId, bookingId, reason) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) return null;

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) return null;

  if (booking.paymentStatus !== 'paid') {
    if (!booking.paymentDetails) booking.paymentDetails = {};
    booking.paymentDetails.failureReason = reason || 'Payment cancelled by customer';
    booking.paymentStatus = 'failed';
    await booking.save();
  }
  return booking;
};

/**
 * Provider submits or updates spare parts / material charges for a booking
 */
const submitSpareParts = async (userId, bookingId, { items }) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: must be the assigned provider
  if (!booking.provider || booking.provider.toString() !== provider._id.toString()) {
    const err = new Error('Access denied: You are not the assigned provider for this booking');
    err.statusCode = 403;
    throw err;
  }

  // Only allowed during accepted or in_progress status
  if (!['accepted', 'in_progress'].includes(booking.status)) {
    const err = new Error(`Cannot add spare parts to booking in '${booking.status}' status. Must be 'accepted' or 'in_progress'.`);
    err.statusCode = 400;
    throw err;
  }

  // If already approved or already paid, lock against edits
  if (booking.spareParts && booking.spareParts.status === 'approved') {
    const err = new Error('Cannot edit spare parts after customer has approved the bill. Please contact support or customer.');
    err.statusCode = 400;
    throw err;
  }

  // Validate and calculate line items server-side with paise precision
  let partsSubtotal = 0;
  let labourSubtotal = 0;

  const sanitizedItems = items.map((item) => {
    const name = String(item.name).trim();
    const description = item.description ? String(item.description).trim() : '';
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) * 100) / 100);
    const labourCharge = Math.max(0, Math.round(Number(item.labourCharge || 0) * 100) / 100);
    const totalPrice = Math.round((quantity * unitPrice + labourCharge) * 100) / 100;
    const notes = item.notes ? String(item.notes).trim() : '';

    partsSubtotal += Math.round(quantity * unitPrice * 100) / 100;
    labourSubtotal += labourCharge;

    return {
      name,
      description,
      quantity,
      unitPrice,
      labourCharge,
      totalPrice,
      notes
    };
  });

  partsSubtotal = Math.round(partsSubtotal * 100) / 100;
  labourSubtotal = Math.round(labourSubtotal * 100) / 100;
  const totalAdditionalAmount = Math.round((partsSubtotal + labourSubtotal) * 100) / 100;

  // Preserve original service amount
  const originalServiceAmount = booking.spareParts?.originalServiceAmount || booking.pricing.totalAmount;

  booking.spareParts = {
    items: sanitizedItems,
    partsSubtotal,
    labourSubtotal,
    totalAdditionalAmount,
    status: 'pending_approval',
    submittedBy: provider._id,
    submittedAt: new Date(),
    reviewedAt: null,
    rejectionReason: null,
    originalServiceAmount,
    paymentStatus: booking.paymentMethod === 'cash' ? 'not_applicable' : 'pending',
    paymentDetails: {
      razorpayOrderId: booking.spareParts?.paymentDetails?.razorpayOrderId || null,
      razorpayPaymentId: booking.spareParts?.paymentDetails?.razorpayPaymentId || null,
      razorpaySignature: booking.spareParts?.paymentDetails?.razorpaySignature || null,
      paidAt: booking.spareParts?.paymentDetails?.paidAt || null
    }
  };

  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Customer reviews (approve or reject) proposed spare parts charges
 */
const reviewSpareParts = async (userId, bookingId, { action, rejectionReason }) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: must be the customer who created the booking
  if (booking.customer.toString() !== customer._id.toString()) {
    const err = new Error('Access denied: You do not own this booking');
    err.statusCode = 403;
    throw err;
  }

  if (!booking.spareParts || !['pending_approval', 'pending_customer_approval'].includes(booking.spareParts.status)) {
    const err = new Error(`No pending spare parts proposal to review (current status: ${booking.spareParts?.status || 'none'})`);
    err.statusCode = 400;
    throw err;
  }

  if (action === 'approve') {
    booking.spareParts.status = 'approved';
    booking.spareParts.reviewedAt = new Date();
    booking.spareParts.rejectionReason = null;

    // Recalculate final totalAmount on booking pricing
    const baseServiceAmount = booking.spareParts.originalServiceAmount || booking.pricing.totalAmount;
    const additional = booking.spareParts.totalAdditionalAmount || 0;
    booking.pricing.totalAmount = Math.round((baseServiceAmount + additional) * 100) / 100;
  } else if (action === 'reject') {
    booking.spareParts.status = 'rejected';
    booking.spareParts.reviewedAt = new Date();
    booking.spareParts.rejectionReason = (rejectionReason || 'Customer declined proposed parts and charges').trim();
    // Revert pricing total to originalServiceAmount
    if (booking.spareParts.originalServiceAmount) {
      booking.pricing.totalAmount = booking.spareParts.originalServiceAmount;
    }
  }

  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Customer initiates Razorpay payment specifically for approved additional spare parts
 */
const createSparePartsPaymentOrder = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (!booking.spareParts || booking.spareParts.status !== 'approved') {
    const err = new Error('Spare parts must be approved before payment can be initiated');
    err.statusCode = 400;
    throw err;
  }

  if (booking.spareParts.paymentStatus === 'paid') {
    const err = new Error('Spare parts charges have already been paid');
    err.statusCode = 400;
    throw err;
  }

  const additionalAmount = booking.spareParts.totalAdditionalAmount;
  if (!additionalAmount || additionalAmount <= 0) {
    const err = new Error('No payable amount for spare parts');
    err.statusCode = 400;
    throw err;
  }

  const { keyId } = paymentService.getSanitizedRazorpayConfig();
  const order = await paymentService.createOrder({
    amountInRupees: additionalAmount,
    receipt: `${booking.bookingReference}-PARTS`,
    notes: {
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      paymentType: 'spare_parts',
      customerId: customer._id.toString()
    }
  });

  if (!booking.spareParts.paymentDetails) {
    booking.spareParts.paymentDetails = {};
  }
  booking.spareParts.paymentDetails.razorpayOrderId = order.id;
  await booking.save();

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency || 'INR',
    keyId,
    bookingReference: booking.bookingReference,
    customer: {
      name: (await User.findById(userId))?.name || 'Customer',
      phone: (await User.findById(userId))?.phone || ''
    }
  };
};

/**
 * Verifies Razorpay payment signature for approved spare parts
 */
const verifySparePartsPayment = async (userId, bookingId, paymentPayload) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = paymentPayload;

  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (!booking.spareParts || booking.spareParts.status !== 'approved') {
    const err = new Error('Spare parts must be approved before payment verification');
    err.statusCode = 400;
    throw err;
  }

  if (booking.spareParts.paymentStatus === 'paid') {
    return booking;
  }

  if (booking.spareParts.paymentDetails?.razorpayOrderId && booking.spareParts.paymentDetails.razorpayOrderId !== razorpayOrderId) {
    const err = new Error('Payment verification failed: Razorpay order ID does not match spare parts bill');
    err.statusCode = 400;
    throw err;
  }

  const isValid = paymentService.verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature
  });

  if (!isValid) {
    if (!booking.spareParts.paymentDetails) booking.spareParts.paymentDetails = {};
    booking.spareParts.paymentDetails.failureReason = 'Invalid Razorpay payment signature';
    booking.spareParts.paymentStatus = 'failed';
    await booking.save();

    const err = new Error('Payment verification failed: Invalid payment signature');
    err.statusCode = 400;
    throw err;
  }

  booking.spareParts.paymentStatus = 'paid';
  if (!booking.spareParts.paymentDetails) booking.spareParts.paymentDetails = {};
  booking.spareParts.paymentDetails.razorpayOrderId = razorpayOrderId;
  booking.spareParts.paymentDetails.razorpayPaymentId = razorpayPaymentId;
  booking.spareParts.paymentDetails.razorpaySignature = razorpaySignature;
  booking.spareParts.paymentDetails.paidAt = new Date();
  booking.spareParts.paymentDetails.failureReason = null;

  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Customer reports spare parts payment cancelled or failed (retains balance for retry)
 */
const recordSparePartsPaymentFailure = async (userId, bookingId, reason) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) return null;

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) return null;

  if (booking.spareParts && booking.spareParts.paymentStatus !== 'paid') {
    if (!booking.spareParts.paymentDetails) booking.spareParts.paymentDetails = {};
    booking.spareParts.paymentDetails.failureReason = reason || 'Payment cancelled by customer';
    booking.spareParts.paymentStatus = 'failed';
    await booking.save();
  }
  return booking;
};

/**
 * Provider confirms cash received on service
 */
const confirmCashPaymentByProvider = async (userId, bookingId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: must be the assigned provider
  if (!booking.provider || booking.provider.toString() !== provider._id.toString()) {
    const err = new Error('Access denied: You are not the assigned provider for this booking');
    err.statusCode = 403;
    throw err;
  }

  // Payment method check: Must be cash
  if (booking.paymentMethod !== 'cash') {
    const err = new Error(`Cannot record cash collection for '${booking.paymentMethod}' booking`);
    err.statusCode = 400;
    throw err;
  }

  // Status check: must be in_progress or completed
  if (!['in_progress', 'completed'].includes(booking.status)) {
    const err = new Error(`Cannot collect cash for booking in '${booking.status}' status. Must be 'in_progress' or 'completed'.`);
    err.statusCode = 400;
    throw err;
  }

  // Pending proposal check: extra materials must not be awaiting customer decision
  if (
    booking.spareParts &&
    ['pending_approval', 'pending_customer_approval'].includes(booking.spareParts.status)
  ) {
    const err = new Error('Cannot collect cash while extra materials proposal is awaiting customer approval');
    err.statusCode = 400;
    throw err;
  }

  // Idempotency: if already confirmed paid
  if (booking.paymentStatus === 'paid' && booking.paymentDetails?.cashConfirmedByProvider) {
    return await Booking.findById(booking._id)
      .populate('service', 'name price priceType')
      .populate({
        path: 'provider',
        populate: { path: 'user', select: 'name phone' }
      })
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name phone' }
      });
  }

  const finalPayable = booking.pricing?.totalAmount || 0;
  if (!booking.paymentDetails) booking.paymentDetails = {};
  booking.paymentStatus = 'paid';
  booking.paymentDetails.cashCollectedAmount = finalPayable;
  booking.paymentDetails.cashConfirmedByProvider = true;
  booking.paymentDetails.cashConfirmedByProviderAt = new Date();
  booking.paymentDetails.paidAt = new Date();
  booking.paymentDetails.failureReason = null;
  // If spare parts exist, mark them not_applicable or paid for cash
  if (booking.spareParts && booking.spareParts.status === 'approved') {
    booking.spareParts.paymentStatus = 'paid';
  }

  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Customer confirms cash paid or dispute
 */
const confirmCashPaymentByCustomer = async (userId, bookingId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.paymentMethod !== 'cash') {
    const err = new Error(`Cannot confirm cash payment for '${booking.paymentMethod}' booking`);
    err.statusCode = 400;
    throw err;
  }

  if (!booking.paymentDetails) booking.paymentDetails = {};
  booking.paymentDetails.cashConfirmedByCustomer = true;
  booking.paymentDetails.cashConfirmedByCustomerAt = new Date();
  booking.paymentDetails.cashDisputedByCustomer = false;
  booking.paymentDetails.cashDisputeReason = null;
  booking.paymentDetails.cashDisputedAt = null;

  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    });
};

/**
 * Customer reports cash payment issue / dispute
 */
const reportCashPaymentDispute = async (userId, bookingId, disputeReason) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findOne({ _id: bookingId, customer: customer._id });
  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.paymentMethod !== 'cash') {
    const err = new Error(`Cannot report cash dispute for '${booking.paymentMethod}' booking`);
    err.statusCode = 400;
    throw err;
  }

  if (!booking.paymentDetails) booking.paymentDetails = {};
  booking.paymentDetails.cashDisputedByCustomer = true;
  booking.paymentDetails.cashDisputeReason = (disputeReason || 'Cash payment dispute reported by customer').trim();
  booking.paymentDetails.cashDisputedAt = new Date();

  await booking.save();

  return await Booking.findById(booking._id)
    .populate('service', 'name price priceType')
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name phone' }
    });
};

module.exports = {
  createBooking,
  getCustomerBookings,
  getCustomerBookingById,
  cancelBookingByCustomer,
  getProviderRequests,
  getProviderHistory,
  getProviderBookingById,
  acceptBookingByProvider,
  rejectBookingByProvider,
  startServiceByProvider,
  completeServiceByProvider,
  getAdminBookings,
  getAdminBookingById,
  cancelBookingByAdmin,
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure,
  submitSpareParts,
  reviewSpareParts,
  createSparePartsPaymentOrder,
  verifySparePartsPayment,
  recordSparePartsPaymentFailure,
  confirmCashPaymentByProvider,
  confirmCashPaymentByCustomer,
  reportCashPaymentDispute
};
