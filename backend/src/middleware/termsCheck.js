const Provider = require('../models/Provider');
const { CURRENT_TERMS_VERSION } = require('../constants/providerTerms');

/**
 * Server-side access enforcement middleware for service provider Terms & Conditions.
 * Ensures providers who have not accepted the current terms version cannot access
 * normal provider operations.
 *
 * Exemptions:
 * - Non-provider users (customers and admins are never locked)
 * - Terms retrieval (GET /api/providers/terms)
 * - Terms acceptance (POST /api/providers/accept-terms)
 * - Basic profile retrieval (GET /api/providers/me) so the UI can check status
 * - Authentication status and logout endpoints
 */
const enforceTermsAcceptance = async (req, res, next) => {
  if (!req.user || req.user.role !== 'provider') {
    return next();
  }

  const rawPath = req.path || req.originalUrl || '';
  const cleanPath = rawPath.split('?')[0].toLowerCase();

  // Allowed whitelist paths for providers needing acceptance
  const isWhitelisted =
    cleanPath.endsWith('/terms') ||
    cleanPath.endsWith('/accept-terms') ||
    cleanPath.endsWith('/logout') ||
    (req.method === 'GET' && (cleanPath.endsWith('/providers/me') || cleanPath.endsWith('/auth/me')));

  if (isWhitelisted) {
    return next();
  }

  try {
    const provider = await Provider.findOne({ user: req.user._id })
      .select('acceptedTermsVersion acceptedTermsAt')
      .lean();

    const isAccepted =
      provider &&
      provider.acceptedTermsVersion === CURRENT_TERMS_VERSION &&
      Boolean(provider.acceptedTermsAt);

    if (!isAccepted) {
      return res.status(403).json({
        success: false,
        code: 'TERMS_ACCEPTANCE_REQUIRED',
        requiresTermsAcceptance: true,
        message: 'You must read and accept the updated MENDROO Service Provider Terms & Conditions to access this feature.',
        currentVersion: CURRENT_TERMS_VERSION
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { enforceTermsAcceptance };
