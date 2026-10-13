const mongoose = require('mongoose');

const bannerConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'home_first_service_offer',
      trim: true
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    badgeText: {
      type: String,
      required: true,
      trim: true,
      default: 'FIRST SERVICE ORDER'
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Get ₹100 OFF'
    },
    subtitle: {
      type: String,
      trim: true,
      default: 'Book your first service today'
    },
    discountAmount: {
      type: Number,
      min: [0, 'Discount amount cannot be negative'],
      default: 100
    },
    currency: {
      type: String,
      trim: true,
      default: '₹'
    },
    buttonLabel: {
      type: String,
      trim: true,
      default: 'Book Now'
    },
    targetRoute: {
      type: String,
      trim: true,
      default: 'SearchTab'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

bannerConfigSchema.index({ key: 1 }, { unique: true });

const BannerConfig = mongoose.model('BannerConfig', bannerConfigSchema);

module.exports = BannerConfig;
