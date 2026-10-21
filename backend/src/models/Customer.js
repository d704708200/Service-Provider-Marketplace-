const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Home',
      trim: true
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
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
    zipCode: {
      type: String,
      trim: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Associated User ID is required'],
      unique: true
    },
    addresses: [addressSchema],
    defaultPaymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet', 'online'],
      default: 'cash'
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true }
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

customerSchema.index({ 'addresses.location': '2dsphere' });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
