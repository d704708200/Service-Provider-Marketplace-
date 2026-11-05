const walletService = require('../services/walletService');
const { Provider } = require('../models');

/**
 * Helper to fetch provider profile by authenticated user
 */
const getProviderFromUser = async (userId) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found for this user account');
    err.statusCode = 404;
    throw err;
  }
  return provider;
};

// ---------------------------------------------------------
// PROVIDER ENDPOINTS
// ---------------------------------------------------------

const getSummary = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const summary = await walletService.getWalletSummary(provider._id);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

const getEarnings = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const earnings = await walletService.getEarningsBreakdown(provider._id);

    res.status(200).json({
      success: true,
      data: earnings
    });
  } catch (error) {
    next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const result = await walletService.getTransactions(provider._id, req.query);

    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const requestWithdrawal = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const result = await walletService.requestWithdrawal(provider._id, req.body);

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getWithdrawals = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const result = await walletService.getWithdrawals(provider._id, req.query);

    res.status(200).json({
      success: true,
      data: result.withdrawals,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------
// ADMIN ENDPOINTS
// ---------------------------------------------------------

const adminListWallets = async (req, res, next) => {
  try {
    const result = await walletService.adminListWallets(req.query);

    res.status(200).json({
      success: true,
      data: result.wallets,
      stats: result.stats,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const adminListWithdrawals = async (req, res, next) => {
  try {
    const result = await walletService.adminListWithdrawals(req.query);

    res.status(200).json({
      success: true,
      data: result.withdrawals,
      statusCounts: result.statusCounts,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const adminApproveWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await walletService.adminApproveWithdrawal(
      req.params.id,
      req.user._id,
      req.body.note
    );

    res.status(200).json({
      success: true,
      message: 'Withdrawal request approved successfully',
      data: withdrawal
    });
  } catch (error) {
    next(error);
  }
};

const adminRejectWithdrawal = async (req, res, next) => {
  try {
    const result = await walletService.adminRejectWithdrawal(
      req.params.id,
      req.user._id,
      req.body.reason
    );

    res.status(200).json({
      success: true,
      message: 'Withdrawal request rejected and funds returned to wallet',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const adminPayoutWithdrawal = async (req, res, next) => {
  try {
    const result = await walletService.adminPayoutWithdrawal(
      req.params.id,
      req.user._id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Payout marked as completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const adminAdjustWallet = async (req, res, next) => {
  try {
    const result = await walletService.adminAdjustWallet(
      req.params.id,
      req.user._id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: `Wallet ${req.body.type === 'credit' ? 'credited' : 'debited'} successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getCommissionDetails = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const details = await walletService.getCommissionDetails(provider._id);

    res.status(200).json({
      success: true,
      data: details
    });
  } catch (error) {
    next(error);
  }
};

const createPayCommissionOrder = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const order = await walletService.createPayCommissionOrder(provider._id, req.body?.amount);

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

const cancelPayCommissionOrder = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const result = await walletService.cancelActiveCommissionOrder(provider._id);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

const verifyCommissionPayment = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const result = await walletService.verifyAndSettleCommissionPayment(provider._id, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const toggleAutoDeductCommission = async (req, res, next) => {
  try {
    const provider = await getProviderFromUser(req.user._id);
    const enabled = req.body.enabled !== undefined
      ? req.body.enabled
      : req.body.autoDeductCommissionFromWallet;
    const result = await walletService.toggleAutoDeductCommission(provider._id, enabled);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const adminListCommissions = async (req, res, next) => {
  try {
    const result = await walletService.adminListCommissions(req.query);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const adminToggleAutoCommissionAdjustment = async (req, res, next) => {
  try {
    const result = await walletService.adminToggleAutoCommissionAdjustment(
      req.params.id,
      req.body.enabled,
      req.user._id
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

const adminSettleFullCommission = async (req, res, next) => {
  try {
    const result = await walletService.adminSettleFullCommission(
      req.params.id,
      req.body,
      req.user._id
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

const adminWaiveFullCommission = async (req, res, next) => {
  try {
    const result = await walletService.adminWaiveFullCommission(
      req.params.id,
      req.body,
      req.user._id
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

const adminAdjustCommission = async (req, res, next) => {
  try {
    const result = await walletService.adminAdjustCommission(
      req.params.id,
      req.body,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: result.message || 'Commission adjusted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  getEarnings,
  getTransactions,
  requestWithdrawal,
  getWithdrawals,
  getCommissionDetails,
  createPayCommissionOrder,
  cancelPayCommissionOrder,
  verifyCommissionPayment,
  toggleAutoDeductCommission,
  adminListCommissions,
  adminToggleAutoCommissionAdjustment,
  adminSettleFullCommission,
  adminWaiveFullCommission,
  adminAdjustCommission,
  adminListWallets,
  adminListWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminPayoutWithdrawal,
  adminAdjustWallet
};

