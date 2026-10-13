import React, { useState, useEffect, useCallback } from 'react';
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
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bannerApi } from '../../services/api';
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

  const permissions = profile?.permissions || ['manage_users', 'manage_providers', 'manage_categories', 'manage_services', 'manage_bookings'];
  const department = profile?.department || 'Operations';
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Banner State
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

  // Navigation Tabs: 'banner' | 'system' | 'all'
  const [activeTab, setActiveTab] = useState('banner');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Promotional Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage promotional offer banners, inspect administrator profile attributes, and review platform connectivity.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('banner')}
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
          onClick={() => setActiveTab('system')}
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

      {/* Banner Management Notification Alerts */}
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

      {/* SECTION 1: Home Banner / Promotional Offers Management */}
      {(activeTab === 'banner' || activeTab === 'all') && (
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
                  placeholder="e.g. Book your first service today"
                  value={bannerForm.subtitle}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Explanatory text below the offer headline.
                </p>
              </div>

              {/* Button Label */}
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-semibold"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Call-to-action button text.
                </p>
              </div>

              {/* Discount Amount & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={bannerForm.discountAmount}
                    onChange={(e) => setBannerForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-semibold"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Numerical promo amount</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={bannerForm.currency}
                    onChange={(e) => setBannerForm((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-semibold"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">e.g. ₹, $, €</p>
                </div>
              </div>

              {/* Target Navigation Route */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Book Now Destination Route
                </label>
                <select
                  value={bannerForm.targetRoute}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, targetRoute: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-medium"
                >
                  {ROUTE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Target Customer App screen opened when customer taps "Book Now".
                </p>
              </div>
            </div>

            {/* Live Visual Preview matching Customer App Figma Dark UI */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Live Customer App Banner Preview
              </span>
              <div className="p-4 bg-[#0F0D15] rounded-2xl border border-slate-800">
                <div className="flex flex-row justify-between items-center bg-[#1C152B] border border-[#2D2348] rounded-2xl p-4">
                  <div className="flex-1 pr-3">
                    <span className="text-[10px] font-bold text-[#A78BFA] tracking-wider uppercase block">
                      {bannerForm.badgeText || 'FIRST SERVICE ORDER'}
                    </span>
                    <span className="text-base font-extrabold text-white my-0.5 block">
                      {bannerForm.title || 'Get ₹100 OFF'}
                    </span>
                    <span className="text-xs text-[#9CA3AF] block">
                      {bannerForm.subtitle || 'Book your first service today'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="bg-[#7C3AED] text-white text-xs font-semibold px-4 py-2 rounded-xl shrink-0 cursor-default shadow-xs"
                  >
                    {bannerForm.buttonLabel || 'Book Now'}
                  </button>
                </div>
                {!bannerForm.isEnabled && (
                  <p className="mt-2 text-center text-xs text-amber-400/90 font-medium">
                    ⚠️ Banner is currently disabled. It will be hidden on the Customer App.
                  </p>
                )}
              </div>
            </div>

            {/* Save Buttons Row */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={fetchBanner}
                disabled={isBannerSaving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBannerLoading ? 'animate-spin' : ''}`} />
                <span>Reload Saved</span>
              </button>

              <button
                type="submit"
                disabled={isBannerSaving}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isBannerSaving ? 'Saving Changes...' : 'Save Banner Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </Card>
      )}

      {/* SECTION 2: System & Account Metadata */}
      {(activeTab === 'system' || activeTab === 'all') && (
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
