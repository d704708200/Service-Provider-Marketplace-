import React, { useState } from 'react';
import { BarChart3, Download, Calendar, Filter, AlertCircle, FileSpreadsheet } from 'lucide-react';
import Card from '../../components/common/Card';
import EmptyState from '../../components/common/EmptyState';

const reportTypes = [
  { id: 'revenue', title: 'Platform Gross Revenue', description: 'Transaction totals, platform service fees, and commission breakdown' },
  { id: 'payouts', title: 'Provider Disbursement Records', description: 'Completed and pending earnings distributions to service contractors' },
  { id: 'bookings', title: 'Booking Performance & Fulfillment', description: 'Volume metrics, cancellation percentages, and completion velocity' },
  { id: 'providers', title: 'Provider Activity & Retention', description: 'Onboarding funnel, verified accounts, and average response intervals' }
];

const ReportsPage = () => {
  const [selectedRange, setSelectedRange] = useState('30d');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial & Platform Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate financial summaries, export transaction ledgers, and analyze performance indicators.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range & Filter Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Date Period:</span>
            <div className="inline-flex rounded-lg p-1 bg-slate-100 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedRange('7d')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedRange === '7d' ? 'bg-white shadow-xs text-indigo-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setSelectedRange('30d')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedRange === '30d' ? 'bg-white shadow-xs text-indigo-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => setSelectedRange('90d')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedRange === '90d' ? 'bg-white shadow-xs text-indigo-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quarterly
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Available Report Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((rep) => (
          <div key={rep.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{rep.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{rep.description}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Data pipeline pending
              </span>
              <button
                type="button"
                disabled
                className="text-xs font-semibold text-slate-400 cursor-not-allowed"
              >
                Generate Report
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Honest Empty Report State */}
      <Card title="Aggregated Analytics View" subtitle="Real-time data visualization">
        <EmptyState
          icon={BarChart3}
          title="Analytics Pipeline Pending Integration"
          description="Aggregated transaction data, revenue charts, and operational graphs will be generated dynamically once financial and booking records exist."
          pendingApi={true}
          apiEndpoint="/api/admin/reports/summary"
        />
      </Card>
    </div>
  );
};

export default ReportsPage;
