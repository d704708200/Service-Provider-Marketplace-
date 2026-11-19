const mongoose = require('mongoose');
const { CommissionLedger, Booking, Provider, ProviderWallet, WalletTransaction } = require('../models');
const { calculateBookingCommission } = require('../utils/commissionCalculator');

/**
 * Ensures or updates independent commission ledger records for a booking.
 * Idempotent: uses upsert with compound index { booking: 1, commissionType: 1 }.
 */
const recordBookingCommissions = async (bookingDocOrId, options = {}) => {
  const booking = typeof bookingDocOrId === 'string' || bookingDocOrId instanceof mongoose.Types.ObjectId
    ? await Booking.findById(bookingDocOrId).populate('provider')
    : bookingDocOrId;

  if (!booking) {
    return { success: false, message: 'Booking not found' };
  }

  const accounting = calculateBookingCommission(booking, options);
  const providerId = booking.provider?._id || booking.provider;
  const bookingRef = booking.bookingReference || `BK-${booking._id.toString().slice(-6).toUpperCase()}`;

  let providerName = '';
  if (booking.provider?.businessName) {
    providerName = booking.provider.businessName;
  } else if (providerId) {
    const prov = await Provider.findById(providerId).select('businessName');
    providerName = prov?.businessName || '';
  }

  // 1. Service Commission Record
  const serviceCommissionData = {
    booking: booking._id,
    bookingReference: bookingRef,
    provider: providerId,
    providerName,
    commissionType: 'service',
    eligibleAmount: accounting.originalServicePrice,
    appliedPercentage: accounting.serviceCommissionRate,
    calculatedAmount: accounting.serviceCommissionAmount,
    paymentMode: booking.paymentMethod || 'cash'
  };

  // Determine initial status for service commission
  let initialServiceStatus = 'CALCULATED';
  if (booking.status === 'completed') {
    if (booking.paymentMethod === 'online' && booking.paymentStatus === 'paid') {
      initialServiceStatus = 'DEDUCTED';
    } else if (booking.paymentMethod === 'cash') {
      initialServiceStatus = 'PENDING';
    }
  } else if (booking.status === 'cancelled') {
    initialServiceStatus = 'REVERSED';
  }

  const existingService = await CommissionLedger.findOne({ booking: booking._id, commissionType: 'service' });
  let serviceRecord;

  if (!existingService) {
    serviceRecord = await CommissionLedger.create({
      ...serviceCommissionData,
      deductedAmount: initialServiceStatus === 'DEDUCTED' ? accounting.serviceCommissionAmount : 0,
      status: initialServiceStatus,
      deductionTimestamp: initialServiceStatus === 'DEDUCTED' ? new Date() : null,
      transactionReference: options.transactionReference || null,
      auditTrail: [
        {
          action: 'CREATED',
          performedByRole: options.role || 'system',
          previousStatus: 'NOT_CALCULATED',
          newStatus: initialServiceStatus,
          reason: 'Initial booking commission calculation'
        }
      ]
    });
  } else {
    // Preserve existing deduction if already completed/deducted
    existingService.eligibleAmount = accounting.originalServicePrice;
    existingService.appliedPercentage = accounting.serviceCommissionRate;
    existingService.calculatedAmount = accounting.serviceCommissionAmount;
    existingService.providerName = providerName;
    if (existingService.status === 'NOT_CALCULATED') {
      existingService.status = initialServiceStatus;
    }
    await existingService.save();
    serviceRecord = existingService;
  }

  // 2. Labour Commission Record
  const hasApprovedLabour = accounting.approvedLabourCharge > 0 && accounting.labourCommissionRate > 0;
  const labourEligible = accounting.approvedLabourCharge;
  const labourCalculated = accounting.labourCommissionAmount;

  let initialLabourStatus = 'NOT_APPLICABLE';
  if (hasApprovedLabour) {
    if (booking.status === 'completed') {
      if (booking.paymentMethod === 'online' && booking.paymentStatus === 'paid') {
        initialLabourStatus = 'DEDUCTED';
      } else if (booking.paymentMethod === 'cash') {
        initialLabourStatus = 'PENDING';
      } else {
        initialLabourStatus = 'CALCULATED';
      }
    } else if (booking.status === 'cancelled') {
      initialLabourStatus = 'REVERSED';
    } else {
      initialLabourStatus = 'CALCULATED';
    }
  }

  const existingLabour = await CommissionLedger.findOne({ booking: booking._id, commissionType: 'labour' });
  let labourRecord;

  if (!existingLabour) {
    labourRecord = await CommissionLedger.create({
      booking: booking._id,
      bookingReference: bookingRef,
      provider: providerId,
      providerName,
      commissionType: 'labour',
      eligibleAmount: labourEligible,
      appliedPercentage: accounting.labourCommissionRate,
      calculatedAmount: labourCalculated,
      deductedAmount: initialLabourStatus === 'DEDUCTED' ? labourCalculated : 0,
      status: initialLabourStatus,
      paymentMode: booking.paymentMethod || 'cash',
      deductionTimestamp: initialLabourStatus === 'DEDUCTED' ? new Date() : null,
      transactionReference: options.transactionReference || null,
      auditTrail: [
        {
          action: 'CREATED',
          performedByRole: options.role || 'system',
          previousStatus: 'NOT_CALCULATED',
          newStatus: initialLabourStatus,
          reason: hasApprovedLabour ? 'Initial labour commission calculation' : 'No approved labour charge applicable'
        }
      ]
    });
  } else {
    existingLabour.eligibleAmount = labourEligible;
    existingLabour.appliedPercentage = accounting.labourCommissionRate;
    existingLabour.calculatedAmount = labourCalculated;
    existingLabour.providerName = providerName;
    if (existingLabour.status === 'NOT_CALCULATED' || (!hasApprovedLabour && existingLabour.status !== 'DEDUCTED')) {
      existingLabour.status = initialLabourStatus;
    }
    await existingLabour.save();
    labourRecord = existingLabour;
  }

  // Synchronize to Booking document
  await syncBookingCommissionFields(booking._id, serviceRecord, labourRecord);

  return {
    success: true,
    serviceCommission: serviceRecord,
    labourCommission: labourRecord
  };
};

