const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Service = require('../models/Service');
const Category = require('../models/Category');

/**
 * Resolve start date from period string ('7d', '30d', '90d', 'quarterly', or custom)
 */
const getStartDateFromPeriod = (period) => {
  const now = new Date();
  const start = new Date(now);
  if (period === '7d') {
    start.setDate(now.getDate() - 7);
  } else if (period === '90d' || period === 'quarterly') {
    start.setDate(now.getDate() - 90);
  } else {
    // Default 30 days
    start.setDate(now.getDate() - 30);
  }
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Generate comprehensive analytical reports with MongoDB aggregations
 */
const getPlatformReports = async (query = {}) => {
  const period = query.period || '30d';
  const startDate = query.startDate ? new Date(query.startDate) : getStartDateFromPeriod(period);
  const endDate = query.endDate ? new Date(query.endDate) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const dateFilter = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };

  const [
    revenueAgg,
    statusCounts,
    dailyBookingTrends,
    providerStatusAgg,
    categoryDistribution
  ] = await Promise.all([
    // 1. Financial Revenue Pipeline (Verified payments only)
    Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          grossServiceValue: { $sum: '$pricing.totalAmount' },
          sparePartsRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$spareParts.paymentStatus', 'paid'] },
                '$spareParts.totalAdditionalAmount',
                0
              ]
            }
          },
          paidBookingsCount: { $sum: 1 }
        }
      }
    ]),

    // 2. Booking Performance & Fulfillment
    Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    // 3. Daily Booking Volume & Revenue Trends
    Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          dailyRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$pricing.totalAmount', 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // 4. Provider Activity Breakdown
    Provider.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]),

    // 5. Category Demand Distribution
    Booking.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'services',
          localField: 'service',
          foreignField: '_id',
          as: 'serviceDoc'
        }
      },
      { $unwind: '$serviceDoc' },
      {
        $lookup: {
          from: 'categories',
          localField: 'serviceDoc.category',
          foreignField: '_id',
          as: 'categoryDoc'
        }
      },
      { $unwind: '$categoryDoc' },
      {
        $group: {
          _id: '$categoryDoc.name',
          bookingCount: { $sum: 1 },
          categoryRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$pricing.totalAmount', 0]
            }
          }
        }
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 6 }
    ])
  ]);

  // Process Revenue
  let grossValue = 0;
  let sparePartsValue = 0;
  let paidCount = 0;

  if (revenueAgg.length > 0) {
    grossValue = revenueAgg[0].grossServiceValue || 0;
    sparePartsValue = revenueAgg[0].sparePartsRevenue || 0;
    paidCount = revenueAgg[0].paidBookingsCount || 0;
  }

  const totalGrossRevenue = grossValue + sparePartsValue;
  // Commission model: 15% platform take-rate, 85% provider payout pool
  const platformCommissionRate = 0.15;
  const platformCommission = Math.round(totalGrossRevenue * platformCommissionRate);
  const providerDisbursementPool = totalGrossRevenue - platformCommission;

  // Process Booking Performance
  const bookingStats = {
    total: 0,
    completed: 0,
    cancelled: 0,
    pending: 0,
    accepted: 0,
    in_progress: 0,
    rejected: 0,
    completionRate: 0,
    cancellationRate: 0
  };

  statusCounts.forEach((s) => {
    bookingStats.total += s.count;
    if (s._id && bookingStats.hasOwnProperty(s._id)) {
      bookingStats[s._id] = s.count;
    }
  });

  if (bookingStats.total > 0) {
    bookingStats.completionRate = Math.round((bookingStats.completed / bookingStats.total) * 100);
    bookingStats.cancellationRate = Math.round((bookingStats.cancelled / bookingStats.total) * 100);
  }

  // Process Provider Funnel
  const providerStats = {
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    suspended: 0
  };

  providerStatusAgg.forEach((p) => {
    providerStats.total += p.count;
    if (p._id && providerStats.hasOwnProperty(p._id)) {
      providerStats[p._id] = p.count;
    }
  });

  return {
    period,
    dateRange: {
      startDate,
      endDate
    },
    revenue: {
      grossTransactionValue: totalGrossRevenue,
      serviceCharges: grossValue,
      sparePartsCharges: sparePartsValue,
      paidInvoicesCount: paidCount,
      estimatedCommission: platformCommission,
      providerPayoutPool: providerDisbursementPool,
      payoutModelConfigured: false,
      payoutModelNote: 'Automated bank payout distribution pipeline is scheduled for Phase 12 integration. Figures represent calculated contractor earnings pool.'
    },
    bookings: bookingStats,
    providers: providerStats,
    dailyTrends: dailyBookingTrends.map((d) => ({
      date: d._id,
      bookings: d.totalBookings,
      completed: d.completedBookings,
      revenue: d.dailyRevenue
    })),
    categoryDistribution: categoryDistribution.map((c) => ({
      categoryName: c._id,
      bookings: c.bookingCount,
      revenue: c.categoryRevenue
    }))
  };
};

module.exports = {
  getPlatformReports
};
