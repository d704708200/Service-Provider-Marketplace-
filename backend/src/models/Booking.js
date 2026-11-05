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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true
    },
    subcategory: {
      type: String,
      trim: true,
      default: null
    },
    tag: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceTag',
      default: null,
      index: true
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
      required: [
        function () {
          return this.bookingMode === 'scheduled';
        },
        'Scheduled date is required for scheduled bookings'
      ]
    },
    scheduledTimeSlot: {
      startTime: {
        type: String,
        required: [
          function () {
            return this.bookingMode === 'scheduled';
          },
          'Start time is required for scheduled bookings'
        ]
      },
      endTime: {
        type: String,
        required: [
          function () {
            return this.bookingMode === 'scheduled';
          },
          'End time is required for scheduled bookings'
        ]
      }
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
    spareParts: {
      items: [
        {
          name: { type: String, required: true, trim: true },
          description: { type: String, trim: true, default: '' },
          quantity: { type: Number, required: true, min: 1, default: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
          labourCharge: { type: Number, default: 0, min: 0 },
          totalPrice: { type: Number, required: true, min: 0 },
          notes: { type: String, trim: true, default: '' }
        }
      ],
      partsSubtotal: { type: Number, default: 0, min: 0 },
      labourSubtotal: { type: Number, default: 0, min: 0 },
      totalAdditionalAmount: { type: Number, default: 0, min: 0 },
      status: {
        type: String,
        enum: ['none', 'pending_approval', 'pending_customer_approval', 'approved', 'rejected'],
        default: 'none'
      },
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        default: null
      },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      rejectionReason: { type: String, trim: true, default: null },
      originalServiceAmount: { type: Number, default: 0, min: 0 },
      paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'not_applicable'],
        default: 'pending'
      },
      paymentMethod: {
        type: String,
        enum: ['online', 'cash', null],
        default: null
      },
      paymentDetails: {
        razorpayOrderId: { type: String, trim: true, default: null },
        razorpayPaymentId: { type: String, trim: true, default: null },
        razorpaySignature: { type: String, trim: true, default: null },
        paidAt: { type: Date, default: null },
        failureReason: { type: String, trim: true, default: null }
      }
    },
    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 }
    },
    // Dedicated Accounting & Commission Breakdown
    // Platform commission is calculated ONLY on originalServicePrice, never on spare parts/materials
    accounting: {
      originalServicePrice: { type: Number, default: 0, min: 0 },
      additionalPartsAmount: { type: Number, default: 0, min: 0 },
      partsDescription: { type: String, default: '', trim: true },
      customerApprovedPartsAmount: { type: Number, default: 0, min: 0 },
      totalCustomerPayable: { type: Number, default: 0, min: 0 },
      commissionableAmount: { type: Number, default: 0, min: 0 },
      platformCommissionRate: { type: Number, default: 15, min: 0 },
      platformCommissionAmount: { type: Number, default: 0, min: 0 },
      providerNetEarning: { type: Number, default: 0, min: 0 }
    },
    // Top-level fields for direct access and backward compatibility
    originalServicePrice: { type: Number, default: null },
    additionalPartsAmount: { type: Number, default: 0 },
    partsDescription: { type: String, default: '' },
    customerApprovedPartsAmount: { type: Number, default: 0 },
    totalCustomerPayable: { type: Number, default: null },
    commissionableAmount: { type: Number, default: null },
    platformCommissionRate: { type: Number, default: null },
    platformCommissionAmount: { type: Number, default: null },
    providerNetEarning: { type: Number, default: null },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'refunded', 'failed', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet', 'online'],
      default: 'cash'
    },
    initialPaymentMethod: {
      type: String,
      enum: ['cash', 'online', 'card', 'upi', 'wallet', null],
      default: 'cash'
    },
    postServicePaymentChoice: {
      type: String,
      enum: ['cash', 'online', null],
      default: null
    },
    paymentDetails: {
      razorpayOrderId: { type: String, trim: true, default: null },
      razorpayPaymentId: { type: String, trim: true, default: null },
      razorpaySignature: { type: String, trim: true, default: null },
      paidAt: { type: Date, default: null },
      failureReason: { type: String, trim: true, default: null },
      cashCollectedAmount: { type: Number, default: 0, min: 0 },
      cashConfirmedByProvider: { type: Boolean, default: false },
      cashConfirmedByProviderAt: { type: Date, default: null },
      cashConfirmedByCustomer: { type: Boolean, default: false },
      cashConfirmedByCustomerAt: { type: Date, default: null },
      cashDisputedByCustomer: { type: Boolean, default: false },
      cashDisputeReason: { type: String, trim: true, default: null },
      cashDisputedAt: { type: Date, default: null }
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
    },
    serviceTeam: {
      totalCount: {
        type: Number,
        min: 1,
        default: null
      },
      roles: [
        {
          role: {
            type: String,
            trim: true,
            required: true
          },
          count: {
            type: Number,
            min: 1,
            default: 1
          }
        }
      ],
      isConfirmed: {
        type: Boolean,
        default: false
      },
      confirmedAt: {
        type: Date,
        default: null
      },
      notes: {
        type: String,
        trim: true,
        default: ''
      },
      history: [
        {
          updatedAt: {
            type: Date,
            default: Date.now
          },
          updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },
          previousTotalCount: {
            type: Number,
            default: null
          },
          newTotalCount: {
            type: Number,
            required: true
          },
          roles: [
            {
              role: String,
              count: Number
            }
          ],
          reason: {
            type: String,
            trim: true,
            default: ''
          },
          bookingStatusAtUpdate: {
            type: String,
            default: ''
          }
        }
      ]
    },
    warranty: {
      hasWarranty: {
        type: Boolean,
        default: false
      },
      periodDays: {
        type: Number,
        default: 0
      },
      startDate: {
        type: Date,
        default: null
      },
      endDate: {
        type: Date,
        default: null
      },
      gracePeriodDays: {
        type: Number,
        default: 15
      }
    },
    warrantyEndDate: {
      type: Date,
      default: null
    },
    warrantyGracePeriodDays: {
      type: Number,
      default: 15
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ status: 1, bookingMode: 1 });
bookingSchema.index({ category: 1, tag: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ 'address.location': '2dsphere' });

