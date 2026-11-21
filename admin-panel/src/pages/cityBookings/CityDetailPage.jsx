import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  Download,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  TrendingUp,
  X,
  Layers,
  User,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { cityAnalyticsApi, categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const PERIOD_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom', value: 'custom' }
];

const STATUS_BADGES = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  accepted: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

const PAYMENT_BADGES = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  refunded: 'bg-slate-50 text-slate-700 border-slate-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200'
};

const CityDetailPage = () => {
  const { city: cityParam } = useParams();

  // Filters
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [searchBookingId, setSearchBookingId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data & States
  const [citySummary, setCitySummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [categories, setCategories] = useState([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await categoryApi.getAll();
        if (res?.success) {
          setCategories(res.data?.categories || res.data || []);
        }
      } catch (err) {
        console.warn('Failed to load categories', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch City Detailed Statistics & Charts
  const fetchCitySummary = useCallback(async () => {
    if (!cityParam) return;
    setIsLoadingSummary(true);
    try {
      const params = {
        period,
        status,
        category
      };
      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await cityAnalyticsApi.getCitySummary(cityParam, params);
      if (res?.success) {
        setCitySummary(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch city summary');
      }
    } catch (err) {
      console.error(err);
      setError(err.userMessage || err.message || 'Error loading city analytics.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, [cityParam, period, startDate, endDate, status, category]);

  // Fetch City Paginated Bookings List
  const fetchCityBookings = useCallback(async () => {
    if (!cityParam) return;
    setIsLoadingBookings(true);
    try {
      const params = {
        period,
        status,
        category,
        paymentStatus,
        search: searchBookingId.trim() || undefined,
        page,
        limit: pageSize
      };
      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await cityAnalyticsApi.getCityBookings(cityParam, params);
      if (res?.success) {
        setBookings(res.data || []);
        setPagination(res.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      } else {
        throw new Error(res?.message || 'Failed to fetch city bookings');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingBookings(false);
    }
  }, [cityParam, period, startDate, endDate, status, category, paymentStatus, searchBookingId, page, pageSize]);

  useEffect(() => {
    fetchCitySummary();
  }, [fetchCitySummary]);

  useEffect(() => {
    fetchCityBookings();
  }, [fetchCityBookings]);

  // CSV Export for City Bookings
  const handleExportCityCSV = async () => {
    setIsExporting(true);
    try {
      const params = {
        type: 'bookings',
        city: cityParam,
        period,
        status,
        category,
        paymentStatus,
        search: searchBookingId.trim() || undefined
      };
      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const blob = await cityAnalyticsApi.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cityParam}_bookings_${period}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to export city CSV: ' + (err.userMessage || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  const overview = citySummary?.overview || {};
  const cityName = citySummary?.city?.cityName || decodeURIComponent(cityParam || 'City');
  const categoryBreakdown = citySummary?.categoryBreakdown || [];
  const dailyTrends = citySummary?.dailyTrends || [];

  const maxCategoryOrders = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map((c) => c.bookingCount)) : 1;
  const maxDailyOrders = dailyTrends.length > 0 ? Math.max(...dailyTrends.map((d) => d.totalBookings)) : 1;

  return (
    <div className="space-y-6">
      {/* Header with Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/city-bookings"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs"
            title="Back to all cities"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{cityName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                City Service Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed fulfillment velocity, category popularity, and order history for {cityName}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchCitySummary();
              fetchCityBookings();
            }}
            disabled={isLoadingSummary || isLoadingBookings}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary || isLoadingBookings ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCityCSV}
            disabled={isExporting || isLoadingBookings || bookings.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Exporting...' : `Export ${cityName} Bookings (CSV)`}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-4">
        {/* Date Range Selection */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Date Period:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPeriod(opt.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === opt.value
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Booking ID Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Booking ID (e.g. BK-)..."
              value={searchBookingId}
              onChange={(e) => {
                setSearchBookingId(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchBookingId && (
              <button
                type="button"
                onClick={() => {
                  setSearchBookingId('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Booking Status Dropdown */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value="all">All Booking Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In Progress</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value="all">All Service Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Dropdown */}
          <div>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid (Verified)</option>
              <option value="pending">Payment Pending</option>
              <option value="failed">Payment Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Summary KPI Cards for this city */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Bookings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Bookings</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{overview.totalBookings || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">In {cityName}</span>
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completed</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700">{overview.completed || 0}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
              {overview.completionRate || 0}% completion
            </span>
          </div>
        </div>

        {/* Pending */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pending</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-800">{overview.pending || 0}</span>
            <span className="text-[10px] text-amber-600 block mt-0.5">Awaiting provider</span>
          </div>
        </div>

        {/* Accepted / In Progress */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">In Progress</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-sky-700">
              {(overview.accepted || 0) + (overview.inProgress || 0)}
            </span>
            <span className="text-[10px] text-sky-600 block mt-0.5">Active field jobs</span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Cancelled</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-700">{overview.cancelled || 0}</span>
            <span className="text-[10px] text-rose-600 block mt-0.5">
              {overview.cancellationRate || 0}% cancellation
            </span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Verified Revenue</span>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 block truncate">
              ₹{(overview.totalRevenue || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">
              Take-rate: ₹{(overview.platformEarnings || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section: Daily Trends & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Booking & Revenue Trend Chart */}
        <Card title="Daily Booking Activity Trend" subtitle="Fulfillment volume over time">
          {isLoadingSummary ? (
            <div className="p-8 flex items-center justify-center">
              <LoadingSpinner size="md" color="indigo" />
            </div>
          ) : dailyTrends.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No daily order activity for this period.</div>
          ) : (
            <div className="space-y-3 p-2">
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-1 border-b border-slate-200">
                {dailyTrends.slice(-14).map((d) => {
                  const heightPct = Math.round((d.totalBookings / maxDailyOrders) * 100);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                        {d.date}: {d.totalBookings} orders (₹{d.revenue.toLocaleString('en-IN')})
                      </div>
                      <div
                        className="w-full bg-indigo-500 group-hover:bg-indigo-600 rounded-t transition-all"
                        style={{ height: `${Math.max(8, heightPct)}%` }}
                      />
                      <span className="text-[9px] text-slate-400 truncate w-full text-center">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Last 14 recorded days</span>
                <span className="font-semibold text-indigo-600">Peak: {maxDailyOrders} orders/day</span>
              </div>
            </div>
          )}
        </Card>

        {/* Top Service Categories Breakdown in this city */}
        <Card title="Category Demand Breakdown" subtitle="Service demand distribution in this city">
          {isLoadingSummary ? (
            <div className="p-8 flex items-center justify-center">
              <LoadingSpinner size="md" color="indigo" />
            </div>
          ) : categoryBreakdown.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No category demand data found.</div>
          ) : (
            <div className="space-y-3 p-2">
              {categoryBreakdown.map((cat) => {
                const pct = Math.round((cat.bookingCount / maxCategoryOrders) * 100);
                return (
                  <div key={cat.categoryName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{cat.categoryName}</span>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">{cat.bookingCount} orders</span>
                        <span className="text-[10px] text-emerald-600 font-semibold ml-2">
                          ₹{cat.revenue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bookings Table for this City */}
      <Card
        title={`All Booking Records for ${cityName}`}
        subtitle={`Showing ${bookings.length} of ${pagination.total} total bookings in this city`}
      >
        {isLoadingBookings ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <LoadingSpinner size="lg" color="indigo" />
            <p className="text-xs text-slate-500">Loading bookings for {cityName}...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No Matching Bookings</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No booking records matched your filters in {cityName}. Try clearing the booking ID search or changing the
              status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase bg-slate-50 tracking-wider">
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-3">Date & Slot</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Service & Category</th>
                  <th className="py-3 px-3">Assigned Provider</th>
                  <th className="py-3 px-3 text-right">Amount (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {b.bookingReference}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">
                        {b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString('en-IN') : 'ASAP'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {b.scheduledTimeSlot?.startTime} - {b.scheduledTimeSlot?.endTime}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">
                        {b.customer?.user?.name || 'Customer'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {b.customer?.user?.phone || 'No phone'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900">{b.service?.name || 'Standard Service'}</div>
                      <div className="text-[10px] text-indigo-600 font-semibold">
                        {b.category?.name || b.service?.category?.name || 'General'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {b.provider ? (
                        <div>
                          <span className="font-medium text-slate-800 block">{b.provider.businessName}</span>
                          <span className="text-[10px] text-slate-400">★ {b.provider.rating || 5.0}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned broadcast</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      ₹{(b.pricing?.totalAmount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          STATUS_BADGES[b.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          PAYMENT_BADGES[b.paymentStatus] || 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-slate-900">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-slate-900">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-900">{pagination.total}</span> bookings
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 py-1 font-semibold text-slate-800">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page >= pagination.totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CityDetailPage;
