import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  XCircle,
  Clock,
  CheckCircle,
  MapPin,
  User,
  Building,
  CreditCard,
  Wrench,
  Package,
  ShieldCheck
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

const RequestsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Detail Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await bookingApi.getAdminBookings(params);
      if (res.success) {
        setBookings(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err.userMessage || 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, searchTerm]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleViewDetail = async (id) => {
    setIsDetailLoading(true);
    setActionError(null);
    setCancelReason('');
    try {
      const res = await bookingApi.getAdminBookingById(id);
      if (res.success && res.data) {
        setSelectedBooking(res.data);
      }
    } catch (err) {
      alert(err.userMessage || 'Could not fetch booking details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleAdminCancel = async () => {
    if (!selectedBooking) return;
    setIsCancelling(true);
    setActionError(null);
    try {
      const res = await bookingApi.cancelBooking(
        selectedBooking._id,
        cancelReason || 'Cancelled by administrator'
      );
      if (res.success) {
        setSelectedBooking(res.data);
        fetchBookings();
      }
    } catch (err) {
      setActionError(err.userMessage || 'Cancellation failed');
    } finally {
      setIsCancelling(false);
    }
  };

  const columns = [
    {
      header: 'Booking ID',
      key: 'bookingId',
      render: (item) => (
        <div>
          <span className="font-semibold text-indigo-600 block">{item.bookingReference}</span>
          <span className="text-xs text-slate-400">
            {item.bookingMode === 'instant' ? '⚡ Instant (ASAP)' : '📅 Scheduled'}
          </span>
        </div>
      )
    },
    {
      header: 'Customer',
      key: 'customerName',
      render: (item) => (
        <div>
          <span className="font-medium text-slate-800 block">
            {item.customer?.user?.name || 'Customer'}
          </span>
          <span className="text-xs text-slate-500">{item.customer?.user?.phone || 'No phone'}</span>
        </div>
      )
    },
    {
      header: 'Service Requested',
      key: 'serviceTitle',
      render: (item) => (
        <div>
          <span className="font-medium text-slate-800 block">{item.service?.name || 'Service'}</span>
          <span className="text-xs text-slate-400 capitalize">{item.service?.priceType || 'fixed'}</span>
        </div>
      )
    },
    {
      header: 'Provider Assigned',
      key: 'providerName',
      render: (item) => (
        <div>
          <span className="font-medium text-slate-800 block">
            {item.provider?.businessName || item.provider?.user?.name || (
              <span className="text-amber-600 font-normal italic">Unassigned (Pool)</span>
            )}
          </span>
          {item.provider?.user?.phone && (
            <span className="text-xs text-slate-400">{item.provider.user.phone}</span>
          )}
        </div>
      )
    },
    {
      header: 'Scheduled Time',
      key: 'scheduledTime',
      render: (item) => (
        <div>
          {item.bookingMode === 'instant' ? (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm">
              ASAP
            </span>
          ) : (
            <>
              <span className="text-xs text-slate-800 block">
                {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString() : 'N/A'}
              </span>
              <span className="text-xs text-slate-400">
                {item.scheduledTimeSlot?.startTime} - {item.scheduledTimeSlot?.endTime}
              </span>
            </>
          )}
        </div>
      )
    },
    {
      header: 'Payment',
      key: 'payment',
      render: (item) => (
        <div>
          <span className="font-semibold text-xs text-slate-800 uppercase block">
            {item.paymentMethod || 'CASH'}
          </span>
          <span
            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
              item.paymentStatus === 'paid'
                ? 'bg-emerald-50 text-emerald-700'
                : item.paymentStatus === 'failed'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {item.paymentStatus?.toUpperCase() || 'PENDING'}
          </span>
        </div>
      )
    },
    {
      header: 'Order Total',
      key: 'amount',
      render: (item) => (
        <span className="font-semibold text-slate-900">
          ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
        </span>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
            STATUS_BADGES[item.status] || 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {item.status.toUpperCase()}
        </span>
      )
    },
    {
      header: 'Created At',
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
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Requests & Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Supervise consumer order dispatching, booking progression, dispute mediation, and status lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchBookings}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Orders</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Reference (BK-...), city, street..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="all">Status: All Bookings</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Error Banner with Retry */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchBookings}
            className="px-3 py-1 text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Requests Data Table */}
      {!error && (
        <DataTable
          columns={columns}
          data={bookings}
          isLoading={isLoading}
          emptyTitle="No Service Bookings Recorded"
          emptyDescription="Consumer requests and provider assignments will stream here in real time as bookings are created."
          pendingApi={false}
        />
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg">
          <span className="text-xs text-slate-500">
            Showing Page <span className="font-semibold">{pagination.page}</span> of{' '}
            <span className="font-semibold">{pagination.totalPages}</span> ({pagination.total} total bookings)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                  Booking Reference
                </span>
                <h2 className="text-xl font-bold text-slate-900">{selectedBooking.bookingReference}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Mode Banner */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    STATUS_BADGES[selectedBooking.status]
                  }`}
                >
                  {selectedBooking.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Mode:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {selectedBooking.bookingMode}
                </span>
              </div>
            </div>

            {/* Service & Pricing Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase">Service Details</h3>
                <p className="font-semibold text-slate-900">{selectedBooking.service?.name}</p>
                <p className="text-xs text-slate-500">
                  Base Price: ₹{selectedBooking.pricing?.basePrice} | Total: ₹{selectedBooking.pricing?.totalAmount}
                </p>
                <p className="text-xs text-slate-500">
                  Payment: <span className="font-semibold text-slate-700">{selectedBooking.paymentMethod?.toUpperCase()}</span> ({selectedBooking.paymentStatus})
                </p>
                {selectedBooking.paymentDetails?.razorpayOrderId && (
                  <p className="text-[11px] font-mono text-slate-500">
                    Order Ref: {selectedBooking.paymentDetails.razorpayOrderId}
                  </p>
                )}
                {selectedBooking.paymentDetails?.razorpayPaymentId && (
                  <p className="text-[11px] font-mono text-emerald-600">
                    Payment ID: {selectedBooking.paymentDetails.razorpayPaymentId}
                  </p>
                )}
                {selectedBooking.paymentDetails?.paidAt && (
                  <p className="text-[11px] text-slate-500">
                    Paid At: {new Date(selectedBooking.paymentDetails.paidAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase">Schedule & Address</h3>
                <p className="text-xs text-slate-700">
                  <span className="font-semibold">Date/Slot:</span>{' '}
                  {selectedBooking.bookingMode === 'instant'
                    ? 'ASAP (Instant Request)'
                    : `${new Date(selectedBooking.scheduledDate).toLocaleDateString()} (${selectedBooking.scheduledTimeSlot?.startTime} - ${selectedBooking.scheduledTimeSlot?.endTime})`}
                </p>
                <p className="text-xs text-slate-700">
                  <span className="font-semibold">Address:</span> {selectedBooking.address?.street},{' '}
                  {selectedBooking.address?.city} {selectedBooking.address?.zipCode}
                </p>
              </div>
            </div>

            {/* Spare Parts & Materials Breakdown Section */}
            {selectedBooking.spareParts &&
              selectedBooking.spareParts.status !== 'none' &&
              selectedBooking.spareParts.items?.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase">
                        Spare Parts & Materials Breakdown
                      </h3>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedBooking.spareParts.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selectedBooking.spareParts.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {selectedBooking.spareParts.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 text-xs">
                    {selectedBooking.spareParts.items.map((part, pIdx) => (
                      <div key={pIdx} className="py-2 flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{part.name}</p>
                          {part.description && (
                            <p className="text-[11px] text-slate-500">{part.description}</p>
                          )}
                          <p className="text-[11px] text-indigo-600">
                            Qty: {part.quantity} × ₹{part.unitPrice}
                            {part.labourCharge > 0 ? ` + Labour: ₹${part.labourCharge}` : ''}
                          </p>
                          {part.notes && (
                            <p className="text-[10px] text-slate-400 italic">Note: {part.notes}</p>
                          )}
                        </div>
                        <span className="font-bold text-slate-800">₹{part.totalPrice}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">ORIGINAL SERVICE</span>
                      <span className="font-bold text-slate-800">
                        ₹{selectedBooking.spareParts.originalServiceAmount || selectedBooking.pricing?.basePrice}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">PARTS SUBTOTAL</span>
                      <span className="font-bold text-slate-800">
                        ₹{selectedBooking.spareParts.partsSubtotal || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">LABOUR SUBTOTAL</span>
                      <span className="font-bold text-slate-800">
                        ₹{selectedBooking.spareParts.labourSubtotal || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-600 block text-[10px] font-bold">REVISED PAYABLE</span>
                      <span className="font-extrabold text-indigo-700">
                        ₹{selectedBooking.pricing?.totalAmount}
                      </span>
                    </div>
                  </div>

                  {selectedBooking.spareParts.rejectionReason && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                      <span className="font-bold">Rejection Reason: </span>
                      {selectedBooking.spareParts.rejectionReason}
                    </div>
                  )}

                  {selectedBooking.spareParts.paymentStatus && (
                    <div className="text-[11px] text-slate-500">
                      Payment Status:{' '}
                      <span className="font-semibold capitalize text-slate-700">
                        {selectedBooking.spareParts.paymentStatus}
                      </span>
                    </div>
                  )}
                </div>
              )}

            {/* Customer & Provider Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase">
                  <User className="w-4 h-4" />
                  <span>Customer Profile</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">
                  {selectedBooking.customer?.user?.name || 'Customer'}
                </p>
                <p className="text-xs text-slate-500">{selectedBooking.customer?.user?.email}</p>
                <p className="text-xs text-slate-500">{selectedBooking.customer?.user?.phone}</p>
              </div>

              <div className="p-4 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase">
                  <Building className="w-4 h-4" />
                  <span>Assigned Provider</span>
                </div>
                {selectedBooking.provider ? (
                  <>
                    <p className="font-semibold text-slate-900 text-sm">
                      {selectedBooking.provider.businessName || selectedBooking.provider.user?.name}
                    </p>
                    <p className="text-xs text-slate-500">{selectedBooking.provider.user?.email}</p>
                    <p className="text-xs text-slate-500">{selectedBooking.provider.user?.phone}</p>
                  </>
                ) : (
                  <p className="text-xs text-amber-600 italic">No provider assigned yet (Instant pool)</p>
                )}
              </div>
            </div>

            {/* Notes */}
            {selectedBooking.notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <span className="font-bold">Customer Notes: </span>
                {selectedBooking.notes}
              </div>
            )}

            {/* Cancellation info if cancelled */}
            {selectedBooking.status === 'cancelled' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                <p className="font-bold">Cancelled by: {selectedBooking.cancelledBy || 'Platform'}</p>
                <p>Reason: {selectedBooking.cancellationReason || 'No reason provided'}</p>
                {selectedBooking.statusTimestamps?.cancelledAt && (
                  <p className="text-rose-600">
                    At: {new Date(selectedBooking.statusTimestamps.cancelledAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Admin Cancellation Action */}
            {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase">Administrator Actions</h4>
                {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Supervisory cancellation reason..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAdminCancel}
                    disabled={isCancelling}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
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

export default RequestsPage;
