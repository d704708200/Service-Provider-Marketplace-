import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  X,
  User,
  Building,
  CalendarCheck
} from 'lucide-react';
import { reviewApi } from '../../services/api';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const ReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, averageRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  // Detail Modal State
  const [selectedReview, setSelectedReview] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (ratingFilter !== 'all') params.rating = ratingFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await reviewApi.getAdminReviews(params);
      if (res?.success) {
        setReviews(res.data || []);
        if (res.stats) setStats(res.stats);
        if (res.pagination) setPagination(res.pagination);
      } else {
        throw new Error(res?.message || 'Failed to load reviews');
      }
    } catch (err) {
      setError(err.userMessage || err.message || 'Failed to load reviews from backend server.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, ratingFilter, statusFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  const handleToggleVisibility = async (review) => {
    setActionError(null);
    setActionSuccess(null);
    const newStatus = !review.isPublic;
    try {
      const res = await reviewApi.updateReviewVisibility(review._id, newStatus);
      if (res?.success) {
        setActionSuccess(`Review ${newStatus ? 'restored to public view' : 'hidden from public view'} successfully.`);
        if (selectedReview?._id === review._id) {
          setSelectedReview((prev) => ({ ...prev, isPublic: newStatus }));
        }
        fetchReviews();
      }
    } catch (err) {
      setActionError(err.userMessage || 'Failed to update review visibility.');
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Are you sure you want to permanently delete this customer review? This action cannot be undone.')) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await reviewApi.deleteReview(review._id);
      if (res?.success) {
        setActionSuccess('Review deleted successfully.');
        if (selectedReview?._id === review._id) {
          setSelectedReview(null);
        }
        fetchReviews();
      }
    } catch (err) {
      setActionError(err.userMessage || 'Failed to delete review.');
    }
  };

  const reviewColumns = [
    {
      header: 'Review ID',
      key: 'id',
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-slate-700">
          {item._id?.slice(-8).toUpperCase()}
        </span>
      )
    },
    {
      header: 'Score Rating',
      key: 'rating',
      render: (item) => (
        <div className="flex items-center gap-1">
          <span className="text-amber-500 font-bold text-sm">★</span>
          <span className="font-bold text-slate-900 text-xs">{item.rating}</span>
          <span className="text-[10px] text-slate-400">/ 5</span>
        </div>
      )
    },
    {
      header: 'Reviewer (Customer)',
      key: 'customer',
      render: (item) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block">
            {item.customer?.user?.name || 'Customer'}
          </span>
          <span className="text-[11px] text-slate-500">
            {item.customer?.user?.phone || item.customer?.user?.email || 'Verified Consumer'}
          </span>
        </div>
      )
    },
    {
      header: 'Provider Reviewed',
      key: 'provider',
      render: (item) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block">
            {item.provider?.businessName || item.provider?.user?.name || 'Provider'}
          </span>
          <span className="text-[11px] text-indigo-600">
            {item.service?.name || 'Platform Service'}
          </span>
        </div>
      )
    },
    {
      header: 'Review Content',
      key: 'comment',
      render: (item) => (
        <p className="text-xs text-slate-700 max-w-xs truncate" title={item.comment}>
          "{item.comment || 'No text feedback provided'}"
        </p>
      )
    },
    {
      header: 'Date Posted',
      key: 'createdAt',
      render: (item) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : 'N/A'}
        </span>
      )
    },
    {
      header: 'Moderation Status',
      key: 'isPublic',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
            item.isPublic
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {item.isPublic ? 'Public' : 'Hidden'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedReview(item)}
            className="p-1 text-slate-600 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
            title="Inspect Review"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleVisibility(item)}
            className="p-1 text-slate-600 hover:text-amber-600 rounded-md hover:bg-slate-100 transition-colors"
            title={item.isPublic ? 'Hide Review' : 'Restore Review'}
          >
            {item.isPublic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => handleDeleteReview(item)}
            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors"
            title="Delete Review"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reviews & Ratings Moderation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Moderate consumer feedback, inspect provider rating distributions, and manage flagged reviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchReviews}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
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

      {/* Ratings Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Star className="w-6 h-6 fill-amber-500" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Average Platform Score</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">{stats.averageRating}</span>
              <span className="text-xs text-slate-400">out of 5.0</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Customer Reviews</span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-center text-xs space-y-1">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] block mb-1">Score Breakdown</span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-600">5 Stars: <strong>{stats.distribution[5] || 0}</strong></span>
            <span className="text-slate-600">4 Stars: <strong>{stats.distribution[4] || 0}</strong></span>
            <span className="text-slate-600">3 Stars: <strong>{stats.distribution[3] || 0}</strong></span>
            <span className="text-slate-600">1-2 Stars: <strong>{(stats.distribution[1] || 0) + (stats.distribution[2] || 0)}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name, provider, or review feedback..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="all">All Star Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="all">All Moderation Status</option>
              <option value="published">Public / Published</option>
              <option value="hidden">Hidden / Moderated</option>
            </select>
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
            onClick={fetchReviews}
            className="text-xs text-rose-700 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Reviews Data Table */}
      <DataTable
        columns={reviewColumns}
        data={reviews}
        isLoading={isLoading}
        emptyTitle="No Customer Reviews Recorded"
        emptyDescription="Customer feedback, ratings, and moderation flags will appear here once booking completion reviews occur."
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} Total Reviews)
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

      {/* Review Details Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">Customer Review Details</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-amber-500">★ {selectedReview.rating} / 5</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      selectedReview.isPublic
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {selectedReview.isPublic ? 'Public' : 'Hidden'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase block">Review Comment</span>
              <p className="text-sm text-slate-800 italic leading-relaxed">
                "{selectedReview.comment || 'No written feedback provided'}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-400 block">Customer</span>
                <span className="font-semibold text-slate-900 block mt-0.5">{selectedReview.customer?.user?.name}</span>
                <span className="text-slate-500 block text-[11px]">{selectedReview.customer?.user?.phone || selectedReview.customer?.user?.email}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-400 block">Provider</span>
                <span className="font-semibold text-slate-900 block mt-0.5">{selectedReview.provider?.businessName || selectedReview.provider?.user?.name}</span>
                <span className="text-indigo-600 block text-[11px]">{selectedReview.service?.name}</span>
              </div>
            </div>

            {selectedReview.booking && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <span className="text-slate-400 block">Linked Booking Reference:</span>
                <span className="font-mono font-bold text-indigo-700">{selectedReview.booking.bookingReference}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleToggleVisibility(selectedReview)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  selectedReview.isPublic
                    ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                    : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {selectedReview.isPublic ? 'Hide from Public Discovery' : 'Restore to Public Discovery'}
              </button>

              <button
                type="button"
                onClick={() => handleDeleteReview(selectedReview)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;
