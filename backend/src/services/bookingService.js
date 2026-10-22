const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Availability = require('../models/Availability');
const ServiceArea = require('../models/ServiceArea');
const User = require('../models/User');
const Notification = require('../models/Notification');
const paymentService = require('./paymentService');

/**
 * Generate unique, human-readable booking reference (e.g. BK-20261013-A1B2)
 */
const generateBookingReference = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${dateStr}-${randomChars}`;
};

// Concurrency mutex lock per provider slot to prevent race conditions on simultaneous booking requests
const bookingLocks = new Map();

const acquireBookingLock = async (lockKey) => {
  while (bookingLocks.has(lockKey)) {
    try {
      await bookingLocks.get(lockKey);
    } catch (_) {}
  }
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  bookingLocks.set(lockKey, promise);
  return () => {
    bookingLocks.delete(lockKey);
    release();
  };
};

/**
 * Customer creates a new booking (instant or scheduled)
 */
const createBooking = async (userId, bookingData) => {
  // 1. Verify active customer profile
  const user = await User.findById(userId);
  if (!user || user.role !== 'customer' || !user.isActive || user.isDeleted) {
    const err = new Error('Authenticated customer account is inactive, deleted, or not found');
    err.statusCode = 403;
    throw err;
  }

  let customer = await Customer.findOne({ user: userId });
  if (!customer) {
    // Gracefully initialize customer profile if not yet created
    customer = await Customer.create({ user: userId, addresses: [] });
  } else if (customer.isDeleted) {
    const err = new Error('Customer profile has been terminated');
    err.statusCode = 403;
    throw err;
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
  let releaseLock = null;
  let newBooking = null;
  let provider = null;

  if (bookingData.providerId) {
    provider = await Provider.findById(bookingData.providerId).populate('user');
    if (!provider) {
      const err = new Error(`Provider with ID '${bookingData.providerId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (provider.isDeleted || provider.user?.isDeleted) {
      const err = new Error(`Provider '${provider.businessName || 'Selected'}' has been deleted`);
      err.statusCode = 400;
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
    const isOwnedService = service.provider && (
      service.provider.toString() === provider._id.toString() ||
      (provider.user && service.provider.toString() === provider.user.toString())
    );

    if (service.provider && !isOwnedService) {
      const err = new Error('The selected provider does not offer this specific service');
      err.statusCode = 400;
      throw err;
    }

    // Verify provider offers category (or created/owns this custom service)
    const offersCategory = isOwnedService || (provider.categories && provider.categories.some(
      (catId) => catId.toString() === service.category._id.toString()
    ));
    if (!offersCategory) {
      const err = new Error('The selected provider does not offer this service category');
      err.statusCode = 400;
      throw err;
    }

    // Concurrency lock per provider slot to prevent race conditions on simultaneous booking requests
    if ((bookingData.bookingMode || 'scheduled') === 'scheduled' && bookingData.scheduledDate) {
      const targetDate = new Date(bookingData.scheduledDate);
      const targetDateStr = !isNaN(targetDate.getTime()) ? targetDate.toISOString().slice(0, 10) : 'scheduled';
      const lockKey = `provider:${provider._id}:${targetDateStr}`;
      releaseLock = await acquireBookingLock(lockKey);
    }
  }

  try {
    if (provider) {
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

        // Check for overlapping confirmed or in-progress bookings for this provider
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const reqStart = (bookingData.scheduledTimeSlot?.startTime || '').trim();
        const reqEnd = (bookingData.scheduledTimeSlot?.endTime || '').trim();

        if (reqStart && reqEnd) {
          const overlappingBooking = await Booking.findOne({
            provider: provider._id,
            status: { $in: ['pending', 'accepted', 'in_progress'] },
            bookingMode: 'scheduled',
            scheduledDate: { $gte: startOfDay, $lte: endOfDay },
            'scheduledTimeSlot.startTime': { $lt: reqEnd },
            'scheduledTimeSlot.endTime': { $gt: reqStart }
          });

          if (overlappingBooking) {
            const err = new Error(
              `The selected provider is already booked for this time slot (${overlappingBooking.scheduledTimeSlot.startTime} - ${overlappingBooking.scheduledTimeSlot.endTime}). Please select another time or an alternative provider.`
            );
            err.statusCode = 409;
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

    newBooking = await Booking.create({
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

    // Concurrency safety net: verify no simultaneous overlapping booking was persisted
    if (assignedProvider && (bookingMode || 'scheduled') === 'scheduled' && scheduledDate && scheduledTimeSlot) {
      const startOfDay = new Date(scheduledDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(scheduledDate);
      endOfDay.setHours(23, 59, 59, 999);
      const reqStart = (scheduledTimeSlot.startTime || '').trim();
      const reqEnd = (scheduledTimeSlot.endTime || '').trim();

      if (reqStart && reqEnd) {
        const conflictingCount = await Booking.countDocuments({
          provider: assignedProvider,
          status: { $in: ['pending', 'accepted', 'in_progress'] },
          bookingMode: 'scheduled',
          scheduledDate: { $gte: startOfDay, $lte: endOfDay },
          'scheduledTimeSlot.startTime': { $lt: reqEnd },
          'scheduledTimeSlot.endTime': { $gt: reqStart }
        });

        if (conflictingCount > 1) {
          await Booking.findByIdAndDelete(newBooking._id);
          const err = new Error(
            `The selected provider is already booked for this time slot (${reqStart} - ${reqEnd}). Please select another time or an alternative provider.`
          );
          err.statusCode = 409;
          throw err;
        }
      }
    }
  } finally {
    if (releaseLock) releaseLock();
  }

  const createdDoc = await Booking.findById(newBooking._id)
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

  // Safe notification dispatching
  try {
    const serviceName = createdDoc.service?.name || 'Service';
    const customerName = createdDoc.customer?.user?.name || 'Customer';
    const scheduledInfo = createdDoc.bookingMode === 'instant'
      ? 'Immediate (ASAP)'
      : createdDoc.scheduledDate
      ? `${new Date(createdDoc.scheduledDate).toLocaleDateString()} (${createdDoc.scheduledTimeSlot?.startTime || ''})`
      : 'Scheduled';

    const providerUserIds = [];

    if (assignedProvider && createdDoc.provider?.user?._id) {
      providerUserIds.push(createdDoc.provider.user._id);
    } else if (candidateProviders && candidateProviders.length > 0) {
      const candidateDocs = await Provider.find({ _id: { $in: candidateProviders } }).select('user');
      candidateDocs.forEach((p) => {
        if (p.user) providerUserIds.push(p.user);
      });
    }

    if (providerUserIds.length > 0) {
      const notifDocs = providerUserIds.map((pUserId) => ({
        recipient: pUserId,
        title: `New Booking Request: ${createdDoc.bookingReference}`,
        message: `New request for ${serviceName} from ${customerName}. Scheduled: ${scheduledInfo}. Total: ₹${createdDoc.pricing?.totalAmount || 0}.`,
        type: 'booking',
        data: {
          bookingId: createdDoc._id.toString(),
          bookingReference: createdDoc.bookingReference,
          mode: createdDoc.bookingMode
        }
      }));

      await Notification.insertMany(notifDocs);
      console.log(
        `[BOOKING_NOTIFICATION] Created ${notifDocs.length} notification(s) for booking ${createdDoc.bookingReference}`
      );
    }
  } catch (notifErr) {
    // Notification delivery failure must not abort booking creation
    console.error(
      `[BOOKING_NOTIFICATION_ERROR] Failed to dispatch notifications for booking ${createdDoc.bookingReference}:`,
      notifErr.message
    );
  }

  console.log(
    `[BOOKING_CREATED] Reference: ${createdDoc.bookingReference} | Mode: ${createdDoc.bookingMode} | Customer: ${createdDoc.customer?._id} | AssignedProvider: ${createdDoc.provider?._id || 'none'} | Candidates: ${candidateProviders.length}`
  );

  return createdDoc;
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
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter)
  ]);

  // Find reviews for completed bookings to supply instant review status
  const completedBookingIds = bookings
    .filter((b) => b.status === 'completed')
    .map((b) => b._id);

  let reviewsMap = new Map();
  if (completedBookingIds.length > 0) {
    const Review = require('../models/Review');
    const existingReviews = await Review.find({ booking: { $in: completedBookingIds } }).lean();
    existingReviews.forEach((r) => {
      reviewsMap.set(r.booking.toString(), r);
    });
  }

  const enrichedBookings = bookings.map((b) => ({
    ...b,
    review: reviewsMap.get(b._id.toString()) || null
  }));

  return {
    bookings: enrichedBookings,
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
const acceptBookingByProvider = async (userId, bookingId, teamData = null) => {
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

  const targetBooking = await Booking.findById(bookingId);
  if (!targetBooking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (targetBooking.status !== 'pending') {
    const err = new Error(`Booking is no longer pending (current status: '${targetBooking.status}'). Already claimed or cancelled.`);
    err.statusCode = 409;
    err.data = { currentStatus: targetBooking.status };
    throw err;
  }

  if (targetBooking.provider && targetBooking.provider.toString() !== provider._id.toString()) {
    const err = new Error('This booking is assigned to another service provider');
    err.statusCode = 403;
    throw err;
  }

  // Acceptance-time validation: provider cannot accept a conflicting second booking if they already have an active booking
  if (targetBooking.bookingMode === 'scheduled' && targetBooking.scheduledDate && targetBooking.scheduledTimeSlot) {
    const targetDate = new Date(targetBooking.scheduledDate);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const reqStart = (targetBooking.scheduledTimeSlot.startTime || '').trim();
    const reqEnd = (targetBooking.scheduledTimeSlot.endTime || '').trim();

    if (reqStart && reqEnd) {
      const activeConflict = await Booking.findOne({
        _id: { $ne: targetBooking._id },
        provider: provider._id,
        status: { $in: ['accepted', 'in_progress'] },
        bookingMode: 'scheduled',
        scheduledDate: { $gte: startOfDay, $lte: endOfDay },
        'scheduledTimeSlot.startTime': { $lt: reqEnd },
        'scheduledTimeSlot.endTime': { $gt: reqStart }
      });

      if (activeConflict) {
        const err = new Error(
          `Cannot accept booking: You already have an active booking (${activeConflict.bookingReference}) during this time slot (${activeConflict.scheduledTimeSlot.startTime} - ${activeConflict.scheduledTimeSlot.endTime}).`
        );
        err.statusCode = 409;
        throw err;
      }
    }
  }

  const now = new Date();

  // Build serviceTeam update if provided
  let serviceTeamUpdate = undefined;
  if (teamData && teamData.totalCount) {
    const totalCount = parseInt(teamData.totalCount, 10);
    const roles = Array.isArray(teamData.roles)
      ? teamData.roles.map(r => ({ role: String(r.role || '').trim(), count: parseInt(r.count, 10) || 1 }))
      : [];
    serviceTeamUpdate = {
      totalCount,
      roles,
      isConfirmed: true,
      confirmedAt: now,
      notes: (teamData.notes || '').trim(),
      history: [
        {
          updatedAt: now,
          updatedBy: userId,
          previousTotalCount: null,
          newTotalCount: totalCount,
          roles,
          reason: 'Initial confirmation upon accepting booking',
          bookingStatusAtUpdate: 'accepted'
        }
      ]
    };
  }

  const updateFields = {
    status: 'accepted',
    provider: provider._id,
    'statusTimestamps.acceptedAt': now
  };
  if (serviceTeamUpdate) {
    updateFields.serviceTeam = serviceTeamUpdate;
  }

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
      $set: updateFields
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

  // Safe notification to customer that provider accepted
  try {
    const custUserId = updatedBooking.customer?.user?._id;
    if (custUserId) {
      await Notification.create({
        recipient: custUserId,
        title: `Booking Accepted: ${updatedBooking.bookingReference}`,
        message: `${provider.businessName || 'Service Provider'} has accepted your booking request.`,
        type: 'booking',
        data: {
          bookingId: updatedBooking._id.toString(),
          bookingReference: updatedBooking.bookingReference,
          status: 'accepted'
        }
      });
    }
  } catch (notifErr) {
    console.error('[BOOKING_ACCEPT_NOTIFICATION_ERROR]', notifErr.message);
  }

  console.log(
    `[BOOKING_ACCEPTED] Reference: ${updatedBooking.bookingReference} | Provider: ${provider._id} (${provider.businessName})`
  );

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

  // Payment completion checks:
  // 1. If booking paymentMethod is cash, paymentStatus must be paid (marked by provider)
  if (existing.paymentMethod === 'cash') {
    if (existing.paymentStatus !== 'paid') {
      const totalPayable = existing.pricing?.totalAmount || 0;
      const err = new Error(
        `Cannot complete service: Provider must collect cash and mark cash received (Total: ₹${totalPayable}) before completion.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // 2. If booking paymentMethod is online, base service must be paid
  if (existing.paymentMethod === 'online' && existing.paymentStatus !== 'paid') {
    const err = new Error(
      'Cannot complete service: Online payment for base service is pending. Customer must pay before completion.'
    );
    err.statusCode = 400;
    throw err;
  }

  // 3. If spare parts were approved with additional amount > 0, verify spare parts payment
  if (
    existing.spareParts &&
    existing.spareParts.status === 'approved' &&
    existing.spareParts.totalAdditionalAmount > 0
  ) {
    if (existing.spareParts.paymentStatus !== 'paid') {
      const method = existing.spareParts.paymentMethod || 'online';
      if (method === 'cash') {
        const err = new Error(
          `Cannot complete service: Provider must mark cash collected for the approved extra materials (₹${existing.spareParts.totalAdditionalAmount}) before completion.`
        );
        err.statusCode = 400;
        throw err;
      } else {
        const err = new Error(
          'Cannot complete service: Approved additional materials amount has not been paid yet by the customer.'
        );
        err.statusCode = 400;
        throw err;
      }
    }
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
/**
 * Admin lists all bookings with filters, search, date range, and pagination
 */
const getAdminBookings = async (query = {}) => {
  const filter = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }
  if (query.paymentStatus && query.paymentStatus !== 'all') {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.bookingMode && query.bookingMode !== 'all') {
    filter.bookingMode = query.bookingMode;
  }

  // Date range filters (by scheduledDate or createdAt)
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = start;
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Multi-entity search
  if (query.search && query.search.trim()) {
    const rawSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(rawSearch, 'i');

    // Find matching users (customers or providers)
    const matchingUsers = await User.find({
      $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
    }).select('_id').lean();
    const matchedUserIds = matchingUsers.map((u) => u._id);

    // Find matching customer profiles
    const matchingCustomers = await Customer.find({
      user: { $in: matchedUserIds }
    }).select('_id').lean();
    const matchedCustomerIds = matchingCustomers.map((c) => c._id);

    // Find matching provider profiles by businessName or user
    const matchingProviders = await Provider.find({
      $or: [
        { businessName: searchRegex },
        { user: { $in: matchedUserIds } }
      ]
    }).select('_id').lean();
    const matchedProviderIds = matchingProviders.map((p) => p._id);

    // Find matching services
    const matchingServices = await Service.find({
      name: searchRegex
    }).select('_id').lean();
    const matchedServiceIds = matchingServices.map((s) => s._id);

    filter.$or = [
      { bookingReference: searchRegex },
      { 'address.city': searchRegex },
      { 'address.street': searchRegex },
      { customer: { $in: matchedCustomerIds } },
      { provider: { $in: matchedProviderIds } },
      { service: { $in: matchedServiceIds } }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate({
        path: 'service',
        select: 'name price priceType category',
        populate: { path: 'category', select: 'name slug icon' }
      })
      .populate({
        path: 'provider',
        select: 'businessName rating user',
        populate: { path: 'user', select: 'name email phone avatar' }
      })
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name email phone avatar' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter)
  ]);

  return {
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Admin live aggregation statistics for Bookings dashboard
 */
const getAdminBookingStats = async () => {
  const [statusCounts, revenueAgg, paymentStatusCounts] = await Promise.all([
    Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Booking.aggregate([
      {
        $match: {
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          totalSparePartsRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$spareParts.paymentStatus', 'paid'] },
                '$spareParts.totalAdditionalAmount',
                0
              ]
            }
          }
        }
      }
    ]),
    Booking.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const stats = {
    total: 0,
    pending: 0,
    accepted: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    rejected: 0,
    failedPayments: 0,
    paidPayments: 0,
    pendingPayments: 0,
    totalRevenue: 0
  };

  statusCounts.forEach((item) => {
    stats.total += item.count;
    if (item._id && stats.hasOwnProperty(item._id)) {
      stats[item._id] = item.count;
    }
  });

  paymentStatusCounts.forEach((item) => {
    if (item._id === 'failed') stats.failedPayments = item.count;
    if (item._id === 'paid') stats.paidPayments = item.count;
    if (item._id === 'pending') stats.pendingPayments = item.count;
  });

  if (revenueAgg.length > 0) {
    const rev = revenueAgg[0];
    stats.totalRevenue = (rev.totalRevenue || 0) + (rev.totalSparePartsRevenue || 0);
  }

  return stats;
};

/**
 * Admin views single booking
 */
const getAdminBookingById = async (bookingId) => {
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'service',
      populate: { path: 'category', select: 'name slug icon' }
    })
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name email phone avatar' }
    })
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name email phone avatar' }
    })
    .lean();

  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Load review if completed
  const Review = require('../models/Review');
  const review = await Review.findOne({ booking: booking._id }).lean();
  booking.review = review || null;

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
  const hasItems = sanitizedItems.length > 0;

  booking.spareParts = {
    items: sanitizedItems,
    partsSubtotal,
    labourSubtotal,
    totalAdditionalAmount,
    status: hasItems ? 'pending_approval' : 'none',
    submittedBy: hasItems ? provider._id : null,
    submittedAt: hasItems ? new Date() : null,
    reviewedAt: null,
    rejectionReason: null,
    originalServiceAmount,
    paymentStatus: hasItems
      ? (booking.paymentMethod === 'cash' ? 'not_applicable' : 'pending')
      : 'not_applicable',
    paymentMethod: null,
    paymentDetails: {
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      paidAt: null
    }
  };

  // If no materials are added, ensure final pricing remains the original base service amount
  if (!hasItems && originalServiceAmount) {
    booking.pricing.totalAmount = originalServiceAmount;
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
 * Customer chooses payment method for approved extra materials (online vs cash)
 */
const selectSparePartsPaymentMethod = async (userId, bookingId, { paymentMethod }) => {
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
    const err = new Error('Spare parts must be approved before selecting a payment method');
    err.statusCode = 400;
    throw err;
  }

  if (booking.spareParts.paymentStatus === 'paid') {
    const err = new Error('Spare parts charges have already been paid');
    err.statusCode = 400;
    throw err;
  }

  if (!['online', 'cash'].includes(paymentMethod)) {
    const err = new Error("Payment method must be either 'online' or 'cash'");
    err.statusCode = 400;
    throw err;
  }

  // If customer switches to cash, clear any pending razorpayOrderId so duplicate online payments are prevented
  if (paymentMethod === 'cash') {
    if (booking.spareParts.paymentDetails?.razorpayOrderId) {
      booking.spareParts.paymentDetails.razorpayOrderId = null;
    }
  }

  booking.spareParts.paymentMethod = paymentMethod;
  booking.spareParts.paymentStatus = 'pending';
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

  // The spare parts order charges specifically for the approved additional items (₹399)
  const payableAmount = booking.spareParts.totalAdditionalAmount || 0;

  if (!payableAmount || payableAmount <= 0) {
    const err = new Error('No payable amount for spare parts');
    err.statusCode = 400;
    throw err;
  }

  // Set spareParts paymentMethod to online
  booking.spareParts.paymentMethod = 'online';

  const { keyId } = paymentService.getSanitizedRazorpayConfig();
  const order = await paymentService.createOrder({
    amountInRupees: payableAmount,
    receipt: `${booking.bookingReference}-PARTS`,
    notes: {
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      paymentType: 'spare_parts',
      customerId: customer._id.toString(),
      payableAmount: payableAmount.toString()
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
  booking.spareParts.paymentMethod = 'online';
  if (!booking.spareParts.paymentDetails) booking.spareParts.paymentDetails = {};
  booking.spareParts.paymentDetails.razorpayOrderId = razorpayOrderId;
  booking.spareParts.paymentDetails.razorpayPaymentId = razorpayPaymentId;
  booking.spareParts.paymentDetails.razorpaySignature = razorpaySignature;
  booking.spareParts.paymentDetails.paidAt = new Date();
  booking.spareParts.paymentDetails.failureReason = null;

  // If base service was also unpaid and this order covered the full total, mark base paid too
  if (booking.paymentStatus !== 'paid' && booking.paymentMethod === 'online') {
    booking.paymentStatus = 'paid';
    if (!booking.paymentDetails) booking.paymentDetails = {};
    booking.paymentDetails.paidAt = new Date();
  }

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

  // Pending proposal check: extra materials must not be awaiting customer decision
  if (
    booking.spareParts &&
    ['pending_approval', 'pending_customer_approval'].includes(booking.spareParts.status)
  ) {
    const err = new Error('Cannot collect cash while extra materials proposal is awaiting customer approval');
    err.statusCode = 400;
    throw err;
  }

  // Check if booking is eligible for cash collection:
  // Case 1: booking.paymentMethod === 'cash'
  // Case 2: booking.paymentMethod === 'online' AND booking.spareParts?.paymentMethod === 'cash'
  const isBaseCash = booking.paymentMethod === 'cash';
  const isSparePartsCash =
    booking.spareParts &&
    booking.spareParts.status === 'approved' &&
    booking.spareParts.paymentMethod === 'cash';

  if (!isBaseCash && !isSparePartsCash) {
    const err = new Error(`Cannot record cash collection for '${booking.paymentMethod}' booking without cash payment option selected`);
    err.statusCode = 400;
    throw err;
  }

  // Status check: must be in_progress or completed
  if (!['in_progress', 'completed'].includes(booking.status)) {
    const err = new Error(`Cannot collect cash for booking in '${booking.status}' status. Must be 'in_progress' or 'completed'.`);
    err.statusCode = 400;
    throw err;
  }

  // Check already collected / duplicate collection
  if (isBaseCash) {
    if (booking.paymentStatus === 'paid' && booking.paymentDetails?.cashConfirmedByProvider) {
      if (!isSparePartsCash || booking.spareParts.paymentStatus === 'paid') {
        const err = new Error('Cash payment for this booking has already been collected and recorded');
        err.statusCode = 400;
        throw err;
      }
    }
  } else if (isSparePartsCash) {
    if (booking.spareParts.paymentStatus === 'paid') {
      const err = new Error('Approved extra materials cash charges have already been collected for this booking');
      err.statusCode = 400;
      throw err;
    }
    const extraCash = Number(booking.spareParts.totalAdditionalAmount || 0);
    if (extraCash <= 0) {
      const err = new Error('No outstanding cash balance to collect for this booking');
      err.statusCode = 400;
      throw err;
    }
  }

  const now = new Date();
  let updatedBooking = null;

  if (isBaseCash) {
    const finalPayable = booking.pricing?.totalAmount || 0;
    const updateFields = {
      paymentStatus: 'paid',
      'paymentDetails.cashCollectedAmount': finalPayable,
      'paymentDetails.cashConfirmedByProvider': true,
      'paymentDetails.cashConfirmedByProviderAt': now,
      'paymentDetails.paidAt': now,
      'paymentDetails.failureReason': null
    };

    if (booking.spareParts && booking.spareParts.status === 'approved') {
      updateFields['spareParts.paymentStatus'] = 'paid';
      if (!booking.spareParts.paymentMethod) {
        updateFields['spareParts.paymentMethod'] = 'cash';
      }
      updateFields['spareParts.paymentDetails.paidAt'] = now;
    }

    updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        provider: provider._id,
        $or: [
          { paymentStatus: { $ne: 'paid' } },
          { 'spareParts.paymentStatus': { $ne: 'paid' } }
        ]
      },
      { $set: updateFields },
      { new: true }
    );
  } else if (isSparePartsCash) {
    const extraCash = Number(booking.spareParts.totalAdditionalAmount || 0);
    updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        provider: provider._id,
        'spareParts.paymentStatus': { $ne: 'paid' }
      },
      {
        $set: {
          'spareParts.paymentStatus': 'paid',
          'spareParts.paymentMethod': 'cash',
          'spareParts.paymentDetails.paidAt': now,
          'paymentDetails.cashConfirmedByProvider': true,
          'paymentDetails.cashConfirmedByProviderAt': now
        },
        $inc: {
          'paymentDetails.cashCollectedAmount': extraCash
        }
      },
      { new: true }
    );
  }

  if (!updatedBooking) {
    const err = new Error('Cash payment could not be recorded: payment may have already been collected or modified concurrently');
    err.statusCode = 400;
    throw err;
  }

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

  const isCashApplicable =
    booking.paymentMethod === 'cash' ||
    (booking.spareParts && booking.spareParts.status === 'approved' && booking.spareParts.paymentMethod === 'cash');

  if (!isCashApplicable) {
    const err = new Error(`Cannot confirm cash payment for booking without cash payment option selected`);
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

  const isCashApplicable =
    booking.paymentMethod === 'cash' ||
    (booking.spareParts && booking.spareParts.status === 'approved' && booking.spareParts.paymentMethod === 'cash');

  if (!isCashApplicable) {
    const err = new Error(`Cannot report cash dispute for booking without cash payment option selected`);
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

/**
 * Get notifications for authenticated user
 */
const getUserNotifications = async (userId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { recipient: userId };
  if (query.unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, isRead: false })
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Mark notification as read
 */
const markNotificationRead = async (userId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    const err = new Error('Notification not found or access denied');
    err.statusCode = 404;
    throw err;
  }

  return notification;
};

/**
 * Provider updates / confirms service team size on a booking
 * Rules:
 * - Booking must belong to this provider
 * - Booking status must be 'accepted' or 'in_progress' (cannot update when pending, completed, or cancelled)
 * - When 'in_progress', reason is required for explicit authorized updates and recorded in history
 * - Price/payment is NEVER modified by team size changes
 * - Customer is notified via project notification system
 */
const updateTeamSizeByProvider = async (userId, bookingId, teamData) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId).populate({
    path: 'customer',
    populate: { path: 'user', select: 'name phone email' }
  });

  if (!booking) {
    const err = new Error(`Booking with ID '${bookingId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (!booking.provider || booking.provider.toString() !== provider._id.toString()) {
    const err = new Error('Access denied: You are not the assigned provider for this booking');
    err.statusCode = 403;
    throw err;
  }

  // Allowed states check
  if (!['accepted', 'in_progress'].includes(booking.status)) {
    const err = new Error(
      `Cannot update team size for booking in '${booking.status}' status. Team size can only be configured for 'accepted' or 'in_progress' bookings.`
    );
    err.statusCode = 400;
    throw err;
  }

  // After service starts ('in_progress'), explicit reason / authorization is required
  if (booking.status === 'in_progress') {
    if (!teamData.reason || typeof teamData.reason !== 'string' || !teamData.reason.trim()) {
      const err = new Error(
        'Reason for team size update is required because the service is already in progress'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const totalCount = parseInt(teamData.totalCount, 10);
  const roles = Array.isArray(teamData.roles)
    ? teamData.roles.map((r) => ({
        role: String(r.role || '').trim(),
        count: parseInt(r.count, 10) || 1
      }))
    : [];

  const now = new Date();
  const previousTotal = booking.serviceTeam?.totalCount || null;

  const historyEntry = {
    updatedAt: now,
    updatedBy: userId,
    previousTotalCount: previousTotal,
    newTotalCount: totalCount,
    roles,
    reason: (teamData.reason || (booking.serviceTeam?.isConfirmed ? 'Provider updated team configuration' : 'Provider confirmed initial team size')).trim(),
    bookingStatusAtUpdate: booking.status
  };

  const existingHistory = Array.isArray(booking.serviceTeam?.history) ? booking.serviceTeam.history : [];

  booking.serviceTeam = {
    totalCount,
    roles,
    isConfirmed: true,
    confirmedAt: booking.serviceTeam?.confirmedAt || now,
    notes: (teamData.notes !== undefined ? teamData.notes : (booking.serviceTeam?.notes || '')).trim(),
    history: [...existingHistory, historyEntry]
  };

  await booking.save();

  // Populate service details for response
  await booking.populate('service');

  // Notify customer about confirmed / updated team size
  try {
    const custUserId = booking.customer?.user?._id;
    if (custUserId) {
      const teamLabel = totalCount === 1 ? '1 person' : `${totalCount} people`;
      const updateMsg = previousTotal
        ? `The service team size has been updated to ${teamLabel} for booking ${booking.bookingReference}.`
        : `Your service team size has been confirmed: ${teamLabel} will arrive for booking ${booking.bookingReference}.`;

      await Notification.create({
        recipient: custUserId,
        title: `Service Team Update: ${booking.bookingReference}`,
        message: updateMsg,
        type: 'booking',
        data: {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          totalCount,
          status: booking.status
        }
      });
    }
  } catch (notifErr) {
    console.error('[TEAM_SIZE_NOTIFICATION_ERROR]', notifErr.message);
  }

  console.log(
    `[TEAM_SIZE_UPDATED] Booking: ${booking.bookingReference} | Total: ${totalCount} | Provider: ${provider._id}`
  );

  return booking;
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
  getAdminBookingStats,
  getAdminBookingById,
  cancelBookingByAdmin,
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure,
  submitSpareParts,
  reviewSpareParts,
  selectSparePartsPaymentMethod,
  createSparePartsPaymentOrder,
  verifySparePartsPayment,
  recordSparePartsPaymentFailure,
  confirmCashPaymentByProvider,
  confirmCashPaymentByCustomer,
  reportCashPaymentDispute,
  getUserNotifications,
  markNotificationRead,
  updateTeamSizeByProvider
};

