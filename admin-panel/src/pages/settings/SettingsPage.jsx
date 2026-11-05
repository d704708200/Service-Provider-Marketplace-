import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  Shield,
  User,
  Server,
  Database,
  Key,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Percent,
  History,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bannerApi, settingApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ROUTE_OPTIONS = [
  { value: 'SearchTab', label: 'Search & Catalog Screen (SearchTab)' },
  { value: 'HomeTab', label: 'Home Screen (HomeTab)' },
  { value: 'BookingsTab', label: 'My Bookings Screen (BookingsTab)' },
  { value: 'AlertsTab', label: 'Notifications Screen (AlertsTab)' },
  { value: 'ProfileTab', label: 'Customer Profile Screen (ProfileTab)' },
  { value: 'CategoryServices', label: 'Category Services Screen (CategoryServices)' },
  { value: 'RequestService', label: 'Request Service Screen (RequestService)' }
];

const SettingsPage = () => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const permissions = profile?.permissions || ['manage_users', 'manage_providers', 'manage_categories', 'manage_services', 'manage_bookings'];
  const department = profile?.department || 'Operations';
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Navigation Tabs: 'commission' | 'banner' | 'system'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'banner' || tabParam === 'system' ? tabParam : 'commission');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // =========================================================================
  // 1. PLATFORM COMMISSION SETTINGS STATE
  // =========================================================================
  const [commissionData, setCommissionData] = useState(null);
  const [isCommissionLoading, setIsCommissionLoading] = useState(true);
  const [isCommissionSaving, setIsCommissionSaving] = useState(false);
  const [commissionSuccess, setCommissionSuccess] = useState(null);
  const [commissionError, setCommissionError] = useState(null);
  const [newPercentage, setNewPercentage] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const fetchCommissionSetting = useCallback(async () => {
    setIsCommissionLoading(true);
    setCommissionError(null);
    try {
      const res = await settingApi.getCommissionSetting();
      if (res?.success && res.data) {
        setCommissionData(res.data);
        setNewPercentage(String(res.data.percentage));
      }
    } catch (err) {
      setCommissionError(err.userMessage || err.message || 'Failed to load platform commission configuration.');
    } finally {
      setIsCommissionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissionSetting();
  }, [fetchCommissionSetting]);

  useEffect(() => {
    if (commissionSuccess) {
      const timer = setTimeout(() => setCommissionSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [commissionSuccess]);

  const handleOpenConfirmModal = (e) => {
    e.preventDefault();
    setCommissionError(null);

    const num = Number(newPercentage);
    if (isNaN(num) || num < 0 || num > 100) {
      setCommissionError('Please enter a valid commission percentage between 0% and 100%.');
      return;
    }

    if (!changeReason.trim() || changeReason.trim().length < 3) {
      setCommissionError('Please provide a descriptive reason for this commission rate change (minimum 3 characters).');
      return;
    }

    setConfirmModalOpen(true);
  };

  const handleConfirmSaveCommission = async () => {
    setIsCommissionSaving(true);
    setCommissionError(null);
    try {
      const res = await settingApi.updateCommissionSetting({
        percentage: Number(newPercentage),
        reason: changeReason.trim()
      });

      if (res?.success) {
        setCommissionSuccess(`Platform commission rate updated to ${res.data.percentage}% successfully!`);
        setCommissionData(res.data);
        setChangeReason('');
        setConfirmModalOpen(false);
      } else {
        setCommissionError(res?.message || 'Failed to update commission setting.');
      }
    } catch (err) {
      setCommissionError(err.userMessage || err.message || 'Failed to save commission setting.');
    } finally {
      setIsCommissionSaving(false);
    }
  };

  // =========================================================================
  // 2. PROMOTIONAL BANNER STATE
  // =========================================================================
  const [bannerForm, setBannerForm] = useState({
    isEnabled: true,
    badgeText: 'FIRST SERVICE ORDER',
    title: 'Get ₹100 OFF',
    subtitle: 'Book your first service today',
    discountAmount: 100,
    currency: '₹',
    buttonLabel: 'Book Now',
    targetRoute: 'SearchTab'
  });
  const [isBannerLoading, setIsBannerLoading] = useState(true);
  const [isBannerSaving, setIsBannerSaving] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState(null);
  const [bannerError, setBannerError] = useState(null);

  const fetchBanner = useCallback(async () => {
    setIsBannerLoading(true);
    setBannerError(null);
    try {
      const res = await bannerApi.getAdminBanner();
      if (res?.success && res.data) {
        setBannerForm({
          isEnabled: Boolean(res.data.isEnabled),
          badgeText: res.data.badgeText || 'FIRST SERVICE ORDER',
          title: res.data.title || 'Get ₹100 OFF',
          subtitle: res.data.subtitle || 'Book your first service today',
          discountAmount: res.data.discountAmount ?? 100,
          currency: res.data.currency || '₹',
          buttonLabel: res.data.buttonLabel || 'Book Now',
          targetRoute: res.data.targetRoute || 'SearchTab'
        });
      }
    } catch (err) {
      setBannerError(err.userMessage || 'Failed to load home banner configuration.');
    } finally {
      setIsBannerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanner();
  }, [fetchBanner]);

  useEffect(() => {
    if (bannerSuccess) {
      const timer = setTimeout(() => setBannerSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [bannerSuccess]);

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    setIsBannerSaving(true);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const payload = {
        isEnabled: bannerForm.isEnabled,
        badgeText: bannerForm.badgeText.trim(),
        title: bannerForm.title.trim(),
        subtitle: bannerForm.subtitle.trim(),
        discountAmount: Number(bannerForm.discountAmount) || 0,
        currency: bannerForm.currency.trim() || '₹',
        buttonLabel: bannerForm.buttonLabel.trim() || 'Book Now',
        targetRoute: bannerForm.targetRoute
      };

      const res = await bannerApi.updateAdminBanner(payload);
      if (res?.success) {
        setBannerSuccess('Home promotional banner configuration saved successfully!');
        if (res.data) {
          setBannerForm({
            isEnabled: Boolean(res.data.isEnabled),
            badgeText: res.data.badgeText,
            title: res.data.title,
            subtitle: res.data.subtitle,
            discountAmount: res.data.discountAmount,
            currency: res.data.currency,
            buttonLabel: res.data.buttonLabel,
            targetRoute: res.data.targetRoute
          });
        }
      } else {
        setBannerError(res?.message || 'Failed to update banner configuration.');
      }
    } catch (err) {
      setBannerError(err.userMessage || 'Failed to save banner configuration.');
    } finally {
      setIsBannerSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Configuration & Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Control global commission rates, promotional offer banners, and inspect administrator system metadata.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange('commission')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'commission'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Platform Commission Settings</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('banner')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'banner'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Home Banner & Promotional Offers</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('system')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'system'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Admin Profile & System Metadata</span>
        </button>
      </div>

      {/* Commission Alerts */}
      {commissionSuccess && (
        <div
          role="status"
          className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{commissionSuccess}</span>
          </div>
          <button
            onClick={() => setCommissionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {commissionError && (
        <div
          role="alert"
          className="flex items-start justify-between p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-900">Commission Configuration Error</span>
              <span className="text-xs text-rose-700 leading-relaxed">{commissionError}</span>
            </div>
          </div>
          <button
            onClick={() => setCommissionError(null)}
            className="text-rose-600 hover:text-rose-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Banner Alerts */}
      {bannerSuccess && (
        <div
          role="status"
          className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button
            onClick={() => setBannerSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {bannerError && (
        <div
          role="alert"
          className="flex items-start justify-between p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-900">Banner Notice</span>
              <span className="text-xs text-rose-700 leading-relaxed">{bannerError}</span>
            </div>
          </div>
          <button
            onClick={() => setBannerError(null)}
            className="text-rose-600 hover:text-rose-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 0: PLATFORM COMMISSION SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'commission' && (
        <div className="space-y-6">
          {/* Audited Policy Banner */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-indigo-950">
                  Admin-Controlled Platform Commission Take-Rate
                </h3>
                <p className="text-xs text-indigo-800 mt-1 max-w-2xl leading-relaxed">
                  Mendroo platform commission is calculated <strong>only once on original service base prices</strong>. Additional spare parts, materials, and replacement components supplied by providers are <strong>100% commission-free (0% fee)</strong>. When a booking is created, its commission rate is permanently frozen.
                </p>
              </div>
            </div>
            <button
              onClick={fetchCommissionSetting}
              disabled={isCommissionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors cursor-pointer self-start md:self-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCommissionLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Current Active Rate & Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Active Commission Rate
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ACTIVE
                </span>
              </div>
              <div className="text-3xl font-extrabold text-indigo-600 mt-2 font-sans">
                {isCommissionLoading ? '...' : `${commissionData?.percentage || 15}%`}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Applied to all upcoming new bookings
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Effective Date & Time
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-sm font-bold text-slate-800 mt-2">
                {commissionData?.effectiveFrom
                  ? new Date(commissionData.effectiveFrom).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Platform Default (System Startup)'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Existing bookings remain frozen at their creation rate
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Authorized Admin
                </span>
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-sm font-bold text-slate-800 mt-2">
                {commissionData?.updatedBy?.name || 'Administrator'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {commissionData?.updatedBy?.email || 'admin@service-marketplace.com'}
              </p>
            </div>
          </div>

          {/* Update Commission Percentage Form */}
          <Card
            title="Configure New Commission Percentage"
            subtitle="Update the centralized platform take-rate applied to future customer bookings"
          >
            <form onSubmit={handleOpenConfirmModal} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    New Commission Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      placeholder="e.g. 20"
                      value={newPercentage}
                      onChange={(e) => setNewPercentage(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                      %
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Enter a rate between 0% and 100%. (e.g. 15 for 15%, 20 for 20%).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Audit Justification / Reason for Change (Required)
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g., Seasonal promotion rate adjustment, Approved board quarterly update..."
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Documented permanently in the system configuration audit log.
                  </p>
                </div>
              </div>

              {/* Formula & Rule Summary Pill */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Immutable Calculation Rule:</span>
                </div>
                <code className="block font-mono text-[11px] text-indigo-900 bg-white p-2 rounded-lg border border-slate-200">
                  commissionAmount = originalServicePrice × {newPercentage || 15}% / 100 (Spare parts commission = ₹0)
                </code>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isCommissionLoading || isCommissionSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Review & Apply New Rate</span>
                </button>
              </div>
            </form>
          </Card>

          {/* Change History / Audit Log */}
          <Card
            title="Commission Rate Audit Log & Change History"
            subtitle="Immutable chronological ledger of all platform commission percentage modifications"
          >
            {(!commissionData?.history || commissionData.history.length === 0) ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <span>No previous commission rate modifications recorded. Initial default rate active.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Effective Date & Time</th>
                      <th className="py-3 px-4">Rate Change</th>
                      <th className="py-3 px-4">Changed By</th>
                      <th className="py-3 px-4">Audit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commissionData.history.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {new Date(h.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-bold font-sans">
                            <span className="text-slate-400">{h.previousPercentage}%</span>
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              {h.newPercentage}%
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {h.changedBy || 'Administrator'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-md">
                          {h.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR COMMISSION RATE UPDATE */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Platform Commission Rate Update
                </h3>
                <p className="text-xs text-slate-500">
                  This setting applies globally to all future service bookings.
                </p>
              </div>
            </div>

            {/* Comparison Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Current Rate:</span>
                  <span className="font-bold text-slate-700">{commissionData?.percentage || 15}%</span>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-500" />
                <div className="text-right">
                  <span className="text-xs text-indigo-600 block font-semibold">New Rate:</span>
                  <span className="font-extrabold text-indigo-600 text-lg">{newPercentage}%</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-xs">
                <span className="font-semibold text-slate-700 block">Documented Reason:</span>
                <span className="text-slate-600 italic">"{changeReason}"</span>
              </div>
            </div>

            {/* Strict Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Strict Financial Snapshot Protection:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-800 text-[11px]">
                <li>All <strong>existing bookings</strong> preserve their frozen creation rate.</li>
                <li>Completed transactions and cash commission dues are <strong>never recalculated</strong>.</li>
                <li>Additional spare parts and materials remain <strong>100% commission-free (0%)</strong>.</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isCommissionSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveCommission}
                disabled={isCommissionSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCommissionSaving ? (
                  <>
                    <LoadingSpinner size="sm" color="white" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Confirm & Apply {newPercentage}% Rate</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: Home Banner / Promotional Offers Management */}
      {/* ========================================================================= */}
      {activeTab === 'banner' && (
        <Card
          title="Customer App Home Banner & Promotional Offers"
          subtitle="Configure the First Service Order offer card shown on the Customer App Home Screen"
        >
        {isBannerLoading ? (
          <div className="py-12 flex flex-col justify-center items-center gap-3">
            <LoadingSpinner size="md" color="indigo" />
            <span className="text-xs text-slate-500 font-medium">Loading banner configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveBanner} className="space-y-6">
            {/* Top Toggle Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-purple-50/60 border border-purple-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-purple-950">Promotional Offer Banner</span>
                    <Badge variant={bannerForm.isEnabled ? 'success' : 'default'}>
                      {bannerForm.isEnabled ? 'Active (Visible)' : 'Disabled (Hidden)'}
                    </Badge>
                  </div>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Controls visibility of the special coupon card on the customer mobile home feed.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer self-start sm:self-center">
                <input
                  type="checkbox"
                  checked={bannerForm.isEnabled}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500"
                />
                <span className="text-xs font-semibold text-purple-900">
                  Enable Banner
                </span>
              </label>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Badge Small Heading */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Small Heading / Badge Tag
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FIRST SERVICE ORDER"
                  value={bannerForm.badgeText}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, badgeText: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-semibold text-xs tracking-wider uppercase"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Top uppercase badge tag displayed above the main title.
                </p>
              </div>

              {/* Main Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Offer Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Get ₹100 OFF"
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-bold"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Prominent headline text displayed on the card.
                </p>
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Subtitle Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Book your first service today"
                  value={bannerForm.subtitle}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                />
              </div>

              {/* Target Navigation Route */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tap Action / Navigation Destination
                </label>
                <select
                  value={bannerForm.targetRoute}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, targetRoute: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                >
                  {ROUTE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Where the Customer App navigates when the customer taps this banner.
                </p>
              </div>
            </div>

            {/* Discount & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Discount Value (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={bannerForm.discountAmount}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Button Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Book Now"
                  value={bannerForm.buttonLabel}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, buttonLabel: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  required
                  value={bannerForm.currency}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isBannerLoading || isBannerSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Banner Settings</span>
              </button>
            </div>
          </form>
        )}
      </Card>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: System & Account Metadata */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Administrator Profile Details */}
        <Card title="Current Administrator Profile" subtitle="Authenticated session metadata">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{user?.name || 'Administrator'}</h4>
                <p className="text-xs text-slate-500">{user?.email || 'N/A'}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="primary">Role: {user?.role || 'admin'}</Badge>
                  <Badge variant="success">Account: {user?.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Department</span>
                <span className="font-medium text-slate-900">{department}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">User Account ID</span>
                <span className="font-mono text-slate-700">{user?._id || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Admin Profile ID</span>
                <span className="font-mono text-slate-700">{profile?._id || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Assigned Permissions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {permissions.map((perm, idx) => (
                  <Badge key={idx} variant="default">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Backend & Environment Configuration */}
        <Card title="Platform Connectivity Configuration" subtitle="Runtime environment endpoints">
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Server className="w-4 h-4 text-indigo-600" />
                <span>Backend API Base URL</span>
              </div>
              <code className="block p-2 bg-white border border-slate-200 rounded-md text-[11px] font-mono text-slate-800 break-all">
                {apiUrl}
              </code>
              <p className="text-[11px] text-slate-500">
                Configured via Vite environment variable <span className="font-mono">VITE_API_URL</span>.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Authentication Protocol</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                JSON Web Token (JWT) over Bearer Authorization headers with automated 401 session expiration handling.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Persistence Model</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Strict MongoDB multi-role relational linkage (User model with specialized Admin model profile).
              </p>
            </div>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
};

export default SettingsPage;