/**
 * Syncs CommissionLedger states back to Booking.accounting
 */
const syncBookingCommissionFields = async (bookingId, serviceLedger, labourLedger) => {
  try {
    const s = serviceLedger || await CommissionLedger.findOne({ booking: bookingId, commissionType: 'service' });
    const l = labourLedger || await CommissionLedger.findOne({ booking: bookingId, commissionType: 'labour' });

    const updateFields = {};
    if (s) {
      updateFields['accounting.serviceCommission'] = {
        eligibleAmount: s.eligibleAmount,
        appliedPercentage: s.appliedPercentage,
        calculatedAmount: s.calculatedAmount,
        deductedAmount: s.deductedAmount,
        status: s.status,
        transactionReference: s.transactionReference,
        deductedAt: s.deductionTimestamp,
        failureReason: s.failureReason,
        reversalReference: s.reversalReference,
        reversedAt: s.reversedTimestamp
      };
      updateFields['serviceCommissionAmount'] = s.calculatedAmount;
    }

    if (l) {
      updateFields['accounting.labourCommission'] = {
        eligibleAmount: l.eligibleAmount,
        appliedPercentage: l.appliedPercentage,
        calculatedAmount: l.calculatedAmount,
        deductedAmount: l.deductedAmount,
        status: l.status,
        transactionReference: l.transactionReference,
        deductedAt: l.deductionTimestamp,
        failureReason: l.failureReason,
        reversalReference: l.reversalReference,
        reversedAt: l.reversedTimestamp
      };
      updateFields['labourCommissionAmount'] = l.calculatedAmount;
    }

    if (Object.keys(updateFields).length > 0) {
      await Booking.findByIdAndUpdate(bookingId, { $set: updateFields });
    }
  } catch (err) {
    console.warn('[SYNC_BOOKING_COMMISSION_WARN]', err.message);
  }
};

