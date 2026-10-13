const providerService = require('../services/providerService');

/**
 * GET /api/providers/me
 * Authenticated provider views their own complete profile
 */
const getProviderMe = async (req, res, next) => {
  try {
    const profile = await providerService.getProviderProfileByUserId(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Provider profile retrieved successfully',
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/providers/me
 * Authenticated provider updates their permitted profile fields
 */
const updateProviderMe = async (req, res, next) => {
  try {
    const updated = await providerService.updateProviderProfileByUserId(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: 'Provider profile updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/me/services
 * Authenticated provider views their own services
 */
const getProviderServices = async (req, res, next) => {
  try {
    const services = await providerService.getProviderServicesByUserId(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Provider services retrieved successfully',
      data: services
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/me/availability
 * Authenticated provider views their schedule
 */
const getProviderAvailability = async (req, res, next) => {
  try {
    const availability = await providerService.getProviderAvailabilityByUserId(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Provider availability schedule retrieved successfully',
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/providers/me/availability
 * Authenticated provider updates their schedule
 */
const updateProviderAvailability = async (req, res, next) => {
  try {
    const updated = await providerService.updateProviderAvailabilityByUserId(
      req.user._id,
      req.body.schedule
    );
    res.status(200).json({
      success: true,
      message: 'Availability schedule updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/me/service-areas
 * Authenticated provider views their assigned service areas
 */
const getProviderServiceAreas = async (req, res, next) => {
  try {
    const areas = await providerService.getProviderServiceAreasByUserId(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Provider service areas retrieved successfully',
      data: areas
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/providers/me/service-areas
 * Authenticated provider adds a service area
 */
const addProviderServiceArea = async (req, res, next) => {
  try {
    const areas = await providerService.addProviderServiceAreaByUserId(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Service area created successfully',
      data: areas
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/providers/me/service-areas/:id
 * Authenticated provider updates a service area
 */
const updateProviderServiceArea = async (req, res, next) => {
  try {
    const areas = await providerService.updateProviderServiceAreaByUserId(
      req.user._id,
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Service area updated successfully',
      data: areas
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/providers/me/service-areas/:id
 * Authenticated provider deletes a service area
 */
const deleteProviderServiceArea = async (req, res, next) => {
  try {
    const areas = await providerService.deleteProviderServiceAreaByUserId(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: 'Service area deleted successfully',
      data: areas
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/providers/me/services
 * Authenticated provider adds a provider service offering
 */
const addProviderService = async (req, res, next) => {
  try {
    const service = await providerService.addProviderServiceByUserId(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/providers/me/services/:id
 * Authenticated provider updates a provider service offering
 */
const updateProviderService = async (req, res, next) => {
  try {
    const service = await providerService.updateProviderServiceByUserId(
      req.user._id,
      req.params.id,
      req.body
    );
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
 * DELETE /api/providers/me/services/:id
 * Authenticated provider deletes or deactivates a provider service offering
 */
const deleteProviderService = async (req, res, next) => {
  try {
    const result = await providerService.deleteProviderServiceByUserId(
      req.user._id,
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/providers/me/documents
 * Authenticated provider submits or resubmits a verification document
 */
const submitDocument = async (req, res, next) => {
  try {
    const result = await providerService.submitDocument(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: 'Document submitted for verification successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/providers/me/documents/:documentId
 * Authenticated provider deletes an unapproved document
 */
const deleteDocument = async (req, res, next) => {
  try {
    const result = await providerService.deleteDocument(req.user._id, req.params.documentId);
    res.status(200).json({
      success: true,
      message: 'Document removed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers
 * Public discovery of verified and active providers
 */
const getPublicProviders = async (req, res, next) => {
  try {
    const providers = await providerService.getPublicProviders(req.query);
    res.status(200).json({
      success: true,
      message: 'Verified marketplace providers retrieved successfully',
      data: providers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/:id
 * Public view of a single verified provider
 */
const getPublicProviderById = async (req, res, next) => {
  try {
    const provider = await providerService.getPublicProviderById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Provider details retrieved successfully',
      data: provider
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/admin
 * Admin listing of all providers with filtering and pagination
 */
const getAdminProviders = async (req, res, next) => {
  try {
    const result = await providerService.getAdminProviders(req.query);
    res.status(200).json({
      success: true,
      message: 'Admin provider directory retrieved successfully',
      data: result.providers,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/admin/pending
 * Admin listing of providers awaiting verification
 */
const getAdminPendingVerifications = async (req, res, next) => {
  try {
    const result = await providerService.getAdminProviders({
      ...req.query,
      verificationStatus: 'pending'
    });
    res.status(200).json({
      success: true,
      message: 'Pending provider verification queue retrieved successfully',
      data: result.providers,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/admin/:id
 * Admin views single provider details including documents
 */
const getAdminProviderById = async (req, res, next) => {
  try {
    const provider = await providerService.getAdminProviderById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Provider review dossier retrieved successfully',
      data: provider
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/providers/admin/:id/documents/:documentId/status
 * Admin approves or rejects an individual document
 */
const reviewDocument = async (req, res, next) => {
  try {
    const updated = await providerService.reviewDocument(
      req.params.id,
      req.params.documentId,
      req.body
    );
    res.status(200).json({
      success: true,
      message: `Document status updated to '${req.body.status}'`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/providers/admin/:id/verification
 * Admin approves, rejects or suspends overall provider verification
 */
const updateProviderVerification = async (req, res, next) => {
  try {
    const updated = await providerService.updateProviderVerification(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: `Provider verification status updated to '${req.body.status}'`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/providers/admin/:id/account-status
 * Admin toggles provider user account active state
 */
const updateProviderAccountStatus = async (req, res, next) => {
  try {
    const updated = await providerService.updateProviderAccountStatus(
      req.params.id,
      req.body.isActive
    );
    res.status(200).json({
      success: true,
      message: `Provider account ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProviderMe,
  updateProviderMe,
  getProviderServices,
  addProviderService,
  updateProviderService,
  deleteProviderService,
  getProviderAvailability,
  updateProviderAvailability,
  getProviderServiceAreas,
  addProviderServiceArea,
  updateProviderServiceArea,
  deleteProviderServiceArea,
  submitDocument,
  deleteDocument,
  getPublicProviders,
  getPublicProviderById,
  getAdminProviders,
  getAdminPendingVerifications,
  getAdminProviderById,
  reviewDocument,
  updateProviderVerification,
  updateProviderAccountStatus
};
