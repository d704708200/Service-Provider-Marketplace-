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

module.exports = {
  getAdminReviews,
  updateReviewVisibility,
  deleteReviewByAdmin
};