/**
 * ONLINE BOOKING: Confirm actual deduction of Service and Labour commissions.
 * Called immediately when walletTransaction 'booking_earning' is successfully persisted.
 */
const confirmOnlineCommissionDeduction = async (booking, walletTransaction) => {
  if (!booking || !walletTransaction) return;

  const accounting = calculateBookingCommission(booking);
  const now = new Date();
  const txnRef = walletTransaction.transactionReference || `TXN-ERN-${walletTransaction._id}`;
  const providerId = booking.provider?._id || booking.provider;
  const bookingRef = booking.bookingReference || `BK-${booking._id.toString().slice(-6).toUpperCase()}`;
  let providerName = booking.provider?.businessName || '';
  if (!providerName && providerId) {
    try {
      const pDoc = await Provider.findById(providerId).select('businessName');
      providerName = pDoc?.businessName || '';
    } catch (_) {}
  }

  // 1. Confirm Service Commission
  const serviceLedger = await CommissionLedger.findOneAndUpdate(
    { booking: booking._id, commissionType: 'service' },
    {
      $setOnInsert: {
        booking: booking._id,
        bookingReference: bookingRef,
        provider: providerId,
        providerName,
        commissionType: 'service'
      },
      $set: {
        eligibleAmount: accounting.originalServicePrice,
        appliedPercentage: accounting.serviceCommissionRate,
        calculatedAmount: accounting.serviceCommissionAmount,
        deductedAmount: accounting.serviceCommissionAmount,
        status: 'DEDUCTED',
        paymentMode: 'online',
        transactionReference: txnRef,
        walletTransaction: walletTransaction._id,
        deductionTimestamp: now
      },
      $push: {
        auditTrail: {
          action: 'DEDUCTED',
          performedByRole: 'system',
          previousStatus: 'CALCULATED',
          newStatus: 'DEDUCTED',
          reason: 'Online booking payout settled with platform commission retained at source',
          details: { transactionReference: txnRef, deductedAmount: accounting.serviceCommissionAmount }
        }
      }
    },
    { new: true, upsert: true }
  );

  // 2. Confirm Labour Commission (or mark NOT_APPLICABLE if zero)
  const isApprovedLabour = accounting.approvedLabourCharge > 0 && accounting.labourCommissionRate > 0;
  const labourCalculated = accounting.labourCommissionAmount;
  const labourStatus = isApprovedLabour ? 'DEDUCTED' : 'NOT_APPLICABLE';

  const labourLedger = await CommissionLedger.findOneAndUpdate(
    { booking: booking._id, commissionType: 'labour' },
    {
      $setOnInsert: {
        booking: booking._id,
        bookingReference: bookingRef,
        provider: providerId,
        providerName,
        commissionType: 'labour'
      },
      $set: {
        eligibleAmount: accounting.approvedLabourCharge,
        appliedPercentage: accounting.labourCommissionRate,
        calculatedAmount: labourCalculated,
        deductedAmount: isApprovedLabour ? labourCalculated : 0,
        status: labourStatus,
        paymentMode: 'online',
        transactionReference: isApprovedLabour ? txnRef : null,
        walletTransaction: isApprovedLabour ? walletTransaction._id : null,
        deductionTimestamp: isApprovedLabour ? now : null
      },
      $push: {
        auditTrail: {
          action: isApprovedLabour ? 'DEDUCTED' : 'CREATED',
          performedByRole: 'system',
          previousStatus: 'CALCULATED',
          newStatus: labourStatus,
          reason: isApprovedLabour
            ? 'Online booking approved labour commission retained at source'
            : 'No approved labour charges; commission not applicable',
          details: { transactionReference: txnRef, deductedAmount: isApprovedLabour ? labourCalculated : 0 }
        }
      }
    },
    { new: true, upsert: true }
  );

  await syncBookingCommissionFields(booking._id, serviceLedger, labourLedger);

  return { serviceLedger, labourLedger };
};

/**
 * CASH BOOKING: Record commission liabilities as PENDING.
 * Crucial Rule: A cash booking completion alone does NOT mean commissions are deducted.
 */