/**
 * Pre-save middleware to keep accounting breakdown and originalServicePrice synchronized.
 * Enforces: Platform commission is calculated ONLY on originalServicePrice, never on spare parts.
 */
bookingSchema.pre('save', function (next) {
  try {
    const { calculateBookingCommission } = require('../utils/commissionCalculator');
    const breakdown = calculateBookingCommission(this);

    this.accounting = {
      originalServicePrice: breakdown.originalServicePrice,
      additionalPartsAmount: breakdown.additionalPartsAmount,
      partsDescription: breakdown.partsDescription,
      customerApprovedPartsAmount: breakdown.customerApprovedPartsAmount,
      totalCustomerPayable: breakdown.totalCustomerPayable,
      commissionableAmount: breakdown.commissionableAmount,
      platformCommissionRate: breakdown.platformCommissionRate,
      platformCommissionAmount: breakdown.platformCommissionAmount,
      providerNetEarning: breakdown.providerNetEarning
    };

    this.originalServicePrice = breakdown.originalServicePrice;
    this.additionalPartsAmount = breakdown.additionalPartsAmount;
    this.partsDescription = breakdown.partsDescription;
    this.customerApprovedPartsAmount = breakdown.customerApprovedPartsAmount;
    this.totalCustomerPayable = breakdown.totalCustomerPayable;
    this.commissionableAmount = breakdown.commissionableAmount;
    this.platformCommissionRate = breakdown.platformCommissionRate;
    this.platformCommissionAmount = breakdown.platformCommissionAmount;
    this.providerNetEarning = breakdown.providerNetEarning;

    next();
  } catch (err) {
    next(err);
  }
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
