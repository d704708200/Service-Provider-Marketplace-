const { ProviderWallet, WalletTransaction, WithdrawalRequest, Provider, Booking } = require('../models');

/**
 * Get or create wallet for a provider
 */
const getOrCreateWallet = async (providerId) => {
  let wallet = await ProviderWallet.findOne({ provider: providerId });
  if (!wallet) {
    wallet = await ProviderWallet.create({
      provider: providerId,
      availableBalance: 0,
      pendingBalance: 0,
      pendingWithdrawal: 0,
      totalEarnings: 0,
      totalWithdrawn: 0
    });
  }
  return wallet;
};

/**
 * Get wallet overview summary for a provider
 */
const getWalletSummary = async (providerId) => {
  const wallet = await getOrCreateWallet(providerId);

  // Count total transactions
  const totalTransactions = await WalletTransaction.countDocuments({ wallet: wallet._id });

  // Count pending withdrawal requests
  const pendingWithdrawalsCount = await WithdrawalRequest.countDocuments({
    wallet: wallet._id,
    status: { $in: ['requested', 'approved', 'processing'] }
  });

  return {
    walletId: wallet._id,
    availableBalance: wallet.availableBalance,
    pendingBalance: wallet.pendingBalance,
    pendingWithdrawal: wallet.pendingWithdrawal,
    totalEarnings: wallet.totalEarnings,
    totalWithdrawn: wallet.totalWithdrawn,
    currency: wallet.currency || 'INR',
    status: wallet.status,
    totalTransactions,
    pendingWithdrawalsCount,
    savedPaymentMethods: wallet.savedPaymentMethods || {},
    lastTransactionAt: wallet.lastTransactionAt
  };
};

/**
 * Get earnings breakdown by time intervals
 */
