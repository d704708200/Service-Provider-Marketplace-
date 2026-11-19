const commissionLedgerService = require('../services/commissionLedgerService');

/**
 * GET /api/admin/commissions/dashboard
 * Live aggregated KPI cards & liabilities
 */
const getDashboard = async (req, res, next) => {
  try {
    const stats = await commissionLedgerService.getCommissionDashboardStats(req.query);
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/commissions/transactions
 * Filtered, paginated commission ledger entries
 */
const getTransactions = async (req, res, next) => {
  try {
    const result = await commissionLedgerService.listCommissionLedgerTransactions(req.query);
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/commissions/export
 * Export transactions to CSV
 */
const exportCsv = async (req, res, next) => {
  try {
    const csvData = await commissionLedgerService.exportCommissionLedgerCsv(req.query);
    const filename = `mendroo-commission-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/commissions/booking/:bookingId
 * Dedicated platform commission breakdown for a booking
 */
const getBookingBreakdown = async (req, res, next) => {
  try {
    const breakdown = await commissionLedgerService.getBookingCommissionBreakdown(req.params.bookingId);
    res.status(200).json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/commissions/transactions/:id/adjust
 * Audited manual adjustment or reversal
 */
const adjustTransaction = async (req, res, next) => {
  try {
    const updated = await commissionLedgerService.adminAdjustCommissionLedger(
      req.params.id,
      {
        newStatus: req.body.newStatus,
        reason: req.body.reason,
        adminUserId: req.user._id
      }
    );

    res.status(200).json({
      success: true,
      message: `Commission transaction status updated to ${updated.status}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/commissions/reconcile
 * Idempotent historical commission reconciliation
 */
const reconcileLedger = async (req, res, next) => {
  try {
    const result = await commissionLedgerService.reconcileHistoricalCommissions();
    res.status(200).json({
      success: true,
      message: 'Historical commission ledger reconciliation completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getTransactions,
  exportCsv,
  getBookingBreakdown,
  adjustTransaction,
  reconcileLedger
};

