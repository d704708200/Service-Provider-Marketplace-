const reportService = require('../services/reportService');

const getPlatformReports = async (req, res, next) => {
  try {
    const reportData = await reportService.getPlatformReports(req.query);
    res.status(200).json({
      success: true,
      message: 'Platform reports and analytical metrics generated successfully',
      data: reportData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlatformReports
};
