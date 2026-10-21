const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const Customer = require('../models/Customer');
const User = require('../models/User');

/**
 * List all reviews with search, star rating filter, moderation status, and pagination
 */
const getAdminReviews = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  // Star Rating filter
  if (query.rating && query.rating !== 'all') {
    const r = parseInt(query.rating, 10);
    if (!isNaN(r) && r >= 1 && r <= 5) {
      filter.rating = r;
    }
  }

  // Moderation / Public visibility filter
  if (query.status && query.status !== 'all') {
    if (query.status === 'published' || query.status === 'public') {
      filter.isPublic = true;
    } else if (query.status === 'hidden' || query.status === 'flagged') {
      filter.isPublic = false;
    }
  }

  // Search by comment text, or customer/provider name
  if (query.search && query.search.trim()) {
    const rawSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(rawSearch, 'i');

    const matchingUsers = await User.find({
      $or: [{ name: searchRegex }, { email: searchRegex }]
    }).select('_id').lean();
    const matchedUserIds = matchingUsers.map((u) => u._id);

    const [matchingCustomers, matchingProviders] = await Promise.all([
      Customer.find({ user: { $in: matchedUserIds } }).select('_id').lean(),
      Provider.find({
        $or: [
          { businessName: searchRegex },
          { user: { $in: matchedUserIds } }
        ]
      }).select('_id').lean()
    ]);

    const matchedCustomerIds = matchingCustomers.map((c) => c._id);
    const matchedProviderIds = matchingProviders.map((p) => p._id);

    filter.$or = [
      { comment: searchRegex },
      { customer: { $in: matchedCustomerIds } },
      { provider: { $in: matchedProviderIds } }
    ];
  }

  const [reviews, total, statsAgg] = await Promise.all([
    Review.find(filter)
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name email phone avatar' }
      })
      .populate({
        path: 'provider',
        populate: { path: 'user', select: 'name email phone avatar' }
      })
      .populate('service', 'name price category')
      .populate('booking', 'bookingReference status pricing scheduledDate createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  // Calculate rating distributions
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sumScore = 0;
  let totalReviewsCount = 0;

  statsAgg.forEach((item) => {
    if (item._id && distribution.hasOwnProperty(item._id)) {
      distribution[item._id] = item.count;
      sumScore += item._id * item.count;
      totalReviewsCount += item.count;
    }
  });

  const averageRating = totalReviewsCount > 0 ? Number((sumScore / totalReviewsCount).toFixed(1)) : 0;

  return {
    reviews,
    stats: {
      total: totalReviewsCount,
      averageRating,
      distribution
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Toggle Review visibility / moderation status (hide or restore)
 */
const updateReviewVisibilityByAdmin = async (reviewId, isPublic) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    const err = new Error(`Invalid review ID format: '${reviewId}'`);
    err.statusCode = 400;
    throw err;
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    const err = new Error(`Review with ID '${reviewId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  review.isPublic = Boolean(isPublic);
  await review.save();

  // Recalculate provider rating to exclude/include review
  if (review.provider) {
    await recalculateProviderRating(review.provider);
  }

  return await Review.findById(review._id)
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name email phone' }
    })
    .populate({
      path: 'provider',
      populate: { path: 'user', select: 'name email phone' }
    })
    .populate('service', 'name')
    .lean();
};

/**
 * Delete a review permanently as administrator
 */
const deleteReviewByAdmin = async (reviewId) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    const err = new Error(`Invalid review ID format: '${reviewId}'`);
    err.statusCode = 400;
    throw err;
  }

  const review = await Review.findByIdAndDelete(reviewId);
  if (!review) {
    const err = new Error(`Review with ID '${reviewId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Recalculate provider rating
  if (review.provider) {
    await recalculateProviderRating(review.provider);
  }

  return { success: true, deletedId: reviewId };
};

/**
 * Recalculate Provider average rating and public review count
 */
const recalculateProviderRating = async (providerId) => {
  if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) return;

  const stats = await Review.aggregate([
    { $match: { provider: new mongoose.Types.ObjectId(providerId), isPublic: true } },
    {
      $group: {
        _id: '$provider',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);

  const count = stats.length > 0 ? stats[0].count : 0;
  const avg = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;

  await Provider.findByIdAndUpdate(providerId, {
    'rating.average': avg,
    'rating.count': count
  });
};

/**
 * Create a review by an authenticated customer
 */
const createReviewByCustomer = async (userId, reviewData) => {
  const { bookingId, rating, comment } = reviewData;

  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('A valid booking reference is required');
    err.statusCode = 400;
    throw err;
  }

  const numRating = parseInt(rating, 10);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    const err = new Error('Rating must be an integer between 1 and 5');
    err.statusCode = 400;
    throw err;
  }

  // Find customer profile
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Find booking
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  // Check customer ownership
  if (booking.customer.toString() !== customer._id.toString()) {
    const err = new Error('You can only review bookings made by your account');
    err.statusCode = 403;
    throw err;
  }

  // Check completed status
  if (booking.status !== 'completed') {
    const err = new Error(`Only completed bookings can be reviewed. Current status: '${booking.status}'`);
    err.statusCode = 400;
    throw err;
  }

  // Check existing review
  const existingReview = await Review.findOne({ booking: booking._id });
  if (existingReview) {
    const err = new Error('This booking has already been reviewed');
    err.statusCode = 409;
    throw err;
  }

  if (!booking.provider) {
    const err = new Error('This booking has no assigned service provider to review');
    err.statusCode = 400;
    throw err;
  }

  const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

  const newReview = await Review.create({
    booking: booking._id,
    customer: customer._id,
    provider: booking.provider,
    service: booking.service,
    rating: numRating,
    comment: trimmedComment,
    isPublic: true
  });

  // Update provider aggregate rating
  await recalculateProviderRating(booking.provider);

  return await Review.findById(newReview._id)
    .populate({
      path: 'customer',
      populate: { path: 'user', select: 'name email phone avatar' }
    })
    .populate({
      path: 'provider',
      select: 'businessName rating',
      populate: { path: 'user', select: 'name avatar' }
    })
    .populate('service', 'name price')
    .populate('booking', 'bookingReference status scheduledDate')
    .lean();
};

/**
 * Get review for a specific booking
 */
const getBookingReview = async (userId, bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking ID');
    err.statusCode = 400;
    throw err;
  }

  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    const err = new Error('Customer profile not found');
    err.statusCode = 404;
    throw err;
  }

  const review = await Review.findOne({ booking: bookingId, customer: customer._id })
    .populate({
      path: 'provider',
      select: 'businessName rating',
      populate: { path: 'user', select: 'name avatar' }
    })
    .populate('service', 'name price')
    .populate('booking', 'bookingReference status scheduledDate')
    .lean();

  return review;
};

/**
 * Get reviews created by authenticated customer
 */
const getCustomerReviews = async (userId) => {
  const customer = await Customer.findOne({ user: userId });
  if (!customer) {
    return [];
  }

  return await Review.find({ customer: customer._id })
    .populate({
      path: 'provider',
      select: 'businessName rating',
      populate: { path: 'user', select: 'name avatar' }
    })
    .populate('service', 'name price')
    .populate('booking', 'bookingReference status scheduledDate')
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Get public reviews for a provider
 */
const getProviderPublicReviews = async (providerId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    const err = new Error('Invalid provider ID');
    err.statusCode = 400;
    throw err;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = { provider: providerId, isPublic: true };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name avatar' }
      })
      .populate('service', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter)
  ]);

  return {
    reviews,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

module.exports = {
  getAdminReviews,
  updateReviewVisibilityByAdmin,
  deleteReviewByAdmin,
  recalculateProviderRating,
  createReviewByCustomer,
  getBookingReview,
  getCustomerReviews,
  getProviderPublicReviews
};
