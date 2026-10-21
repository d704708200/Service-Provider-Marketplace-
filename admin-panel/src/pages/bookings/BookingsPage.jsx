import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  User,
  Building,
  CreditCard,
  Wrench,
  Package,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  DollarSign
} from 'lucide-react';
import { bookingApi } from '../../services/api';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const STATUS_BADGES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

const PAYMENT_BADGES = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  refunded: 'bg-slate-50 text-slate-700 border-slate-200'
};

const BookingsPage = () => {
  // Data State
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Detail Drawer / Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Fetch Live Statistics
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const res = await bookingApi.getAdminBookingStats();
      if (res?.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load booking statistics', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch Bookings with All Active Filters
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (paymentStatusFilter !== 'all') params.paymentStatus = paymentStatusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await bookingApi.getAdminBookings(params);
      if (res?.success) {
        setBookings(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        throw new Error(res?.message || 'Failed to retrieve bookings');
      }
    } catch (err) {
      setError(err.userMessage || err.message || 'Failed to load bookings from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, paymentStatusFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Open Booking Details Drawer/Modal
  const handleViewDetail = async (id) => {
    setIsDetailLoading(true);
    setActionError(null);
    setActionSuccess(null);
    setCancelReason('');
    try {
      const res = await bookingApi.getAdminBookingById(id);
      if (res?.success) {
        setSelectedBooking(res.data);
      } else {
        setActionError('Failed to load booking details.');
      }
    } catch (err) {
      setActionError(err.userMessage || 'Failed to load booking details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Safe Administrative Cancellation
  const handleAdminCancel = async () => {
    if (!cancelReason.trim()) {
      setActionError('A cancellation justification reason is required for administrative audit logs.');
      return;
    }

    setIsCancelling(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await bookingApi.cancelBooking(selectedBooking._id, cancelReason.trim());
      if (res?.success) {
        setActionSuccess('Booking has been cancelled by platform administrator.');
        setSelectedBooking(res.data);
        setCancelReason('');
        fetchBookings();
        fetchStats();
      } else {
        throw new Error(res?.message || 'Cancellation could not be confirmed');
      }
    } catch (err) {
      setActionError(err.userMessage || err.message || 'Failed to cancel booking.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Table Columns Definition
  const columns = [
    {
      header: 'Booking ID',
      key: 'bookingReference',
      render: (item) => (
        <div>
          <span className="font-mono font-bold text-indigo-600 block text-xs">
            {item.bookingReference}
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            {item.bookingMode === 'instant' ? '⚡ Instant' : '📅 Scheduled'}
          </span>
        </div>
      )
    },
    {
      header: 'Customer',
      key: 'customerName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">
            {item.customer?.user?.name || 'Customer'}
          </span>
          <span className="text-[11px] text-slate-500 block">
            {item.customer?.user?.phone || item.customer?.user?.email || 'No contact'}
          </span>
        </div>
      )
    },
    {
      header: 'Provider',
      key: 'providerName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">
            {item.provider?.businessName || item.provider?.user?.name || (
              <span className="text-amber-600 font-normal italic">Unassigned (Pool)</span>
            )}
          </span>
          {item.provider?.user?.phone && (
            <span className="text-[11px] text-slate-500 block">{item.provider.user.phone}</span>
          )}
        </div>
      )
    },
    {
      header: 'Service & Category',
      key: 'service',
      render: (item) => (
        <div>
          <span className="font-medium text-slate-800 block text-xs">
            {item.service?.name || 'Service'}
          </span>
          <span className="text-[11px] text-indigo-600 block">
            {item.service?.category?.name || 'General Category'}
          </span>
        </div>
      )
    },
    {
      header: 'Date & Time',
      key: 'scheduledTime',
      render: (item) => (
        <div>
          {item.bookingMode === 'instant' ? (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm">
              ASAP
            </span>
          ) : (
            <>
              <span className="text-xs text-slate-800 block font-medium">
                {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('en-IN') : 'N/A'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {item.scheduledTimeSlot?.startTime} - {item.scheduledTimeSlot?.endTime}
              </span>
            </>
          )}
        </div>
      )
    },
    {
      header: 'Service Address',
      key: 'address',
      render: (item) => (
        <div className="max-w-[180px]">
          <span className="text-xs text-slate-700 block truncate" title={`${item.address?.street}, ${item.address?.city}`}>
            {item.address?.city || 'City N/A'}
          </span>
          <span className="text-[11px] text-slate-400 block truncate">
            {item.address?.street}
          </span>
        </div>
      )
    },
    {
      header: 'Amount',
      key: 'amount',
      render: (item) => (
        <div>
          <span className="font-bold text-xs text-slate-900 block">
            ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
          </span>
          {item.spareParts?.totalAdditionalAmount > 0 && (
            <span className="text-[10px] text-indigo-600 font-medium block">
              +₹{item.spareParts.totalAdditionalAmount} parts
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Payment',
      key: 'payment',
      render: (item) => (
        <div>
          <span className="text-[11px] font-semibold text-slate-700 uppercase block">
            {item.paymentMethod || 'CASH'}
          </span>
          <span
            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${
              PAYMENT_BADGES[item.paymentStatus] || 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {item.paymentStatus?.toUpperCase() || 'PENDING'}
          </span>
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            STATUS_BADGES[item.status] || 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {item.status.toUpperCase()}
        </span>
      )
    },
    {
      header: 'Created Date',
      key: 'createdAt',
      render: (item) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item) => (
        <button
          type="button"
          onClick={() => handleViewDetail(item._id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Details</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Booking Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor real-time appointments, payment records, order dispatches, and supervise service executions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchBookings();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Live Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block truncate">Total Bookings</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {isStatsLoading ? '...' : stats?.total ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <span className="text-xs font-medium text-amber-700 block truncate">Pending</span>
          <span className="text-xl font-bold text-amber-600 mt-1 block">
            {isStatsLoading ? '...' : stats?.pending ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/20 shadow-xs">
          <span className="text-xs font-medium text-sky-700 block truncate">Accepted</span>
          <span className="text-xl font-bold text-sky-600 mt-1 block">
            {isStatsLoading ? '...' : stats?.accepted ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/20 shadow-xs">
          <span className="text-xs font-medium text-indigo-700 block truncate">In Progress</span>
          <span className="text-xl font-bold text-indigo-600 mt-1 block">
            {isStatsLoading ? '...' : stats?.in_progress ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
          <span className="text-xs font-medium text-emerald-700 block truncate">Completed</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">
            {isStatsLoading ? '...' : stats?.completed ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
          <span className="text-xs font-medium text-rose-700 block truncate">Cancelled</span>
          <span className="text-xl font-bold text-rose-600 mt-1 block">
            {isStatsLoading ? '...' : stats?.cancelled ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-rose-600 block truncate">Failed Payments</span>
          <span className="text-xl font-bold text-rose-600 mt-1 block">
            {isStatsLoading ? '...' : stats?.failedPayments ?? 0}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <span className="text-xs font-medium text-emerald-800 block truncate">Total Revenue</span>
          <span className="text-lg font-bold text-emerald-700 mt-1 block truncate" title={`₹${stats?.totalRevenue || 0}`}>
            {isStatsLoading ? '...' : `₹${(stats?.totalRevenue || 0).toLocaleString('en-IN')}`}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by reference, customer, provider, service..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 shadow-xs"
            />
          </div>

          {/* Booking Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
            >
              <option value="all">All Booking Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Payment Pending</option>
              <option value="failed">Payment Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Reset Filters Action */}
          <div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Date Range Selection Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-500">Date Range (Created):</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-md text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-md text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Card>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchBookings}
            className="text-xs text-rose-700 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Bookings Data Table */}
      <DataTable
        columns={columns}
        data={bookings}
        isLoading={isLoading}
        emptyTitle="No Bookings Found"
        emptyDescription="No booking records match the selected query criteria. Try adjusting the search term or status filters."
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500">
            Showing Page <span className="font-semibold text-slate-800">{pagination.page}</span> of{' '}
            <span className="font-semibold text-slate-800">{pagination.totalPages}</span> ({pagination.total} Total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Booking Details Modal / Drawer */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">
                  Booking Reference
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {selectedBooking.bookingReference}
                </h2>
                <span className="text-xs text-slate-400">
                  Created on {new Date(selectedBooking.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Alerts inside Modal */}
            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Status & Mode Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Booking Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_BADGES[selectedBooking.status]
                  }`}
                >
                  {selectedBooking.status.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Dispatch Mode:</span>
                <span className="text-xs font-bold text-slate-800 capitalize">
                  {selectedBooking.bookingMode}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Payment Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    PAYMENT_BADGES[selectedBooking.paymentStatus]
                  }`}
                >
                  {selectedBooking.paymentStatus.toUpperCase()}
                </span>
              </div>
            </div>

            {/* 3-Column Profile Cards: Customer, Provider, Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Customer Info */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase">
                  <User className="w-4 h-4" />
                  <span>Customer Details</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">
                  {selectedBooking.customer?.user?.name || 'Customer Profile'}
                </p>
                <p className="text-xs text-slate-600">
                  Phone: {selectedBooking.customer?.user?.phone || 'N/A'}
                </p>
                <p className="text-xs text-slate-600">
                  Email: {selectedBooking.customer?.user?.email || 'N/A'}
                </p>
              </div>

              {/* Provider Info */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase">
                  <Building className="w-4 h-4" />
                  <span>Assigned Provider</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">
                  {selectedBooking.provider?.businessName || selectedBooking.provider?.user?.name || (
                    <span className="text-amber-600 font-normal italic">Unassigned (Pool)</span>
                  )}
                </p>
                <p className="text-xs text-slate-600">
                  Contact: {selectedBooking.provider?.user?.phone || 'N/A'}
                </p>
                <p className="text-xs text-slate-600">
                  Email: {selectedBooking.provider?.user?.email || 'N/A'}
                </p>
              </div>

              {/* Schedule & Address */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase">
                  <MapPin className="w-4 h-4" />
                  <span>Service Location</span>
                </div>
                <p className="text-xs font-medium text-slate-800">
                  {selectedBooking.bookingMode === 'instant'
                    ? '⚡ Instant Request (ASAP)'
                    : `${new Date(selectedBooking.scheduledDate).toLocaleDateString('en-IN')} (${selectedBooking.scheduledTimeSlot?.startTime} - ${selectedBooking.scheduledTimeSlot?.endTime})`}
                </p>
                <p className="text-xs text-slate-600">
                  {selectedBooking.address?.street}, {selectedBooking.address?.city}{' '}
                  {selectedBooking.address?.zipCode}
                </p>
              </div>
            </div>

            {/* Financial & Payment Breakdown */}
            <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Financial & Payment Breakdown</span>
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Method: {selectedBooking.paymentMethod}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Base Price</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    ₹{selectedBooking.pricing?.basePrice || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Tax / GST</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    ₹{selectedBooking.pricing?.tax || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Discount</span>
                  <span className="font-bold text-emerald-600 text-sm mt-0.5 block">
                    -₹{selectedBooking.pricing?.discount || 0}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <span className="text-indigo-700 font-semibold block">Total Service Amount</span>
                  <span className="font-bold text-indigo-950 text-base mt-0.5 block">
                    ₹{selectedBooking.pricing?.totalAmount || 0}
                  </span>
                </div>
              </div>

              {/* Payment Gateway Transaction Evidence */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                {selectedBooking.paymentDetails?.razorpayOrderId && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Razorpay Order ID:</span>
                    <span className="font-mono text-slate-800 select-all">
                      {selectedBooking.paymentDetails.razorpayOrderId}
                    </span>
                  </div>
                )}
                {selectedBooking.paymentDetails?.razorpayPaymentId && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Payment Transaction ID:</span>
                    <span className="font-mono text-emerald-700 font-semibold select-all">
                      {selectedBooking.paymentDetails.razorpayPaymentId}
                    </span>
                  </div>
                )}
                {selectedBooking.paymentDetails?.paidAt && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Payment Recorded At:</span>
                    <span>{new Date(selectedBooking.paymentDetails.paidAt).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {selectedBooking.paymentDetails?.cashConfirmedByProvider && (
                  <div className="col-span-full p-2 bg-emerald-50 rounded-md text-emerald-800 text-[11px] flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cash payment verified & confirmed by provider on {new Date(selectedBooking.paymentDetails.cashConfirmedByProviderAt).toLocaleString('en-IN')}.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Approved Spare Parts / Additional Materials (if applicable) */}
            {selectedBooking.spareParts?.items?.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Extra Materials / Spare Parts</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-700">
                    Status: {selectedBooking.spareParts.status.toUpperCase()} (₹{selectedBooking.spareParts.totalAdditionalAmount || 0})
                  </span>
                </div>
                <div className="divide-y divide-slate-200 border-t border-slate-200 text-xs">
                  {selectedBooking.spareParts.items.map((part, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">{part.name}</span>
                        {part.description && <span className="text-slate-500 block text-[11px]">{part.description}</span>}
                      </div>
                      <div className="text-right">
                        <span className="text-slate-700 font-medium">Qty: {part.quantity} × ₹{part.unitPrice}</span>
                        <span className="block font-bold text-slate-900">Total: ₹{part.totalPrice}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status History & Audit Timestamps */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase block">Status History & Timestamps</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Accepted At:</span>
                  <span className="text-slate-700 font-medium">
                    {selectedBooking.statusTimestamps?.acceptedAt
                      ? new Date(selectedBooking.statusTimestamps.acceptedAt).toLocaleString('en-IN')
                      : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">In Progress At:</span>
                  <span className="text-slate-700 font-medium">
                    {selectedBooking.statusTimestamps?.inProgressAt
                      ? new Date(selectedBooking.statusTimestamps.inProgressAt).toLocaleString('en-IN')
                      : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Completed At:</span>
                  <span className="text-slate-700 font-medium">
                    {selectedBooking.statusTimestamps?.completedAt
                      ? new Date(selectedBooking.statusTimestamps.completedAt).toLocaleString('en-IN')
                      : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Cancelled At:</span>
                  <span className="text-rose-600 font-medium">
                    {selectedBooking.statusTimestamps?.cancelledAt
                      ? new Date(selectedBooking.statusTimestamps.cancelledAt).toLocaleString('en-IN')
                      : 'None'}
                  </span>
                </div>
              </div>

              {selectedBooking.cancellationReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 mt-2">
                  <span className="font-bold">Cancellation Reason ({selectedBooking.cancelledBy}):</span>{' '}
                  {selectedBooking.cancellationReason}
                </div>
              )}
            </div>

            {/* Review Section (if customer provided rating) */}
            {selectedBooking.review && (
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-amber-800 uppercase block">Customer Rating & Review</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700">★ {selectedBooking.review.rating} / 5</span>
                  <span className="text-xs text-slate-600">"{selectedBooking.review.comment}"</span>
                </div>
              </div>
            )}

            {/* Supervised Administrative Actions */}
            {['pending', 'accepted', 'in_progress'].includes(selectedBooking.status) && (
              <div className="p-4 border border-rose-200 bg-rose-50/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-800 uppercase">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Supervised Administrative Cancellation</span>
                </div>
                <p className="text-xs text-slate-600">
                  In accordance with platform safety and dispute policy, administrators can cancel active orders. Please provide a mandatory reason for the audit trail.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Enter explicit cancellation justification..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAdminCancel}
                    disabled={isCancelling}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isCancelling ? 'Processing...' : 'Cancel Order as Admin'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
