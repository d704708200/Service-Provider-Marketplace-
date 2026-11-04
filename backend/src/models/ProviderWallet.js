const mongoose = require('mongoose');

const providerWalletSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      unique: true,
      index: true
    },
    availableBalance: {
      type: Number,
      default: 0
    },
    pendingBalance: {
      type: Number,
      default: 0
    },
    pendingWithdrawal: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    commissionDue: {
      type: Number,
      default: 0,
      min: 0
    },
    autoCommissionAdjustment: {
      type: Boolean,
      default: false
    },
    autoDeductCommissionFromWallet: {
      type: Boolean,
      default: false
    },
    lastAutoDeductionAt: {
      type: Date,
      default: null
    },
    reconciliationFlagged: {
      type: Boolean,
      default: false
    },
    reconciliationReason: {
      type: String,
      default: null
    },
    activeCommissionOrder: {
      orderId: { type: String, default: null },
      amount: { type: Number, default: 0 },
      amountInPaise: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      createdAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      status: {
        type: String,
        enum: ['none', 'pending', 'settled', 'expired', 'failed', 'cancelled'],
        default: 'none'
      },
      paymentId: { type: String, default: null },
      settledAt: { type: Date, default: null }
    },
    currency: {
      type: String,
      default: 'INR'
    },
    savedPaymentMethods: {
      upi: {
        upiId: { type: String, trim: true },
        name: { type: String, trim: true },
        isDefault: { type: Boolean, default: false }
      },
      bank: {
        accountHolderName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true, uppercase: true },
        bankName: { type: String, trim: true },
        branch: { type: String, trim: true },
        isDefault: { type: Boolean, default: false }
      }
    },
    status: {
      type: String,
      enum: ['active', 'frozen', 'suspended'],
      default: 'active'
    },
    lastTransactionAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ProviderWallet', providerWalletSchema);