const recordCashCommissionLiability = async (booking, walletTransaction) => {
  if (!booking) return;

  const accounting = calculateBookingCommission(booking);
  const txnRef = walletTransaction?.transactionReference || `TXN-CDUE-${booking._id.toString().slice(-6)}`;
  const providerId = booking.provider?._id || booking.provider;
  const bookingRef = booking.bookingReference || `BK-${booking._id.toString().slice(-6).toUpperCase()}`;
  let providerName = booking.provider?.businessName || '';
  if (!providerName && providerId) {
    try {
      const pDoc = await Provider.findById(providerId).select('businessName');
      providerName = pDoc?.businessName || '';
    } catch (_) {}
  }

  // 1. Service Commission -> PENDING
  const serviceLedger = await CommissionLedger.findOneAndUpdate(
    { booking: booking._id, commissionType: 'service' },
    {
      $setOnInsert: {
        booking: booking._id,
        bookingReference: bookingRef,
        provider: providerId,
        providerName,
        commissionType: 'service'
      },
      $set: {
        eligibleAmount: accounting.originalServicePrice,
        appliedPercentage: accounting.serviceCommissionRate,
        calculatedAmount: accounting.serviceCommissionAmount,
        deductedAmount: 0,
        status: 'PENDING',
        paymentMode: 'cash',
        transactionReference: txnRef,
        walletTransaction: walletTransaction?._id || null,
        deductionTimestamp: null
      },
      $push: {
        auditTrail: {
          action: 'SET_PENDING',
          performedByRole: 'system',
          previousStatus: 'CALCULATED',
          newStatus: 'PENDING',
          reason: 'Cash booking completed. Provider collected direct cash; commission liability is outstanding.',
          details: { transactionReference: txnRef, outstandingAmount: accounting.serviceCommissionAmount }
        }
      }
    },
    { new: true, upsert: true }
  );

  // 2. Labour Commission -> PENDING (or NOT_APPLICABLE if 0)
  const isApprovedLabour = accounting.approvedLabourCharge > 0 && accounting.labourCommissionRate > 0;
  const labourCalculated = accounting.labourCommissionAmount;
  const labourStatus = isApprovedLabour ? 'PENDING' : 'NOT_APPLICABLE';

  const labourLedger = await CommissionLedger.findOneAndUpdate(
    { booking: booking._id, commissionType: 'labour' },
    {
      $setOnInsert: {
        booking: booking._id,
        bookingReference: bookingRef,
        provider: providerId,
        providerName,
        commissionType: 'labour'
      },
      $set: {
        eligibleAmount: accounting.approvedLabourCharge,
        appliedPercentage: accounting.labourCommissionRate,
        calculatedAmount: labourCalculated,
        deductedAmount: 0,
        status: labourStatus,
        paymentMode: 'cash',
        transactionReference: isApprovedLabour ? txnRef : null,
        walletTransaction: isApprovedLabour ? walletTransaction?._id : null,
        deductionTimestamp: null
      },
      $push: {
        auditTrail: {
          action: isApprovedLabour ? 'SET_PENDING' : 'CREATED',
          performedByRole: 'system',
          previousStatus: 'CALCULATED',
          newStatus: labourStatus,
          reason: isApprovedLabour
            ? 'Cash booking completed. Labour commission liability is outstanding.'
            : 'No approved labour charges; commission not applicable',
          details: { transactionReference: txnRef, outstandingAmount: isApprovedLabour ? labourCalculated : 0 }
        }
      }
    },
    { new: true, upsert: true }
  );

  await syncBookingCommissionFields(booking._id, serviceLedger, labourLedger);

  return { serviceLedger, labourLedger };
};

/**
 * CASH COMMISSION RECOVERY:
 * When cash commission is recovered via Razorpay, auto-debit, or admin settlement,
 * transitions oldest pending commission ledger records to DEDUCTED.
 */
