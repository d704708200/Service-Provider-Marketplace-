const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    effectiveFrom: {
      type: Date,
      default: Date.now
    },
    history: [
      {
        previousValue: {
          type: mongoose.Schema.Types.Mixed
        },
        newValue: {
          type: mongoose.Schema.Types.Mixed
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        changedByName: {
          type: String,
          default: 'Administrator'
        },
        reason: {
          type: String,
          required: true,
          trim: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);

