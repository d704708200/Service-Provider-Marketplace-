const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: [150, 'Service name cannot exceed 150 characters']
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required']
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      default: null // Null indicates a platform-level standard service template
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    price: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Price must be non-negative']
    },
    priceType: {
      type: String,
      enum: ['fixed', 'hourly', 'quote'],
      default: 'fixed'
    },
    estimatedDurationMinutes: {
      type: Number,
      min: [1, 'Duration must be at least 1 minute'],
      default: 60
    },
    image: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ provider: 1, isActive: 1 });
serviceSchema.index({ price: 1 });

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
