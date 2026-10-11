import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  ShieldCheck,
  Wrench,
  CalendarCheck,
  ArrowRight,
  Activity,
  Layers,
  Settings,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';

const metricPlaceholders = [
  {
    title: 'Registered Customers',
    icon: Users,
    description: 'Active client accounts',
    link: '/customers',
    color: 'text-sky-600 bg-sky-50'
  },
  {
    title: 'Service Providers',
    icon: Briefcase,
    description: 'Registered contractors & agencies',
    link: '/providers',
    color: 'text-indigo-600 bg-indigo-50'
  },
  {
    title: 'Pending Verifications',
    icon: ShieldCheck,
    description: 'Awaiting credential review',
    link: '/provider-verification',
    color: 'text-amber-600 bg-amber-50'
  },
  {
    title: 'Service Catalog',
    icon: Wrench,
    description: 'Configured marketplace services',
    link: '/services',
    color: 'text-emerald-600 bg-emerald-50'
  },
  {
    title: 'Active Bookings',
    icon: CalendarCheck,
    description: 'Live service requests',
    link: '/requests',
    color: 'text-purple-600 bg-purple-50'
  }
];

const quickActions = [
  { title: 'Review Providers', link: '/provider-verification', icon: ShieldCheck },
  { title: 'Manage Categories', link: '/categories', icon: Layers },
  { title: 'Service Catalog', link: '/services', icon: Wrench },
  { title: 'System Settings', link: '/settings', icon: Settings }
];

const Dashboard = () => {
  const { user, profile } = useAuth();
  const adminName = user?.name || 'Administrator';
  const department = profile?.department || 'Operations';

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
            Marketplace administrative console and service oversight portal.
          </p>
        </div>

        {/* Status Callout */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>System Online: Admin Auth Verified</span>
        </div>
      </div>

      {/* Integration Notice Alert */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-900">Module Status: Dashboard Overview</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Authentication and administrative session architecture are actively operating. Aggregated analytics and real-time transaction telemetry will connect as individual service management endpoints are phased in.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metricPlaceholders.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
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
                {/* Honest indicator */}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">—</span>
                  <span className="text-xs font-medium text-slate-400">Pending API</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{stat.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link
                  to={stat.link}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <span>Open Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Navigation & Recent Activity Section */}
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

        {/* Recent Activity / Audit Stream */}
        <div className="lg:col-span-2">
          <Card
            title="System Audit & Activity Stream"
            subtitle="Chronological log of administrative actions and platform events"
          >
            <EmptyState
              icon={Activity}
              title="No Administrative Activity Logged"
              description="Platform transaction logging and audit trails will appear here automatically when customer orders, provider verification actions, and catalog adjustments occur."
              pendingApi={true}
              apiEndpoint="/api/admin/activity-logs"
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
