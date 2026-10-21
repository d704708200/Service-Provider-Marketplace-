const serviceAreaService = require('../services/serviceAreaService');

const getAdminServiceAreas = async (req, res, next) => {
  try {
    const result = await serviceAreaService.getAdminServiceAreas(req.query);
    res.status(200).json({
      success: true,
      message: 'Service areas retrieved successfully',
      data: result.areas,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const createServiceArea = async (req, res, next) => {
  try {
    const area = await serviceAreaService.createServiceAreaByAdmin(req.body);
    res.status(201).json({
      success: true,
      message: 'Service area created successfully',
      data: area
    });
  } catch (error) {
    next(error);
  }
};

const updateServiceArea = async (req, res, next) => {
  try {
    const area = await serviceAreaService.updateServiceAreaByAdmin(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Service area updated successfully',
      data: area
    });
  } catch (error) {
    next(error);
  }
};

const toggleServiceAreaStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const area = await serviceAreaService.toggleServiceAreaStatusByAdmin(req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Service area ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: area
    });
  } catch (error) {
    next(error);
  }
};

const deleteServiceArea = async (req, res, next) => {
  try {
    const result = await serviceAreaService.deleteServiceAreaByAdmin(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminServiceAreas,
  createServiceArea,
  updateServiceArea,
  toggleServiceAreaStatus,
  deleteServiceArea
};
