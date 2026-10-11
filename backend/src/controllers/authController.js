const authService = require('../services/authService');

const registerCustomer = async (req, res, next) => {
  try {
    const result = await authService.registerCustomer(req.body);
    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const loginCustomer = async (req, res, next) => {
  try {
    const result = await authService.loginCustomer(req.body);
    res.status(200).json({
      success: true,
      message: 'Customer logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const registerProvider = async (req, res, next) => {
  try {
    const result = await authService.registerProvider(req.body);
    res.status(201).json({
      success: true,
      message: 'Provider registered successfully. Account is pending admin verification.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const loginProvider = async (req, res, next) => {
  try {
    const result = await authService.loginProvider(req.body);
    res.status(200).json({
      success: true,
      message: 'Provider logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const result = await authService.loginAdmin(req.body);
    res.status(200).json({
      success: true,
      message: 'Administrator authenticated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Current user profile retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerCustomer,
  loginCustomer,
  registerProvider,
  loginProvider,
  loginAdmin,
  getMe
};
