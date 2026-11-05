const mongoose = require('mongoose');
const { ProviderWallet, WalletTransaction, WithdrawalRequest, Provider, Booking } = require('../models');

/**
 * Normalizes PLATFORM_COMMISSION_RATE environment variable:
 * - If value is between 0 and 1 (e.g. 0.15), treats as decimal rate (15%).
 * - If value is between 1 and 100 (e.g. 15), divides by 100 to get decimal rate (0.15).
 * - Defaults to 0.15 (15%).
 * Returns { rateDecimal: number, ratePercentage: number, rateFormatted: string }
 */
const getPlatformCommissionConfig = () => {
  const envVal = process.env.PLATFORM_COMMISSION_RATE;
  let decimal = 0.15;

  if (envVal !== undefined && envVal !== null && String(envVal).trim() !== '') {
    const parsed = parseFloat(String(envVal).trim());
    if (!isNaN(parsed) && parsed >= 0) {
      if (parsed > 1 && parsed <= 100) {
        decimal = parsed / 100;
      } else if (parsed <= 1) {
        decimal = parsed;
      }
    }
  }

  decimal = Math.round(decimal * 10000) / 10000;
  const percentage = Math.round(decimal * 100);
  const formatted = `${percentage}%`;

  return {
    rateDecimal: decimal,
    ratePercentage: percentage,
    rateFormatted: formatted
  };
};

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
    commissionDue: wallet.commissionDue || 0,
    autoDeductCommissionFromWallet: Boolean(wallet.autoDeductCommissionFromWallet),
    autoCommissionAdjustment: Boolean(wallet.autoDeductCommissionFromWallet || wallet.autoCommissionAdjustment),
    lastAutoDeductionAt: wallet.lastAutoDeductionAt || null,
    reconciliationFlagged: Boolean(wallet.reconciliationFlagged),
    reconciliationReason: wallet.reconciliationReason || null,
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
      filter.type = { $in: ['adjustment_credit', 'adjustment_debit', 'commission_deduction', 'COMMISSION_PAYMENT', 'COMMISSION_ADJUSTMENT', 'COMMISSION_REFUND'] };
    } else if (type === 'commission') {
      filter.type = { $in: ['CASH_BOOKING_COMMISSION_DUE', 'COMMISSION_PAYMENT', 'COMMISSION_ADJUSTMENT', 'COMMISSION_REFUND'] };
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

  // Prepare updated payment methods
  const updatedMethods = { ...(wallet.savedPaymentMethods?.toObject?.() || wallet.savedPaymentMethods || {}) };
  if (payoutMethod === 'upi') {
    updatedMethods.upi = {
      upiId: payoutDetails.upiId,
      name: payoutDetails.accountHolderName || '',
      isDefault: true
    };
  } else {
    updatedMethods.bank = {
      accountHolderName: payoutDetails.accountHolderName,
      accountNumber: payoutDetails.accountNumber,
      ifscCode: payoutDetails.ifscCode.toUpperCase(),
      bankName: payoutDetails.bankName || '',
      branch: payoutDetails.branch || '',
      isDefault: true
    };
  }

  // Atomically reserve funds ONLY IF availableBalance >= numAmount
  const updatedWallet = await ProviderWallet.findOneAndUpdate(
    {
      _id: wallet._id,
      status: 'active',
      availableBalance: { $gte: numAmount }
    },
    {
      $inc: {
        availableBalance: -numAmount,
        pendingWithdrawal: numAmount
      },
      $set: {
        savedPaymentMethods: updatedMethods,
        lastTransactionAt: new Date()
      }
    },
    { new: true }
  );

  if (!updatedWallet) {
    const freshWallet = await ProviderWallet.findById(wallet._id);
    const err = new Error(
      `Insufficient available balance. You have ₹${(freshWallet?.availableBalance || 0).toLocaleString('en-IN')}, requested ₹${numAmount.toLocaleString('en-IN')}`
    );
    err.statusCode = 400;
    throw err;
  }

  const balanceBefore = updatedWallet.availableBalance + numAmount;
  const balanceAfter = updatedWallet.availableBalance;

  // Generate Reference IDs
  const requestReference = `WDR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnReference = `TXN-WDR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  let withdrawalRequest;
  let transaction;

  try {
    // Create WithdrawalRequest record
    withdrawalRequest = await WithdrawalRequest.create({
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
    transaction = await WalletTransaction.create({
      wallet: wallet._id,
      provider: providerId,
      transactionReference: txnReference,
      type: 'withdrawal',
      amount: numAmount,
      balanceBefore,
      balanceAfter,
      status: 'pending',
      withdrawalRequest: withdrawalRequest._id,
      paymentMethod: payoutMethod,
      description: `Withdrawal request #${requestReference} via ${payoutMethod === 'upi' ? 'UPI' : 'Bank Transfer'}`,
      metadata: {
        payoutMethod,
        destination: payoutMethod === 'upi' ? payoutDetails.upiId : `${payoutDetails.bankName || 'Bank'} A/C ...${payoutDetails.accountNumber.slice(-4)}`
      }
    });
  } catch (createErr) {
    // Rollback balance reservation if record creation failed
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      $inc: {
        availableBalance: numAmount,
        pendingWithdrawal: -numAmount
      }
    });
    throw createErr;
  }

  return {
    withdrawalRequest,
    transaction,
    walletSummary: {
      availableBalance: updatedWallet.availableBalance,
      pendingWithdrawal: updatedWallet.pendingWithdrawal
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
 * Core Reusable Service: Try Automatic Commission Deduction from Wallet
 * STRICT BUSINESS RULES:
 * 1. autoDeductCommissionFromWallet === true
 * 2. commissionDue > 0
 * 3. availableBalance > 0
 * 4. availableBalance >= commissionDue
 * 5. Negative legacy balance blocks deduction and flags for reconciliation
 * 6. Deduct entire commission in full in ONE transaction; never partial deduction
 * 7. Never touch pendingBalance or pendingWithdrawal
 * 8. Never settle if active Razorpay commission order is pending
 * 9. Concurrency-safe atomic compare-and-set or session
 */
const tryAutoDeductCommissionFromWallet = async (providerId, options = {}) => {
  const { bookingId = null, transactionType = null, providerNetEarnings = null } = options;
  const wallet = await ProviderWallet.findOne({ provider: providerId });
  if (!wallet) {
    return { isProcessed: true, deducted: false, reason: 'WALLET_NOT_FOUND' };
  }

  // 1. Negative legacy balance guard: do not deduct, do not reset to 0, flag for reconciliation
  if (wallet.availableBalance < 0) {
    if (!wallet.reconciliationFlagged) {
      wallet.reconciliationFlagged = true;
      wallet.reconciliationReason = `Negative legacy balance detected (₹${wallet.availableBalance}). Automatic commission deduction blocked; awaiting administrative reconciliation.`;
      await wallet.save();
    }
    return {
      isProcessed: true,
      deducted: false,
      reason: 'NEGATIVE_BALANCE_FLAGGED',
      availableBalance: wallet.availableBalance,
      commissionDue: wallet.commissionDue || 0
    };
  }

  // 2. Consent check: Provider must have explicitly enabled auto-deduction
  const isEnabled = Boolean(wallet.autoDeductCommissionFromWallet || wallet.autoCommissionAdjustment);
  if (!isEnabled) {
    return {
      isProcessed: true,
      deducted: false,
      reason: 'AUTO_DEDUCT_DISABLED',
      availableBalance: wallet.availableBalance,
      commissionDue: wallet.commissionDue || 0
    };
  }

  // 3. Outstanding commission check
  const currentCommissionDue = wallet.commissionDue || 0;
  if (currentCommissionDue <= 0) {
    return {
      isProcessed: true,
      deducted: false,
      reason: 'NO_COMMISSION_DUE',
      availableBalance: wallet.availableBalance,
      commissionDue: 0
    };
  }

  // Legacy rule support: When only legacy autoCommissionAdjustment is active,
  // require single earning to cover the entire commission due
  if (wallet.autoCommissionAdjustment && !wallet.autoDeductCommissionFromWallet) {
    if (providerNetEarnings !== null && providerNetEarnings < currentCommissionDue) {
      return {
        isProcessed: true,
        deducted: false,
        reason: 'EARNING_LESS_THAN_COMMISSION_DUE',
        availableBalance: wallet.availableBalance,
        commissionDue: currentCommissionDue
      };
    }
  }

  // 4. Balance sufficiency check (Available balance must be strictly > 0 and >= full commissionDue)
  if (wallet.availableBalance <= 0 || wallet.availableBalance < currentCommissionDue) {
    return {
      isProcessed: true,
      deducted: false,
      reason: 'INSUFFICIENT_BALANCE',
      availableBalance: wallet.availableBalance,
      commissionDue: currentCommissionDue
    };
  }

  // 5. Razorpay conflict check: If an active Razorpay order is currently pending, do not conflict
  const activeOrder = wallet.activeCommissionOrder;
  if (
    activeOrder &&
    activeOrder.status === 'pending' &&
    activeOrder.expiresAt &&
    new Date(activeOrder.expiresAt) > new Date()
  ) {
    return {
      isProcessed: true,
      deducted: false,
      reason: 'ACTIVE_RAZORPAY_ORDER_PENDING',
      orderId: activeOrder.orderId,
      availableBalance: wallet.availableBalance,
      commissionDue: currentCommissionDue
    };
  }

  // 6. Concurrency-safe Atomic Deduction:
  // Requires: autoDeductCommissionFromWallet or autoCommissionAdjustment === true, commissionDue === currentCommissionDue, availableBalance >= currentCommissionDue
  const deductionAmount = currentCommissionDue;
  const updatedWallet = await ProviderWallet.findOneAndUpdate(
    {
      _id: wallet._id,
      $or: [
        { autoDeductCommissionFromWallet: true },
        { autoCommissionAdjustment: true }
      ],
      commissionDue: deductionAmount,
      availableBalance: { $gte: deductionAmount },
      $and: [
        {
          $or: [
            { 'activeCommissionOrder.status': { $in: ['none', 'expired', 'failed', 'cancelled', 'settled'] } },
            { 'activeCommissionOrder.orderId': null },
            { 'activeCommissionOrder': { $exists: false } }
          ]
        }
      ]
    },
    {
      $inc: {
        availableBalance: -deductionAmount,
        commissionDue: -deductionAmount
      },
      $set: {
        lastTransactionAt: new Date(),
        lastAutoDeductionAt: new Date(),
        'activeCommissionOrder.status': 'none',
        'activeCommissionOrder.orderId': null
      }
    },
    { new: true }
  );

  if (!updatedWallet) {
    return {
      isProcessed: false,
      deducted: false,
      reason: 'CONCURRENCY_ABORT',
      message: 'Wallet balance or commission due changed concurrently'
    };
  }

  // 7. Record the Immutable Ledger Transaction
  const resolvedType = transactionType ||
    (wallet.autoCommissionAdjustment && !wallet.autoDeductCommissionFromWallet
      ? 'COMMISSION_ADJUSTMENT'
      : 'COMMISSION_WALLET_AUTO_DEBIT');

  const txnRef = `TXN-CAUTO-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnData = {
    wallet: updatedWallet._id,
    provider: providerId,
    transactionReference: txnRef,
    type: resolvedType,
    amount: deductionAmount,
    balanceBefore: updatedWallet.availableBalance + deductionAmount,
    balanceAfter: updatedWallet.availableBalance,
    commissionDueBefore: deductionAmount,
    commissionDueAfter: 0,
    status: 'completed',
    paymentMethod: 'system_adjustment',
    description: `Automatic full platform commission deduction of ₹${deductionAmount} from available wallet balance`,
    metadata: {
      settlementSource: 'PROVIDER_WALLET',
      settledCommission: deductionAmount,
      autoDeductFromWallet: true,
      deductedAt: new Date()
    }
  };

  if (bookingId) {
    txnData.booking = bookingId;
    txnData.metadata.bookingId = String(bookingId);
  }

  const transaction = await WalletTransaction.create(txnData);

  // 8. Send Notification to Provider
  try {
    const { sendNotification } = require('./notificationService');
    const providerDoc = await Provider.findById(providerId);
    if (providerDoc && providerDoc.user) {
      await sendNotification({
        recipientIds: [providerDoc.user],
        title: 'Commission Automatically Deducted',
        body: `Your full platform commission of ₹${deductionAmount} has been automatically deducted from your available wallet balance. Available Balance: ₹${updatedWallet.availableBalance}.`,
        type: 'wallet',
        data: {
          commissionDue: 0,
          deductedAmount: deductionAmount,
          availableBalance: updatedWallet.availableBalance,
          transactionReference: txnRef
        }
      });
    }
  } catch (notifErr) {
    console.warn('[AUTO_DEDUCT_NOTIF_ERROR]', notifErr.message);
  }

  return {
    isProcessed: true,
    deducted: true,
    amount: deductionAmount,
    deductionAmount,
    availableBalance: updatedWallet.availableBalance,
    commissionDue: 0,
    wallet: updatedWallet,
    transaction
  };
};

/**
 * Provider: Toggle Auto Deduct Commission from Wallet (ON/OFF)
 * Requires explicit provider consent.
 */
const toggleAutoDeductCommission = async (providerId, enabled) => {
  const isEnabled = Boolean(enabled);
  const wallet = await getOrCreateWallet(providerId);

  wallet.autoDeductCommissionFromWallet = isEnabled;
  wallet.autoCommissionAdjustment = isEnabled; // keep in sync
  await wallet.save();

  // Notification
  try {
    const { sendNotification } = require('./notificationService');
    const providerDoc = await Provider.findById(providerId);
    if (providerDoc && providerDoc.user) {
      await sendNotification({
        recipientIds: [providerDoc.user],
        title: isEnabled ? 'Auto Deduct from Wallet Enabled' : 'Auto Deduct from Wallet Disabled',
        body: isEnabled
          ? 'Mendroo will automatically deduct your complete outstanding commission in one transaction when your positive Available Wallet Balance is sufficient.'
          : 'Automatic commission deduction from your wallet has been turned off.',
        type: 'wallet',
        data: { autoDeductCommissionFromWallet: isEnabled }
      });
    }
  } catch (notifErr) {
    console.warn('[TOGGLE_AUTO_DEDUCT_NOTIF_ERROR]', notifErr.message);
  }

  // Trigger 4: Immediately attempt auto-deduction if provider just enabled it
  let deductionResult = null;
  if (isEnabled) {
    deductionResult = await tryAutoDeductCommissionFromWallet(providerId);
  }

  const freshSummary = await getWalletSummary(providerId);
  return {
    success: true,
    message: isEnabled
      ? (deductionResult?.deducted
        ? `Auto deduct enabled. Your full commission of ₹${deductionResult.amount} was automatically settled from your available balance.`
        : 'Automatic commission deduction from wallet enabled successfully')
      : 'Automatic commission deduction from wallet disabled successfully',
    autoDeductCommissionFromWallet: isEnabled,
    deductionResult,
    summary: freshSummary
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
    type: { $in: ['booking_earning', 'commission_deduction', 'CASH_BOOKING_COMMISSION_DUE'] }
  });

  if (existingTxn) {
    return {
      success: true,
      message: 'Booking earnings or commission have already been recorded',
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

  // Critical Business Rule: Commission calculated ONLY ONCE on original base service price.
  // Spare parts, materials, and replacement components are 100% EXCLUDED from platform commission (partsCommission = 0).
  const { calculateBookingCommission } = require('../utils/commissionCalculator');
  const accounting = calculateBookingCommission(booking);

  const originalServicePrice = accounting.originalServicePrice;
  const additionalPartsAmount = accounting.additionalPartsAmount;
  const customerApprovedPartsAmount = accounting.customerApprovedPartsAmount;
  const commissionableAmount = accounting.commissionableAmount;
  const platformCommission = accounting.platformCommissionAmount; // paise precision, calculated on originalServicePrice only
  const providerNetEarnings = accounting.providerNetEarning;
  const totalGrossAmount = accounting.totalCustomerPayable;
  const commissionRateFormatted = `${accounting.platformCommissionRate}%`;
  const partsCommission = 0;

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
          originalServicePrice,
          additionalPartsAmount,
          customerApprovedPartsAmount,
          commissionableAmount,
          platformCommission,
          partsCommission: 0,
          grossAmount: totalGrossAmount,
          totalCustomerPayable: totalGrossAmount,
          providerNetEarnings,
          commissionRate: commissionRateFormatted,
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
    let updatedWallet = await ProviderWallet.findByIdAndUpdate(
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

    // 3. Trigger 2: Automatic Commission Deduction Check
    // When an eligible online booking earning is credited to Available Balance
    let autoDeductResult = null;
    try {
      autoDeductResult = await tryAutoDeductCommissionFromWallet(booking.provider, {
        bookingId: booking._id,
        providerNetEarnings
      });
      if (autoDeductResult && autoDeductResult.deducted && autoDeductResult.wallet) {
        updatedWallet = autoDeductResult.wallet;
      }
    } catch (autoErr) {
      console.warn('[ONLINE_EARNING_AUTO_DEDUCT_WARN]', autoErr.message);
    }

    return {
      success: true,
      providerNetEarnings,
      platformCommission,
      partsCommission: 0,
      commissionableAmount,
      originalServicePrice,
      additionalPartsAmount: customerApprovedPartsAmount,
      totalGrossAmount,
      balanceAfter: updatedWallet.availableBalance,
      commissionDue: updatedWallet.commissionDue || 0,
      transaction,
      autoDeductResult
    };
  } else {
    // Booking was paid in CASH.
    // Provider collected 100% cash in hand from the customer directly.
    // RULE:
    // 1. Commission is calculated ONLY on original base service price, NEVER on spare parts.
    // 2. NEVER make the provider's availableBalance negative to represent outstanding commission!
    // 3. Keep commission payable separate from withdrawable wallet balance (in commissionDue).
    // 4. Do not credit gross cash to availableBalance.
    // 5. Record CASH_BOOKING_COMMISSION_DUE with immutable ledger entry.
    const txnRef = `TXN-CDUE-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const currentDueBefore = wallet.commissionDue || 0;
    const currentDueAfter = currentDueBefore + platformCommission;

    try {
      transaction = await WalletTransaction.create({
        wallet: wallet._id,
        provider: booking.provider,
        transactionReference: txnRef,
        type: 'CASH_BOOKING_COMMISSION_DUE',
        amount: platformCommission,
        balanceBefore,
        balanceAfter: balanceBefore, // Available Balance is NOT made negative!
        commissionDueBefore: currentDueBefore,
        commissionDueAfter: currentDueAfter,
        status: 'completed',
        booking: booking._id,
        paymentMethod: 'cash',
        description: `Platform Commission Due for Cash Booking #${booking.bookingReference} (Base: ₹${commissionableAmount}, Parts: ₹${customerApprovedPartsAmount} @ 0% comm)`,
        metadata: {
          bookingReference: booking.bookingReference,
          serviceName: booking.service?.name,
          originalServicePrice,
          additionalPartsAmount,
          customerApprovedPartsAmount,
          commissionableAmount,
          platformCommission,
          partsCommission: 0,
          grossAmount: totalGrossAmount,
          totalCustomerPayable: totalGrossAmount,
          providerNetEarnings,
          commissionRate: commissionRateFormatted,
          paymentMethod: 'cash'
        }
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        const existing = await WalletTransaction.findOne({
          booking: booking._id,
          type: { $in: ['CASH_BOOKING_COMMISSION_DUE', 'commission_deduction'] }
        });
        return { success: true, message: 'Cash booking commission already recorded', transaction: existing };
      }
      throw createErr;
    }

    const updatedWallet = await ProviderWallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: {
          commissionDue: platformCommission,
          totalEarnings: providerNetEarnings
        },
        $set: { lastTransactionAt: new Date() }
      },
      { new: true }
    );

    // Notify provider of new commission payable
    try {
      const { sendNotification } = require('./notificationService');
      const providerDoc = await Provider.findById(booking.provider);
      if (providerDoc && providerDoc.user) {
        await sendNotification({
          recipientIds: [providerDoc.user],
          title: 'Commission Payable to Mendroo',
          body: `₹${platformCommission} platform commission is due for cash booking #${booking.bookingReference}.`,
          type: 'wallet',
          data: {
            commissionDue: updatedWallet.commissionDue,
            bookingId: String(booking._id)
          }
        });
      }
    } catch (notifErr) {
      console.warn('[WALLET_CASH_DUE_NOTIF_ERROR]', notifErr.message);
    }

    // Trigger 1: Automatic Commission Deduction Check
    // When cash booking creates a new commission due (if provider already had sufficient balance and opt-in)
    let autoDeductResult = null;
    try {
      autoDeductResult = await tryAutoDeductCommissionFromWallet(booking.provider, {
        bookingId: booking._id,
        providerNetEarnings
      });
      if (autoDeductResult && autoDeductResult.deducted && autoDeductResult.wallet) {
        updatedWallet = autoDeductResult.wallet;
      }
    } catch (autoErr) {
      console.warn('[CASH_DUE_AUTO_DEDUCT_WARN]', autoErr.message);
    }

    return {
      success: true,
      providerNetEarnings,
      platformCommission,
      partsCommission: 0,
      commissionableAmount,
      originalServicePrice,
      additionalPartsAmount: customerApprovedPartsAmount,
      totalGrossAmount,
      balanceAfter: updatedWallet.availableBalance,
      commissionDue: updatedWallet.commissionDue,
      transaction,
      autoDeductResult
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
  const { status, page = 1, limit = 20, search } = query;

  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search && search.trim()) {
    const s = search.trim();
    const orConditions = [
      { requestReference: { $regex: s, $options: 'i' } },
      { 'payoutDetails.accountHolderName': { $regex: s, $options: 'i' } },
      { 'payoutDetails.upiId': { $regex: s, $options: 'i' } },
      { 'payoutDetails.accountNumber': { $regex: s, $options: 'i' } }
    ];
    if (mongoose.Types.ObjectId.isValid(s)) {
      orConditions.push({ provider: s }, { wallet: s }, { _id: s });
    }
    filter.$or = orConditions;
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
      .populate('wallet', 'availableBalance pendingWithdrawal totalEarnings totalWithdrawn currency status')
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

  // 1. Atomically transition WithdrawalRequest from requested/approved/processing to rejected
  const withdrawal = await WithdrawalRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: { $in: ['requested', 'approved', 'processing'] }
    },
    {
      $set: {
        status: 'rejected',
        rejectionReason,
        processedBy: adminUserId,
        processedAt: new Date()
      }
    },
    { new: true }
  );

  if (!withdrawal) {
    const fresh = await WithdrawalRequest.findById(requestId);
    const err = new Error(`Cannot reject withdrawal: current status is '${fresh?.status || 'not found'}'`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Atomically refund reserved funds back to available balance exactly once
  const updatedWallet = await ProviderWallet.findByIdAndUpdate(
    withdrawal.wallet,
    {
      $inc: {
        pendingWithdrawal: -withdrawal.amount,
        availableBalance: withdrawal.amount
      },
      $set: { lastTransactionAt: new Date() }
    },
    { new: true }
  );

  if (!updatedWallet) {
    const err = new Error('Associated provider wallet not found');
    err.statusCode = 404;
    throw err;
  }

  // Update original pending transaction if exists
  await WalletTransaction.findOneAndUpdate(
    { withdrawalRequest: withdrawal._id, type: 'withdrawal' },
    { $set: { status: 'reversed' } }
  );

  // Create refund transaction record
  const refundTxnRef = `TXN-REF-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const refundTransaction = await WalletTransaction.create({
    wallet: updatedWallet._id,
    provider: withdrawal.provider,
    transactionReference: refundTxnRef,
    type: 'withdrawal_refund',
    amount: withdrawal.amount,
    balanceBefore: updatedWallet.availableBalance - withdrawal.amount,
    balanceAfter: updatedWallet.availableBalance,
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
      availableBalance: updatedWallet.availableBalance,
      pendingWithdrawal: updatedWallet.pendingWithdrawal
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

  // 1. Atomically transition WithdrawalRequest from requested/approved/processing to paid
  const withdrawal = await WithdrawalRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: { $in: ['requested', 'approved', 'processing'] }
    },
    {
      $set: {
        status: 'paid',
        transactionReference,
        adminNote: adminNote || '',
        processedBy: adminUserId,
        processedAt: new Date(),
        paidAt: new Date()
      }
    },
    { new: true }
  );

  if (!withdrawal) {
    const fresh = await WithdrawalRequest.findById(requestId);
    const err = new Error(`Cannot complete payout: request status is '${fresh?.status || 'not found'}'`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Atomically finalize deduction from pending to totalWithdrawn
  const updatedWallet = await ProviderWallet.findByIdAndUpdate(
    withdrawal.wallet,
    {
      $inc: {
        pendingWithdrawal: -withdrawal.amount,
        totalWithdrawn: withdrawal.amount
      },
      $set: { lastTransactionAt: new Date() }
    },
    { new: true }
  );

  if (!updatedWallet) {
    const err = new Error('Associated provider wallet not found');
    err.statusCode = 404;
    throw err;
  }

  // Mark the pending transaction completed
  await WalletTransaction.findOneAndUpdate(
    { withdrawalRequest: withdrawal._id, type: 'withdrawal' },
    {
      $set: {
        status: 'completed',
        'metadata.payoutReference': transactionReference,
        'metadata.paidAt': new Date()
      }
    }
  );

  return {
    withdrawal,
    walletSummary: {
      availableBalance: updatedWallet.availableBalance,
      pendingWithdrawal: updatedWallet.pendingWithdrawal,
      totalWithdrawn: updatedWallet.totalWithdrawn
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

  // Trigger 3: When an authorized wallet credit increases Available Balance
  let autoDeductResult = null;
  if (type === 'credit') {
    try {
      autoDeductResult = await tryAutoDeductCommissionFromWallet(wallet.provider);
      if (autoDeductResult && autoDeductResult.deducted && autoDeductResult.wallet) {
        wallet.availableBalance = autoDeductResult.wallet.availableBalance;
        wallet.commissionDue = autoDeductResult.wallet.commissionDue;
      }
    } catch (autoErr) {
      console.warn('[ADMIN_CREDIT_AUTO_DEDUCT_WARN]', autoErr.message);
    }
  }

  return {
    wallet,
    transaction,
    autoDeductResult
  };
};

/**
 * Get Commission Payable breakdown & cash booking history for provider
 */
const getCommissionDetails = async (providerId) => {
  const wallet = await getOrCreateWallet(providerId);

  // Find all cash bookings or transactions that created commission due
  const commissionTxns = await WalletTransaction.find({
    wallet: wallet._id,
    type: { $in: ['CASH_BOOKING_COMMISSION_DUE', 'COMMISSION_PAYMENT', 'COMMISSION_ADJUSTMENT', 'COMMISSION_WALLET_AUTO_DEBIT', 'COMMISSION_WAIVER', 'COMMISSION_REFUND'] }
  })
    .populate('booking')
    .sort({ createdAt: -1 })
    .lean();

  const currentCommissionDue = wallet.commissionDue || 0;
  const { getActiveCommissionRate } = require('../utils/commissionCalculator');
  const activeConfig = await getActiveCommissionRate();
  const configuredRate = activeConfig.rateDecimal;

  return {
    commissionDue: currentCommissionDue,
    availableBalance: wallet.availableBalance || 0,
    autoDeductCommissionFromWallet: Boolean(wallet.autoDeductCommissionFromWallet),
    autoCommissionAdjustment: Boolean(wallet.autoDeductCommissionFromWallet || wallet.autoCommissionAdjustment),
    lastAutoDeductionAt: wallet.lastAutoDeductionAt || null,
    reconciliationFlagged: Boolean(wallet.reconciliationFlagged),
    reconciliationReason: wallet.reconciliationReason || null,
    configuredCommissionRate: configuredRate,
    commissionRateText: `${activeConfig.ratePercentage}% Platform Take-Rate`,
    activeOrder: wallet.activeCommissionOrder?.status === 'pending' ? {
      orderId: wallet.activeCommissionOrder.orderId,
      amount: wallet.activeCommissionOrder.amount,
      expiresAt: wallet.activeCommissionOrder.expiresAt
    } : null,
    history: commissionTxns.map((t) => ({
      _id: t._id,
      transactionReference: t.transactionReference,
      type: t.type,
      amount: t.amount,
      bookingId: t.booking?._id || t.metadata?.bookingId || null,
      bookingReference: t.booking?.bookingReference || t.metadata?.bookingReference || 'N/A',
      serviceName: t.booking?.service?.name || t.metadata?.serviceName || 'Service',
      customerPaymentAmount: t.metadata?.totalCustomerPayable || t.metadata?.grossAmount || 0,
      originalServicePrice: t.metadata?.originalServicePrice || t.metadata?.commissionableAmount || t.metadata?.grossAmount || 0,
      additionalPartsAmount: t.metadata?.customerApprovedPartsAmount || t.metadata?.additionalPartsAmount || 0,
      customerApprovedPartsAmount: t.metadata?.customerApprovedPartsAmount || t.metadata?.additionalPartsAmount || 0,
      commissionableAmount: t.metadata?.commissionableAmount || t.metadata?.originalServicePrice || t.metadata?.grossAmount || 0,
      platformCommissionAmount: t.amount,
      partsCommission: 0,
      commissionPercentage: t.metadata?.commissionRate || `${Math.round(configuredRate * 100)}%`,
      createdAt: t.createdAt,
      status: t.status,
      description: t.description
    }))
  };
};

/**
 * Provider: Create Razorpay Order to Pay Outstanding Commission in Full
 * STRICT RULE: One-time payment of the entire outstanding commission. No partial amounts.
 * Concurrency Safety: Compare-and-set active order lock prevents duplicate active orders.
 * Edge-case Safety: Checks for unresolved in-flight payments before creating new orders.
 */
const createPayCommissionOrder = async (providerId, requestedAmount) => {
  const wallet = await getOrCreateWallet(providerId);
  const currentCommissionDue = wallet.commissionDue || 0;

  if (currentCommissionDue <= 0) {
    const err = new Error('You do not have any outstanding commission payable to Mendroo.');
    err.statusCode = 400;
    throw err;
  }

  const rawAmount = (typeof requestedAmount === 'object' && requestedAmount !== null) ? requestedAmount.amount : requestedAmount;
  if (rawAmount !== undefined && rawAmount !== null) {
    const parsed = Number(rawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const err = new Error('Invalid payment amount. Amount must be greater than zero.');
      err.statusCode = 400;
      throw err;
    }
  }

  const paymentService = require('./paymentService');
  let activeKeyId;
  try {
    activeKeyId = paymentService.getSanitizedRazorpayConfig().keyId;
  } catch (e) {
    activeKeyId = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : 'rzp_test_placeholder';
  }

  // 1. Check if there is already an active order for this provider
  const activeOrder = wallet.activeCommissionOrder;
  if (activeOrder && activeOrder.orderId) {
    // Check if the earlier order has an unresolved in-flight payment on Razorpay
    if (activeOrder.status === 'pending' || activeOrder.status === 'cancelled') {
      try {
        const orderPayments = await paymentService.fetchOrderPayments(activeOrder.orderId);
        if (orderPayments && orderPayments.items && orderPayments.items.length > 0) {
          const successfulPayment = orderPayments.items.find(
            (p) => p.status === 'captured' || p.status === 'authorized'
          );
          if (successfulPayment) {
            // If already captured, auto-settle the commission immediately
            if (successfulPayment.status === 'captured') {
              const settlementResult = await verifyAndSettleCommissionPayment(providerId, {
                razorpayOrderId: activeOrder.orderId,
                razorpayPaymentId: successfulPayment.id,
                razorpaySignature: 'auto_resolved_capture'
              });
              return {
                alreadySettled: true,
                message: 'Your earlier pending payment was successfully captured and settled.',
                orderId: activeOrder.orderId,
                amount: activeOrder.amount,
                status: 'settled'
              };
            } else if (successfulPayment.status === 'authorized') {
              const err = new Error(
                `Payment '${successfulPayment.id}' for order '${activeOrder.orderId}' is currently authorized and being processed. Cannot create a new order while payment is resolving.`
              );
              err.statusCode = 409;
              throw err;
            }
          }
        }
      } catch (checkErr) {
        if (checkErr.statusCode === 409) throw checkErr;
      }
    }

    if (activeOrder.status === 'pending') {
      const isExpired = activeOrder.expiresAt && new Date() > new Date(activeOrder.expiresAt);
      if (!isExpired && activeOrder.amount === currentCommissionDue && activeOrder.orderId) {
        // Re-use active order to prevent creating multiple Razorpay orders
        return {
          orderId: activeOrder.orderId,
          amount: activeOrder.amount,
          amountInPaise: activeOrder.amountInPaise,
          currency: activeOrder.currency || 'INR',
          keyId: activeKeyId,
          expiresAt: activeOrder.expiresAt,
          status: 'pending'
        };
      }
    }
  }

  // 2. Atomic Compare-And-Set Lock:
  // Ensures only ONE thread/request can create an order at a time
  const amountInPaise = Math.round(currentCommissionDue * 100);
  const orderExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins TTL

  const lockedWallet = await ProviderWallet.findOneAndUpdate(
    {
      _id: wallet._id,
      commissionDue: { $gt: 0 },
      $or: [
        { 'activeCommissionOrder.status': { $in: ['none', 'settled', 'expired', 'failed', 'cancelled', null] } },
        { 'activeCommissionOrder.expiresAt': { $lt: new Date() } }
      ]
    },
    {
      $set: {
        'activeCommissionOrder.status': 'pending',
        'activeCommissionOrder.amount': currentCommissionDue,
        'activeCommissionOrder.amountInPaise': amountInPaise,
        'activeCommissionOrder.currency': 'INR',
        'activeCommissionOrder.createdAt': new Date(),
        'activeCommissionOrder.expiresAt': orderExpiry
      }
    },
    { new: true }
  );

  if (!lockedWallet) {
    const reloaded = await ProviderWallet.findById(wallet._id);
    if (reloaded?.activeCommissionOrder?.status === 'pending' && reloaded.activeCommissionOrder.orderId) {
      return {
        orderId: reloaded.activeCommissionOrder.orderId,
        amount: reloaded.activeCommissionOrder.amount,
        amountInPaise: reloaded.activeCommissionOrder.amountInPaise,
        currency: reloaded.activeCommissionOrder.currency || 'INR',
        keyId: activeKeyId,
        expiresAt: reloaded.activeCommissionOrder.expiresAt,
        status: 'pending'
      };
    }
    const err = new Error('An active commission settlement order is already pending. Please complete or cancel it before creating a new one.');
    err.statusCode = 409;
    throw err;
  }

  // 3. Create server-side Razorpay order
  const receipt = `RCP-COM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  let order;
  try {
    order = await paymentService.createOrder({
      amountInRupees: currentCommissionDue,
      receipt,
      notes: {
        providerId: String(providerId),
        walletId: String(wallet._id),
        purpose: 'COMMISSION_PAYMENT',
        commissionDue: String(currentCommissionDue)
      }
    });
  } catch (gatewayErr) {
    // Release the lock on failure
    await ProviderWallet.findByIdAndUpdate(wallet._id, {
      $set: { 'activeCommissionOrder.status': 'failed' }
    });
    throw gatewayErr;
  }

  // 4. Record the real Razorpay Order ID on the active order
  await ProviderWallet.findByIdAndUpdate(wallet._id, {
    $set: {
      'activeCommissionOrder.orderId': order.id,
      'activeCommissionOrder.status': 'pending'
    }
  });

  return {
    orderId: order.id,
    amount: currentCommissionDue,
    amountInPaise,
    currency: order.currency || 'INR',
    keyId: activeKeyId,
    expiresAt: orderExpiry,
    status: 'pending'
  };
};

/**
 * Provider: Cancel active pending commission order
 * Edge-case Safety: Checks if payment succeeded prior to/at cancellation before setting status.
 */
const cancelActiveCommissionOrder = async (providerId) => {
  const wallet = await getOrCreateWallet(providerId);
  const activeOrder = wallet.activeCommissionOrder;

  if (activeOrder && activeOrder.status === 'pending' && activeOrder.orderId) {
    try {
      const paymentService = require('./paymentService');
      const orderPayments = await paymentService.fetchOrderPayments(activeOrder.orderId);
      if (orderPayments && orderPayments.items && orderPayments.items.length > 0) {
        const capturedOrAuth = orderPayments.items.find(
          (p) => p.status === 'captured' || p.status === 'authorized'
        );
        if (capturedOrAuth) {
          // Payment succeeded just before or during cancellation! Settle rather than discarding
          if (capturedOrAuth.status === 'authorized') {
            await paymentService.capturePayment(capturedOrAuth.id, activeOrder.amountInPaise, 'INR');
          }
          await verifyAndSettleCommissionPayment(providerId, {
            razorpayOrderId: activeOrder.orderId,
            razorpayPaymentId: capturedOrAuth.id,
            razorpaySignature: 'auto_resolved_capture'
          });
          return {
            success: true,
            settled: true,
            message: 'Payment succeeded just prior to cancellation and commission was settled in full.'
          };
        }
      }
    } catch (checkErr) {
      console.warn('[CANCEL_ORDER_CHECK_WARN]', checkErr.message);
    }

    wallet.activeCommissionOrder.status = 'cancelled';
    await wallet.save();
  }
  return { success: true, message: 'Active commission payment order cancelled' };
};

/**
 * Provider / Webhook: Verify Razorpay Payment & Atomically Settle Full Commission
 * STRICT RULE 1: Payment in status 'authorized' must NOT settle commission unless backend successfully captures it and verifies 'captured'.
 * STRICT RULE 2: Only verified captured payment can create COMMISSION_PAYMENT and set commissionDue to 0.
 * Edge-case Safety: Late successful payments for cancelled/expired orders are accounted for and settled.
 */
const verifyAndSettleCommissionPayment = async (providerId, payload = {}) => {
  const source = (payload && payload.response) || payload || {};
  const razorpayOrderId =
    source.razorpayOrderId ||
    source.razorpay_order_id ||
    source.orderId ||
    source.order_id ||
    payload.razorpayOrderId ||
    payload.razorpay_order_id ||
    payload.orderId ||
    payload.order_id;
  const razorpayPaymentId =
    source.razorpayPaymentId ||
    source.razorpay_payment_id ||
    source.paymentId ||
    source.payment_id ||
    payload.razorpayPaymentId ||
    payload.razorpay_payment_id ||
    payload.paymentId ||
    payload.payment_id;
  const razorpaySignature =
    source.razorpaySignature ||
    source.razorpay_signature ||
    source.signature ||
    payload.razorpaySignature ||
    payload.razorpay_signature ||
    payload.signature;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const err = new Error('Razorpay order ID, payment ID, and signature are required for commission settlement.');
    err.statusCode = 400;
    throw err;
  }

  const wallet = await getOrCreateWallet(providerId);
  const currentCommissionDue = wallet.commissionDue || 0;

  // 1. Idempotency Check: Check if this payment or order was already settled
  const alreadyProcessed = await WalletTransaction.findOne({
    $or: [
      { 'metadata.razorpayPaymentId': razorpayPaymentId },
      { 'metadata.razorpayOrderId': razorpayOrderId }
    ],
    type: 'COMMISSION_PAYMENT'
  });
  if (alreadyProcessed) {
    return {
      success: true,
      settled: true,
      alreadySettled: true,
      message: 'Commission payment already settled in full.',
      wallet,
      transaction: alreadyProcessed
    };
  }

  if (currentCommissionDue <= 0) {
    const latestTxn = await WalletTransaction.findOne({
      provider: providerId,
      type: 'COMMISSION_PAYMENT'
    }).sort({ createdAt: -1 });

    return {
      success: true,
      settled: true,
      alreadySettled: true,
      message: 'No outstanding commission payable to settle. Commission balance is already ₹0.',
      wallet,
      transaction: latestTxn
    };
  }

  // 2. Active Order Validation: Must match the wallet's order ID
  const activeOrder = wallet.activeCommissionOrder;
  if (!activeOrder || activeOrder.orderId !== razorpayOrderId) {
    const err = new Error('Order ID mismatch. The payment order does not match the commission settlement order for this provider.');
    err.statusCode = 400;
    throw err;
  }

  // 3. HMAC SHA-256 signature verification (unless auto-resolved server capture)
  const paymentService = require('./paymentService');
  if (razorpaySignature !== 'auto_resolved_capture') {
    const isSigValid = paymentService.verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!isSigValid) {
      const err = new Error('Payment signature verification failed. Outstanding commission remains unchanged.');
      err.statusCode = 400;
      throw err;
    }
  }

  // 4. Server-Side Verification with Razorpay API (amount in paise, INR currency, captured status)
  const expectedAmountInPaise = activeOrder.amountInPaise || Math.round(currentCommissionDue * 100);
  try {
    let paymentRecord = await paymentService.fetchPayment(razorpayPaymentId);
    if (paymentRecord) {
      if (paymentRecord.currency && paymentRecord.currency !== 'INR') {
        const err = new Error(`Invalid payment currency '${paymentRecord.currency}'. Expected 'INR'.`);
        err.statusCode = 400;
        throw err;
      }
      if (paymentRecord.amount && paymentRecord.amount !== expectedAmountInPaise) {
        const err = new Error(`Payment amount mismatch: received ${paymentRecord.amount} paise, expected ${expectedAmountInPaise} paise.`);
        err.statusCode = 400;
        throw err;
      }
      if (paymentRecord.order_id && paymentRecord.order_id !== razorpayOrderId) {
        const err = new Error(`Payment order mismatch: payment belongs to order '${paymentRecord.order_id}', not '${razorpayOrderId}'.`);
        err.statusCode = 400;
        throw err;
      }

      // CASE 1 & 2: If status is 'authorized', attempt explicit backend capture
      if (paymentRecord.status === 'authorized') {
        try {
          paymentRecord = await paymentService.capturePayment(razorpayPaymentId, expectedAmountInPaise, 'INR');
        } catch (captureErr) {
          const capMsg = captureErr.message || captureErr.error?.description || 'Gateway capture error';
          const err = new Error(`Payment is authorized but backend capture failed: ${capMsg}. Commission remains unsettled.`);
          err.statusCode = 400;
          throw err;
        }
      }

      // STRICT RULE: Must be 'captured'
      if (paymentRecord.status !== 'captured') {
        const err = new Error(`Payment status is '${paymentRecord.status}'. Only verified captured payments can settle commission.`);
        err.statusCode = 400;
        throw err;
      }
    }
  } catch (apiErr) {
    if (apiErr.statusCode === 400) throw apiErr;
    const errMsg = (apiErr && (apiErr.message || apiErr.error?.description || apiErr.description)) || '';
    if (process.env.NODE_ENV === 'production' && !errMsg.includes('test_')) {
      throw apiErr;
    }
  }

  // 5. Late successful payment safety:
  // If order was marked cancelled or expired on client, but genuine captured payment succeeded,
  // revive the order state so the payment is never discarded or unaccounted
  if (activeOrder.status === 'cancelled' || activeOrder.status === 'expired') {
    activeOrder.status = 'pending';
    await wallet.save();
  }

  // 6. Atomic Compare-And-Set Settlement:
  const updatedWallet = await ProviderWallet.findOneAndUpdate(
    {
      _id: wallet._id,
      commissionDue: { $gt: 0 },
      'activeCommissionOrder.orderId': razorpayOrderId
    },
    {
      $set: {
        commissionDue: 0,
        'activeCommissionOrder.status': 'settled',
        'activeCommissionOrder.paymentId': razorpayPaymentId,
        'activeCommissionOrder.settledAt': new Date(),
        lastTransactionAt: new Date()
      }
    },
    { new: true }
  );

  if (!updatedWallet) {
    const existing = await WalletTransaction.findOne({
      $or: [
        { 'metadata.razorpayPaymentId': razorpayPaymentId },
        { 'metadata.razorpayOrderId': razorpayOrderId }
      ],
      type: 'COMMISSION_PAYMENT'
    });
    if (existing) {
      return {
        success: true,
        message: 'Commission payment already settled',
        wallet: await ProviderWallet.findById(wallet._id),
        transaction: existing
      };
    }
    const err = new Error('Could not settle commission: active order state mismatch or already settled.');
    err.statusCode = 409;
    throw err;
  }

  // 7. Record immutable WalletTransaction
  const amountToSettle = currentCommissionDue;
  const txnRef = `TXN-CPAY-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  let transaction;
  try {
    transaction = await WalletTransaction.create({
      wallet: wallet._id,
      provider: providerId,
      transactionReference: txnRef,
      type: 'COMMISSION_PAYMENT',
      amount: amountToSettle,
      balanceBefore: wallet.availableBalance,
      balanceAfter: wallet.availableBalance, // Available Balance unchanged
      commissionDueBefore: currentCommissionDue,
      commissionDueAfter: 0,
      status: 'completed',
      paymentMethod: 'online',
      description: `Full Settlement of Commission Payable to Mendroo (₹${amountToSettle})`,
      metadata: {
        razorpayOrderId,
        razorpayPaymentId,
        settledAmount: amountToSettle,
        amountInPaise: expectedAmountInPaise,
        currency: 'INR',
        settlementType: 'direct_razorpay'
      }
    });
  } catch (createErr) {
    if (createErr.code === 11000) {
      const existing = await WalletTransaction.findOne({
        $or: [
          { 'metadata.razorpayPaymentId': razorpayPaymentId },
          { 'metadata.razorpayOrderId': razorpayOrderId }
        ],
        type: 'COMMISSION_PAYMENT'
      });
      return {
        success: true,
        message: 'Commission payment already settled',
        wallet: updatedWallet,
        transaction: existing
      };
    }
    throw createErr;
  }

  // Notify Provider
  try {
    const { sendNotification } = require('./notificationService');
    const providerDoc = await Provider.findById(providerId);
    if (providerDoc && providerDoc.user) {
      await sendNotification({
        recipientIds: [providerDoc.user],
        title: 'Commission Paid Successfully',
        body: `Your payment of ₹${amountToSettle} for Mendroo platform commission was completed successfully. Your commission due is now ₹0.`,
        type: 'wallet',
        data: {
          commissionDue: 0,
          settledAmount: amountToSettle,
          paymentId: razorpayPaymentId
        }
      });
    }
  } catch (notifErr) {
    console.warn('[WALLET_PAY_COMMISSION_NOTIF_ERROR]', notifErr.message);
  }

  return {
    success: true,
    settled: true,
    commissionSettled: amountToSettle,
    message: 'Commission payable to Mendroo settled in full',
    wallet: updatedWallet,
    transaction
  };
};

/**
 * Provider / Recovery: Reconcile in-flight commission payment server-side with Razorpay gateway.
 * Recovers captured or authorized payments after network timeouts or client disconnects.
 * Idempotently settles the commission if payment was captured.
 * Does not cancel or release active order lock unless payment genuinely failed or expired.
 */
const reconcileCommissionPayment = async (providerId) => {
  const wallet = await getOrCreateWallet(providerId);
  const currentCommissionDue = wallet.commissionDue || 0;

  // 1. If commission is already settled (balance due is 0)
  if (currentCommissionDue <= 0) {
    const latestTxn = await WalletTransaction.findOne({
      provider: providerId,
      type: 'COMMISSION_PAYMENT'
    }).sort({ createdAt: -1 });

    return {
      success: true,
      settled: true,
      status: 'already_settled',
      message: 'Commission is already settled in full with zero balance due.',
      wallet,
      transaction: latestTxn
    };
  }

  // 2. Check active order
  const activeOrder = wallet.activeCommissionOrder;
  if (!activeOrder || !activeOrder.orderId) {
    return {
      success: false,
      settled: false,
      status: 'no_active_order',
      message: 'No active commission payment order found. You can initiate a new payment.'
    };
  }

  // 3. Inspect Razorpay Gateway for payments on this order
  const paymentService = require('./paymentService');
  try {
    const paymentsList = await paymentService.fetchOrderPayments(activeOrder.orderId);
    const items = paymentsList && Array.isArray(paymentsList.items) ? paymentsList.items : [];

    // Prioritize captured payment
    const captured = items.find((p) => p.status === 'captured');
    if (captured) {
      const settlement = await verifyAndSettleCommissionPayment(providerId, {
        razorpayOrderId: activeOrder.orderId,
        razorpayPaymentId: captured.id,
        razorpaySignature: 'auto_resolved_capture'
      });
      return {
        ...settlement,
        status: 'settled',
        message: 'Payment verified and commission settled in full.'
      };
    }

    // Look for authorized payment that can be captured
    const authorized = items.find((p) => p.status === 'authorized');
    if (authorized) {
      const amountPaise = activeOrder.amountInPaise || Math.round(currentCommissionDue * 100);
      try {
        await paymentService.capturePayment(authorized.id, amountPaise, 'INR');
        const settlement = await verifyAndSettleCommissionPayment(providerId, {
          razorpayOrderId: activeOrder.orderId,
          razorpayPaymentId: authorized.id,
          razorpaySignature: 'auto_resolved_capture'
        });
        return {
          ...settlement,
          status: 'settled',
          message: 'Authorized payment captured and commission settled in full.'
        };
      } catch (capErr) {
        return {
          success: false,
          settled: false,
          status: 'capture_failed',
          message: `Payment authorized on Razorpay but capture failed: ${capErr.message || 'Gateway error'}. Outstanding commission unchanged.`
        };
      }
    }

    // If payments exist and all failed
    if (items.length > 0 && items.every((p) => p.status === 'failed')) {
      await ProviderWallet.findByIdAndUpdate(wallet._id, {
        $set: { 'activeCommissionOrder.status': 'failed' }
      });
      return {
        success: false,
        settled: false,
        status: 'failed',
        message: 'Payment attempt failed at gateway. You can retry paying your commission safely.'
      };
    }

    // If order has expired without payment
    if (activeOrder.expiresAt && new Date(activeOrder.expiresAt) < new Date()) {
      await ProviderWallet.findByIdAndUpdate(wallet._id, {
        $set: { 'activeCommissionOrder.status': 'expired' }
      });
      return {
        success: false,
        settled: false,
        status: 'expired',
        message: 'Payment order has expired. Safe retry is available.'
      };
    }

    return {
      success: false,
      settled: false,
      status: 'pending',
      message: 'Payment is pending on gateway. Please complete checkout or check again in a moment.'
    };
  } catch (err) {
    const errorMsg = err.message || err.error?.description || 'Could not verify payment status with gateway.';
    return {
      success: false,
      settled: false,
      status: 'gateway_error',
      message: errorMsg
    };
  }
};

/**
 * Admin: List all commissions & outstanding amounts across providers
 */
const adminListCommissions = async (query = {}) => {
  const { search, status = 'all', page = 1, limit = 20 } = query;

  const matchFilter = {};
  if (status === 'outstanding') {
    matchFilter.commissionDue = { $gt: 0 };
  } else if (status === 'settled') {
    matchFilter.commissionDue = { $lte: 0 };
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [wallets, total, aggStats] = await Promise.all([
    ProviderWallet.find(matchFilter)
      .populate({
        path: 'provider',
        populate: { path: 'user', select: 'name email phone' }
      })
      .sort({ commissionDue: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ProviderWallet.countDocuments(matchFilter),
    ProviderWallet.aggregate([
      {
        $group: {
          _id: null,
          totalOutstandingCommission: { $sum: '$commissionDue' },
          providersWithOutstandingCount: {
            $sum: { $cond: [{ $gt: ['$commissionDue', 0] }, 1, 0] }
          }
        }
      }
    ])
  ]);

  const summary = aggStats[0] || {
    totalOutstandingCommission: 0,
    providersWithOutstandingCount: 0
  };

  const { getActiveCommissionRate } = require('../utils/commissionCalculator');
  const activeCommissionConfig = await getActiveCommissionRate();

  return {
    summary: {
      totalOutstandingCommission: summary.totalOutstandingCommission || 0,
      providersWithOutstandingCount: summary.providersWithOutstandingCount || 0,
      activeCommissionRate: activeCommissionConfig.ratePercentage,
      activeCommissionRateFormatted: activeCommissionConfig.rateFormatted
    },
    wallets: wallets.map((w) => ({
      _id: w._id,
      providerId: w.provider?._id,
      businessName: w.provider?.businessName || 'N/A',
      providerName: w.provider?.businessName || w.provider?.user?.name || 'N/A',
      providerEmail: w.provider?.user?.email || 'N/A',
      providerPhone: w.provider?.user?.phone || 'N/A',
      availableBalance: w.availableBalance,
      commissionDue: w.commissionDue || 0,
      autoDeductCommissionFromWallet: Boolean(w.autoDeductCommissionFromWallet),
      autoCommissionAdjustment: Boolean(w.autoDeductCommissionFromWallet || w.autoCommissionAdjustment),
      lastAutoDeductionAt: w.lastAutoDeductionAt || null,
      reconciliationFlagged: Boolean(w.reconciliationFlagged),
      reconciliationReason: w.reconciliationReason || null,
      lastTransactionAt: w.lastTransactionAt
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
};

/**
 * Admin: Disable autoDeductCommissionFromWallet for a provider where authorized
 * STRICT RULE: Admin cannot silently enable automatic deduction. Only the provider can grant consent.
 */
const adminToggleAutoCommissionAdjustment = async (providerId, enabled, adminUserId) => {
  if (enabled === true) {
    const err = new Error('Admin cannot enable automatic commission deduction on behalf of the provider. Only the provider can explicitly grant consent from the Provider App.');
    err.statusCode = 403;
    throw err;
  }

  const wallet = await getOrCreateWallet(providerId);
  wallet.autoDeductCommissionFromWallet = false;
  wallet.autoCommissionAdjustment = false;
  await wallet.save();

  try {
    const { sendNotification } = require('./notificationService');
    const providerDoc = await Provider.findById(providerId);
    if (providerDoc && providerDoc.user) {
      await sendNotification({
        recipientIds: [providerDoc.user],
        title: 'Auto Deduct from Wallet Disabled',
        body: 'Automatic commission deduction has been disabled by platform administration.',
        type: 'wallet',
        data: { autoDeductCommissionFromWallet: false }
      });
    }
  } catch (notifErr) {
    console.warn('[ADMIN_DISABLE_AUTO_DEDUCT_NOTIF_WARN]', notifErr.message);
  }

  return {
    success: true,
    message: 'Automatic commission deduction from wallet disabled successfully by admin',
    autoDeductCommissionFromWallet: false,
    autoCommissionAdjustment: false
  };
};

/**
 * Admin: Full Payment Settlement (Recorded offline payment)
 * STRICT RULE: Settles 100% of current commission due. No partial settlements.
 */
const adminSettleFullCommission = async (providerId, { reason, adminId, amount } = {}, adminUserId) => {
  const effectiveAdminId = adminUserId || adminId;
  if (!effectiveAdminId) {
    const err = new Error('Authorized Admin user ID is required.');
    err.statusCode = 401;
    throw err;
  }
  if (!reason || !reason.trim() || reason.trim().length < 5) {
    const err = new Error('A mandatory audited business reason (min 5 characters) is required for full commission settlement.');
    err.statusCode = 400;
    throw err;
  }

  const wallet = await getOrCreateWallet(providerId);
  const dueBefore = wallet.commissionDue || 0;

  if (dueBefore <= 0) {
    const err = new Error('No outstanding commission payable to settle.');
    err.statusCode = 400;
    throw err;
  }

  if (amount !== undefined && amount !== null && Number(amount) !== dueBefore) {
    const err = new Error(
      `Strict Full Settlement Rule: Partial settlement of ₹${amount} is rejected. The entire outstanding balance of ₹${dueBefore} must be settled in one single transaction.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Settle the entire balance in full
  const settledAmount = dueBefore;
  const updatedWallet = await ProviderWallet.findOneAndUpdate(
    { _id: wallet._id, commissionDue: { $gt: 0 } },
    {
      $set: {
        commissionDue: 0,
        lastTransactionAt: new Date()
      }
    },
    { new: true }
  );

  if (!updatedWallet) {
    const err = new Error('Commission was already settled or cleared concurrently.');
    err.statusCode = 409;
    throw err;
  }

  const txnRef = `TXN-CPAY-ADM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const transaction = await WalletTransaction.create({
    wallet: wallet._id,
    provider: providerId,
    transactionReference: txnRef,
    type: 'COMMISSION_PAYMENT',
    amount: settledAmount,
    balanceBefore: wallet.availableBalance,
    balanceAfter: wallet.availableBalance,
    commissionDueBefore: dueBefore,
    commissionDueAfter: 0,
    status: 'completed',
    paymentMethod: 'system_adjustment',
    description: `Admin full settlement of commission payable: ${reason.trim()}`,
    metadata: {
      operationType: 'ADMIN_FULL_SETTLEMENT',
      settledAmount,
      dueBefore,
      dueAfter: 0,
      actor: adminUserId,
      reason: reason.trim(),
      timestamp: new Date()
    }
  });

  return {
    success: true,
    message: `Commission of ₹${settledAmount} settled in full`,
    wallet: updatedWallet,
    transaction
  };
};

/**
 * Admin: Full Commission Waiver / Write-off
 * STRICT RULE: Waives 100% of current commission due. Cannot perform partial write-offs.
 */
const adminWaiveFullCommission = async (providerId, { reason, adminId, amount } = {}, adminUserId) => {
  const effectiveAdminId = adminUserId || adminId;
  if (!effectiveAdminId) {
    const err = new Error('Authorized Admin user ID is required.');
    err.statusCode = 401;
    throw err;
  }
  if (!reason || !reason.trim() || reason.trim().length < 5) {
    const err = new Error('A mandatory audited business reason (min 5 characters) is required for commission waiver.');
    err.statusCode = 400;
    throw err;
  }

  const wallet = await getOrCreateWallet(providerId);
  const dueBefore = wallet.commissionDue || 0;

  if (dueBefore <= 0) {
    const err = new Error('No outstanding commission payable to waive.');
    err.statusCode = 400;
    throw err;
  }

  if (amount !== undefined && amount !== null && Number(amount) !== dueBefore) {
    const err = new Error(
      `Strict Full Settlement Rule: Partial waiver of ₹${amount} is rejected. The entire outstanding balance of ₹${dueBefore} must be waived in one single transaction.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Waive the entire balance in full
  const waivedAmount = dueBefore;
  const updatedWallet = await ProviderWallet.findOneAndUpdate(
    { _id: wallet._id, commissionDue: { $gt: 0 } },
    {
      $set: {
        commissionDue: 0,
        lastTransactionAt: new Date()
      }
    },
    { new: true }
  );

  if (!updatedWallet) {
    const err = new Error('Commission was already waived or cleared concurrently.');
    err.statusCode = 409;
    throw err;
  }

  const txnRef = `TXN-CWAV-ADM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const transaction = await WalletTransaction.create({
    wallet: wallet._id,
    provider: providerId,
    transactionReference: txnRef,
    type: 'COMMISSION_WAIVER',
    amount: waivedAmount,
    balanceBefore: wallet.availableBalance,
    balanceAfter: wallet.availableBalance,
    commissionDueBefore: dueBefore,
    commissionDueAfter: 0,
    status: 'completed',
    paymentMethod: 'system_adjustment',
    description: `Admin authorized full waiver of commission payable: ${reason.trim()}`,
    metadata: {
      operationType: 'ADMIN_FULL_WAIVER',
      waivedAmount,
      dueBefore,
      dueAfter: 0,
      actor: adminUserId,
      reason: reason.trim(),
      timestamp: new Date()
    }
  });

  return {
    success: true,
    message: `Commission of ₹${waivedAmount} waived in full`,
    wallet: updatedWallet,
    transaction
  };
};

/**
 * Backward compatible router dispatch for admin adjust commission:
 * Strictly maps to full settlement or full waiver. Partial adjustments are prohibited.
 */
const adminAdjustCommission = async (providerId, { action, type, amount, reason, adminId } = {}, adminUserId) => {
  const effectiveAdminId = adminUserId || adminId;
  const chosenAction = action || type;
  if (chosenAction === 'settle') {
    return await adminSettleFullCommission(providerId, { reason, amount, adminId: effectiveAdminId }, effectiveAdminId);
  }
  if (chosenAction === 'waive') {
    return await adminWaiveFullCommission(providerId, { reason, amount, adminId: effectiveAdminId }, effectiveAdminId);
  }
  const err = new Error("Invalid commission action. Allowed operations are 'settle' (Full Settlement) and 'waive' (Full Waiver). Partial adjustments are strictly prohibited.");
  err.statusCode = 400;
  throw err;
};

module.exports = {
  getOrCreateWallet,
  getWalletSummary,
  getEarningsBreakdown,
  getTransactions,
  requestWithdrawal,
  getWithdrawals,
  creditBookingEarnings,
  tryAutoDeductCommissionFromWallet,
  toggleAutoDeductCommission,
  getPlatformCommissionConfig,
  getCommissionDetails,
  createPayCommissionOrder,
  cancelActiveCommissionOrder,
  cancelPayCommissionOrder: cancelActiveCommissionOrder,
  verifyAndSettleCommissionPayment,
  verifyCommissionPayment: verifyAndSettleCommissionPayment,
  reconcileCommissionPayment,
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

