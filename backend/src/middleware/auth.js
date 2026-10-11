const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Authentication Middleware:
 * Verifies Bearer token, checks if User exists in DB, and checks if account is active.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access denied: No token provided or invalid format (Bearer token required)',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access denied: Empty token string',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        error: {
          message: isExpired ? 'Token expired: Please log in again' : 'Invalid token signature or payload',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Malformed token payload: Missing userId',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user still exists in database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Account not found: The user associated with this token no longer exists',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Account suspended or inactive: Contact support for assistance',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role Authorization Middleware Factory:
 * Restricts access to specific role(s) (e.g. ['admin'], ['provider'], ['customer'])
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required prior to role verification',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Your role is '${req.user.role}'.`,
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};
