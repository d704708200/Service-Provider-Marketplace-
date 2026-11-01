const mongoose = require('mongoose');

const homeBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
      maxlength: [120, 'Banner title cannot exceed 120 characters']
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [200, 'Banner subtitle cannot exceed 200 characters'],
      default: ''
    },
    imageUrl: {
      type: String,
      required: [true, 'Banner image URL is required'],
      trim: true
    },
    publicId: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    destinationType: {
      type: String,
      enum: ['category', 'service', 'search', 'offer', 'screen', 'url', 'none'],
      default: 'none'
    },
    destinationId: {
      type: String,
      trim: true,
      default: ''
    },
    destinationMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
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

// Compound index for optimal querying of active customer banners in order
homeBannerSchema.index({ isActive: 1, displayOrder: 1, startDate: 1, endDate: 1 });

const HomeBanner = mongoose.model('HomeBanner', homeBannerSchema);

module.exports = HomeBanner;

