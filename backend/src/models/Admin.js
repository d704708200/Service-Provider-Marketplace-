const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Associated User ID is required'],
      unique: true
    },
    permissions: {
      type: [String],
      enum: [
        'manage_users',
        'manage_providers',
        'manage_categories',
        'manage_services',
        'manage_bookings',
        'manage_reviews',
        'manage_reports',
        'super_admin'
      ],
      default: ['manage_users', 'manage_providers', 'manage_categories', 'manage_services', 'manage_bookings']
    },
    department: {
      type: String,
      trim: true,
      default: 'Operations'
    }
  },
  {
    timestamps: true
  }
);

adminSchema.index({ permissions: 1 });

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
