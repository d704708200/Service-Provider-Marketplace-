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

module.exports = {
  validateRegisterCustomer,
  validateRegisterProvider,
  validateLogin
};
