import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  RefreshCw,
  CreditCard,
  Building,
  CheckCircle2,
  DollarSign,
  PieChart,
  Users
} from 'lucide-react';
import { reportApi } from '../../services/api';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ReportsPage = () => {
  const [selectedRange, setSelectedRange] = useState('30d');
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportApi.getPlatformReports({ period: selectedRange });
      if (res?.success) {
        setReportData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to load report data');
      }
    } catch (err) {
      setError(err.userMessage || err.message || 'Failed to generate platform financial and operational analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // CSV Exporter for Financial and Booking Metrics
  const handleExportCSV = () => {
    if (!reportData) return;
    const rows = [
      ['Metric', 'Value'],
      ['Reporting Period', reportData.period],
      ['Gross Transaction Value (INR)', reportData.revenue?.grossTransactionValue || 0],
      ['Service Charges (INR)', reportData.revenue?.serviceCharges || 0],
      ['Spare Parts Revenue (INR)', reportData.revenue?.sparePartsCharges || 0],
      ['Paid Invoices Count', reportData.revenue?.paidInvoicesCount || 0],
      ['Estimated Platform Commission (15%)', reportData.revenue?.estimatedCommission || 0],
      ['Estimated Provider Payout Pool (85%)', reportData.revenue?.providerPayoutPool || 0],
      ['Total Orders', reportData.bookings?.total || 0],
      ['Completed Orders', reportData.bookings?.completed || 0],
      ['Cancelled Orders', reportData.bookings?.cancelled || 0],
      ['Fulfillment Rate (%)', `${reportData.bookings?.completionRate || 0}%`],
      ['Cancellation Rate (%)', `${reportData.bookings?.cancellationRate || 0}%`],
      ['Total Providers', reportData.providers?.total || 0],
      ['Verified Providers', reportData.providers?.verified || 0],
      ['Pending KYC Providers', reportData.providers?.pending || 0]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `platform_report_${selectedRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial & Platform Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate financial summaries, export transaction ledgers, and analyze operational fulfillment trends.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchReports}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!reportData || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="p-4">
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
                Quarterly (90 Days)
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            {reportData?.dateRange ? (
              <span>
                Window: {new Date(reportData.dateRange.startDate).toLocaleDateString('en-IN')} — {new Date(reportData.dateRange.endDate).toLocaleDateString('en-IN')}
              </span>
            ) : null}
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
            onClick={fetchReports}
            className="text-xs text-rose-700 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Report Category Cards with Live MongoDB Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Platform Gross Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Platform Gross Revenue</h4>
                  <p className="text-xs text-slate-500">Verified transaction receipts and platform fee share</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Live Data
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Gross Value (INR)</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  ₹{(reportData?.revenue?.grossTransactionValue || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400">Paid Invoices: {reportData?.revenue?.paidInvoicesCount || 0}</span>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
                <span className="text-indigo-700 font-semibold block">Platform Take-rate (15%)</span>
                <span className="text-lg font-black text-indigo-950 mt-0.5 block">
                  ₹{(reportData?.revenue?.estimatedCommission || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-indigo-500">Commission model</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Provider Disbursement Records */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Provider Disbursement Records</h4>
                  <p className="text-xs text-slate-500">Contractor payout pool and earnings allocation</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                Calculated Pool
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Contractor Earnings Pool</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  ₹{(reportData?.revenue?.providerPayoutPool || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400">85% of verified billing</span>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60">
                <span className="text-amber-800 font-semibold block">Payout Model Status</span>
                <span className="text-xs font-bold text-amber-900 mt-1 block">Manual Batch</span>
                <span className="text-[10px] text-amber-700 leading-tight block mt-0.5">
                  Automated gateway pipeline pending Phase 12.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Booking Performance & Fulfillment */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Booking Performance & Velocity</h4>
                  <p className="text-xs text-slate-500">Order completion percentages, velocity, and cancellation ratios</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                Fulfillment Metrics
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <span className="text-slate-500 block text-[11px]">Total Orders</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {reportData?.bookings?.total || 0}
                </span>
              </div>

              <div className="p-2.5 bg-emerald-50/60 rounded-lg text-center border border-emerald-100">
                <span className="text-emerald-700 block text-[11px]">Completion Rate</span>
                <span className="text-base font-black text-emerald-800 mt-0.5 block">
                  {reportData?.bookings?.completionRate || 0}%
                </span>
              </div>

              <div className="p-2.5 bg-rose-50/60 rounded-lg text-center border border-rose-100">
                <span className="text-rose-700 block text-[11px]">Cancellation Rate</span>
                <span className="text-base font-black text-rose-800 mt-0.5 block">
                  {reportData?.bookings?.cancellationRate || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Provider Activity & Retention */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Provider Retention & Verification</h4>
                  <p className="text-xs text-slate-500">Onboarding pipeline, verified contractors, and pending queues</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                Network Status
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                <span className="text-slate-500 block text-[11px]">Total Network</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {reportData?.providers?.total || 0}
                </span>
              </div>

              <div className="p-2.5 bg-emerald-50/60 rounded-lg text-center border border-emerald-100">
                <span className="text-emerald-700 block text-[11px]">Verified Active</span>
                <span className="text-base font-black text-emerald-800 mt-0.5 block">
                  {reportData?.providers?.verified || 0}
                </span>
              </div>

              <div className="p-2.5 bg-amber-50/60 rounded-lg text-center border border-amber-100">
                <span className="text-amber-700 block text-[11px]">Pending Review</span>
                <span className="text-base font-black text-amber-800 mt-0.5 block">
                  {reportData?.providers?.pending || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregated Analytics: Daily Booking Trends & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Ledger */}
        <Card title="Daily Booking Volume & Revenue Trends" subtitle="Chronological fulfillment activity in current period">
          {isLoading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <LoadingSpinner size="md" color="indigo" />
            </div>
          ) : reportData?.dailyTrends?.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No orders recorded during this selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase bg-slate-50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Total Orders</th>
                    <th className="py-2.5 px-3">Completed</th>
                    <th className="py-2.5 px-3">Verified Billing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.dailyTrends.map((trend, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{trend.date}</td>
                      <td className="py-2.5 px-3 text-slate-700">{trend.bookings}</td>
                      <td className="py-2.5 px-3 text-emerald-700 font-medium">{trend.completed}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">₹{trend.revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Category Demand Breakdown */}
        <Card title="Top Service Categories by Demand" subtitle="Consumer booking volume segmented by category">
          {isLoading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <LoadingSpinner size="md" color="indigo" />
            </div>
          ) : reportData?.categoryDistribution?.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No category orders recorded during this selected date range.
            </div>
          ) : (
            <div className="space-y-3 p-2">
              {reportData.categoryDistribution.map((cat, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{cat.categoryName}</span>
                    <span className="text-slate-500">{cat.bookings} Orders Placed</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">₹{cat.revenue.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Verified Receipts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