const applyCashCommissionRecovery = async (providerId, recoveredAmount, options = {}) => {
  if (!providerId || !recoveredAmount || recoveredAmount <= 0) return { updatedCount: 0 };

  let remaining = Number(recoveredAmount);
  const txnRef = options.transactionReference || `TXN-REC-${Date.now().toString().slice(-6)}`;
  const now = new Date();

  // Find all pending commission ledger entries for this provider, FIFO
  const pendingEntries = await CommissionLedger.find({
    provider: providerId,
    status: 'PENDING'
  }).sort({ createdAt: 1 });

  let updatedCount = 0;

  for (const entry of pendingEntries) {
    if (remaining <= 0) break;

    const needed = Math.max(0, entry.calculatedAmount - entry.deductedAmount);
    if (needed <= 0) {
      entry.status = 'DEDUCTED';
      await entry.save();
      continue;
    }

    if (remaining >= needed) {
      // Fully covered
      entry.deductedAmount = entry.calculatedAmount;
      entry.status = 'DEDUCTED';
      entry.deductionTimestamp = now;
      entry.transactionReference = txnRef;
      entry.auditTrail.push({
        action: 'DEDUCTED',
        performedByRole: options.role || 'system',
        previousStatus: 'PENDING',
        newStatus: 'DEDUCTED',
        reason: options.reason || 'Cash commission recovered and settled via confirmed financial transaction',
        details: { recoveredAmount: needed, transactionReference: txnRef }
      });
      await entry.save();
      await syncBookingCommissionFields(entry.booking);
      remaining -= needed;
      updatedCount++;
    } else {
      // Partially covered
      entry.deductedAmount += remaining;
      entry.auditTrail.push({
        action: 'ADJUSTED',
        performedByRole: options.role || 'system',
        previousStatus: 'PENDING',
        newStatus: 'PENDING',
        reason: `Partial commission recovery of ₹${remaining}`,
        details: { recoveredAmount: remaining, transactionReference: txnRef }
      });
      await entry.save();
      await syncBookingCommissionFields(entry.booking);
      remaining = 0;
      updatedCount++;
    }
  }

  return { updatedCount, remainingUnallocated: remaining };
};

/**
 * REVERSAL / REFUND:
 * When a booking is cancelled or refunded, reverses or refunds commissions.
 */
const reverseOrRefundBookingCommissions = async (bookingId, options = {}) => {
  const entries = await CommissionLedger.find({ booking: bookingId });
  const isRefund = Boolean(options.isRefund);
  const newStatus = isRefund ? 'REFUNDED' : 'REVERSED';
  const now = new Date();
  const ref = options.reference || `REF-${Date.now().toString().slice(-6)}`;

  for (const entry of entries) {
    if (['DEDUCTED', 'PENDING', 'CALCULATED'].includes(entry.status)) {
      const prev = entry.status;
      entry.status = newStatus;
      if (isRefund) {
        entry.refundReference = ref;
      } else {
        entry.reversalReference = ref;
        entry.reversalReason = options.reason || 'Booking cancelled';
        entry.reversedTimestamp = now;
      }
      entry.auditTrail.push({
        action: isRefund ? 'REFUNDED' : 'REVERSED',
        performedByRole: options.role || 'admin',
        previousStatus: prev,
        newStatus,
        reason: options.reason || (isRefund ? 'Customer refund processed' : 'Booking cancellation reversal'),
        details: { reference: ref }
      });
      await entry.save();
    }
  }

  await syncBookingCommissionFields(bookingId);
  return { success: true };
};

/**
 * Mark commission deduction as failed
 */
const markCommissionFailed = async (bookingId, commissionType, reason) => {
  const entry = await CommissionLedger.findOne({ booking: bookingId, commissionType });
  if (entry) {
    const prev = entry.status;
    entry.status = 'FAILED';
    entry.failureReason = reason || 'Commission deduction failed';
    entry.auditTrail.push({
      action: 'FAILED',
      performedByRole: 'system',
      previousStatus: prev,
      newStatus: 'FAILED',
      reason: reason || 'Commission deduction failed'
    });
    await entry.save();
    await syncBookingCommissionFields(bookingId);
  }
};

/**
 * ADMIN ADJUSTMENT:
 * Audited manual adjustment or reversal with strict validation (no fake DEDUCTED bypass).
 */
