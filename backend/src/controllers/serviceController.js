const serviceService = require('../services/serviceService');

/**
 * GET /api/services
 * List active services for public use
 */
const getPublicServices = async (req, res, next) => {
  try {
    const services = await serviceService.getPublicServices(req.query);
    res.status(200).json({
      success: true,
      message: 'Active services retrieved successfully',
      data: services
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/services/admin
 * Admin-only service listing with pagination, search, category filter, and status filter
 */
const getAdminServices = async (req, res, next) => {
  try {
    const result = await serviceService.getAdminServices(req.query);
    res.status(200).json({
      success: true,
      message: 'Admin services retrieved successfully',
      data: result.services,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/services/:id
 * Retrieve single service details
 */
const getServiceById = async (req, res, next) => {
  try {
    const service = await serviceService.getServiceById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Service retrieved successfully',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/services
 * Admin-only: create new service
 */
const createService = async (req, res, next) => {
  try {
    const service = await serviceService.createService(req.body);
    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/services/:id
 * Admin-only: update service details
 */
const updateService = async (req, res, next) => {
  try {
    const service = await serviceService.updateService(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/services/:id/status
 * Admin-only: activate or deactivate service
 */
const updateServiceStatus = async (req, res, next) => {
  try {
    const service = await serviceService.updateServiceStatus(req.params.id, req.body.isActive);
    res.status(200).json({
      success: true,
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`,
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/services/:id
 * Admin-only: safe deletion or conflict if referenced by bookings
 */
const deleteService = async (req, res, next) => {
  try {
    const result = await serviceService.deleteService(req.params.id);
    res.status(200).json({
      success: true,
      message: `Service '${result.name}' deleted successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicServices,
  getAdminServices,
  getServiceById,
  createService,
  updateService,
  updateServiceStatus,
  deleteService
};
