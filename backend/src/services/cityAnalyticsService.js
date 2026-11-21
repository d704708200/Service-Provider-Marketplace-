const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');

/**
 * Normalizes city names for display (Title Case, trimmed)
 */
const formatCityDisplayName = (raw) => {
  if (!raw || typeof raw !== 'string') return 'Unspecified';
  const trimmed = raw.trim();
  if (!trimmed) return 'Unspecified';
  // Capitalize each word properly
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Resolves date range bounds based on period string or explicit start/end dates
 */
const resolveDateRange = (query = {}) => {
  const { period, startDate, endDate } = query;
  const now = new Date();
  let start = null;
  let end = null;

  if (startDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
  }
  if (endDate) {
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  if (!start && period) {
    const p = String(period).toLowerCase().trim();
    if (p === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (p === 'yesterday') {
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (p === '7d' || p === 'last_7_days') {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (p === '30d' || p === 'last_30_days') {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (p === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (p === 'prev_month' || p === 'previous_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
    }
  }

  return { start, end };
};

/**
 * Builds base match filter for bookings query
 */
const buildBookingFilter = (query = {}) => {
  const filter = {};

  // Date range filter
  const { start, end } = resolveDateRange(query);
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }

  // Booking status filter
  if (query.status && query.status !== 'all') {
    filter.status = query.status.trim();
  }

  // Service category filter
  if (query.category && query.category !== 'all') {
    if (mongoose.Types.ObjectId.isValid(query.category)) {
      filter.category = new mongoose.Types.ObjectId(query.category);
    }
  }

  // Payment status filter
  if (query.paymentStatus && query.paymentStatus !== 'all') {
    filter.paymentStatus = query.paymentStatus.trim();
  }

  return filter;
};

/**
 * GET /api/admin/analytics/cities
 * Aggregates all bookings grouped by normalized city with overall summary and pagination
 */
const getCityAnalytics = async (query = {}) => {
  const baseFilter = buildBookingFilter(query);

  // Common pipeline for extracting normalized city
  const cityExtractionStage = [
    { $match: baseFilter },
    {
      $addFields: {
        rawCityTrimmed: {
          $trim: {
            input: {
              $ifNull: ['$address.city', '']
            }
          }
        }
      }
    },
    {
      $addFields: {
        cityKey: {
          $cond: [
            { $gt: [{ $strLenCP: '$rawCityTrimmed' }, 0] },
            { $toLower: '$rawCityTrimmed' },
            'unspecified'
          ]
        },
        originalCity: {
          $cond: [
            { $gt: [{ $strLenCP: '$rawCityTrimmed' }, 0] },
            '$rawCityTrimmed',
            'Unspecified'
          ]
        }
      }
    }
  ];

  // Optional search query on city name
  let searchFilterStage = [];
  if (query.search && query.search.trim()) {
    const rawSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchFilterStage = [
      {
        $match: {
          cityKey: { $regex: new RegExp(rawSearch, 'i') }
        }
      }
    ];
  }

  // Aggregation pipeline to group by normalized cityKey
  const groupStage = [
    {
      $group: {
        _id: '$cityKey',
        sampleCityName: { $first: '$originalCity' },
        totalBookings: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        accepted: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        // Revenue is calculated strictly from verified paid bookings
        revenue: {
          $sum: {
            $cond: [
              { $eq: ['$paymentStatus', 'paid'] },
              { $ifNull: ['$pricing.totalAmount', 0] },
              0
            ]
          }
        },
        // Spare parts revenue from verified paid spare parts
        sparePartsRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentStatus', 'paid'] },
                  { $eq: ['$spareParts.paymentStatus', 'paid'] }
                ]
              },
              { $ifNull: ['$spareParts.totalAdditionalAmount', 0] },
              0
            ]
          }
        },
        // Platform earnings from paid bookings
        platformEarnings: {
          $sum: {
            $cond: [
              { $eq: ['$paymentStatus', 'paid'] },
              {
                $ifNull: [
                  '$totalPlatformCommission',
                  {
                    $ifNull: [
                      '$accounting.totalPlatformCommission',
                      {
                        $multiply: [
                          { $ifNull: ['$pricing.totalAmount', 0] },
                          0.15
                        ]
                      }
                    ]
                  }
                ]
              },
              0
            ]
          }
        }
      }
    },
    {
      $addFields: {
        totalRevenue: { $add: ['$revenue', '$sparePartsRevenue'] },
        completionRate: {
          $cond: [
            { $gt: ['$totalBookings', 0] },
            { $round: [{ $multiply: [{ $divide: ['$completed', '$totalBookings'] }, 100] }, 1] },
            0
          ]
        },
        cancellationRate: {
          $cond: [
            { $gt: ['$totalBookings', 0] },
            { $round: [{ $multiply: [{ $divide: ['$cancelled', '$totalBookings'] }, 100] }, 1] },
            0
          ]
        }
      }
    }
  ];

  // Sorting
  const sortBy = query.sortBy || 'totalBookings';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sortStage = {
    $sort: {
      [sortBy === 'revenue'
        ? 'totalRevenue'
        : sortBy === 'completed'
        ? 'completed'
        : sortBy === 'pending'
        ? 'pending'
        : sortBy === 'cancelled'
        ? 'cancelled'
        : sortBy === 'city'
        ? '_id'
        : 'totalBookings']: sortOrder,
      _id: 1
    }
  };

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  // Run aggregation with overall summary and paginated items
  const pipeline = [
    ...cityExtractionStage,
    ...searchFilterStage,
    ...groupStage,
    sortStage,
    {
      $facet: {
        metadata: [{ $count: 'totalCities' }],
        cities: [{ $skip: skip }, { $limit: limit }]
      }
    }
  ];

  const [aggResult, overallStats] = await Promise.all([
    Booking.aggregate(pipeline),
    // Overall totals across all cities matching the active filter
    Booking.aggregate([
      ...cityExtractionStage,
      ...searchFilterStage,
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          acceptedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                { $ifNull: ['$pricing.totalAmount', 0] },
                0
              ]
            }
          },
          sparePartsRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$paymentStatus', 'paid'] },
                    { $eq: ['$spareParts.paymentStatus', 'paid'] }
                  ]
                },
                { $ifNull: ['$spareParts.totalAdditionalAmount', 0] },
                0
              ]
            }
          },
          platformEarnings: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                {
                  $ifNull: [
                    '$totalPlatformCommission',
                    {
                      $ifNull: [
                        '$accounting.totalPlatformCommission',
                        {
                          $multiply: [
                            { $ifNull: ['$pricing.totalAmount', 0] },
                            0.15
                          ]
                        }
                      ]
                    }
                  ]
                },
                0
              ]
            }
          }
        }
      }
    ])
  ]);

  const rawCities = aggResult[0]?.cities || [];
  const totalCities = aggResult[0]?.metadata[0]?.totalCities || 0;

  const formattedCities = rawCities.map((c) => ({
    cityKey: c._id,
    cityName: formatCityDisplayName(c.sampleCityName || c._id),
    totalBookings: c.totalBookings || 0,
    completed: c.completed || 0,
    pending: c.pending || 0,
    accepted: c.accepted || 0,
    inProgress: c.inProgress || 0,
    cancelled: c.cancelled || 0,
    rejected: c.rejected || 0,
    revenue: Math.round((c.totalRevenue || 0) * 100) / 100,
    grossBookingValue: Math.round((c.totalRevenue || 0) * 100) / 100,
    platformEarnings: Math.round((c.platformEarnings || 0) * 100) / 100,
    completionRate: c.completionRate || 0,
    cancellationRate: c.cancellationRate || 0
  }));

  const globalSummary = overallStats[0] || {};
  const grossRev = (globalSummary.totalRevenue || 0) + (globalSummary.sparePartsRevenue || 0);

  return {
    summary: {
      totalCities,
      totalBookings: globalSummary.totalBookings || 0,
      completedBookings: globalSummary.completedBookings || 0,
      pendingBookings: globalSummary.pendingBookings || 0,
      acceptedBookings: globalSummary.acceptedBookings || 0,
      cancelledBookings: globalSummary.cancelledBookings || 0,
      totalRevenue: Math.round(grossRev * 100) / 100,
      grossBookingValue: Math.round(grossRev * 100) / 100,
      platformEarnings: Math.round((globalSummary.platformEarnings || 0) * 100) / 100,
      currency: 'INR'
    },
    cities: formattedCities,
    pagination: {
      total: totalCities,
      page,
      limit,
      totalPages: Math.ceil(totalCities / limit) || 1
    }
  };
};

