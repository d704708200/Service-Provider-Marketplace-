const validateRegisterCustomer = (req, res, next) => {
  const { name, email, phone, password, address } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters');
  }

  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
    errors.push('A valid phone number is required (min 7 digits)');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters');
  }

  if (address) {
    if (typeof address !== 'object' || !address.street || !address.city) {
      errors.push('Address if provided must include street and city');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const validateRegisterProvider = (req, res, next) => {
  const { name, email, phone, password, businessName, bio, experienceYears } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters');
  }

  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
    errors.push('A valid phone number is required (min 7 digits)');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters');
  }

  if (experienceYears !== undefined && (typeof experienceYears !== 'number' || experienceYears < 0)) {
    errors.push('Experience years must be a non-negative number');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required');
  }

  if (!password || typeof password !== 'string' || !password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const mongoose = require('mongoose');

const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid MongoDB ObjectId for parameter '${paramName}': '${id}'`,
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }
    next();
  };
};

const validateCreateCategory = (req, res, next) => {
  const { name, displayOrder, description } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Category name is required');
  } else if (name.trim().length > 100) {
    errors.push('Category name cannot exceed 100 characters');
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  if (displayOrder !== undefined && (!Number.isInteger(Number(displayOrder)) || Number(displayOrder) < 0)) {
    errors.push('Display order must be a non-negative integer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const validateUpdateCategory = (req, res, next) => {
  const { name, displayOrder, description } = req.body;
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      errors.push('Category name cannot be empty');
    } else if (name.trim().length > 100) {
      errors.push('Category name cannot exceed 100 characters');
    }
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  if (displayOrder !== undefined && (!Number.isInteger(Number(displayOrder)) || Number(displayOrder) < 0)) {
    errors.push('Display order must be a non-negative integer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const validateUpdateCategoryStatus = (req, res, next) => {
  const { isActive } = req.body;
  if (isActive === undefined || typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed: 'isActive' boolean field is required",
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

const validateCreateService = (req, res, next) => {
  const { name, category, price, priceType = 'fixed', estimatedDurationMinutes, provider, description, image, isActive } = req.body;
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Service name is required');
  } else if (name.trim().length < 2 || name.trim().length > 150) {
    errors.push('Service name must be between 2 and 150 characters');
  }

  // Category validation
  if (!category || !mongoose.Types.ObjectId.isValid(category)) {
    errors.push('A valid category ObjectId is required');
  }

  // Price type validation
  const validPriceTypes = ['fixed', 'hourly', 'quote'];
  if (priceType && !validPriceTypes.includes(priceType)) {
    errors.push(`Price type must be one of: ${validPriceTypes.join(', ')}`);
  }

  // Price validation
  if (price === undefined || price === null || typeof price !== 'number' || Number.isNaN(price) || price < 0) {
    errors.push('Price is required and must be a non-negative number');
  } else {
    // For fixed or hourly, price must be greater than zero. Quote can be 0 (custom quote/free estimate)
    const effectivePriceType = priceType || 'fixed';
    if ((effectivePriceType === 'fixed' || effectivePriceType === 'hourly') && price <= 0) {
      errors.push(`Price must be greater than 0 for ${effectivePriceType} pricing model`);
    }
  }

  // Duration validation
  if (estimatedDurationMinutes !== undefined) {
    if (!Number.isInteger(Number(estimatedDurationMinutes)) || Number(estimatedDurationMinutes) < 1) {
      errors.push('Estimated duration must be an integer of at least 1 minute');
    }
  }

  // Provider validation (if supplied)
  if (provider !== undefined && provider !== null && !mongoose.Types.ObjectId.isValid(provider)) {
    errors.push('Provider if provided must be a valid ObjectId');
  }

  // Description validation
  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  // Image validation
  if (image !== undefined && image !== null && typeof image !== 'string') {
    errors.push('Image must be a string URL or null');
  }

  // isActive validation
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const validateUpdateService = (req, res, next) => {
  const { name, category, price, priceType, estimatedDurationMinutes, provider, description, image, isActive } = req.body;
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      errors.push('Service name cannot be empty');
    } else if (name.trim().length < 2 || name.trim().length > 150) {
      errors.push('Service name must be between 2 and 150 characters');
    }
  }

  if (category !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(category)) {
      errors.push('Category must be a valid ObjectId');
    }
  }

  const validPriceTypes = ['fixed', 'hourly', 'quote'];
  if (priceType !== undefined && !validPriceTypes.includes(priceType)) {
    errors.push(`Price type must be one of: ${validPriceTypes.join(', ')}`);
  }

  if (price !== undefined) {
    if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
      errors.push('Price must be a non-negative number');
    } else if (priceType && (priceType === 'fixed' || priceType === 'hourly') && price <= 0) {
      errors.push(`Price must be greater than 0 for ${priceType} pricing model`);
    }
  }

  if (estimatedDurationMinutes !== undefined) {
    if (!Number.isInteger(Number(estimatedDurationMinutes)) || Number(estimatedDurationMinutes) < 1) {
      errors.push('Estimated duration must be an integer of at least 1 minute');
    }
  }

  if (provider !== undefined && provider !== null && !mongoose.Types.ObjectId.isValid(provider)) {
    errors.push('Provider if provided must be a valid ObjectId');
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  if (image !== undefined && image !== null && typeof image !== 'string') {
    errors.push('Image must be a string URL or null');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Validation failed: ${errors.join(', ')}`,
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

const validateUpdateServiceStatus = (req, res, next) => {
  const { isActive } = req.body;
  if (isActive === undefined || typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed: 'isActive' boolean field is required",
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

module.exports = {
  validateRegisterCustomer,
  validateRegisterProvider,
  validateLogin,
  validateObjectId,
  validateCreateCategory,
  validateUpdateCategory,
  validateUpdateCategoryStatus,
  validateCreateService,
  validateUpdateService,
  validateUpdateServiceStatus
};
