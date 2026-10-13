const customerService = require('../services/customerService');

/**
 * GET /api/customers/me
 * Authenticated customer views their own profile
 */
const getCustomerMe = async (req, res, next) => {
  try {
    const profile = await customerService.getCustomerProfileByUserId(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Customer profile retrieved successfully',
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/customers/me
 * Authenticated customer updates editable profile fields
 */
const updateCustomerMe = async (req, res, next) => {
  try {
    const updated = await customerService.updateCustomerProfileByUserId(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customers/me/addresses
 * Authenticated customer lists saved addresses
 */
const getCustomerAddresses = async (req, res, next) => {
  try {
    const addresses = await customerService.getCustomerAddressesByUserId(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Saved addresses retrieved successfully',
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customers/me/addresses
 * Authenticated customer adds a new saved address
 */
const addCustomerAddress = async (req, res, next) => {
  try {
    const addresses = await customerService.addCustomerAddressByUserId(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/customers/me/addresses/:addressId
 * Authenticated customer updates an existing address
 */
const updateCustomerAddress = async (req, res, next) => {
  try {
    const addresses = await customerService.updateCustomerAddressByUserId(
      req.user._id,
      req.params.addressId,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/customers/me/addresses/:addressId
 * Authenticated customer deletes an owned address
 */
const deleteCustomerAddress = async (req, res, next) => {
  try {
    const addresses = await customerService.deleteCustomerAddressByUserId(
      req.user._id,
      req.params.addressId
    );
    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/customers/me/addresses/:addressId/default
 * Authenticated customer designates an address as default
 */
const setDefaultCustomerAddress = async (req, res, next) => {
  try {
    const addresses = await customerService.setDefaultCustomerAddressByUserId(
      req.user._id,
      req.params.addressId
    );
    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerMe,
  updateCustomerMe,
  getCustomerAddresses,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress
};