const getEarningsBreakdown = async (providerId) => {
  const wallet = await getOrCreateWallet(providerId);

  const now = new Date();
  
  // Start of today
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Start of this week (Monday)
  const currentDay = now.getDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // Start of this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aggregate earnings transactions
  const pipeline = (startDate) => [
    {
      $match: {
        wallet: wallet._id,
        type: 'booking_earning',
        status: 'completed',
        ...(startDate ? { createdAt: { $gte: startDate } } : {})
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ];

  const [todayAgg, weekAgg, monthAgg, lifetimeAgg] = await Promise.all([
    WalletTransaction.aggregate(pipeline(startOfToday)),
    WalletTransaction.aggregate(pipeline(startOfWeek)),
    WalletTransaction.aggregate(pipeline(startOfMonth)),
    WalletTransaction.aggregate(pipeline(null))
  ]);

  return {
    today: {
      amount: todayAgg[0]?.total || 0,
      count: todayAgg[0]?.count || 0
    },
    thisWeek: {
      amount: weekAgg[0]?.total || 0,
      count: weekAgg[0]?.count || 0
    },
    thisMonth: {
      amount: monthAgg[0]?.total || 0,
      count: monthAgg[0]?.count || 0
    },
    lifetime: {
      amount: lifetimeAgg[0]?.total || wallet.totalEarnings || 0,
      count: lifetimeAgg[0]?.count || 0
    }
  };
};

/**
 * Get transaction history with filtering & pagination
 */
const getTransactions = async (providerId, query = {}) => {
  const wallet = await getOrCreateWallet(providerId);

  const {
    type,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20
  } = query;

  const filter = { wallet: wallet._id };

  if (type && type !== 'all') {
    if (type === 'earnings') {
      filter.type = 'booking_earning';
    } else if (type === 'withdrawals') {
      filter.type = { $in: ['withdrawal', 'withdrawal_refund'] };
    } else if (type === 'adjustments') {
      filter.type = { $in: ['adjustment_credit', 'adjustment_debit', 'commission_deduction'] };
    } else {
      filter.type = type;
    }
  }

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('booking', 'bookingReference service scheduledDate')
      .populate('withdrawalRequest', 'requestReference payoutMethod status'),
    WalletTransaction.countDocuments(filter)
  ]);

  return {
    transactions,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Request a withdrawal from wallet
 */
const requestWithdrawal = async (providerId, withdrawalData) => {
  const { amount, payoutMethod, payoutDetails } = withdrawalData;

  const numAmount = Number(amount);
  if (!numAmount || isNaN(numAmount) || numAmount < 100) {
    const err = new Error('Minimum withdrawal amount is ₹100');
    err.statusCode = 400;
    throw err;
  }

  if (!['bank_transfer', 'upi'].includes(payoutMethod)) {
    const err = new Error("Invalid payout method. Supported methods: 'bank_transfer', 'upi'");
    err.statusCode = 400;
    throw err;
  }

  if (payoutMethod === 'upi') {
    if (!payoutDetails?.upiId || !payoutDetails.upiId.includes('@')) {
      const err = new Error('A valid UPI ID (e.g. user@bank) is required');
      err.statusCode = 400;
      throw err;
    }
  } else if (payoutMethod === 'bank_transfer') {
    if (!payoutDetails?.accountNumber || !payoutDetails?.ifscCode || !payoutDetails?.accountHolderName) {
      const err = new Error('Account Holder Name, Account Number and IFSC Code are required for bank transfer');
      err.statusCode = 400;
      throw err;
    }
  }

  const wallet = await getOrCreateWallet(providerId);

  if (wallet.status !== 'active') {
    const err = new Error(`Wallet is ${wallet.status}. Withdrawals are temporarily disabled.`);
    err.statusCode = 403;
    throw err;
  }

  if (wallet.availableBalance < numAmount) {
    const err = new Error(`Insufficient available balance. You have ₹${wallet.availableBalance.toLocaleString('en-IN')}, requested ₹${numAmount.toLocaleString('en-IN')}`);
    err.statusCode = 400;
    throw err;
  }

  // Generate Reference IDs
  const requestReference = `WDR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnReference = `TXN-WDR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Balance reservation
  const balanceBefore = wallet.availableBalance;
  wallet.availableBalance -= numAmount;
  wallet.pendingWithdrawal += numAmount;
  wallet.lastTransactionAt = new Date();

  // Save payment method in wallet for easy future reuse
  if (!wallet.savedPaymentMethods) wallet.savedPaymentMethods = {};
  if (payoutMethod === 'upi') {
    wallet.savedPaymentMethods.upi = {
      upiId: payoutDetails.upiId,
      name: payoutDetails.accountHolderName || '',
      isDefault: true
    };
  } else {
    wallet.savedPaymentMethods.bank = {
      accountHolderName: payoutDetails.accountHolderName,
      accountNumber: payoutDetails.accountNumber,
      ifscCode: payoutDetails.ifscCode.toUpperCase(),
      bankName: payoutDetails.bankName || '',
      branch: payoutDetails.branch || '',
      isDefault: true
    };
  }

  await wallet.save();

  // Create WithdrawalRequest record
  const withdrawalRequest = await WithdrawalRequest.create({
    requestReference,
    provider: providerId,
    wallet: wallet._id,
    amount: numAmount,
    payoutMethod,
    payoutDetails: {
      accountHolderName: payoutDetails.accountHolderName || '',
      accountNumber: payoutDetails.accountNumber || '',
      ifscCode: payoutDetails.ifscCode ? payoutDetails.ifscCode.toUpperCase() : '',
      bankName: payoutDetails.bankName || '',
      upiId: payoutDetails.upiId || ''
    },
    status: 'requested'
  });

  // Create WalletTransaction record
  const transaction = await WalletTransaction.create({
    wallet: wallet._id,
    provider: providerId,
    transactionReference: txnReference,
    type: 'withdrawal',
    amount: numAmount,
    balanceBefore,
    balanceAfter: wallet.availableBalance,
    status: 'pending',
    withdrawalRequest: withdrawalRequest._id,
    paymentMethod: payoutMethod,
    description: `Withdrawal request #${requestReference} via ${payoutMethod === 'upi' ? 'UPI' : 'Bank Transfer'}`,
    metadata: {
      payoutMethod,
      destination: payoutMethod === 'upi' ? payoutDetails.upiId : `${payoutDetails.bankName || 'Bank'} A/C ...${payoutDetails.accountNumber.slice(-4)}`
    }
  });

  return {
    withdrawalRequest,
    transaction,
    walletSummary: {
      availableBalance: wallet.availableBalance,
      pendingWithdrawal: wallet.pendingWithdrawal
    }
  };
};

/**
 * Get provider's withdrawal requests
 */
const getWithdrawals = async (providerId, query = {}) => {
  const wallet = await getOrCreateWallet(providerId);
  const { status, page = 1, limit = 20 } = query;

  const filter = { wallet: wallet._id };
  if (status && status !== 'all') {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [withdrawals, total] = await Promise.all([
    WithdrawalRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    WithdrawalRequest.countDocuments(filter)
  ]);

  return {
    withdrawals,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Automatic booking earning credit on service completion
 * Idempotent: Can safely be called multiple times without duplicate credit
 */
const creditBookingEarnings = async (bookingId) => {
  // Idempotency check: see if earning or commission deduction is already recorded
  const existingTxn = await WalletTransaction.findOne({
    booking: bookingId,
    type: { $in: ['booking_earning', 'commission_deduction'] }
  });

  if (existingTxn) {
    return {
      success: true,
      message: 'Booking earnings have already been credited',
      transaction: existingTxn
    };
  }

  const booking = await Booking.findById(bookingId).populate('service');
  if (!booking) {
    const err = new Error(`Booking ${bookingId} not found for wallet earnings`);
    err.statusCode = 404;
    throw err;
  }

  if (booking.status !== 'completed') {
    const err = new Error(`Cannot credit earnings: Booking is in status '${booking.status}', must be 'completed'`);
    err.statusCode = 400;
    throw err;
  }

  // Strict Payment Verification Guard
  if (booking.paymentStatus !== 'paid') {
    const err = new Error(`Cannot credit earnings: Booking paymentStatus is '${booking.paymentStatus}', must be 'paid'`);
    err.statusCode = 400;
    throw err;
  }

  if (!booking.provider) {
    const err = new Error('Booking has no assigned provider to credit');
    err.statusCode = 400;
    throw err;
  }

  // Total Gross Calculation
  // pricing.totalAmount is the total customer bill (already includes approved spare parts).
  let totalGrossAmount = Number(booking.pricing?.totalAmount || 0);
  if (!totalGrossAmount || totalGrossAmount <= 0) {
    const base = Number(booking.pricing?.basePrice || 0);
    const parts = (
      booking.spareParts &&
      booking.spareParts.status === 'approved' &&
      booking.spareParts.paymentStatus === 'paid'
    ) ? Number(booking.spareParts.totalAdditionalAmount || 0) : 0;
    totalGrossAmount = base + parts;
  }

  // 15% Platform Commission Model (85% Provider Net Earning)
  const commissionRate = 0.15;
  const platformCommission = Math.round(totalGrossAmount * commissionRate);
  const providerNetEarnings = totalGrossAmount - platformCommission;

  const wallet = await getOrCreateWallet(booking.provider);
  const balanceBefore = wallet.availableBalance;
  const isOnline = booking.paymentMethod === 'online';

  let transaction;

  if (isOnline) {
    // 1. Concurrency-safe: Attempt to create transaction FIRST.
    // MongoDB unique index on { booking: 1, type: 1 } ensures exactly ONE thread succeeds.
    const txnRef = `TXN-ERN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      transaction = await WalletTransaction.create({
        wallet: wallet._id,
        provider: booking.provider,
        transactionReference: txnRef,
        type: 'booking_earning',
        amount: providerNetEarnings,
        balanceBefore,
        balanceAfter: balanceBefore + providerNetEarnings,
        status: 'completed',
        booking: booking._id,
        paymentMethod: 'online',
        description: `Service Earnings: #${booking.bookingReference} (${booking.service?.name || 'Service'})`,
        metadata: {
          bookingReference: booking.bookingReference,
          serviceName: booking.service?.name,
          grossAmount: totalGrossAmount,
          platformCommission,
          commissionRate: '15%',
          paymentMethod: 'online'
        }
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        const existing = await WalletTransaction.findOne({ booking: booking._id, type: 'booking_earning' });
        return { success: true, message: 'Booking earnings have already been credited', transaction: existing };
      }
      throw createErr;
    }

    // 2. Only the winning thread updates wallet balance atomically
    const updatedWallet = await ProviderWallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: {
          availableBalance: providerNetEarnings,
          totalEarnings: providerNetEarnings
        },
        $set: { lastTransactionAt: new Date() }
      },
      { new: true }
    );

    return {
      success: true,
      providerNetEarnings,
      platformCommission,
      totalGrossAmount,
      balanceAfter: updatedWallet.availableBalance,
      transaction
    };
  } else {
    // Booking was paid in CASH.
    // Provider already received 100% cash in hand from the customer.
    // Platform's 15% commission is deducted from provider's available wallet balance.
    const txnRef = `TXN-COM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      transaction = await WalletTransaction.create({
        wallet: wallet._id,
        provider: booking.provider,
        transactionReference: txnRef,
        type: 'commission_deduction',
        amount: platformCommission,
        balanceBefore,
        balanceAfter: balanceBefore - platformCommission,
        status: 'completed',
        booking: booking._id,
        paymentMethod: 'cash',
        description: `Platform Commission (15%) for Cash Booking: #${booking.bookingReference}`,
        metadata: {
          bookingReference: booking.bookingReference,
          serviceName: booking.service?.name,
          grossAmount: totalGrossAmount,
          platformCommission,
          providerNetEarnings,
          commissionRate: '15%',
          paymentMethod: 'cash'
        }
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        const existing = await WalletTransaction.findOne({ booking: booking._id, type: 'commission_deduction' });
        return { success: true, message: 'Commission deduction already recorded', transaction: existing };
      }
      throw createErr;
    }

    const updatedWallet = await ProviderWallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: {
          availableBalance: -platformCommission,
          totalEarnings: providerNetEarnings
        },
        $set: { lastTransactionAt: new Date() }
      },
      { new: true }
    );

    return {
      success: true,
      providerNetEarnings,
      platformCommission,
      totalGrossAmount,
      balanceAfter: updatedWallet.availableBalance,
      transaction
    };
  }

  return {
    success: true,
    providerNetEarnings,
    platformCommission,
    totalGrossAmount,
    balanceAfter: wallet.availableBalance,
    transaction
  };
};

