const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true
    },
    documentUrl: {
      type: String,
      required: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    reviewNote: {
      type: String,
      trim: true,
      default: ''
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  { _id: true }
);

const providerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Associated User ID is required'],
      unique: true
    },
    businessName: {
      type: String,
      trim: true,
      default: ''
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      trim: true
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      }
    ],
    // Legacy compatibility fields
    category: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined
    },
    serviceCategories: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ],
    specialization: {
      type: String,
      trim: true,
      default: undefined
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience cannot be negative'],
      default: 0
    },
    serviceAreas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceArea'
      }
    ],
    documents: [documentSchema],
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    rating: {
      average: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
      },
      count: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    completedBookingsCount: {
      type: Number,
      min: 0,
      default: 0
    },
    showInTopRated: {
      type: Boolean,
      default: false
    },
    topRatedOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

providerSchema.index({ verificationStatus: 1 });
providerSchema.index({ isAvailable: 1 });
providerSchema.index({ categories: 1 });
providerSchema.index({ 'rating.average': -1 });
providerSchema.index({ showInTopRated: 1, topRatedOrder: 1 });

const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;
