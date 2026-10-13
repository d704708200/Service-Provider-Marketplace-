const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Availability = require('../models/Availability');
const ServiceArea = require('../models/ServiceArea');
const User = require('../models/User');

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
    const err = new Error(`Cannot complete service from '${existing.status}' status. Must be in 'in_progress' status.`);
    err.statusCode = 400;
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
  cancelBookingByAdmin
};
