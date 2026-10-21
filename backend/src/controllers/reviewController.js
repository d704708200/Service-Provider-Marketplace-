const reviewService = require('../services/reviewService');

const getAdminReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getAdminReviews(req.query);
    res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: result.reviews,
      stats: result.stats,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const updateReviewVisibility = async (req, res, next) => {
  try {
    const { isPublic } = req.body;
    const review = await reviewService.updateReviewVisibilityByAdmin(req.params.id, isPublic);
    res.status(200).json({
      success: true,
      message: `Review ${isPublic ? 'restored to public view' : 'hidden from public view'} successfully`,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

const deleteReviewByAdmin = async (req, res, next) => {
  try {
    const result = await reviewService.deleteReviewByAdmin(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const createCustomerReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReviewByCustomer(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerReviews = async (req, res, next) => {
  try {
    const reviews = await reviewService.getCustomerReviews(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Customer reviews retrieved successfully',
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

const getBookingReview = async (req, res, next) => {
  try {
    const review = await reviewService.getBookingReview(req.user._id, req.params.bookingId);
    res.status(200).json({
      success: true,
      message: 'Booking review status retrieved successfully',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

const getProviderPublicReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getProviderPublicReviews(req.params.providerId, req.query);
    res.status(200).json({
      success: true,
      message: 'Provider reviews retrieved successfully',
      data: result.reviews,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminReviews,
  updateReviewVisibility,
  deleteReviewByAdmin,
  createCustomerReview,
  getCustomerReviews,
  getBookingReview,
  getProviderPublicReviews
};
