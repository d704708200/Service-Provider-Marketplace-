const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    token: {
      type: String,
      required: [true, 'Device push token is required'],
      unique: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['customer', 'provider', 'admin'],
      required: [true, 'Role is required']
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'android'
    },
    deviceModel: {
      type: String,
      default: null,
      trim: true
    },
    appVersion: {
      type: String,
      default: null,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying active tokens for a specific user
deviceTokenSchema.index({ user: 1, isActive: 1 });
deviceTokenSchema.index({ role: 1, isActive: 1 });

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

module.exports = DeviceToken;
