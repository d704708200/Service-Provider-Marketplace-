const bookingService = require('../services/bookingService');

// --- Customer Controllers ---

const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Service booking request created successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getCustomerBookings(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerBookingById = async (req, res, next) => {
  try {
    const booking = await bookingService.getCustomerBookingById(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const cancelCustomerBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBookingByCustomer(
      req.user._id,
      req.params.id,
      req.body.cancellationReason
    );
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// --- Provider Controllers ---

const getProviderRequests = async (req, res, next) => {
  try {
    const requests = await bookingService.getProviderRequests(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

const getProviderHistory = async (req, res, next) => {
  try {
    const result = await bookingService.getProviderHistory(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const getProviderBookingById = async (req, res, next) => {
  try {
    const booking = await bookingService.getProviderBookingById(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const acceptProviderBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.acceptBookingByProvider(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const rejectProviderBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.rejectBookingByProvider(
      req.user._id,
      req.params.id,
      req.body.rejectionReason
    );
    res.status(200).json({
      success: true,
      message: 'Booking request rejected',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const startProviderService = async (req, res, next) => {
  try {
    const booking = await bookingService.startServiceByProvider(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Service marked in-progress',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const completeProviderService = async (req, res, next) => {
  try {
    const booking = await bookingService.completeServiceByProvider(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Service successfully completed',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// --- Admin Controllers ---

const getAdminBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getAdminBookings(req.query);
    res.status(200).json({
      success: true,
      data: result.bookings,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const getAdminBookingById = async (req, res, next) => {
  try {
    const booking = await bookingService.getAdminBookingById(req.params.id);
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const cancelAdminBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBookingByAdmin(
      req.params.id,
      req.body.cancellationReason
    );
    res.status(200).json({
      success: true,
      message: 'Booking cancelled by administrator',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getCustomerBookings,
  getCustomerBookingById,
  cancelCustomerBooking,
  getProviderRequests,
  getProviderHistory,
  getProviderBookingById,
  acceptProviderBooking,
  rejectProviderBooking,
  startProviderService,
  completeProviderService,
  getAdminBookings,
  getAdminBookingById,
  cancelAdminBooking
};
