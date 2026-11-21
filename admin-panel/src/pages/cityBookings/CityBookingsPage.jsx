import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  Download,
  RefreshCw,
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  MapPin,
  TrendingUp,
  X,
  PieChart,
  BarChart3,
  Layers,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cityAnalyticsApi, categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const PERIOD_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Previous Month', value: 'prev_month' },
  { label: 'Custom Range', value: 'custom' }
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Rejected', value: 'rejected' }
];

const CityBookingsPage = () => {
  // Filter States
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('totalBookings');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data & UI States
  const [analyticsData, setAnalyticsData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Load Categories for Filter Dropdown
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await categoryApi.getAll();
        if (res?.success) {
          setCategories(res.data?.categories || res.data || []);
        }
      } catch (err) {
        console.warn('Failed to load categories for filter', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch City Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        period,
        status,
        category,
        search: searchTerm.trim() || undefined,
        sortBy,
        sortOrder,
        page,
        limit: pageSize
      };

      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await cityAnalyticsApi.getCities(params);
      if (res?.success) {
        setAnalyticsData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch city analytics');
      }
    } catch (err) {
      setError(err.userMessage || err.message || 'Error loading city-wise booking data.');
    } finally {
      setIsLoading(false);
    }
  }, [period, startDate, endDate, status, category, searchTerm, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle Search Input Change (resets to page 1)
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  // Handle Sort Toggle
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Handle CSV Export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const params = {
        type: 'summary',
        period,
        status,
        category,
        search: searchTerm.trim() || undefined
      };
      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const blob = await cityAnalyticsApi.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `city_wise_booking_summary_${period}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to export CSV: ' + (err.userMessage || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  const summary = analyticsData?.summary || {};
  const cities = analyticsData?.cities || [];
  const pagination = analyticsData?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

  // Calculate Top Cities for Visual Comparison Charts
  const topCitiesByBookings = [...cities].sort((a, b) => b.totalBookings - a.totalBookings).slice(0, 5);
  const maxBookingCount = topCitiesByBookings.length > 0 ? Math.max(...topCitiesByBookings.map((c) => c.totalBookings)) : 1;

  const topCitiesByRevenue = [...cities].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxRevenueAmount = topCitiesByRevenue.length > 0 ? Math.max(...topCitiesByRevenue.map((c) => c.revenue)) : 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">City-wise Booking Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              MENDROO Super Admin
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time fulfillment metrics, verified booking revenue, and city-level demand distribution across India.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting || isLoading || cities.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Exporting...' : 'Export All Summaries (CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-4">
        {/* Row 1: Quick Date Range Pills */}
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

        {/* Row 2: Custom Date Range (conditional), Status, Category, and City Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Custom Date Inputs */}
          {period === 'custom' ? (
            <div className="col-span-1 sm:col-span-2 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by city name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

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
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Service Category Dropdown */}
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

          {/* Search box if custom date range was shown */}
          {period === 'custom' && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search city..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="text-xs text-rose-700 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* A. City Overview Dashboard: 6 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Cities */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Cities</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{summary.totalCities || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Active coverage areas</span>
          </div>
        </div>

        {/* 2. Total Bookings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Bookings</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{summary.totalBookings || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Across all locations</span>
          </div>
        </div>

        {/* 3. Completed Bookings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700">{summary.completedBookings || 0}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
              {summary.totalBookings > 0
                ? `${Math.round((summary.completedBookings / summary.totalBookings) * 100)}% fulfillment`
                : '0% fulfillment'}
            </span>
          </div>
        </div>

        {/* 4. Pending Bookings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-800">{summary.pendingBookings || 0}</span>
            <span className="text-[10px] text-amber-600 block mt-0.5">Awaiting provider</span>
          </div>
        </div>

        {/* 5. Cancelled Bookings */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Cancelled</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-700">{summary.cancelledBookings || 0}</span>
            <span className="text-[10px] text-rose-600 block mt-0.5">
              {summary.totalBookings > 0
                ? `${Math.round((summary.cancelledBookings / summary.totalBookings) * 100)}% churn`
                : '0% churn'}
            </span>
          </div>
        </div>

        {/* 6. Total Revenue */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Verified Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-slate-900 block truncate">
              ₹{(summary.totalRevenue || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">
              Commission: ₹{(summary.platformEarnings || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* E. Visual Charts: Comparison & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Top Cities by Booking Volume */}
        <Card title="Top Cities by Booking Volume" subtitle="Marketplace service demand ranking">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center">
              <LoadingSpinner size="sm" color="indigo" />
            </div>
          ) : topCitiesByBookings.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No booking records found.</div>
          ) : (
            <div className="space-y-3 p-1">
              {topCitiesByBookings.map((city, idx) => {
                const pct = Math.round((city.totalBookings / maxBookingCount) * 100);
                return (
                  <div key={city.cityKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span className="w-4 text-center text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <Link to={`/city-bookings/${city.cityKey}`} className="hover:text-indigo-600 hover:underline">
                          {city.cityName}
                        </Link>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-bold text-slate-900">{city.totalBookings}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({city.completed} done)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Chart 2: Top Cities by Revenue */}
        <Card title="Top Cities by Revenue (₹)" subtitle="Verified paid gross transaction value">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center">
              <LoadingSpinner size="sm" color="indigo" />
            </div>
          ) : topCitiesByRevenue.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No revenue data available.</div>
          ) : (
            <div className="space-y-3 p-1">
              {topCitiesByRevenue.map((city, idx) => {
                const pct = maxRevenueAmount > 0 ? Math.round((city.revenue / maxRevenueAmount) * 100) : 0;
                return (
                  <div key={city.cityKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span className="w-4 text-center text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <Link to={`/city-bookings/${city.cityKey}`} className="hover:text-indigo-600 hover:underline">
                          {city.cityName}
                        </Link>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-bold text-emerald-800">₹{city.revenue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Chart 3: Booking Status Distribution */}
        <Card title="Overall Fulfillment Distribution" subtitle="Order pipeline breakdown">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center">
              <LoadingSpinner size="sm" color="indigo" />
            </div>
          ) : !summary.totalBookings ? (
            <div className="p-6 text-center text-xs text-slate-400">No booking activity recorded.</div>
          ) : (
            <div className="space-y-3 p-1 text-xs">
              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Completed
                  </span>
                  <span className="font-bold text-slate-900">
                    {summary.completedBookings || 0} (
                    {Math.round(((summary.completedBookings || 0) / summary.totalBookings) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${Math.round(((summary.completedBookings || 0) / summary.totalBookings) * 100)}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span className="flex items-center gap-1.5 text-sky-700">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Accepted
                  </span>
                  <span className="font-bold text-slate-900">
                    {summary.acceptedBookings || 0} (
                    {Math.round(((summary.acceptedBookings || 0) / summary.totalBookings) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{
                      width: `${Math.round(((summary.acceptedBookings || 0) / summary.totalBookings) * 100)}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Pending
                  </span>
                  <span className="font-bold text-slate-900">
                    {summary.pendingBookings || 0} (
                    {Math.round(((summary.pendingBookings || 0) / summary.totalBookings) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${Math.round(((summary.pendingBookings || 0) / summary.totalBookings) * 100)}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Cancelled
                  </span>
                  <span className="font-bold text-slate-900">
                    {summary.cancelledBookings || 0} (
                    {Math.round(((summary.cancelledBookings || 0) / summary.totalBookings) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{
                      width: `${Math.round(((summary.cancelledBookings || 0) / summary.totalBookings) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* B. City-wise Booking Table */}
      <Card title="City-wise Booking Table" subtitle="Comprehensive performance metrics by location">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <LoadingSpinner size="lg" color="indigo" />
            <p className="text-xs text-slate-500">Aggregating live bookings from MongoDB...</p>
          </div>
        ) : cities.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No City Records Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No service booking records matched your search query or filter parameters. Try adjusting the date range or
              status.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase bg-slate-50 tracking-wider">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('city')}
                      className="flex items-center gap-1 hover:text-slate-900 font-bold"
                    >
                      <span>City Name</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort('totalBookings')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 font-bold"
                    >
                      <span>Total Bookings</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center">Pending</th>
                  <th className="py-3 px-3 text-center">Accepted</th>
                  <th className="py-3 px-3 text-center">In Progress</th>
                  <th className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort('completed')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 font-bold text-emerald-700"
                    >
                      <span>Completed</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center text-rose-700">Cancelled</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('revenue')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 font-bold ml-auto"
                    >
                      <span>Verified Revenue (₹)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cities.map((city) => (
                  <tr key={city.cityKey} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        <div>
                          <Link
                            to={`/city-bookings/${city.cityKey}`}
                            className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-xs block"
                          >
                            {city.cityName}
                          </Link>
                          <span className="text-[10px] text-slate-400 font-mono">key: {city.cityKey}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center font-bold text-slate-900 text-sm">
                      {city.totalBookings}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        {city.pending}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        {city.accepted}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {city.inProgress}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {city.completed} ({city.completionRate}%)
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        {city.cancelled}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-black text-slate-900 text-sm">₹{city.revenue.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-emerald-600 font-medium">
                        Share: ₹{city.platformEarnings.toLocaleString('en-IN')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <Link
                        to={`/city-bookings/${city.cityKey}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </Link>
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
                  of <span className="font-semibold text-slate-900">{pagination.total}</span> cities
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

export default CityBookingsPage;
