const mongoose = require('mongoose');

const allowedRadiusOptionSchema = new mongoose.Schema(
  {
    km: {
      type: Number,
      required: [true, 'Radius in kilometres is required'],
      min: [0.1, 'Radius must be greater than 0 KM']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { _id: true }
);

const serviceRadiusConfigSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
      unique: true,
      index: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null
    },
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true
    },
    allowedRadii: {
      type: [allowedRadiusOptionSchema],
      validate: {
        validator: function (radii) {
          return Array.isArray(radii) && radii.length > 0;
        },
        message: 'At least one radius option must be defined'
      }
    },
    maxRadiusKm: {
      type: Number,
      required: [true, 'Maximum permitted radius in kilometres is required'],
      min: [0.1, 'Maximum radius must be greater than 0 KM']
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save validation: Ensure all allowed radius options do not exceed maxRadiusKm and are unique
serviceRadiusConfigSchema.pre('validate', function (next) {
  if (this.allowedRadii && this.allowedRadii.length > 0) {
    // Sort ascending by km for consistent display
    this.allowedRadii.sort((a, b) => a.km - b.km);

    // Validate that no option exceeds maxRadiusKm
    if (this.maxRadiusKm > 0) {
      for (const opt of this.allowedRadii) {
        if (opt.km > this.maxRadiusKm) {
          return next(
            new Error(
              `Allowed radius option ${opt.km} KM cannot exceed maximum permitted radius of ${this.maxRadiusKm} KM`
            )
          );
        }
      }
    }
  }
  next();
});

const ServiceRadiusConfig = mongoose.model('ServiceRadiusConfig', serviceRadiusConfigSchema);

module.exports = ServiceRadiusConfig;

