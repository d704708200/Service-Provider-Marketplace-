const mongoose = require('mongoose');

const commissionAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['CREATED', 'DEDUCTED', 'SET_PENDING', 'FAILED', 'REVERSED', 'REFUNDED', 'ADJUSTED', 'WAIVED']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    performedByRole: {
      type: String,
      enum: ['system', 'admin', 'provider', 'customer'],
      default: 'system'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    previousStatus: {
      type: String,
      default: null
    },
    newStatus: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      default: ''
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const commissionLedgerSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    bookingReference: {
      type: String,
      required: true,
      index: true
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true
    },
    providerName: {
      type: String,
      default: '',
      trim: true
    },
    commissionType: {
      type: String,
      enum: ['service', 'labour'],
      required: true,
      index: true
    },
    eligibleAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    appliedPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    calculatedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    deductedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: [
        'NOT_CALCULATED',
        'CALCULATED',
        'PENDING',
        'DEDUCTED',
        'FAILED',
        'REVERSED',
        'REFUNDED',
        'NOT_APPLICABLE'
      ],
      default: 'NOT_CALCULATED',
      index: true
    },
    paymentMode: {
      type: String,
      enum: ['online', 'cash', 'wallet', 'other', null],
      default: null,
      index: true
    },
    transactionReference: {
      type: String,
      default: null,
      index: true
    },
    walletTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      default: null
    },
    deductionTimestamp: {
      type: Date,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    },
    reversalReference: {
      type: String,
      default: null
    },
    reversalReason: {
      type: String,
      default: null
    },
    reversedTimestamp: {
      type: Date,
      default: null
    },
    refundReference: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    auditTrail: [commissionAuditSchema]
  },
  {
    timestamps: true
  }
);

// Compound Unique Index: One independent ledger record per booking per commission type (idempotency guard)
commissionLedgerSchema.index({ booking: 1, commissionType: 1 }, { unique: true });

// Query optimization indexes
commissionLedgerSchema.index({ provider: 1, status: 1 });
commissionLedgerSchema.index({ status: 1, createdAt: -1 });
commissionLedgerSchema.index({ commissionType: 1, status: 1 });
commissionLedgerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CommissionLedger', commissionLedgerSchema);

