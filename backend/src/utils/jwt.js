const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production environment');
    }
    // Return a default secret strictly in non-production environments with a warning
    return 'dev-jwt-secret-key-change-in-production-123456';
  }
  return secret;
};

const generateToken = (payload, expiresIn) => {
  const secret = getJwtSecret();
  const options = {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '7d'
  };
  return jwt.sign(payload, secret, options);
};

const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

module.exports = {
  getJwtSecret,
  generateToken,
  verifyToken
};