const adminAdjustCommissionLedger = async (ledgerId, { newStatus, reason, adminUserId }) => {
  if (!reason || String(reason).trim().length < 5) {
    const err = new Error('A mandatory audit reason (minimum 5 characters) is required for commission adjustments');
    err.statusCode = 400;
    throw err;
  }

  const validStatuses = ['REVERSED', 'REFUNDED', 'NOT_APPLICABLE', 'PENDING'];
  if (!validStatuses.includes(newStatus)) {
    const err = new Error(`Invalid status transition to '${newStatus}'. Manual adjustments cannot bypass financial ledger verification to mark DEDUCTED.`);
    err.statusCode = 400;
    throw err;
  }

  const entry = await CommissionLedger.findById(ledgerId);
  if (!entry) {
    const err = new Error('Commission ledger transaction not found');
    err.statusCode = 404;
    throw err;
  }

  const prev = entry.status;
  entry.status = newStatus;
  entry.reversalReason = reason.trim();
  entry.auditTrail.push({
    action: newStatus === 'REVERSED' ? 'REVERSED' : (newStatus === 'REFUNDED' ? 'REFUNDED' : 'ADJUSTED'),
    performedBy: adminUserId,
    performedByRole: 'admin',
    previousStatus: prev,
    newStatus,
    reason: reason.trim(),
    timestamp: new Date()
  });

  await entry.save();
  await syncBookingCommissionFields(entry.booking);

  return entry;
};

/**
 * DASHBOARD STATS:
 * Aggregates live KPI statistics from the CommissionLedger.
 */
const getCommissionDashboardStats = async (filters = {}) => {
  const matchFilter = {};

  if (filters.from || filters.to) {
    matchFilter.createdAt = {};
    if (filters.from) matchFilter.createdAt.$gte = new Date(filters.from);
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      matchFilter.createdAt.$lte = toDate;
    }
  }

  if (filters.providerId) {
    matchFilter.provider = new mongoose.Types.ObjectId(filters.providerId);
  }

  if (filters.paymentMode && filters.paymentMode !== 'all') {
    matchFilter.paymentMode = filters.paymentMode;
  }

  const stats = await CommissionLedger.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        // Service Commission Metrics
        totalServiceCalculated: {
          $sum: { $cond: [{ $eq: ['$commissionType', 'service'] }, '$calculatedAmount', 0] }
        },
        totalServiceDeducted: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$commissionType', 'service'] }, { $eq: ['$status', 'DEDUCTED'] }] },
              '$deductedAmount',
              0
            ]
          }
        },
        // Labour Commission Metrics
        totalLabourCalculated: {
          $sum: { $cond: [{ $eq: ['$commissionType', 'labour'] }, '$calculatedAmount', 0] }
        },
        totalLabourDeducted: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$commissionType', 'labour'] }, { $eq: ['$status', 'DEDUCTED'] }] },
              '$deductedAmount',
              0
            ]
          }
        },
        // Status Counts & Amounts
        totalPendingCommission: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'PENDING'] },
              { $subtract: ['$calculatedAmount', '$deductedAmount'] },
              0
            ]
          }
        },
        totalFailedCommission: {
          $sum: {
            $cond: [{ $eq: ['$status', 'FAILED'] }, '$calculatedAmount', 0]
          }
        },
        totalReversedCommission: {
          $sum: {
            $cond: [{ $in: ['$status', ['REVERSED', 'REFUNDED']] }, '$calculatedAmount', 0]
          }
        },
        countDeducted: {
          $sum: { $cond: [{ $eq: ['$status', 'DEDUCTED'] }, 1, 0] }
        },
        countPending: {
          $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
        },
        countFailed: {
          $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
        },
        countReversed: {
          $sum: { $cond: [{ $in: ['$status', ['REVERSED', 'REFUNDED']] }, 1, 0] }
        }
      }
    }
  ]);

  const res = stats[0] || {
    totalServiceCalculated: 0,
    totalServiceDeducted: 0,
    totalLabourCalculated: 0,
    totalLabourDeducted: 0,
    totalPendingCommission: 0,
    totalFailedCommission: 0,
    totalReversedCommission: 0,
    countDeducted: 0,
    countPending: 0,
    countFailed: 0,
    countReversed: 0
  };

  // Outstanding Provider Commission Liabilities from ProviderWallets
  const walletLiabilities = await ProviderWallet.aggregate([
    {
      $group: {
        _id: null,
        totalOutstandingLiability: { $sum: '$commissionDue' },
        providersWithDueCount: {
          $sum: { $cond: [{ $gt: ['$commissionDue', 0] }, 1, 0] }
        }
      }
    }
  ]);

  return {
    kpis: {
      totalServiceCalculated: Math.round(res.totalServiceCalculated * 100) / 100,
      totalServiceDeducted: Math.round(res.totalServiceDeducted * 100) / 100,
      totalLabourCalculated: Math.round(res.totalLabourCalculated * 100) / 100,
      totalLabourDeducted: Math.round(res.totalLabourDeducted * 100) / 100,
      totalPendingCommission: Math.round(res.totalPendingCommission * 100) / 100,
      totalFailedCommission: Math.round(res.totalFailedCommission * 100) / 100,
      totalReversedCommission: Math.round(res.totalReversedCommission * 100) / 100
    },
    counts: {
      deducted: res.countDeducted,
      pending: res.countPending,
      failed: res.countFailed,
      reversed: res.countReversed
    },
    walletLiabilities: {
      totalOutstanding: walletLiabilities[0]?.totalOutstandingLiability || 0,
      providersWithDueCount: walletLiabilities[0]?.providersWithDueCount || 0
    }
  };
};