/* ==========================================================================
   ADMIN WALLET MANAGEMENT METHODS
   ========================================================================== */

/**
 * Admin: List all wallets with summary statistics
 */
const adminListWallets = async (query = {}) => {
  const { search, page = 1, limit = 20 } = query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  // If search is provided, look up providers matching name/email/phone
  let providerFilter = {};
  if (search) {
    const matchingProviders = await Provider.find({
      $or: [
        { businessName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    providerFilter.provider = { $in: matchingProviders.map((p) => p._id) };
  }

  const [wallets, total, platformStats] = await Promise.all([
    ProviderWallet.find(providerFilter)
      .populate({
        path: 'provider',
        select: 'businessName rating user phone profileImage',
        populate: { path: 'user', select: 'name email phone' }
      })
      .sort({ availableBalance: -1 })
      .skip(skip)
      .limit(limitNum),
    ProviderWallet.countDocuments(providerFilter),
    ProviderWallet.aggregate([
      {
        $group: {
          _id: null,
          totalAvailableLiability: { $sum: '$availableBalance' },
          totalPendingWithdrawals: { $sum: '$pendingWithdrawal' },
          totalEarningsCredited: { $sum: '$totalEarnings' },
          totalDisbursed: { $sum: '$totalWithdrawn' }
        }
      }
    ])
  ]);

  return {
    wallets,
    stats: {
      totalAvailableLiability: platformStats[0]?.totalAvailableLiability || 0,
      totalPendingWithdrawals: platformStats[0]?.totalPendingWithdrawals || 0,
      totalEarningsCredited: platformStats[0]?.totalEarningsCredited || 0,
      totalDisbursed: platformStats[0]?.totalDisbursed || 0
    },
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Admin: List all withdrawal requests
 */
const adminListWithdrawals = async (query = {}) => {
  const { status, page = 1, limit = 20 } = query;

  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [withdrawals, total, statusCounts] = await Promise.all([
    WithdrawalRequest.find(filter)
      .populate({
        path: 'provider',
        select: 'businessName phone user',
        populate: { path: 'user', select: 'name email phone' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    WithdrawalRequest.countDocuments(filter),
    WithdrawalRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ])
  ]);

  return {
    withdrawals,
    statusCounts,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Admin: Approve a withdrawal request (sets to processing)
 */
const adminApproveWithdrawal = async (requestId, adminUserId, adminNote) => {
  const withdrawal = await WithdrawalRequest.findById(requestId);
  if (!withdrawal) {
    const err = new Error(`Withdrawal request ${requestId} not found`);
    err.statusCode = 404;
    throw err;
  }

  if (withdrawal.status !== 'requested') {
    const err = new Error(`Cannot approve withdrawal from '${withdrawal.status}' status. Must be 'requested'.`);
    err.statusCode = 400;
    throw err;
  }

  withdrawal.status = 'approved';
  withdrawal.adminNote = adminNote || withdrawal.adminNote;
  withdrawal.processedBy = adminUserId;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  return withdrawal;
};

/**
 * Admin: Reject a withdrawal request (refunds reserved balance back to available)
 */
const adminRejectWithdrawal = async (requestId, adminUserId, rejectionReason) => {
  if (!rejectionReason) {
    const err = new Error('Rejection reason is required');
    err.statusCode = 400;
    throw err;
  }

  const withdrawal = await WithdrawalRequest.findById(requestId);
  if (!withdrawal) {
    const err = new Error(`Withdrawal request ${requestId} not found`);
    err.statusCode = 404;
    throw err;
  }

  if (!['requested', 'approved', 'processing'].includes(withdrawal.status)) {
    const err = new Error(`Cannot reject withdrawal with status '${withdrawal.status}'`);
    err.statusCode = 400;
    throw err;
  }

  const wallet = await ProviderWallet.findById(withdrawal.wallet);
  if (!wallet) {
    const err = new Error('Associated provider wallet not found');
    err.statusCode = 404;
    throw err;
  }

  // Refund reserved funds back to available balance
  const balanceBefore = wallet.availableBalance;
  wallet.pendingWithdrawal = Math.max(0, wallet.pendingWithdrawal - withdrawal.amount);
  wallet.availableBalance += withdrawal.amount;
  wallet.lastTransactionAt = new Date();
  await wallet.save();

  // Update Withdrawal Request status
  withdrawal.status = 'rejected';
  withdrawal.rejectionReason = rejectionReason;
  withdrawal.processedBy = adminUserId;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  // Update original pending transaction if exists
  await WalletTransaction.findOneAndUpdate(
    { withdrawalRequest: withdrawal._id, type: 'withdrawal' },
    { $set: { status: 'reversed' } }
  );

  // Create refund transaction record
  const refundTxnRef = `TXN-REF-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const refundTransaction = await WalletTransaction.create({
    wallet: wallet._id,
    provider: withdrawal.provider,
    transactionReference: refundTxnRef,
    type: 'withdrawal_refund',
    amount: withdrawal.amount,
    balanceBefore,
    balanceAfter: wallet.availableBalance,
    status: 'completed',
    withdrawalRequest: withdrawal._id,
    paymentMethod: withdrawal.payoutMethod,
    description: `Refund for rejected withdrawal #${withdrawal.requestReference}: ${rejectionReason}`,
    metadata: {
      withdrawalRequestReference: withdrawal.requestReference,
      rejectionReason
    }
  });

  return {
    withdrawal,
    refundTransaction,
    walletSummary: {
      availableBalance: wallet.availableBalance,
      pendingWithdrawal: wallet.pendingWithdrawal
    }
  };
};

/**
 * Admin: Mark payout complete (disburses payout, sets status to 'paid')
 */
const adminPayoutWithdrawal = async (requestId, adminUserId, { transactionReference, adminNote }) => {
  if (!transactionReference) {
    const err = new Error('Bank UTR or transfer transaction reference is required');
    err.statusCode = 400;
    throw err;
  }

  const withdrawal = await WithdrawalRequest.findById(requestId);
  if (!withdrawal) {
    const err = new Error(`Withdrawal request ${requestId} not found`);
    err.statusCode = 404;
    throw err;
  }

  if (!['requested', 'approved', 'processing'].includes(withdrawal.status)) {
    const err = new Error(`Cannot complete payout for request in status '${withdrawal.status}'`);
    err.statusCode = 400;
    throw err;
  }

  const wallet = await ProviderWallet.findById(withdrawal.wallet);
  if (!wallet) {
    const err = new Error('Associated provider wallet not found');
    err.statusCode = 404;
    throw err;
  }

  // Deduct from pending withdrawal and add to totalWithdrawn
  wallet.pendingWithdrawal = Math.max(0, wallet.pendingWithdrawal - withdrawal.amount);
  wallet.totalWithdrawn += withdrawal.amount;
  wallet.lastTransactionAt = new Date();
  await wallet.save();

  // Update Withdrawal Request status
  withdrawal.status = 'paid';
  withdrawal.transactionReference = transactionReference;
  withdrawal.adminNote = adminNote || withdrawal.adminNote;
  withdrawal.processedBy = adminUserId;
  withdrawal.processedAt = new Date();
  withdrawal.paidAt = new Date();
  await withdrawal.save();

  // Mark the pending transaction completed
  await WalletTransaction.findOneAndUpdate(
    { withdrawalRequest: withdrawal._id, type: 'withdrawal' },
    {
      $set: {
        status: 'completed',
        'metadata.payoutReference': transactionReference,
        'metadata.paidAt': withdrawal.paidAt
      }
    }
  );

  return {
    withdrawal,
    walletSummary: {
      availableBalance: wallet.availableBalance,
      pendingWithdrawal: wallet.pendingWithdrawal,
      totalWithdrawn: wallet.totalWithdrawn
    }
  };
};

/**
 * Admin: Manual wallet balance adjustment (Credit or Debit with audit trail)
 */
const adminAdjustWallet = async (walletId, adminUserId, { type, amount, reason }) => {
  const numAmount = Number(amount);
  if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
    const err = new Error('Valid positive amount is required for adjustment');
    err.statusCode = 400;
    throw err;
  }

  if (!['credit', 'debit'].includes(type)) {
    const err = new Error("Adjustment type must be either 'credit' or 'debit'");
    err.statusCode = 400;
    throw err;
  }

  if (!reason || reason.trim().length < 4) {
    const err = new Error('A descriptive reason is required for administrative adjustment (minimum 4 characters)');
    err.statusCode = 400;
    throw err;
  }

  const wallet = await ProviderWallet.findById(walletId);
  if (!wallet) {
    const err = new Error(`Wallet ${walletId} not found`);
    err.statusCode = 404;
    throw err;
  }

  const balanceBefore = wallet.availableBalance;

  if (type === 'debit') {
    if (wallet.availableBalance < numAmount) {
      const err = new Error(`Insufficient available balance for debit. Available: ₹${wallet.availableBalance}, Requested debit: ₹${numAmount}`);
      err.statusCode = 400;
      throw err;
    }
    wallet.availableBalance -= numAmount;
  } else {
    wallet.availableBalance += numAmount;
    wallet.totalEarnings += numAmount;
  }

  wallet.lastTransactionAt = new Date();
  await wallet.save();

  const txnRef = `TXN-ADJ-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const transaction = await WalletTransaction.create({
    wallet: wallet._id,
    provider: wallet.provider,
    transactionReference: txnRef,
    type: type === 'credit' ? 'adjustment_credit' : 'adjustment_debit',
    amount: numAmount,
    balanceBefore,
    balanceAfter: wallet.availableBalance,
    status: 'completed',
    paymentMethod: 'system_adjustment',
    description: `Admin manual ${type}: ${reason.trim()}`,
    metadata: {
      adjustedBy: adminUserId,
      reason: reason.trim(),
      adjustmentType: type
    }
  });

  return {
    wallet,
    transaction
  };
};

module.exports = {
  getOrCreateWallet,
  getWalletSummary,
  getEarningsBreakdown,
  getTransactions,
  requestWithdrawal,
  getWithdrawals,
  creditBookingEarnings,
  adminListWallets,
  adminListWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminPayoutWithdrawal,
  adminAdjustWallet
};

