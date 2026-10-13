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

const validateUpdateProviderProfile = (req, res, next) => {
  const {
    businessName,
    bio,
    experienceYears,
    avatar,
    categories,
    phone,
    isAvailable,
    // Disallow modifying protected fields
    role,
    verificationStatus,
    rating,
    reviewCount,
    completedBookingsCount,
    rejectionReason,
    verifiedAt,
    isActive
  } = req.body;

  const errors = [];

  // Check for forbidden fields
  if (role !== undefined || verificationStatus !== undefined || rating !== undefined ||
      reviewCount !== undefined || completedBookingsCount !== undefined ||
      rejectionReason !== undefined || verifiedAt !== undefined || isActive !== undefined) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Security violation: Attempted to modify protected profile fields (role, verification status, rating, or account status)',
        statusCode: 403,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (businessName !== undefined) {
    if (typeof businessName !== 'string') {
      errors.push('Business name must be a string');
    } else if (businessName.trim().length > 100) {
      errors.push('Business name cannot exceed 100 characters');
    }
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      errors.push('Bio must be a string');
    } else if (bio.trim().length > 500) {
      errors.push('Bio cannot exceed 500 characters');
    }
  }

  if (experienceYears !== undefined) {
    if (typeof experienceYears !== 'number' || experienceYears < 0) {
      errors.push('Experience years must be a non-negative number');
    }
  }

  if (avatar !== undefined && avatar !== null && typeof avatar !== 'string') {
    errors.push('Avatar must be a string URL or null');
  }

  if (phone !== undefined) {
    if (typeof phone !== 'string' || phone.trim().length < 7) {
      errors.push('Phone number must be at least 7 characters long');
    }
  }

  if (categories !== undefined) {
    if (!Array.isArray(categories)) {
      errors.push('Categories must be an array of category ObjectIds');
    } else {
      for (const catId of categories) {
        if (!mongoose.Types.ObjectId.isValid(catId)) {
          errors.push(`Invalid category ObjectId format: '${catId}'`);
          break;
        }
      }
    }
  }

  if (isAvailable !== undefined && typeof isAvailable !== 'boolean') {
    errors.push('isAvailable must be a boolean');
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

const validateSubmitDocument = (req, res, next) => {
  const { type, documentUrl } = req.body;
  const errors = [];

  const validTypes = ['identity', 'address', 'certificate', 'license', 'other'];
  if (!type || typeof type !== 'string' || !validTypes.includes(type.trim().toLowerCase())) {
    errors.push(`Document type is required and must be one of: ${validTypes.join(', ')}`);
  }

  if (!documentUrl || typeof documentUrl !== 'string' || !documentUrl.trim()) {
    errors.push('Document URL is required');
  } else {
    const trimmedUrl = documentUrl.trim();
    if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
      errors.push('Document URL must be a valid HTTP or HTTPS URL');
    } else if (trimmedUrl.length > 1000) {
      errors.push('Document URL exceeds maximum length (1000 characters)');
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

const validateDocumentReview = (req, res, next) => {
  const { status, reviewNote } = req.body;
  const errors = [];

  const validStatuses = ['approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    errors.push(`Review status must be one of: ${validStatuses.join(', ')}`);
  }

  if (status === 'rejected' && (!reviewNote || typeof reviewNote !== 'string' || !reviewNote.trim())) {
    errors.push('A review note is required when rejecting a document');
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

const validateProviderVerification = (req, res, next) => {
  const { status, rejectionReason } = req.body;
  const errors = [];

  const validStatuses = ['verified', 'rejected', 'suspended'];
  if (!status || !validStatuses.includes(status)) {
    errors.push(`Verification status must be one of: ${validStatuses.join(', ')}`);
  }

  if ((status === 'rejected' || status === 'suspended') && (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim())) {
    errors.push(`A reason is required when status is '${status}'`);
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

const validateAccountStatus = (req, res, next) => {
  const { isActive } = req.body;
  if (isActive === undefined || typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed: 'isActive' boolean is required",
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

const validateCreateBooking = (req, res, next) => {
  const { serviceId, providerId, bookingMode = 'scheduled', scheduledDate, scheduledTimeSlot, address, notes, problemDescription, paymentMethod } = req.body;
  const errors = [];

  // Service ID validation
  if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
    errors.push('A valid serviceId (MongoDB ObjectId) is required');
  }

  // Provider ID validation (optional)
  if (providerId !== undefined && providerId !== null && !mongoose.Types.ObjectId.isValid(providerId)) {
    errors.push('Provider ID if provided must be a valid MongoDB ObjectId');
  }

  // Booking mode validation
  const validModes = ['instant', 'scheduled'];
  if (bookingMode && !validModes.includes(bookingMode)) {
    errors.push(`Booking mode must be one of: ${validModes.join(', ')}`);
  }

  // Address validation
  if (!address || typeof address !== 'object') {
    errors.push('Service address object is required');
  } else {
    if (!address.street || typeof address.street !== 'string' || !address.street.trim()) {
      errors.push('Street address is required');
    }
    if (!address.city || typeof address.city !== 'string' || !address.city.trim()) {
      errors.push('City is required');
    }
  }

  // Scheduled date & time slot validation for scheduled bookings
  if (bookingMode === 'scheduled') {
    if (!scheduledDate) {
      errors.push('scheduledDate is required for scheduled bookings');
    } else {
      const parsedDate = new Date(scheduledDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push('scheduledDate must be a valid date');
      } else {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const checkDate = new Date(parsedDate);
        checkDate.setHours(23, 59, 59, 999);
        if (checkDate < todayStart) {
          errors.push('Scheduled date cannot be in the past');
        }
      }
    }

    if (!scheduledTimeSlot || typeof scheduledTimeSlot !== 'object') {
      errors.push('scheduledTimeSlot with startTime and endTime is required for scheduled bookings');
    } else {
      if (!scheduledTimeSlot.startTime || typeof scheduledTimeSlot.startTime !== 'string' || !scheduledTimeSlot.startTime.trim()) {
        errors.push('scheduledTimeSlot.startTime is required');
      }
      if (!scheduledTimeSlot.endTime || typeof scheduledTimeSlot.endTime !== 'string' || !scheduledTimeSlot.endTime.trim()) {
        errors.push('scheduledTimeSlot.endTime is required');
      }
    }
  }

  // Optional notes validation
  const effectiveNotes = notes || problemDescription;
  if (effectiveNotes !== undefined && typeof effectiveNotes !== 'string') {
    errors.push('Notes or problem description must be a string');
  }

  // Optional payment method
  const validPaymentMethods = ['cash', 'card', 'upi', 'wallet'];
  if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
    errors.push(`Payment method must be one of: ${validPaymentMethods.join(', ')}`);
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

const validateCancelBooking = (req, res, next) => {
  const { cancellationReason } = req.body;
  if (cancellationReason !== undefined && typeof cancellationReason !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'cancellationReason must be a string if provided',
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

const validateRejectBooking = (req, res, next) => {
  const { rejectionReason } = req.body;
  if (rejectionReason !== undefined && typeof rejectionReason !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'rejectionReason must be a string if provided',
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
  validateUpdateServiceStatus,
  validateUpdateProviderProfile,
  validateSubmitDocument,
  validateDocumentReview,
  validateProviderVerification,
  validateAccountStatus,
  validateCreateBooking,
  validateCancelBooking,
  validateRejectBooking
};

const validateUpdateCustomerProfile = (req, res, next) => {
  const { name, phone, avatar, defaultPaymentMethod, emergencyContact, role, isActive, isVerified } = req.body;
  const errors = [];

  // Strictly disallow altering protected security fields
  if (role !== undefined || isActive !== undefined || isVerified !== undefined) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Security violation: Attempted to modify protected fields (role, account status, or verification)',
        statusCode: 403,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    } else if (name.trim().length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }
  }

  if (phone !== undefined) {
    if (typeof phone !== 'string' || phone.trim().length < 7) {
      errors.push('Phone must be a valid phone number (min 7 digits)');
    }
  }

  if (avatar !== undefined && avatar !== null && typeof avatar !== 'string') {
    errors.push('Avatar must be a string URL or null');
  }

  const validPaymentMethods = ['cash', 'card', 'upi', 'wallet'];
  if (defaultPaymentMethod !== undefined && !validPaymentMethods.includes(defaultPaymentMethod)) {
    errors.push(`defaultPaymentMethod must be one of: ${validPaymentMethods.join(', ')}`);
  }

  if (emergencyContact !== undefined) {
    if (typeof emergencyContact !== 'object' || emergencyContact === null) {
      errors.push('emergencyContact must be an object with name and phone');
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

const validateCustomerAddress = (req, res, next) => {
  const { street, city, state, zipCode, location, isDefault } = req.body;
  const errors = [];

  if (!street || typeof street !== 'string' || !street.trim()) {
    errors.push('Street address is required');
  } else if (street.trim().length > 200) {
    errors.push('Street address cannot exceed 200 characters');
  }

  if (!city || typeof city !== 'string' || !city.trim()) {
    errors.push('City is required');
  } else if (city.trim().length > 100) {
    errors.push('City cannot exceed 100 characters');
  }

  if (state !== undefined && typeof state !== 'string') {
    errors.push('State must be a string');
  }

  if (zipCode !== undefined && typeof zipCode !== 'string') {
    errors.push('Postal/Zip code must be a string');
  }

  if (isDefault !== undefined && typeof isDefault !== 'boolean') {
    errors.push('isDefault must be a boolean');
  }

  if (location !== undefined) {
    if (
      !location ||
      typeof location !== 'object' ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      errors.push('Location must be a GeoJSON object with [longitude, latitude] coordinates');
    } else {
      const [lng, lat] = location.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number' || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        errors.push('Coordinates must be valid numbers: longitude between -180 and 180, latitude between -90 and 90');
      }
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

const validateUpdateCustomerAddress = (req, res, next) => {
  const { street, city, state, zipCode, location, isDefault } = req.body;
  const errors = [];

  if (street !== undefined) {
    if (typeof street !== 'string' || !street.trim()) {
      errors.push('Street address cannot be empty');
    } else if (street.trim().length > 200) {
      errors.push('Street address cannot exceed 200 characters');
    }
  }

  if (city !== undefined) {
    if (typeof city !== 'string' || !city.trim()) {
      errors.push('City cannot be empty');
    } else if (city.trim().length > 100) {
      errors.push('City cannot exceed 100 characters');
    }
  }

  if (state !== undefined && typeof state !== 'string') {
    errors.push('State must be a string');
  }

  if (zipCode !== undefined && typeof zipCode !== 'string') {
    errors.push('Postal/Zip code must be a string');
  }

  if (isDefault !== undefined && typeof isDefault !== 'boolean') {
    errors.push('isDefault must be a boolean');
  }

  if (location !== undefined) {
    if (
      !location ||
      typeof location !== 'object' ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      errors.push('Location must be a GeoJSON object with [longitude, latitude] coordinates');
    } else {
      const [lng, lat] = location.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number' || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        errors.push('Coordinates must be valid numbers: longitude between -180 and 180, latitude between -90 and 90');
      }
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

const validateProviderAvailability = (req, res, next) => {
  const { schedule } = req.body;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!schedule || !Array.isArray(schedule)) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed: 'schedule' array is required",
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  const errors = [];
  const seenDays = new Set();

  schedule.forEach((dayEntry, index) => {
    if (dayEntry.dayOfWeek === undefined || !Number.isInteger(Number(dayEntry.dayOfWeek))) {
      errors.push(`Entry #${index + 1}: dayOfWeek must be an integer between 0 and 6`);
    } else {
      const dayNum = Number(dayEntry.dayOfWeek);
      if (dayNum < 0 || dayNum > 6) {
        errors.push(`Entry #${index + 1}: dayOfWeek must be between 0 (Sunday) and 6 (Saturday)`);
      }
      if (seenDays.has(dayNum)) {
        errors.push(`Duplicate schedule entry for dayOfWeek ${dayNum}`);
      }
      seenDays.add(dayNum);
    }

    if (dayEntry.isAvailable !== undefined && typeof dayEntry.isAvailable !== 'boolean') {
      errors.push(`Entry #${index + 1}: isAvailable must be a boolean`);
    }

    if (dayEntry.slots !== undefined) {
      if (!Array.isArray(dayEntry.slots)) {
        errors.push(`Entry #${index + 1}: slots must be an array`);
      } else {
        dayEntry.slots.forEach((slot, slotIdx) => {
          if (!slot.startTime || !timeRegex.test(slot.startTime)) {
            errors.push(`Entry #${index + 1}, Slot #${slotIdx + 1}: startTime must match HH:mm format`);
          }
          if (!slot.endTime || !timeRegex.test(slot.endTime)) {
            errors.push(`Entry #${index + 1}, Slot #${slotIdx + 1}: endTime must match HH:mm format`);
          }
          if (slot.startTime && slot.endTime && timeRegex.test(slot.startTime) && timeRegex.test(slot.endTime)) {
            if (slot.startTime >= slot.endTime) {
              errors.push(`Entry #${index + 1}, Slot #${slotIdx + 1}: startTime (${slot.startTime}) must precede endTime (${slot.endTime})`);
            }
          }
        });
      }
    }
  });

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

const validateProviderServiceArea = (req, res, next) => {
  const { name, city, state, zipCodes, polygon } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Service area name is required');
  } else if (name.trim().length > 100) {
    errors.push('Service area name cannot exceed 100 characters');
  }

  if (!city || typeof city !== 'string' || !city.trim()) {
    errors.push('City is required');
  }

  if (state !== undefined && typeof state !== 'string') {
    errors.push('State must be a string');
  }

  if (zipCodes !== undefined) {
    if (!Array.isArray(zipCodes)) {
      errors.push('zipCodes must be an array of postal codes');
    } else {
      for (const z of zipCodes) {
        if (typeof z !== 'string' || !z.trim()) {
          errors.push('Each zipCode must be a non-empty string');
          break;
        }
      }
    }
  }

  if (polygon !== undefined) {
    if (
      !polygon ||
      typeof polygon !== 'object' ||
      polygon.type !== 'Polygon' ||
      !Array.isArray(polygon.coordinates) ||
      polygon.coordinates.length === 0
    ) {
      errors.push("polygon must be a GeoJSON Polygon with type 'Polygon' and coordinate rings");
    } else {
      // Validate polygon coordinates
      const ring = polygon.coordinates[0];
      if (!Array.isArray(ring) || ring.length < 4) {
        errors.push('GeoJSON Polygon ring must contain at least 4 coordinate pairs (first and last must match)');
      } else {
        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length < 2 || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            errors.push('Each polygon point must be [longitude, latitude] numbers');
            break;
          }
          const [lng, lat] = coord;
          if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            errors.push('Polygon coordinates out of range (-180 to 180 longitude, -90 to 90 latitude)');
            break;
          }
        }
      }
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

const validateUpdateProviderServiceArea = (req, res, next) => {
  const { name, city, state, zipCodes, polygon, isActive } = req.body;
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      errors.push('Service area name cannot be empty');
    } else if (name.trim().length > 100) {
      errors.push('Service area name cannot exceed 100 characters');
    }
  }

  if (city !== undefined && (typeof city !== 'string' || !city.trim())) {
    errors.push('City cannot be empty');
  }

  if (state !== undefined && typeof state !== 'string') {
    errors.push('State must be a string');
  }

  if (zipCodes !== undefined && !Array.isArray(zipCodes)) {
    errors.push('zipCodes must be an array of postal codes');
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (polygon !== undefined) {
    if (
      !polygon ||
      typeof polygon !== 'object' ||
      polygon.type !== 'Polygon' ||
      !Array.isArray(polygon.coordinates) ||
      polygon.coordinates.length === 0
    ) {
      errors.push("polygon must be a GeoJSON Polygon with type 'Polygon' and coordinate rings");
    } else {
      const ring = polygon.coordinates[0];
      if (!Array.isArray(ring) || ring.length < 4) {
        errors.push('GeoJSON Polygon ring must contain at least 4 coordinate pairs (first and last must match)');
      } else {
        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length < 2 || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            errors.push('Each polygon point must be [longitude, latitude] numbers');
            break;
          }
          const [lng, lat] = coord;
          if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            errors.push('Polygon coordinates out of range (-180 to 180 longitude, -90 to 90 latitude)');
            break;
          }
        }
      }
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
  validateUpdateServiceStatus,
  validateUpdateProviderProfile,
  validateSubmitDocument,
  validateDocumentReview,
  validateProviderVerification,
  validateAccountStatus,
  validateCreateBooking,
  validateCancelBooking,
  validateRejectBooking,
  validateUpdateCustomerProfile,
  validateCustomerAddress,
  validateUpdateCustomerAddress,
  validateProviderAvailability,
  validateProviderServiceArea,
  validateUpdateProviderServiceArea
};


