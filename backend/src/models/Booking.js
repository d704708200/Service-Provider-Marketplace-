const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required']
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      default: null // Can be null if instant broadcast to eligible providers initially
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service is required']
    },
    bookingMode: {
      type: String,
      enum: {
        values: ['instant', 'scheduled'],
        message: '{VALUE} is not a valid booking mode (instant or scheduled required)'
      },
      default: 'scheduled'
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected'],
        message: '{VALUE} is not a valid booking status'
      },
      default: 'pending'
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required']
    },
    scheduledTimeSlot: {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true }
    },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, trim: true, default: '' },
      zipCode: { type: String, trim: true, default: '' },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
      }
    },
    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 }
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet'],
      default: 'cash'
    },
    statusTimestamps: {
      acceptedAt: { type: Date, default: null },
      inProgressAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
      rejectedAt: { type: Date, default: null }
    },
    cancelledBy: {
      type: String,
      enum: ['customer', 'provider', 'admin', null],
      default: null
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null
    },
    candidateProviders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
      }
    ],
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ status: 1, bookingMode: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ 'address.location': '2dsphere' });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
