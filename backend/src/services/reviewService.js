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

  return { success: true, deletedId: reviewId };
};

module.exports = {
  getAdminReviews,
  updateReviewVisibilityByAdmin,
  deleteReviewByAdmin
};
