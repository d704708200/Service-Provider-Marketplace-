const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    requestReference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProviderWallet',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    payoutMethod: {
      type: String,
      enum: ['bank_transfer', 'upi'],
      required: true
    },
    payoutDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      upiId: { type: String, trim: true }
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'processing', 'paid', 'rejected'],
      default: 'requested',
      index: true
    },
    transactionReference: {
      type: String,
      trim: true
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    adminNote: {
      type: String,
      trim: true
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processedAt: {
      type: Date
    },
    paidAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