/**
 * LIST TRANSACTIONS:
 * Filtered, paginated list of CommissionLedger entries.
 */
const listCommissionLedgerTransactions = async (query = {}) => {
  const {
    search,
    commissionType = 'all',
    status = 'all',
    paymentMode = 'all',
    from,
    to,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = query;

  const matchFilter = {};

  if (commissionType && commissionType !== 'all') {
    matchFilter.commissionType = commissionType;
  }

  if (status && status !== 'all') {
    matchFilter.status = status;
  }

  if (paymentMode && paymentMode !== 'all') {
    matchFilter.paymentMode = paymentMode;
  }

  if (from || to) {
    matchFilter.createdAt = {};
    if (from) matchFilter.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      matchFilter.createdAt.$lte = toDate;
    }
  }

  if (search) {
    matchFilter.$or = [
      { bookingReference: { $regex: search, $options: 'i' } },
      { providerName: { $regex: search, $options: 'i' } },
      { transactionReference: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [transactions, total] = await Promise.all([
    CommissionLedger.find(matchFilter)
      .populate({
        path: 'provider',
        select: 'businessName phone user',
        populate: { path: 'user', select: 'name email phone' }
      })
      .populate({
        path: 'booking',
        select: 'bookingReference status paymentStatus pricing service spareParts createdAt',
        populate: { path: 'service', select: 'name' }
      })
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CommissionLedger.countDocuments(matchFilter)
  ]);

  return {
    transactions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
};

/**
 * BOOKING COMMISSION DETAILS:
 * Returns dedicated breakdown for a specific booking.
 */
const getBookingCommissionBreakdown = async (bookingId) => {
  const booking = await Booking.findById(bookingId)
    .populate('provider', 'businessName phone')
    .populate('service', 'name')
    .lean();

  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  const accounting = calculateBookingCommission(booking);
  const ledgerEntries = await CommissionLedger.find({ booking: bookingId }).lean();

  const serviceEntry = ledgerEntries.find(e => e.commissionType === 'service') || null;
  const labourEntry = ledgerEntries.find(e => e.commissionType === 'labour') || null;

  return {
    bookingId: booking._id,
    bookingReference: booking.bookingReference,
    serviceName: booking.service?.name || 'Service',
    provider: booking.provider,
    paymentMethod: booking.paymentMethod,
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.status,
    accounting,
    serviceCommission: serviceEntry ? {
      eligibleAmount: serviceEntry.eligibleAmount,
      appliedPercentage: serviceEntry.appliedPercentage,
      calculatedAmount: serviceEntry.calculatedAmount,
      deductedAmount: serviceEntry.deductedAmount,
      status: serviceEntry.status,
      transactionReference: serviceEntry.transactionReference,
      deductionTimestamp: serviceEntry.deductionTimestamp,
      failureReason: serviceEntry.failureReason,
      reversalReference: serviceEntry.reversalReference,
      auditTrail: serviceEntry.auditTrail
    } : {
      eligibleAmount: accounting.originalServicePrice,
      appliedPercentage: accounting.serviceCommissionRate,
      calculatedAmount: accounting.serviceCommissionAmount,
      deductedAmount: 0,
      status: 'CALCULATED',
      transactionReference: null,
      deductionTimestamp: null
    },
    labourCommission: labourEntry ? {
      eligibleAmount: labourEntry.eligibleAmount,
      appliedPercentage: labourEntry.appliedPercentage,
      calculatedAmount: labourEntry.calculatedAmount,
      deductedAmount: labourEntry.deductedAmount,
      status: labourEntry.status,
      transactionReference: labourEntry.transactionReference,
      deductionTimestamp: labourEntry.deductionTimestamp,
      failureReason: labourEntry.failureReason,
      reversalReference: labourEntry.reversalReference,
      auditTrail: labourEntry.auditTrail
    } : {
      eligibleAmount: accounting.approvedLabourCharge,
      appliedPercentage: accounting.labourCommissionRate,
      calculatedAmount: accounting.labourCommissionAmount,
      deductedAmount: 0,
      status: accounting.approvedLabourCharge > 0 ? 'CALCULATED' : 'NOT_APPLICABLE',
      transactionReference: null,
      deductionTimestamp: null
    },
    summary: {
      totalPlatformCommission: accounting.totalPlatformCommission,
      providerGrossEarnings: accounting.totalCustomerPayable,
      providerNetPayable: accounting.providerNetEarning,
      outstandingCommission: (serviceEntry?.status === 'PENDING' ? serviceEntry.calculatedAmount : 0) +
        (labourEntry?.status === 'PENDING' ? labourEntry.calculatedAmount : 0)
    }
  };
};

/**
 * CSV EXPORT GENERATOR
 */
const exportCommissionLedgerCsv = async (query = {}) => {
  const result = await listCommissionLedgerTransactions({ ...query, page: 1, limit: 5000 });
  const rows = result.transactions;

  const headers = [
    'Transaction Reference',
    'Booking Reference',
    'Provider Name',
    'Commission Type',
    'Eligible Amount (INR)',
    'Applied Percentage (%)',
    'Calculated Amount (INR)',
    'Deducted Amount (INR)',
    'Status',
    'Payment Mode',
    'Deduction Date',
    'Created Date'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines = [headers.join(',')];

  rows.forEach(r => {
    csvLines.push([
      escapeCsv(r.transactionReference || 'N/A'),
      escapeCsv(r.bookingReference),
      escapeCsv(r.providerName || r.provider?.businessName || 'N/A'),
      escapeCsv(r.commissionType?.toUpperCase()),
      escapeCsv(r.eligibleAmount?.toFixed(2)),
      escapeCsv(r.appliedPercentage),
      escapeCsv(r.calculatedAmount?.toFixed(2)),
      escapeCsv(r.deductedAmount?.toFixed(2)),
      escapeCsv(r.status),
      escapeCsv(r.paymentMode || 'N/A'),
      escapeCsv(r.deductionTimestamp ? new Date(r.deductionTimestamp).toISOString() : 'N/A'),
      escapeCsv(new Date(r.createdAt).toISOString())
    ].join(','));
  });

  return csvLines.join('\n');
};

module.exports = {
  recordBookingCommissions,
  confirmOnlineCommissionDeduction,
  recordCashCommissionLiability,
  applyCashCommissionRecovery,
  reverseOrRefundBookingCommissions,
  markCommissionFailed,
  adminAdjustCommissionLedger,
  getCommissionDashboardStats,
  listCommissionLedgerTransactions,
  getBookingCommissionBreakdown,
  exportCommissionLedgerCsv,
  syncBookingCommissionFields
};
