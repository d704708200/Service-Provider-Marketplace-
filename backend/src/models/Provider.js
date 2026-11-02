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
    // Dynamic Service Tags selected by provider
    serviceTags: [
      {
        tag: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ServiceTag',
          required: true
        },
        approvalStatus: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'approved'
        },
        isActive: {
          type: Boolean,
          default: true
        },
        basePrice: {
          type: Number,
          min: 0,
          default: 0
        },
        pricingType: {
          type: String,
          enum: ['fixed', 'hourly', 'quote'],
          default: 'fixed'
        },
        experienceYears: {
          type: Number,
          default: 0
        },
        addedAt: {
          type: Date,
          default: Date.now
        },
        reviewedAt: {
          type: Date,
          default: null
        },
        rejectionReason: {
          type: String,
          trim: true,
          default: null
        }
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
    // Physical business address & GeoJSON coordinates for proximity matching
    businessAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      zipCode: { type: String, trim: true, default: '' }
    },
    location: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number] // [longitude, latitude]
      }
    },
    documents: [documentSchema],
    // KYC Document Fields
    aadhaarFrontImage: {
      type: String,
      default: null
    },
    aadhaarBackImage: {
      type: String,
      default: null
    },
    panFrontImage: {
      type: String,
      default: null
    },
    panBackImage: {
      type: String,
      default: null
    },
    kycStatus: {
      type: String,
      enum: ['pending', 'under_review', 'verified', 'rejected'],
      default: 'pending'
    },
    kycSubmittedAt: {
      type: Date,
      default: null
    },
    kycReviewedAt: {
      type: Date,
      default: null
    },
    kycReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    kycRejectionReason: {
      type: String,
      trim: true,
      default: null
    },
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
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

providerSchema.index({ verificationStatus: 1 });
providerSchema.index({ isAvailable: 1 });
providerSchema.index({ categories: 1 });
providerSchema.index({ 'serviceTags.tag': 1, 'serviceTags.isActive': 1, 'serviceTags.approvalStatus': 1 });
providerSchema.index({ isDeleted: 1 });
providerSchema.index({ 'rating.average': -1 });
providerSchema.index({ showInTopRated: 1, topRatedOrder: 1 });
providerSchema.index({ location: '2dsphere' }, { sparse: true });
providerSchema.index({ 'businessAddress.city': 1 });

const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;
