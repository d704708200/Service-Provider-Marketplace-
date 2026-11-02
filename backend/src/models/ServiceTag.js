const mongoose = require('mongoose');

const serviceTagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      trim: true,
      maxlength: [100, 'Tag name cannot exceed 100 characters']
    },
    slug: {
      type: String,
      required: [true, 'Tag slug is required'],
      lowercase: true,
      trim: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
      index: true
    },
    subcategory: {
      name: {
        type: String,
        trim: true,
        default: 'General'
      },
      slug: {
        type: String,
        lowercase: true,
        trim: true,
        default: 'general'
      }
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    icon: {
      type: String,
      default: null
    },
    image: {
      type: String,
      default: null
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isCustomerVisible: {
      type: Boolean,
      default: true,
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for fast category discovery and provider queries
serviceTagSchema.index({ category: 1, isActive: 1, isCustomerVisible: 1, isArchived: 1 });
serviceTagSchema.index({ category: 1, 'subcategory.name': 1 });
serviceTagSchema.index({ slug: 1, category: 1 });

// Ensure uniqueness per category + subcategory + name (excluding archived tags)
serviceTagSchema.index(
  { category: 1, 'subcategory.name': 1, name: 1, isArchived: 1 },
  { unique: true }
);

const ServiceTag = mongoose.model('ServiceTag', serviceTagSchema);

module.exports = ServiceTag;

