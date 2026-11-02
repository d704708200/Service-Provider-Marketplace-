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

// Admin Wallet Router
const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/', walletController.adminListWallets);
adminRouter.get('/withdrawals', walletController.adminListWithdrawals);
adminRouter.post('/withdrawals/:id/approve', walletController.adminApproveWithdrawal);
adminRouter.post('/withdrawals/:id/reject', walletController.adminRejectWithdrawal);
adminRouter.post('/withdrawals/:id/payout', walletController.adminPayoutWithdrawal);
adminRouter.post('/:id/adjust', walletController.adminAdjustWallet);

module.exports = {
  providerRouter,
  adminRouter
};

