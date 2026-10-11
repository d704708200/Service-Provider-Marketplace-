const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String, // HH:mm format, e.g. "09:00"
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm required)']
    },
    endTime: {
      type: String, // HH:mm format, e.g. "17:00"
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm required)']
    },
    maxBookings: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  { _id: true }
);

const availabilitySchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: [true, 'Provider reference is required']
    },
    dayOfWeek: {
      type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      required: [true, 'Day of week is required (0-6)'],
      min: 0,
      max: 6
    },
    slots: [timeSlotSchema],
    isAvailable: {
      type: Boolean,
      default: true
    },
    specificDateOverrides: [
      {
        date: { type: Date, required: true },
        isBlocked: { type: Boolean, default: true },
        reason: { type: String, trim: true, default: '' }
      }
    ]
  },
  {
    timestamps: true
  }
);

// One schedule entry per day of week per provider
availabilitySchema.index({ provider: 1, dayOfWeek: 1 }, { unique: true });

const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = Availability;
