import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  ShieldCheck,
  Wrench,
  CalendarCheck,
  Calendar,
  ArrowRight,
  Activity,
  Layers,
  Settings,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../services/api';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';

const quickActions = [
  { title: 'Review Providers', link: '/provider-verification', icon: ShieldCheck },
  { title: 'Booking Management', link: '/bookings', icon: Calendar },
  { title: 'Manage Categories', link: '/categories', icon: Layers },
  { title: 'Service Catalog', link: '/services', icon: Wrench },
  { title: 'System Settings', link: '/settings', icon: Settings }
];

const STATUS_BADGES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

const Dashboard = () => {
  const { user, profile } = useAuth();
  const adminName = user?.name || 'Administrator';
  const department = profile?.department || 'Operations';

  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, activityRes] = await Promise.all([
        dashboardApi.getOverviewStats(),
        dashboardApi.getRecentActivity()
      ]);

      if (overviewRes?.success) {
        setStats(overviewRes.data);
      }
      if (activityRes?.success) {
        setActivities(activityRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setError(err.userMessage || 'Failed to fetch live platform statistics from backend server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const cards = [
    {
      title: 'Registered Customers',
      value: stats?.customersCount,
      icon: Users,
      description: 'Active client accounts in MongoDB',
      link: '/customers',
      color: 'text-sky-600 bg-sky-50'
    },
    {
      title: 'Service Providers',
      value: stats?.providersCount,
      icon: Briefcase,
      description: 'Registered contractors & agencies',
      link: '/providers',
      color: 'text-indigo-600 bg-indigo-50'
    },
    {
      title: 'Pending Verifications',
      value: stats?.pendingVerificationsCount,
      icon: ShieldCheck,
      description: 'Awaiting credential & KYC review',
      link: '/provider-verification',
      color: 'text-amber-600 bg-amber-50'
    },
    {
      title: 'Service Catalog',
      value: stats?.servicesCount,
      icon: Wrench,
      description: 'Configured marketplace services',
      link: '/services',
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      title: 'Total Bookings',
      value: stats?.bookingStats?.total,
      icon: CalendarCheck,
      description: 'Platform service bookings & requests',
      link: '/bookings',
      color: 'text-purple-600 bg-purple-50'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {department} Division
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {adminName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Marketplace administrative console and live service oversight portal.
          </p>
        </div>

        {/* Status Callout & Refresh */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Live MongoDB Telemetry</span>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="text-xs text-rose-700 font-semibold hover:underline"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Summary Stat Cards with Live Backend Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {stat.title}
                  </span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Live Value Indicator */}
                <div className="mt-3 flex items-baseline gap-2">
                  {isLoading ? (
                    <span className="text-2xl font-bold text-slate-400">...</span>
                  ) : stat.value !== undefined && stat.value !== null ? (
                    <span className="text-3xl font-extrabold text-slate-900">
                      {stat.value.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-slate-400">0</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{stat.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link
                  to={stat.link}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <span>Open Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Financial & Booking Fulfillment Breakdown */}
      {stats?.bookingStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block truncate">Total Revenue</span>
            <span className="text-lg font-bold text-emerald-600 mt-1 block">
              ₹{(stats.bookingStats.totalRevenue || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block truncate">Completed Orders</span>
            <span className="text-lg font-bold text-slate-800 mt-1 block">
              {stats.bookingStats.completed || 0}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block truncate">In Progress</span>
            <span className="text-lg font-bold text-indigo-600 mt-1 block">
              {stats.bookingStats.in_progress || 0}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block truncate">Pending Dispatch</span>
            <span className="text-lg font-bold text-amber-600 mt-1 block">
              {stats.bookingStats.pending || 0}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block truncate">Cancelled</span>
            <span className="text-lg font-bold text-rose-600 mt-1 block">
              {stats.bookingStats.cancelled || 0}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block truncate">Paid Invoices</span>
            <span className="text-lg font-bold text-emerald-700 mt-1 block">
              {stats.bookingStats.paidPayments || 0}
            </span>
          </div>
        </div>
      )}

      {/* Quick Navigation & Real-time Activity Stream Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Quick Management Links" subtitle="Direct routing to core administrative modules">
            <div className="space-y-2">
              {quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={idx}
                    to={action.link}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 text-slate-700 hover:text-indigo-900 transition-all text-sm font-medium"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{action.title}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Real-time Activity Stream from Live MongoDB Bookings */}
        <div className="lg:col-span-2">
          <Card
            title="System Audit & Recent Activity Stream"
            subtitle="Chronological log of service requests, status transitions, and client bookings"
          >
            {isLoading ? (
              <div className="p-8 flex flex-col items-center justify-center">
                <LoadingSpinner size="md" color="indigo" />
                <span className="mt-3 text-xs text-slate-500">Loading activity events from MongoDB...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No recent booking activities or transactions found in the database.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map((bk) => (
                  <div key={bk._id} className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/60 rounded-lg transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                        <CalendarCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-indigo-600">
                            {bk.bookingReference}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              STATUS_BADGES[bk.status] || 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {bk.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5">
                          <span className="font-medium text-slate-900">{bk.customer?.user?.name || 'Customer'}</span>
                          {' requested '}
                          <span className="font-semibold text-slate-900">{bk.service?.name || 'Service'}</span>
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {bk.createdAt ? new Date(bk.createdAt).toLocaleString('en-IN') : 'Recent'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-xs text-slate-900 block">
                        ₹{bk.pricing?.totalAmount || 0}
                      </span>
                      <Link
                        to="/bookings"
                        className="text-[11px] font-semibold text-indigo-600 hover:underline mt-0.5 inline-block"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
