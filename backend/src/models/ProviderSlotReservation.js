const mongoose = require('mongoose');

const providerSlotReservationSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: [true, 'Provider reference is required'],
      index: true
    },
    dateStr: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Date string (YYYY-MM-DD) is required'],
      index: true
    },
    timeSlot: {
      type: String, // e.g. '17:00', '17:05', '17:10' (5-min ticks)
      required: [true, 'Time slot tick is required']
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_progress'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

/**
 * STRICT UNIQUE COMPOUND INDEX:
 * Guarantees at MongoDB engine level that no two bookings can ever reserve the same provider, date, and tick.
 * Two simultaneous requests attempting to reserve overlapping ticks will trigger E11000 duplicate key error.
 */
providerSlotReservationSchema.index({ provider: 1, dateStr: 1, timeSlot: 1 }, { unique: true });

const ProviderSlotReservation = mongoose.model('ProviderSlotReservation', providerSlotReservationSchema);

module.exports = ProviderSlotReservation;