/**
 * GET /api/admin/analytics/cities/:city/bookings
 * Paginated booking records for a specific city
 */
const getCityBookings = async (cityParam, query = {}) => {
  if (!cityParam) {
    const err = new Error('City parameter is required');
    err.statusCode = 400;
    throw err;
  }

  const rawCity = decodeURIComponent(cityParam).trim();
  const baseFilter = buildBookingFilter(query);

  // Match city case-insensitively using regex matching
  if (rawCity.toLowerCase() === 'unspecified') {
    baseFilter.$or = [
      { 'address.city': { $exists: false } },
      { 'address.city': null },
      { 'address.city': '' },
      { 'address.city': { $regex: /^\s*$/ } }
    ];
  } else {
    const escapedCity = rawCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    baseFilter['address.city'] = new RegExp(`^\\s*${escapedCity}\\s*$`, 'i');
  }

  // Search by booking reference ID
  if (query.search && query.search.trim()) {
    const searchRaw = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    baseFilter.bookingReference = new RegExp(searchRaw, 'i');
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(baseFilter)
      .populate({
        path: 'service',
        select: 'name price priceType category',
        populate: { path: 'category', select: 'name slug icon' }
      })
      .populate({
        path: 'provider',
        select: 'businessName rating user',
        populate: { path: 'user', select: 'name email phone' }
      })
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name email phone' }
      })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(baseFilter)
  ]);

  return {
    city: {
      cityKey: rawCity.toLowerCase(),
      cityName: formatCityDisplayName(rawCity)
    },
    bookings,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * GET /api/admin/analytics/cities/:city/summary
 * Detailed analytics for a single city (status breakdown, category breakdown, daily trend, recent bookings)
 */
const getCitySummary = async (cityParam, query = {}) => {
  if (!cityParam) {
    const err = new Error('City parameter is required');
    err.statusCode = 400;
    throw err;
  }

  const rawCity = decodeURIComponent(cityParam).trim();
  const baseFilter = buildBookingFilter(query);

  if (rawCity.toLowerCase() === 'unspecified') {
    baseFilter.$or = [
      { 'address.city': { $exists: false } },
      { 'address.city': null },
      { 'address.city': '' },
      { 'address.city': { $regex: /^\s*$/ } }
    ];
  } else {
    const escapedCity = rawCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    baseFilter['address.city'] = new RegExp(`^\\s*${escapedCity}\\s*$`, 'i');
  }

  const [
    statusCounts,
    revenueAgg,
    categoryDistribution,
    dailyTrends,
    recentBookings
  ] = await Promise.all([
    // 1. Status breakdown
    Booking.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    // 2. Revenue calculations
    Booking.aggregate([
      {
        $match: {
          ...baseFilter,
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          grossServiceValue: { $sum: { $ifNull: ['$pricing.totalAmount', 0] } },
          sparePartsRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$spareParts.paymentStatus', 'paid'] },
                { $ifNull: ['$spareParts.totalAdditionalAmount', 0] },
                0
              ]
            }
          },
          platformEarnings: {
            $sum: {
              $ifNull: [
                '$totalPlatformCommission',
                {
                  $ifNull: [
                    '$accounting.totalPlatformCommission',
                    {
                      $multiply: [
                        { $ifNull: ['$pricing.totalAmount', 0] },
                        0.15
                      ]
                    }
                  ]
                }
              ]
            }
          },
          paidBookingsCount: { $sum: 1 }
        }
      }
    ]),

    // 3. Category breakdown
    Booking.aggregate([
      { $match: baseFilter },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDoc'
        }
      },
      {
        $unwind: {
          path: '$categoryDoc',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$categoryDoc.name', 'Other Services'] },
          bookingCount: { $sum: 1 },
          categoryRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                { $ifNull: ['$pricing.totalAmount', 0] },
                0
              ]
            }
          }
        }
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 10 }
    ]),

    // 4. Daily trend
    Booking.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalBookings: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                { $ifNull: ['$pricing.totalAmount', 0] },
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 60 }
    ]),

    // 5. Recent 10 bookings
    Booking.find(baseFilter)
      .populate('service', 'name price')
      .populate('category', 'name')
      .populate({
        path: 'provider',
        select: 'businessName'
      })
      .populate({
        path: 'customer',
        populate: { path: 'user', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
  ]);

  // Aggregate stats
  let totalBookings = 0;
  const statusMap = {
    completed: 0,
    pending: 0,
    accepted: 0,
    in_progress: 0,
    cancelled: 0,
    rejected: 0
  };

  statusCounts.forEach((s) => {
    totalBookings += s.count;
    if (statusMap.hasOwnProperty(s._id)) {
      statusMap[s._id] = s.count;
    }
  });

  const revObj = revenueAgg[0] || {};
  const grossRev = (revObj.grossServiceValue || 0) + (revObj.sparePartsRevenue || 0);

  const completionRate = totalBookings > 0 ? Math.round((statusMap.completed / totalBookings) * 1000) / 10 : 0;
  const cancellationRate = totalBookings > 0 ? Math.round((statusMap.cancelled / totalBookings) * 1000) / 10 : 0;

  return {
    city: {
      cityKey: rawCity.toLowerCase(),
      cityName: formatCityDisplayName(rawCity)
    },
    overview: {
      totalBookings,
      completed: statusMap.completed,
      pending: statusMap.pending,
      accepted: statusMap.accepted,
      inProgress: statusMap.in_progress,
      cancelled: statusMap.cancelled,
      rejected: statusMap.rejected,
      completionRate,
      cancellationRate,
      totalRevenue: Math.round(grossRev * 100) / 100,
      grossBookingValue: Math.round(grossRev * 100) / 100,
      platformEarnings: Math.round((revObj.platformEarnings || 0) * 100) / 100,
      paidBookingsCount: revObj.paidBookingsCount || 0,
      currency: 'INR'
    },
    statusBreakdown: Object.keys(statusMap).map((k) => ({
      status: k,
      count: statusMap[k],
      percentage: totalBookings > 0 ? Math.round((statusMap[k] / totalBookings) * 1000) / 10 : 0
    })),
    categoryBreakdown: categoryDistribution.map((cat) => ({
      categoryName: cat._id,
      bookingCount: cat.bookingCount,
      revenue: Math.round(cat.categoryRevenue * 100) / 100
    })),
    dailyTrends: dailyTrends.map((d) => ({
      date: d._id,
      totalBookings: d.totalBookings,
      completed: d.completed,
      revenue: Math.round(d.revenue * 100) / 100
    })),
    recentBookings: recentBookings.map((b) => ({
      _id: b._id,
      bookingReference: b.bookingReference,
      serviceName: b.service?.name || 'Standard Service',
      categoryName: b.category?.name || 'General',
      customerName: b.customer?.user?.name || 'Customer',
      providerName: b.provider?.businessName || 'Unassigned',
      status: b.status,
      paymentStatus: b.paymentStatus,
      amount: b.pricing?.totalAmount || 0,
      createdAt: b.createdAt
    }))
  };
};

