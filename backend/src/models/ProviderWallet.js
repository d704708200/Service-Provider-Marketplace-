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

