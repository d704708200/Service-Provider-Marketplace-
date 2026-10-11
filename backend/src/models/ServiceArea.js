const mongoose = require('mongoose');

const serviceAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service area name is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCodes: [
      {
        type: String,
        trim: true
      }
    ],
    // GeoJSON Polygon for service boundary or Point with radius
    polygon: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon'
      },
      coordinates: {
        type: [[[Number]]] // [[[lng, lat], [lng, lat], ...]]
      }
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

serviceAreaSchema.index({ city: 1, isActive: 1 });
serviceAreaSchema.index({ zipCodes: 1 });
serviceAreaSchema.index({ polygon: '2dsphere' });

const ServiceArea = mongoose.model('ServiceArea', serviceAreaSchema);

module.exports = ServiceArea;