/**
 * Escapes CSV field value safely
 */
const escapeCsvField = (field) => {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * GET /api/admin/analytics/cities/export
 * Generates CSV string based on query filters and export type
 */
const exportCityAnalyticsCSV = async (query = {}) => {
  const exportType = query.type || (query.city ? 'bookings' : 'summary');

  if (exportType === 'bookings') {
    // Export individual booking records
    const baseFilter = buildBookingFilter(query);

    if (query.city && query.city.trim()) {
      const rawCity = query.city.trim();
      if (rawCity.toLowerCase() === 'unspecified') {
        baseFilter.$or = [
          { 'address.city': { $exists: false } },
          { 'address.city': null },
          { 'address.city': '' },
          { 'address.city': { $regex: /^\s*$/ } }
        ];
      } else {
        const escapedCity = rawCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        baseFilter['address.city'] = new RegExp(`^\\s*${escapedCity}\\s*$`, 'i');
      }
    }

    if (query.search && query.search.trim()) {
      const searchRaw = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      baseFilter.bookingReference = new RegExp(searchRaw, 'i');
    }

    const bookings = await Booking.find(baseFilter)
      .populate('service', 'name')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const headers = [
      'Booking ID',
      'City',
      'Booking Date',
      'Service Category',
      'Service Name',
      'Booking Status',
      'Payment Status',
      'Booking Amount (INR)',
      'Platform Commission (INR)'
    ];

    const rows = bookings.map((b) => [
      escapeCsvField(b.bookingReference),
      escapeCsvField(formatCityDisplayName(b.address?.city)),
      escapeCsvField(b.createdAt ? new Date(b.createdAt).toISOString().split('T')[0] : ''),
      escapeCsvField(b.category?.name || 'General'),
      escapeCsvField(b.service?.name || 'Standard Service'),
      escapeCsvField(b.status),
      escapeCsvField(b.paymentStatus),
      escapeCsvField(b.pricing?.totalAmount || 0),
      escapeCsvField(
        b.paymentStatus === 'paid'
          ? b.totalPlatformCommission || Math.round((b.pricing?.totalAmount || 0) * 0.15)
          : 0
      )
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  // Otherwise, export city-wise summaries
  const result = await getCityAnalytics({
    ...query,
    page: 1,
    limit: 1000 // all cities
  });

  const headers = [
    'City Name',
    'Total Bookings',
    'Pending',
    'Accepted',
    'In Progress',
    'Completed',
    'Cancelled',
    'Verified Revenue (INR)',
    'Gross Booking Value (INR)',
    'Platform Earnings (INR)',
    'Completion Rate (%)',
    'Cancellation Rate (%)'
  ];

  const rows = result.cities.map((c) => [
    escapeCsvField(c.cityName),
    escapeCsvField(c.totalBookings),
    escapeCsvField(c.pending),
    escapeCsvField(c.accepted),
    escapeCsvField(c.inProgress),
    escapeCsvField(c.completed),
    escapeCsvField(c.cancelled),
    escapeCsvField(c.revenue),
    escapeCsvField(c.grossBookingValue),
    escapeCsvField(c.platformEarnings),
    escapeCsvField(`${c.completionRate}%`),
    escapeCsvField(`${c.cancellationRate}%`)
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
};

module.exports = {
  formatCityDisplayName,
  resolveDateRange,
  getCityAnalytics,
  getCityBookings,
  getCitySummary,
  exportCityAnalyticsCSV
};
