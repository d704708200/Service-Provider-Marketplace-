const express = require('express');
const walletController = require('../controllers/walletController');
const { authenticate, requireRole } = require('../middleware/auth');

// Provider Wallet Router
const providerRouter = express.Router();
providerRouter.use(authenticate, requireRole('provider'));

providerRouter.get('/summary', walletController.getSummary);
providerRouter.get('/earnings', walletController.getEarnings);
providerRouter.get('/transactions', walletController.getTransactions);
providerRouter.post('/withdraw', walletController.requestWithdrawal);
providerRouter.get('/withdrawals', walletController.getWithdrawals);

// Commission Payable Endpoints (Provider)
providerRouter.get('/commission', walletController.getCommissionDetails);
providerRouter.post('/commission/pay', walletController.createPayCommissionOrder);
providerRouter.post('/commission/cancel', walletController.cancelPayCommissionOrder);
providerRouter.post('/commission/verify', walletController.verifyCommissionPayment);
providerRouter.post('/commission/reconcile', walletController.reconcileCommissionPayment);
providerRouter.get('/commission/reconcile', walletController.reconcileCommissionPayment);
providerRouter.patch('/commission/auto-deduct', walletController.toggleAutoDeductCommission);
providerRouter.post('/commission/auto-deduct', walletController.toggleAutoDeductCommission);

// Admin Wallet Router
const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/', walletController.adminListWallets);
adminRouter.get('/withdrawals', walletController.adminListWithdrawals);
adminRouter.post('/withdrawals/:id/approve', walletController.adminApproveWithdrawal);
adminRouter.post('/withdrawals/:id/reject', walletController.adminRejectWithdrawal);
adminRouter.post('/withdrawals/:id/payout', walletController.adminPayoutWithdrawal);
adminRouter.post('/:id/adjust', walletController.adminAdjustWallet);

// Commission Payable Endpoints (Admin)
adminRouter.get('/commissions', walletController.adminListCommissions);
adminRouter.patch('/providers/:id/commission/auto-adjustment', walletController.adminToggleAutoCommissionAdjustment);
adminRouter.post('/providers/:id/commission/settle', walletController.adminSettleFullCommission);
adminRouter.post('/providers/:id/commission/waive', walletController.adminWaiveFullCommission);
adminRouter.post('/providers/:id/commission/adjust', walletController.adminAdjustCommission);

module.exports = {
  providerRouter,
  adminRouter
};

