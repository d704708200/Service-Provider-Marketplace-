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
  const sectionParam = searchParams.get('section');

  const getInitialActiveTab = () => {
    if (tabParam === 'banner' || tabParam === 'system') return tabParam;
    return 'commission';
  };

  const getInitialSection = () => {
    if (sectionParam === 'service' || sectionParam === 'labour' || sectionParam === 'all') {
      return sectionParam;
    }
    if (tabParam === 'service' || tabParam === 'labour') {
      return tabParam;
    }
    if (tabParam === 'overview') {
      return 'all';
    }
    return 'all';
  };

  const [activeTab, setActiveTab] = useState(getInitialActiveTab);
  const [commissionSection, setCommissionSection] = useState(getInitialSection);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      if (tab !== 'commission') {
        next.delete('section');
      }
      return next;
    }, { replace: true });
  };

  const handleCommissionSectionChange = (section) => {
    setCommissionSection(section);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'commission');
      next.set('section', section);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (tabParam === 'banner' || tabParam === 'system') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('commission');
      if (sectionParam === 'service' || sectionParam === 'labour' || sectionParam === 'all') {
        setCommissionSection(sectionParam);
      } else if (tabParam === 'service' || tabParam === 'labour') {
        setCommissionSection(tabParam);
      } else if (tabParam === 'overview') {
        setCommissionSection('all');
      }
    }
  }, [tabParam, sectionParam]);

  // =========================================================================
  // 1. PLATFORM COMMISSION SETTINGS STATE (DUAL: SERVICE + LABOUR)
  // =========================================================================
  const [commissionData, setCommissionData] = useState(null);
  const [isCommissionLoading, setIsCommissionLoading] = useState(true);
  const [isCommissionSaving, setIsCommissionSaving] = useState(false);
  const [commissionSuccess, setCommissionSuccess] = useState(null);
  const [commissionError, setCommissionError] = useState(null);

  // Interactive Financial Preview Calculator values
  const [previewServicePrice, setPreviewServicePrice] = useState(500);
  const [previewLabourCharge, setPreviewLabourCharge] = useState(200);
  const [previewPartsAmount, setPreviewPartsAmount] = useState(350);

  // Section A: Service Commission Form
  const [newServicePercentage, setNewServicePercentage] = useState('');
  const [serviceChangeReason, setServiceChangeReason] = useState('');

  // Section B: Labour Commission Form
  const [newLabourPercentage, setNewLabourPercentage] = useState('');
  const [labourChangeReason, setLabourChangeReason] = useState('');

  // Confirmation Modal Type: 'service' | 'labour' | null
  const [confirmModalType, setConfirmModalType] = useState(null);

  const fetchCommissionSetting = useCallback(async () => {
    setIsCommissionLoading(true);
    setCommissionError(null);
    try {
      const res = await settingApi.getCommissionSetting();
      if (res?.success && res.data) {
        setCommissionData(res.data);
        const sRate = res.data?.serviceCommission?.percentage ?? res.data?.percentage ?? 15;
        const lRate = res.data?.labourCommission?.percentage ?? 0;
        setNewServicePercentage(String(sRate));
        setNewLabourPercentage(String(lRate));
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

  const handleOpenServiceConfirm = (e) => {
    e.preventDefault();
    setCommissionError(null);

    const num = Number(newServicePercentage);
    if (isNaN(num) || num < 0 || num > 100) {
      setCommissionError('Please enter a valid service commission percentage between 0% and 100%.');
      return;
    }

    if (!serviceChangeReason.trim() || serviceChangeReason.trim().length < 3) {
      setCommissionError('Please provide a descriptive reason for this service commission rate change (minimum 3 characters).');
      return;
    }

    setConfirmModalType('service');
  };

  const handleOpenLabourConfirm = (e) => {
    e.preventDefault();
    setCommissionError(null);

    const num = Number(newLabourPercentage);
    if (isNaN(num) || num < 0 || num > 100) {
      setCommissionError('Please enter a valid labour commission percentage between 0% and 100%.');
      return;
    }

    if (!labourChangeReason.trim() || labourChangeReason.trim().length < 3) {
      setCommissionError('Please provide a descriptive reason for this labour commission rate change (minimum 3 characters).');
      return;
    }

    setConfirmModalType('labour');
  };

  const handleConfirmSaveCommission = async () => {
    if (!confirmModalType) return;
    setIsCommissionSaving(true);
    setCommissionError(null);

    try {
      if (confirmModalType === 'service') {
        const res = await settingApi.updateCommissionSetting({
          percentage: Number(newServicePercentage),
          reason: serviceChangeReason.trim()
        });

        if (res?.success) {
          const appliedRate = res.data?.percentage ?? newServicePercentage;
          setCommissionSuccess(`Platform service commission rate updated to ${appliedRate}% successfully!`);
          setServiceChangeReason('');
          setConfirmModalType(null);
          await fetchCommissionSetting();
        } else {
          setCommissionError(res?.message || 'Failed to update service commission setting.');
        }
      } else if (confirmModalType === 'labour') {
        const res = await settingApi.updateLabourCommissionSetting({
          percentage: Number(newLabourPercentage),
          reason: labourChangeReason.trim()
        });

        if (res?.success) {
          const appliedRate = res.data?.percentage ?? newLabourPercentage;
          setCommissionSuccess(`Platform labour commission rate updated to ${appliedRate}% successfully!`);
          setLabourChangeReason('');
          setConfirmModalType(null);
          await fetchCommissionSetting();
        } else {
          setCommissionError(res?.message || 'Failed to update labour commission setting.');
        }
      }
    } catch (err) {
      setCommissionError(err.userMessage || err.message || `Failed to save ${confirmModalType} commission setting.`);
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
      {/* TAB 1: DUAL COMMISSION SETTINGS (SERVICE + LABOUR) */}
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
                  Dual Platform Commission System (Service + Labour)
                </h3>
                <p className="text-xs text-indigo-800 mt-1 max-w-3xl leading-relaxed">
                  Mendroo operates two independently configurable platform commission take-rates:
                  <strong className="text-indigo-950"> 1) Service Commission</strong> on the base booking price, and
                  <strong className="text-indigo-950"> 2) Labour Commission</strong> strictly on customer-approved labour charges.
                  Physical spare parts and materials supplied by providers are <strong className="text-emerald-700">100% commission-free (0% fee)</strong>.
                  All booking rates are permanently frozen at creation time.
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

          {/* Sub-navigation tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={commissionSection === 'all'}
              onClick={() => handleCommissionSectionChange('all')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                commissionSection === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Overview & Dual Settings</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={commissionSection === 'service'}
              onClick={() => handleCommissionSectionChange('service')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                commissionSection === 'service'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Service Commission (Base)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={commissionSection === 'labour'}
              onClick={() => handleCommissionSectionChange('labour')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                commissionSection === 'labour'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Labour Commission (Approved)</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW & DUAL SETTINGS */}
          {commissionSection === 'all' && (
            <div className="space-y-6">
              {/* Current Active Rates Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Service Commission
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-indigo-600 mt-2 font-sans">
                    {isCommissionLoading ? '...' : `${commissionData?.serviceCommission?.percentage ?? commissionData?.percentage ?? 15}%`}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Base service price take-rate
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Labour Commission
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-indigo-600 mt-2 font-sans">
                    {isCommissionLoading ? '...' : `${commissionData?.labourCommission?.percentage ?? 0}%`}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Approved labour charges take-rate
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Spare Parts / Materials
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      EXEMPT
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-2 font-sans">
                    0%
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    100% provider earnings (Parts Fee = ₹0)
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Snapshot Rule
                    </span>
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-2">
                    Immutable
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    No retroactive changes to bookings
                  </p>
                </div>
              </div>

              {/* Financial Preview Calculator */}
              <Card
                title="Interactive Financial Breakdown Preview"
                subtitle="Test real-time calculation across base service, customer-approved labour, and spare parts"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Base Service Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={previewServicePrice}
                        onChange={(e) => setPreviewServicePrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Original service price agreed</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Approved Labour Charge (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={previewLabourCharge}
                        onChange={(e) => setPreviewLabourCharge(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Customer-approved labour</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Physical Spare Parts (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={previewPartsAmount}
                        onChange={(e) => setPreviewPartsAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">100% Commission-Free</span>
                    </div>
                  </div>

                  {/* Live Preview Result Box */}
                  {(() => {
                    const sRate = Number(newServicePercentage !== '' ? newServicePercentage : (commissionData?.serviceCommission?.percentage ?? 15));
                    const lRate = Number(newLabourPercentage !== '' ? newLabourPercentage : (commissionData?.labourCommission?.percentage ?? 0));
                    const sComm = Math.round(previewServicePrice * (sRate / 100) * 100) / 100;
                    const lComm = Math.round(previewLabourCharge * (lRate / 100) * 100) / 100;
                    const totalCustomer = previewServicePrice + previewLabourCharge + previewPartsAmount;
                    const totalComm = Math.round((sComm + lComm) * 100) / 100;
                    const providerNet = Math.round((totalCustomer - totalComm) * 100) / 100;

                    return (
                      <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Accounting Output Simulation
                          </span>
                          <span className="text-xs text-indigo-400 font-mono">
                            Service Rate: {sRate}% | Labour Rate: {lRate}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                          <div className="p-2.5 bg-slate-800/80 rounded-lg">
                            <span className="text-slate-400 block text-[10px]">Service Comm</span>
                            <span className="font-extrabold text-amber-400 text-sm mt-0.5 block">
                              ₹{sComm.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">₹{previewServicePrice} × {sRate}%</span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-lg">
                            <span className="text-slate-400 block text-[10px]">Labour Comm</span>
                            <span className="font-extrabold text-indigo-400 text-sm mt-0.5 block">
                              ₹{lComm.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">₹{previewLabourCharge} × {lRate}%</span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-lg">
                            <span className="text-slate-400 block text-[10px]">Parts Comm</span>
                            <span className="font-extrabold text-emerald-400 text-sm mt-0.5 block">
                              ₹0.00
                            </span>
                            <span className="text-[10px] text-emerald-400 font-medium">Exempt (0%)</span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-lg">
                            <span className="text-slate-400 block text-[10px]">Total Platform Comm</span>
                            <span className="font-extrabold text-rose-400 text-sm mt-0.5 block">
                              ₹{totalComm.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">Service + Labour</span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-lg">
                            <span className="text-slate-400 block text-[10px]">Customer Payable</span>
                            <span className="font-extrabold text-white text-sm mt-0.5 block">
                              ₹{totalCustomer.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">Base + Labour + Parts</span>
                          </div>

                          <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-lg">
                            <span className="text-emerald-300 block text-[10px] font-semibold">Provider Net</span>
                            <span className="font-extrabold text-emerald-400 text-sm mt-0.5 block">
                              ₹{providerNet.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-emerald-300">Payable - Comm</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Card>

              {/* Navigation Quick Shortcuts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-indigo-200 rounded-2xl p-5 flex items-center justify-between shadow-xs hover:border-indigo-300 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-bold text-sm text-slate-900">Service Commission Settings</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Currently <strong className="text-indigo-600">{commissionData?.serviceCommission?.percentage ?? commissionData?.percentage ?? 15}%</strong>. Applied strictly to originalServicePrice.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCommissionSectionChange('service')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 ml-4"
                  >
                    <span>Configure</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="bg-white border border-purple-200 rounded-2xl p-5 flex items-center justify-between shadow-xs hover:border-purple-300 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-purple-600" />
                      <h4 className="font-bold text-sm text-slate-900">Labour Commission Settings</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Currently <strong className="text-purple-600">{commissionData?.labourCommission?.percentage ?? 0}%</strong>. Applied strictly to customer-approved labour charges.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCommissionSectionChange('labour')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 ml-4"
                  >
                    <span>Configure</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVICE COMMISSION (BASE) ONLY */}
          {commissionSection === 'service' && (
            <div className="space-y-6">
              {/* Active Rate Summary Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Current Effective Service Commission
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-indigo-600 font-sans">
                      {isCommissionLoading ? '...' : `${commissionData?.serviceCommission?.percentage ?? commissionData?.percentage ?? 15}%`}
                    </span>
                    <span className="text-xs text-slate-500">of originalServicePrice</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Centralized platform take-rate applied to original service booking prices. Spare parts (0%) and extra labour are handled separately.
                  </p>
                </div>
                <Badge variant="success">ACTIVE TAKE-RATE</Badge>
              </div>

              <Card
                title="Service Commission Rate Configuration"
                subtitle="Centralized take-rate applied strictly to base service/booking prices"
              >
                <form onSubmit={handleOpenServiceConfirm} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Service Commission Percentage (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          required
                          placeholder="e.g. 15"
                          value={newServicePercentage}
                          onChange={(e) => setNewServicePercentage(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                          %
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current effective: <strong className="text-slate-800">{commissionData?.serviceCommission?.percentage ?? commissionData?.percentage ?? 15}%</strong>. Applies only to originalServicePrice.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mandatory Audit Reason (Service Rate)
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="e.g., Annual platform review, Category take-rate adjustment..."
                        value={serviceChangeReason}
                        onChange={(e) => setServiceChangeReason(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Permanently recorded in the service commission audit log.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isCommissionLoading || isCommissionSaving}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Review & Update Service Commission</span>
                    </button>
                  </div>
                </form>
              </Card>

              {/* Service Commission Audit History */}
              <Card
                title="Service Commission Audit History"
                subtitle="Chronological audit trail of all Service Commission rate updates"
              >
                {(() => {
                  const history = commissionData?.serviceCommission?.history || commissionData?.history || [];
                  if (history.length === 0) {
                    return (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <History className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                        <span>No previous service commission modifications recorded.</span>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Effective Date</th>
                            <th className="py-2.5 px-3">Rate Change</th>
                            <th className="py-2.5 px-3">Changed By</th>
                            <th className="py-2.5 px-3">Audit Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {new Date(h.timestamp).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 font-bold font-sans">
                                  <span className="text-slate-400">{h.previousPercentage}%</span>
                                  <ArrowRight className="w-3 h-3 text-indigo-500" />
                                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                    {h.newPercentage}%
                                  </span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {h.changedBy || 'Administrator'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-md">
                                {h.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}

          {/* TAB 3: LABOUR COMMISSION (APPROVED) ONLY */}
          {commissionSection === 'labour' && (
            <div className="space-y-6">
              {/* Active Rate Summary Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Current Effective Labour Commission
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-indigo-600 font-sans">
                      {isCommissionLoading ? '...' : `${commissionData?.labourCommission?.percentage ?? 0}%`}
                    </span>
                    <span className="text-xs text-slate-500">of customer-approved extra labour charges</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Independent take-rate applied strictly to customer-approved labour charges. Unapproved labour and parts are exempt.
                  </p>
                </div>
                <Badge variant="indigo">ACTIVE TAKE-RATE</Badge>
              </div>

              <Card
                title="Labour Commission Rate Configuration"
                subtitle="Independent take-rate applied strictly to customer-approved extra labour charges"
              >
                <form onSubmit={handleOpenLabourConfirm} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Labour Commission Percentage (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          required
                          placeholder="e.g. 5"
                          value={newLabourPercentage}
                          onChange={(e) => setNewLabourPercentage(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                          %
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current effective: <strong className="text-slate-800">{commissionData?.labourCommission?.percentage ?? 0}%</strong>. Defaults to 0% if unconfigured. Never applied to unapproved labour.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mandatory Audit Reason (Labour Rate)
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="e.g., Setting initial labour take-rate, Seasonal labour fee update..."
                        value={labourChangeReason}
                        onChange={(e) => setLabourChangeReason(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Permanently recorded in the labour commission audit log.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isCommissionLoading || isCommissionSaving}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Review & Update Labour Commission</span>
                    </button>
                  </div>
                </form>
              </Card>

              {/* Labour Commission Audit History */}
              <Card
                title="Labour Commission Audit History"
                subtitle="Chronological audit trail of all Labour Commission rate updates"
              >
                {(() => {
                  const history = commissionData?.labourCommission?.history || [];
                  if (history.length === 0) {
                    return (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <History className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                        <span>No previous labour commission modifications recorded. Current rate is at initial default (0%).</span>
                      </div>
                    );
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Effective Date</th>
                            <th className="py-2.5 px-3">Rate Change</th>
                            <th className="py-2.5 px-3">Changed By</th>
                            <th className="py-2.5 px-3">Audit Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {new Date(h.timestamp).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 font-bold font-sans">
                                  <span className="text-slate-400">{h.previousPercentage}%</span>
                                  <ArrowRight className="w-3 h-3 text-indigo-500" />
                                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                    {h.newPercentage}%
                                  </span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {h.changedBy || 'Administrator'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-md">
                                {h.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL FOR COMMISSION RATE UPDATE (SERVICE OR LABOUR) */}
      {confirmModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm {confirmModalType === 'service' ? 'Service' : 'Labour'} Commission Rate Update
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmModalType === 'service'
                    ? 'Applies globally to original service prices on upcoming bookings.'
                    : 'Applies strictly to customer-approved labour charges on upcoming bookings.'}
                </p>
              </div>
            </div>

            {/* Comparison Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Current {confirmModalType === 'service' ? 'Service' : 'Labour'} Rate:</span>
                  <span className="font-bold text-slate-700">
                    {confirmModalType === 'service'
                      ? `${commissionData?.serviceCommission?.percentage ?? commissionData?.percentage ?? 15}%`
                      : `${commissionData?.labourCommission?.percentage ?? 0}%`}
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-500" />
                <div className="text-right">
                  <span className="text-xs text-indigo-600 block font-semibold">New Rate:</span>
                  <span className="font-extrabold text-indigo-600 text-lg">
                    {confirmModalType === 'service' ? newServicePercentage : newLabourPercentage}%
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-xs">
                <span className="font-semibold text-slate-700 block">Documented Reason:</span>
                <span className="text-slate-600 italic">
                  "{confirmModalType === 'service' ? serviceChangeReason : labourChangeReason}"
                </span>
              </div>
            </div>

            {/* Strict Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Strict Financial Snapshot Protection:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-800 text-[11px]">
                <li>All <strong>existing bookings</strong> preserve their frozen creation rate.</li>
                <li>Completed transactions and cash commission dues are <strong>never recalculated</strong>.</li>
                <li>Physical spare parts and materials remain <strong>100% commission-free (0%)</strong>.</li>
                {confirmModalType === 'labour' && (
                  <li>Labour commission applies <strong>only when customer explicitly approves</strong> the labour charge.</li>
                )}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalType(null)}
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
                  <span>Confirm & Apply {confirmModalType === 'service' ? newServicePercentage : newLabourPercentage}% Rate</span>
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
