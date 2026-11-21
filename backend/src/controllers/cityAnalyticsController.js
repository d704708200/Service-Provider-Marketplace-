const cityAnalyticsService = require('../services/cityAnalyticsService');

/**
 * GET /api/admin/analytics/cities
 */
const getCityAnalytics = async (req, res, next) => {
  try {
    const data = await cityAnalyticsService.getCityAnalytics(req.query);
    res.status(200).json({
      success: true,
      message: 'City-wise booking analytics retrieved successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics/cities/:city/bookings
 */
const getCityBookings = async (req, res, next) => {
  try {
    const result = await cityAnalyticsService.getCityBookings(req.params.city, req.query);
    res.status(200).json({
      success: true,
      message: 'City bookings retrieved successfully',
      city: result.city,
      data: result.bookings,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics/cities/:city/summary
 */
const getCitySummary = async (req, res, next) => {
  try {
    const data = await cityAnalyticsService.getCitySummary(req.params.city, req.query);
    res.status(200).json({
      success: true,
      message: 'City summary analytics retrieved successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics/cities/export
 */
const exportCityAnalyticsCSV = async (req, res, next) => {
  try {
    const csvContent = await cityAnalyticsService.exportCityAnalyticsCSV(req.query);
    const exportType = req.query.type || (req.query.city ? 'bookings' : 'summary');
    const cityName = req.query.city ? `_${req.query.city}` : '';
    const filename = `city_${exportType}${cityName}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCityAnalytics,
  getCityBookings,
  getCitySummary,
  exportCityAnalyticsCSV
};
