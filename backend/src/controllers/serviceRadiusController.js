const serviceRadiusService = require('../services/serviceRadiusService');

const listRadiusConfigs = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.listRadiusConfigs(req.query);
    res.status(200).json({
      success: true,
      message: 'Service radius configurations retrieved successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getRadiusConfigById = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.getRadiusConfigById(req.params.id);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const createRadiusConfig = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.createRadiusConfig(req.body);
    res.status(201).json({
      success: true,
      message: 'Service radius configuration created successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const updateRadiusConfig = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.updateRadiusConfig(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Service radius configuration updated successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const addRadiusOption = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.addRadiusOption(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Radius option added successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const toggleRadiusOption = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.toggleRadiusOption(
      req.params.id,
      req.params.radiusId,
      req.body.isActive
    );
    res.status(200).json({
      success: true,
      message: 'Radius option status updated successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const deleteRadiusOption = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.deleteRadiusOption(req.params.id, req.params.radiusId);
    res.status(200).json({
      success: true,
      message: 'Radius option deleted successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getProvidersByRadius = async (req, res, next) => {
  try {
    const data = await serviceRadiusService.getProvidersByRadius(req.params.id, req.query);
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const deleteRadiusConfig = async (req, res, next) => {
  try {
    const result = await serviceRadiusService.deleteRadiusConfig(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listRadiusConfigs,
  getRadiusConfigById,
  createRadiusConfig,
  updateRadiusConfig,
  addRadiusOption,
  toggleRadiusOption,
  deleteRadiusOption,
  getProvidersByRadius,
  deleteRadiusConfig
};

