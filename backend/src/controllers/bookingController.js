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
    const booking = await bookingService.acceptBookingByProvider(
      req.user._id,
      req.params.id,
      req.body.serviceTeam || (req.body.totalCount ? req.body : null)
    );
    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const updateProviderTeamSize = async (req, res, next) => {
  try {
    const booking = await bookingService.updateTeamSizeByProvider(
      req.user._id,
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Service team size updated successfully',
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

const getAdminBookingStats = async (req, res, next) => {
  try {
    const stats = await bookingService.getAdminBookingStats();
    res.status(200).json({
      success: true,
      data: stats
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

const createPaymentOrder = async (req, res, next) => {
  try {
    const orderData = await bookingService.createPaymentOrder(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: orderData
    });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.verifyPayment(req.user._id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const recordPaymentFailure = async (req, res, next) => {
  try {
    const booking = await bookingService.recordPaymentFailure(
      req.user._id,
      req.params.id,
      req.body.reason
    );
    res.status(200).json({
      success: true,
      message: 'Payment failure recorded',
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

const submitSpareParts = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.submitSpareParts(req.user._id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Spare parts and material charges submitted for customer approval',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const reviewSpareParts = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.reviewSpareParts(req.user._id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: `Spare parts proposal ${req.body.action}ed successfully`,
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const selectSparePartsPaymentMethod = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.selectSparePartsPaymentMethod(
      req.user._id,
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: `Spare parts payment method set to '${req.body.paymentMethod}' successfully`,
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const createSparePartsPaymentOrder = async (req, res, next) => {
  try {
    const orderData = await bookingService.createSparePartsPaymentOrder(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Razorpay order for spare parts created successfully',
      data: orderData
    });
  } catch (error) {
    next(error);
  }
};

const verifySparePartsPayment = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.verifySparePartsPayment(req.user._id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Spare parts payment verified successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const recordSparePartsPaymentFailure = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.recordSparePartsPaymentFailure(
      req.user._id,
      req.params.id,
      req.body.reason
    );
    res.status(200).json({
      success: true,
      message: 'Spare parts payment failure recorded',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const confirmCashPaymentByProvider = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.confirmCashPaymentByProvider(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Cash payment confirmed and recorded successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const confirmCashPaymentByCustomer = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.confirmCashPaymentByCustomer(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Customer confirmed cash payment successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const reportCashPaymentDispute = async (req, res, next) => {
  try {
    const updatedBooking = await bookingService.reportCashPaymentDispute(
      req.user._id,
      req.params.id,
      req.body.disputeReason
    );
    res.status(200).json({
      success: true,
      message: 'Cash payment dispute reported successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const result = await bookingService.getUserNotifications(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await bookingService.markNotificationRead(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
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
  getAdminBookingStats,
  getAdminBookingById,
  cancelAdminBooking,
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure,
  submitSpareParts,
  reviewSpareParts,
  selectSparePartsPaymentMethod,
  createSparePartsPaymentOrder,
  verifySparePartsPayment,
  recordSparePartsPaymentFailure,
  confirmCashPaymentByProvider,
  confirmCashPaymentByCustomer,
  reportCashPaymentDispute,
  getNotifications,
  markNotificationAsRead,
  updateProviderTeamSize
};
