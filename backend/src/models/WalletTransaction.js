const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProviderWallet',
      required: true,
      index: true
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true
    },
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'booking_earning',               // Service earnings credited to wallet
        'commission_deduction',          // Platform commission deduction (legacy)
        'withdrawal',                    // Debit / Reserved for payout
        'withdrawal_refund',             // Refund on rejection of withdrawal
        'adjustment_credit',             // Admin manual adjustment (+)
        'adjustment_debit',              // Admin manual adjustment (-)
        'penalty',                       // Penalty deduction
        'CASH_BOOKING_COMMISSION_DUE',   // Platform commission due recorded on cash booking
        'COMMISSION_PAYMENT',            // Direct Razorpay settlement of outstanding commission
        'COMMISSION_ADJUSTMENT',         // Automatic deduction from eligible online earning (legacy)
        'COMMISSION_WALLET_AUTO_DEBIT',  // Automatic deduction from positive available wallet balance
        'COMMISSION_WAIVER',             // Explicit administrative write-off / waiver of entire commission
        'COMMISSION_REFUND'              // Commission reversal/refund where applicable
      ],
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    balanceBefore: {
      type: Number,
      default: 0
    },
    balanceAfter: {
      type: Number,
      required: true
    },
    commissionDueBefore: {
      type: Number,
      default: null
    },
    commissionDueAfter: {
      type: Number,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
      index: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true
    },
    withdrawalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WithdrawalRequest',
      default: null,
      index: true
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'cash', 'bank_transfer', 'upi', 'system_adjustment'],
      default: 'online'
    },
    description: {
      type: String,
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate earning/commission credits for the same booking under concurrent requests
walletTransactionSchema.index(
  { booking: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      booking: { $exists: true, $type: 'objectId' },
      type: { $in: ['booking_earning', 'commission_deduction', 'CASH_BOOKING_COMMISSION_DUE'] }
    }
  }
);

// Prevent duplicate settlement for the same Razorpay payment ID under concurrent requests or duplicate webhooks
walletTransactionSchema.index(
  { 'metadata.razorpayPaymentId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'metadata.razorpayPaymentId': { $exists: true, $type: 'string' }
    }
  }
);

// Prevent two different payment IDs from settling the same Razorpay order twice
walletTransactionSchema.index(
  { 'metadata.razorpayOrderId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'metadata.razorpayOrderId': { $exists: true, $type: 'string' },
      type: 'COMMISSION_PAYMENT'
    }
  }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);

