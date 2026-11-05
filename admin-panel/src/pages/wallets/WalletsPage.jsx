import { Link } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  CreditCard,
  Sliders,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  ArrowUpDown,
  ShieldCheck,
  ExternalLink,
  Lock,
  User,
  Phone,
  Mail,
  Calendar,
  Percent
} from 'lucide-react';
import { walletApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const WalletsPage = () => {
  const [activeTab, setActiveTab] = useState('withdrawals'); // 'withdrawals' | 'wallets' | 'commissions'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Platform Liability & Financial Overview Stats
  const [stats, setStats] = useState({
    totalAvailableLiability: 0,
    totalPendingWithdrawals: 0,
    totalEarningsCredited: 0,
    totalDisbursed: 0
  });

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState('all');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalSort, setWithdrawalSort] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
  const [withdrawalPagination, setWithdrawalPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [statusCounts, setStatusCounts] = useState({});

  // Wallets State
  const [wallets, setWallets] = useState([]);
  const [walletSearch, setWalletSearch] = useState('');
  const [walletPagination, setWalletPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Commissions State
  const [commissions, setCommissions] = useState([]);
  const [commissionSummary, setCommissionSummary] = useState({ totalOutstandingCommission: 0, providersWithOutstandingCount: 0 });
  const [commissionStatusFilter, setCommissionStatusFilter] = useState('all'); // 'all' | 'outstanding' | 'settled'
  const [commissionPagination, setCommissionPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Separate Settle & Waive Modals (Strictly full-amount only, zero partial settlement inputs)
  const [settleModal, setSettleModal] = useState({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
  const [waiveModal, setWaiveModal] = useState({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });

  // Modals & Drawers
  const [viewModal, setViewModal] = useState({ isOpen: false, item: null, showAccountNumber: false });
  const [approveModal, setApproveModal] = useState({ isOpen: false, item: null, note: '', isSubmitting: false, error: '' });
  const [payoutModal, setPayoutModal] = useState({ isOpen: false, item: null, utr: '', note: '', isSubmitting: false, error: '' });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
  const [adjustModal, setAdjustModal] = useState({ isOpen: false, wallet: null, type: 'credit', amount: '', reason: '', isSubmitting: false, error: '' });

  // Copy helper
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText?.(String(text));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Fetch live backend data
  const fetchData = useCallback(async () => {
    try {
      setApiError(null);
      if (activeTab === 'withdrawals') {
        const [wRes, wltRes] = await Promise.all([
          walletApi.getWithdrawals({
            status: withdrawalStatus,
            page: withdrawalPagination.page,
            limit: 15,
            search: withdrawalSearch.trim() || undefined
          }),
          walletApi.getWallets({ limit: 1 })
        ]);
        if (wRes?.data) {
          setWithdrawals(wRes.data);
          setWithdrawalPagination(wRes.pagination || { page: 1, limit: 15, total: wRes.data.length, pages: 1 });
          if (wRes.statusCounts && Array.isArray(wRes.statusCounts)) {
            const counts = {};
            wRes.statusCounts.forEach((c) => {
              counts[c._id] = c.count;
            });
            setStatusCounts(counts);
          }
        }
        if (wltRes?.stats) {
          setStats(wltRes.stats);
        }
      } else if (activeTab === 'commissions') {
        const commRes = await walletApi.getCommissions({
          status: commissionStatusFilter,
          page: commissionPagination.page,
          limit: 15
        });
        if (commRes?.data) {
          setCommissions(commRes.data.wallets || commRes.data.commissions || []);
          setCommissionSummary(commRes.data.summary || { totalOutstandingCommission: 0, providersWithOutstandingCount: 0 });
          setCommissionPagination(commRes.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
        }
      } else {
        const wltRes = await walletApi.getWallets({
          search: walletSearch.trim() || undefined,
          page: walletPagination.page,
          limit: 15
        });
        if (wltRes?.data) {
          setWallets(wltRes.data);
          setWalletPagination(wltRes.pagination || { page: 1, limit: 15, total: wltRes.data.length, pages: 1 });
        }
        if (wltRes?.stats) {
          setStats(wltRes.stats);
        }
      }
    } catch (err) {
      console.error('[WALLETS_PAGE_FETCH_ERROR]', err);
      setApiError(err.message || 'Failed to fetch wallet data from server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, withdrawalStatus, withdrawalPagination.page, withdrawalSearch, walletSearch, walletPagination.page, commissionStatusFilter, commissionPagination.page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleToggleAutoDeduct = async (providerId, currentVal, businessName) => {
    if (!currentVal) {
      alert('Admin cannot enable automatic deduction. Provider consent is required from the Provider App.');
      return;
    }
    if (!window.confirm(`Are you sure you want to disable automatic commission deduction for "${businessName || 'this provider'}"? The provider will have to manually pay their commission or re-enable it in their app.`)) {
      return;
    }
    try {
      await walletApi.toggleAutoCommissionAdjustment(providerId, false);
      showNotification(`Automatic commission deduction disabled for ${businessName || 'provider'}`);
      fetchData();
    } catch (err) {
      setApiError(err.message || 'Failed to update auto-deduction setting');
    }
  };

  const handleConfirmSettleFull = async () => {
    if (!settleModal.item) return;
    if (!settleModal.reason.trim() || settleModal.reason.trim().length < 5) {
      setSettleModal(p => ({ ...p, error: 'A mandatory audit reason (min 5 characters) is required' }));
      return;
    }
    setSettleModal(p => ({ ...p, isSubmitting: true, error: '' }));
    try {
      await walletApi.settleCommission(settleModal.item.providerId, { reason: settleModal.reason.trim() });
      showNotification(`Full commission of ₹${settleModal.item.commissionDue} settled successfully`);
      setSettleModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
      fetchData();
    } catch (err) {
      setSettleModal(p => ({ ...p, isSubmitting: false, error: err.message || 'Failed to settle commission' }));
    }
  };

  const handleConfirmWaiveFull = async () => {
    if (!waiveModal.item) return;
    if (!waiveModal.reason.trim() || waiveModal.reason.trim().length < 5) {
      setWaiveModal(p => ({ ...p, error: 'A mandatory audit reason (min 5 characters) is required' }));
      return;
    }
    setWaiveModal(p => ({ ...p, isSubmitting: true, error: '' }));
    try {
      await walletApi.waiveCommission(waiveModal.item.providerId, { reason: waiveModal.reason.trim() });
      showNotification(`Full commission of ₹${waiveModal.item.commissionDue} waived successfully`);
      setWaiveModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
      fetchData();
    } catch (err) {
      setWaiveModal(p => ({ ...p, isSubmitting: false, error: err.message || 'Failed to waive commission' }));
    }
  };

  // Filtered & Sorted Withdrawals (for instant responsive UX)
  const processedWithdrawals = useMemo(() => {
    let list = [...withdrawals];

    // Client-side quick filter if search text present
    if (withdrawalSearch.trim()) {
      const q = withdrawalSearch.trim().toLowerCase();
      list = list.filter((item) => {
        const ref = (item.requestReference || '').toLowerCase();
        const bName = (item.provider?.businessName || '').toLowerCase();
        const pId = String(item.provider?._id || '').toLowerCase();
        const uName = (item.provider?.user?.name || '').toLowerCase();
        const holder = (item.payoutDetails?.accountHolderName || '').toLowerCase();
        const upi = (item.payoutDetails?.upiId || '').toLowerCase();
        return (
          ref.includes(q) ||
          bName.includes(q) ||
          pId.includes(q) ||
          uName.includes(q) ||
          holder.includes(q) ||
          upi.includes(q)
        );
      });
    }

    // Sort order
    list.sort((a, b) => {
      if (withdrawalSort === 'date-asc') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (withdrawalSort === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (withdrawalSort === 'amount-asc') {
        return a.amount - b.amount;
      }
      return new Date(b.createdAt) - new Date(a.createdAt); // default: date-desc
    });

    return list;
  }, [withdrawals, withdrawalSearch, withdrawalSort]);

  // Open Approval Modal
  const openApproveModal = (item) => {
    setApproveModal({
      isOpen: true,
      item,
      note: 'Verified provider eligibility and banking details for payout execution.',
      isSubmitting: false,
      error: ''
    });
  };

  // Confirm Approval Execution
  const handleConfirmApproval = async () => {
    if (!approveModal.item) return;
    setApproveModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await walletApi.approveWithdrawal(
        approveModal.item._id,
        approveModal.note.trim() || 'Approved by admin, ready for bank transfer'
      );
      showNotification(`Withdrawal #${approveModal.item.requestReference} approved for disbursal.`);
      setApproveModal({ isOpen: false, item: null, note: '', isSubmitting: false, error: '' });
      if (viewModal.isOpen) {
        setViewModal({ isOpen: false, item: null, showAccountNumber: false });
      }
      fetchData();
    } catch (err) {
      setApproveModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Failed to approve withdrawal'
      }));
    }
  };

  // Confirm Payout Disbursement Execution
  const handleConfirmPayout = async () => {
    if (!payoutModal.utr.trim()) {
      setPayoutModal((prev) => ({ ...prev, error: 'Bank transfer UTR or Reference ID is required' }));
      return;
    }
    setPayoutModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await walletApi.payoutWithdrawal(payoutModal.item._id, {
        transactionReference: payoutModal.utr.trim(),
        adminNote: payoutModal.note.trim()
      });
      setPayoutModal({ isOpen: false, item: null, utr: '', note: '', isSubmitting: false, error: '' });
      if (viewModal.isOpen) {
        setViewModal({ isOpen: false, item: null, showAccountNumber: false });
      }
      showNotification('Payout marked as paid and deducted from pending liabilities.');
      fetchData();
    } catch (err) {
      setPayoutModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Failed to execute payout confirmation'
      }));
    }
  };

  // Confirm Rejection Execution
  const handleConfirmReject = async () => {
    if (!rejectModal.reason.trim() || rejectModal.reason.trim().length < 4) {
      setRejectModal((prev) => ({
        ...prev,
        error: 'Please enter a clear rejection reason (minimum 4 characters)'
      }));
      return;
    }
    setRejectModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await walletApi.rejectWithdrawal(rejectModal.item._id, rejectModal.reason.trim());
      setRejectModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
      if (viewModal.isOpen) {
        setViewModal({ isOpen: false, item: null, showAccountNumber: false });
      }
      showNotification('Withdrawal rejected and ₹' + rejectModal.item.amount + ' refunded to provider balance.');
      fetchData();
    } catch (err) {
      setRejectModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Failed to reject withdrawal request'
      }));
    }
  };

  // Confirm Manual Ledger Balance Adjustment
  const handleConfirmAdjust = async () => {
    const numAmt = parseFloat(adjustModal.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setAdjustModal((prev) => ({ ...prev, error: 'Please enter a positive numeric adjustment amount' }));
      return;
    }
    if (!adjustModal.reason.trim() || adjustModal.reason.trim().length < 4) {
      setAdjustModal((prev) => ({ ...prev, error: 'A mandatory reason is required for audit trail (min 4 chars)' }));
      return;
    }
    setAdjustModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await walletApi.adjustWallet(adjustModal.wallet._id, {
        type: adjustModal.type,
        amount: numAmt,
        reason: adjustModal.reason.trim()
      });
      setAdjustModal({ isOpen: false, wallet: null, type: 'credit', amount: '', reason: '', isSubmitting: false, error: '' });
      showNotification(`Successfully ${adjustModal.type === 'credit' ? 'credited' : 'debited'} ₹${numAmt} to wallet.`);
      fetchData();
    } catch (err) {
      setAdjustModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Wallet adjustment failed'
      }));
    }
  };

  // Mask bank account number helper (e.g. •••••••• 7371)
  const formatMaskedAccount = (num) => {
    if (!num) return 'Not Provided';
    const clean = String(num).trim();
    if (clean.length <= 4) return '•••• ' + clean;
    const last4 = clean.slice(-4);
    return '•••• •••• ' + last4;
  };

  // Format currency helper
  const formatCurrency = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Wallet className="h-7 w-7 text-indigo-600" />
            Wallets & Payouts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial operations dashboard for platform liabilities, contractor payouts, and provider ledger balances.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 transition-colors shadow-xs disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {apiError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="font-medium">{apiError}</span>
          </div>
          <button
            onClick={() => setApiError(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-semibold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Available Liability */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Available Liability
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              {formatCurrency(stats.totalAvailableLiability)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Platform balance owed to active providers</p>
          </div>
        </div>

        {/* Card 2: Pending Withdrawals */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Withdrawals
            </span>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              {formatCurrency(stats.totalPendingWithdrawals)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Reserved in open withdrawal requests</p>
          </div>
        </div>

        {/* Card 3: Total Disbursed */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Disbursed
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              {formatCurrency(stats.totalDisbursed)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Lifetime completed bank & UPI payouts</p>
          </div>
        </div>

        {/* Card 4: Lifetime Net Earnings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lifetime Net Earnings
            </span>
            <div className="p-2 rounded-lg bg-sky-50 border border-sky-100 text-sky-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
              {formatCurrency(stats.totalEarningsCredited)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total earnings credited across all completed jobs</p>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-8">
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${activeTab === 'withdrawals'
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <span>Withdrawal Requests</span>
          {withdrawalPagination.total > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'withdrawals'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              {withdrawalPagination.total}
            </span>
          )}
          {activeTab === 'withdrawals' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('wallets')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${activeTab === 'wallets'
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <span>Provider Wallets & Ledgers</span>
          {walletPagination.total > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'wallets'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              {walletPagination.total}
            </span>
          )}
          {activeTab === 'wallets' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('commissions')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${activeTab === 'commissions'
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <Percent className="h-4 w-4" />
          <span>Commission Payable to Mendroo</span>
          {commissionSummary.providersWithOutstandingCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === 'commissions'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              ₹{commissionSummary.totalOutstandingCommission.toLocaleString('en-IN')}
            </span>
          )}
          {activeTab === 'commissions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: WITHDRAWAL REQUESTS                                 */}
      {/* ========================================================= */}
      {activeTab === 'withdrawals' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Controls Header: Status Filter Pills, Search & Sort */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-50/50">
            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: 'All Requests' },
                { key: 'requested', label: 'Requested' },
                { key: 'approved', label: 'Approved' },
                { key: 'paid', label: 'Paid' },
                { key: 'rejected', label: 'Rejected' }
              ].map((st) => {
                const count = st.key === 'all' ? withdrawalPagination.total : statusCounts[st.key];
                return (
                  <button
                    key={st.key}
                    onClick={() => {
                      setWithdrawalStatus(st.key);
                      setWithdrawalPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${withdrawalStatus === st.key
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                  >
                    <span>{st.label}</span>
                    {count !== undefined && count !== null && count > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${withdrawalStatus === st.key
                            ? 'bg-indigo-700 text-indigo-100'
                            : 'bg-slate-100 text-slate-600'
                          }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Input & Sort Dropdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={withdrawalSearch}
                  onChange={(e) => setWithdrawalSearch(e.target.value)}
                  placeholder="Search reference, provider..."
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-2xs"
                />
                {withdrawalSearch && (
                  <button
                    onClick={() => setWithdrawalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 hidden sm:block" />
                <select
                  value={withdrawalSort}
                  onChange={(e) => setWithdrawalSort(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Amount: High to Low</option>
                  <option value="amount-asc">Amount: Low to High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : processedWithdrawals.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title="No Withdrawal Requests Found"
                description={
                  withdrawalSearch
                    ? `No withdrawal requests match your search "${withdrawalSearch}".`
                    : `No withdrawal requests in status "${withdrawalStatus}".`
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payout Method</th>
                    <th className="py-3 px-4">Payout Details</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Request Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {processedWithdrawals.map((item) => {
                    const isBank = item.payoutMethod === 'bank_transfer';
                    const isUPI = item.payoutMethod === 'upi';

                    return (
                      <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Reference ID */}
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{item.requestReference}</span>
                            <button
                              onClick={() => handleCopy(item.requestReference, `ref-${item._id}`)}
                              title="Copy Reference ID"
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {copiedField === `ref-${item._id}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Provider */}
                        <td className="py-3.5 px-4 min-w-[180px]">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {item.provider?.businessName || 'Business Name'}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {item.provider?.user?.name || item.provider?.phone || 'Provider'}
                            {item.provider?.user?.phone && ` • ${item.provider.user.phone}`}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap font-sans">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                        </td>

                        {/* Payout Method */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {isUPI ? (
                              <CreditCard className="h-3.5 w-3.5 text-purple-600" />
                            ) : (
                              <Building className="h-3.5 w-3.5 text-sky-600" />
                            )}
                            {isUPI ? 'UPI' : 'Bank Transfer'}
                          </span>
                        </td>

                        {/* Payout Details */}
                        <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                          {isUPI ? (
                            <span className="font-mono text-slate-800">{item.payoutDetails?.upiId || '—'}</span>
                          ) : (
                            <div>
                              <div className="font-medium text-slate-800 truncate">
                                {item.payoutDetails?.accountHolderName || 'Account Holder'}
                              </div>
                              <div className="font-mono text-slate-500 mt-0.5">
                                A/C {formatMaskedAccount(item.payoutDetails?.accountNumber)}
                                {item.payoutDetails?.ifscCode && ` • ${item.payoutDetails.ifscCode}`}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.status === 'paid' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              Paid
                            </span>
                          )}
                          {item.status === 'approved' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 capitalize">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                              Approved
                            </span>
                          )}
                          {item.status === 'requested' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                              Requested
                            </span>
                          )}
                          {item.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 capitalize">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                              Rejected
                            </span>
                          )}
                        </td>

                        {/* Request Date */}
                        <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                          <div>
                            {new Date(item.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                        </td>

                        {/* Actions (Exact Order: [View] [Approve] [Reject]) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {/* Case 1: Status = 'requested' -> [View] [Approve] [Reject] */}
                          {item.status === 'requested' && (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {/* 1. View Button (Always First) */}
                              <button
                                onClick={() => setViewModal({ isOpen: true, item, showAccountNumber: false })}
                                title="View Complete Withdrawal Details"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                <span>View</span>
                              </button>

                              {/* 2. Approve Button */}
                              <button
                                onClick={() => openApproveModal(item)}
                                title="Approve Request for Disbursal"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors shadow-2xs"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Approve</span>
                              </button>

                              {/* 3. Reject Button */}
                              <button
                                onClick={() =>
                                  setRejectModal({
                                    isOpen: true,
                                    item,
                                    reason: '',
                                    isSubmitting: false,
                                    error: ''
                                  })
                                }
                                title="Reject and Refund to Provider Wallet"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}

                          {/* Case 2: Status = 'approved' -> [View] [Pay / Disburse] [Reject] */}
                          {item.status === 'approved' && (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {/* 1. View Button */}
                              <button
                                onClick={() => setViewModal({ isOpen: true, item, showAccountNumber: false })}
                                title="View Complete Withdrawal Details"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                <span>View</span>
                              </button>

                              {/* 2. Disburse Button */}
                              <button
                                onClick={() =>
                                  setPayoutModal({
                                    isOpen: true,
                                    item,
                                    utr: '',
                                    note: '',
                                    isSubmitting: false,
                                    error: ''
                                  })
                                }
                                title="Execute Bank Disbursal & Enter UTR"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors shadow-2xs"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                <span>Pay / Disburse</span>
                              </button>

                              {/* 3. Reject Button */}
                              <button
                                onClick={() =>
                                  setRejectModal({
                                    isOpen: true,
                                    item,
                                    reason: '',
                                    isSubmitting: false,
                                    error: ''
                                  })
                                }
                                title="Reject and Refund to Provider Wallet"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}

                          {/* Case 3: Status = 'paid' -> [View] + UTR tag */}
                          {item.status === 'paid' && (
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                onClick={() => setViewModal({ isOpen: true, item, showAccountNumber: false })}
                                title="View Complete Withdrawal Details"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                <span>View</span>
                              </button>
                              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                UTR: {item.transactionReference || 'Completed'}
                              </span>
                            </div>
                          )}

                          {/* Case 4: Status = 'rejected' -> [View] + reason snippet */}
                          {item.status === 'rejected' && (
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                onClick={() => setViewModal({ isOpen: true, item, showAccountNumber: false })}
                                title="View Complete Withdrawal Details"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                <span>View</span>
                              </button>
                              <span
                                className="text-[11px] text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 max-w-[120px] truncate"
                                title={item.rejectionReason}
                              >
                                {item.rejectionReason || 'Rejected'}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Bar */}
              {withdrawalPagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    Showing page <strong className="text-slate-700">{withdrawalPagination.page}</strong> of{' '}
                    <strong className="text-slate-700">{withdrawalPagination.pages}</strong> ({withdrawalPagination.total} total requests)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={withdrawalPagination.page <= 1}
                      onClick={() => setWithdrawalPagination((p) => ({ ...p, page: p.page - 1 }))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 inline mr-1" />
                      Previous
                    </button>
                    <button
                      disabled={withdrawalPagination.page >= withdrawalPagination.pages}
                      onClick={() => setWithdrawalPagination((p) => ({ ...p, page: p.page + 1 }))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 inline ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PROVIDER WALLETS & LEDGERS                          */}
      {/* ========================================================= */}
      {activeTab === 'wallets' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Search Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={walletSearch}
                onChange={(e) => {
                  setWalletSearch(e.target.value);
                  setWalletPagination((p) => ({ ...p, page: 1 }));
                }}
                placeholder="Search provider business, phone, or name..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
            <div className="text-xs text-slate-500">
              Total Managed Wallets: <strong className="text-slate-800">{walletPagination.total}</strong>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Wallet}
                title="No Provider Wallets Found"
                description="No active wallets found matching your filter criteria."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Available Balance</th>
                    <th className="py-3 px-4">Pending Payout</th>
                    <th className="py-3 px-4">Total Earnings</th>
                    <th className="py-3 px-4">Total Withdrawn</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {wallets.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="font-semibold text-slate-900">{item.provider?.businessName || 'Business'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.provider?.user?.name || item.provider?.phone}
                          {item.provider?.user?.email && ` • ${item.provider.user.email}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700 font-sans">
                        ₹{(item.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-amber-600 font-sans">
                        ₹{(item.pendingWithdrawal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-sans">
                        ₹{(item.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-sans">
                        ₹{(item.totalWithdrawn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                          {item.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            setAdjustModal({
                              isOpen: true,
                              wallet: item,
                              type: 'credit',
                              amount: '',
                              reason: '',
                              isSubmitting: false,
                              error: ''
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                        >
                          <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Adjust Balance</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Wallets Pagination */}
              {walletPagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    Showing page <strong className="text-slate-700">{walletPagination.page}</strong> of{' '}
                    <strong className="text-slate-700">{walletPagination.pages}</strong> ({walletPagination.total} total wallets)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={walletPagination.page <= 1}
                      onClick={() => setWalletPagination((p) => ({ ...p, page: p.page - 1 }))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 inline mr-1" />
                      Previous
                    </button>
                    <button
                      disabled={walletPagination.page >= walletPagination.pages}
                      onClick={() => setWalletPagination((p) => ({ ...p, page: p.page + 1 }))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 inline ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

            {/* ========================================================= */}
      {/* TAB 3: COMMISSION PAYABLE TO MENDROO                      */}
      {/* ========================================================= */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          {/* Strict Full Settlement Rule Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Percent className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                Strict Settlement Rule: Mendroo Platform Commission
              </div>
              <div className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Platform commission on completed bookings must ALWAYS be settled in full in ONE transaction.
                Partial payments, installments, and partial adjustments are strictly blocked.
              </div>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Outstanding Due</div>
              <div className="text-2xl font-bold text-amber-600 mt-1 font-sans">
                ₹{(commissionSummary.totalOutstandingCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">Owed across all active providers</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Providers With Due</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {commissionSummary.providersWithOutstandingCount || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">Providers with balance &gt; ₹0</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Standard Commission Rate</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {commissionSummary?.activeCommissionRate || 15}%
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>Base service only (Parts @ 0%)</span>
                <Link to="/settings?tab=commission" className="text-indigo-600 hover:text-indigo-800 font-semibold underline text-[11px]">
                  Settings &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Critical Business Rule Policy Card */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-indigo-950">
                Audited Commission Policy: Platform Commission Calculated Strictly on Original Base Service Price
              </p>
              <p className="text-indigo-800 leading-relaxed">
                Platform commission (15%) is assessed <strong>only once</strong> on the original service/base price agreed at booking creation. All spare parts, replacement components, and physical materials supplied by providers are <strong>100% commission-free (Parts Commission = ₹0)</strong>. Net customer parts payments are credited in full to the provider.
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCommissionStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    commissionStatusFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All Providers
                </button>
                <button
                  onClick={() => setCommissionStatusFilter('outstanding')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    commissionStatusFilter === 'outstanding'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Outstanding Only
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Total Listed: <strong className="text-slate-800">{commissions.length}</strong>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : commissions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Percent}
                  title="No Commission Records"
                  description="No providers found matching your filter criteria."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Available Balance</th>
                      <th className="py-3 px-4">Commission Payable to Mendroo</th>
                      <th className="py-3 px-4">Auto Deduct from Wallet</th>
                      <th className="py-3 px-4">Last Auto-Deduction</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {commissions.map((c) => (
                      <tr key={c.walletId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="font-semibold text-slate-900">{c.businessName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{c.providerPhone}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 font-sans">
                          ₹{(c.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 font-bold font-sans">
                          {c.commissionDue > 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ₹{(c.commissionDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">₹0.00 (Settled)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.autoDeductCommissionFromWallet || c.autoCommissionAdjustment ? (
                            <button
                              onClick={() => handleToggleAutoDeduct(c.providerId, true, c.businessName)}
                              title="Click to disable automatic deduction for this provider"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Active (Provider Opted-In)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleAutoDeduct(c.providerId, false, c.businessName)}
                              title="Admin cannot enable automatic deduction. Provider consent is required from the Provider App."
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              <Lock className="h-3 w-3 text-slate-400" />
                              <span>Disabled</span>
                            </button>
                          )}
                          {c.reconciliationFlagged && (
                            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              <span>Reconciliation Flagged</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {c.lastAutoDeductionAt
                            ? new Date(c.lastAutoDeductionAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Never'}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                          {c.commissionDue > 0 ? (
                            <>
                              <button
                                onClick={() => setSettleModal({ isOpen: true, item: c, reason: 'Offline bank transfer collected & verified by admin', isSubmitting: false, error: '' })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
                              >
                                Settle Full (₹{c.commissionDue})
                              </button>
                              <button
                                onClick={() => setWaiveModal({ isOpen: true, item: c, reason: '', isSubmitting: false, error: '' })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors"
                              >
                                Waive Full
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No Due</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SETTLE FULL COMMISSION MODAL */}
      {settleModal.isOpen && settleModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Settle Full Commission (Offline Payment)</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <div>Provider: <strong>{settleModal.item.businessName}</strong></div>
              <div>Outstanding Amount: <strong className="text-amber-700 font-sans">₹{settleModal.item.commissionDue}</strong></div>
              <div className="text-slate-500 text-[11px]">Strict Full Settlement: Entire outstanding balance will be settled to ₹0.</div>
            </div>
            {settleModal.error && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                {settleModal.error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mandatory Audit Reason (min 5 chars)</label>
              <textarea
                rows={3}
                value={settleModal.reason}
                onChange={e => setSettleModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Offline bank transfer collected and verified on bank statement..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSettleModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={settleModal.isSubmitting}
                onClick={handleConfirmSettleFull}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {settleModal.isSubmitting ? 'Settling...' : `Confirm Settle ₹${settleModal.item.commissionDue}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAIVE FULL COMMISSION MODAL */}
      {waiveModal.isOpen && waiveModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-rose-900">Waive Full Commission (Audit Required)</h3>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1 text-rose-800">
              <div>Provider: <strong>{waiveModal.item.businessName}</strong></div>
              <div>Amount to Waive: <strong className="font-sans">₹{waiveModal.item.commissionDue}</strong></div>
              <div className="text-[11px]">Notice: This write-off creates a permanent COMMISSION_WAIVER audit ledger transaction.</div>
            </div>
            {waiveModal.error && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                {waiveModal.error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Audited Justification Reason (min 5 chars)</label>
              <textarea
                rows={3}
                value={waiveModal.reason}
                onChange={e => setWaiveModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Authorized customer goodwill dispute resolution; platform waived platform take-rate."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWaiveModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={waiveModal.isSubmitting}
                onClick={handleConfirmWaiveFull}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {waiveModal.isSubmitting ? 'Waiving...' : `Confirm Waive ₹${waiveModal.item.commissionDue}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: COMPLETE WITHDRAWAL DETAILS VIEW DRAWER / MODAL    */}

      {/* ========================================================= */}
      {/* MODAL 1: COMPLETE WITHDRAWAL DETAILS VIEW DRAWER / MODAL    */}
      {/* ========================================================= */}
      {viewModal.isOpen && viewModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Withdrawal Request Details
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      {viewModal.item.requestReference}
                    </span>
                    <button
                      onClick={() => handleCopy(viewModal.item.requestReference, 'modal-ref')}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                      title="Copy Reference"
                    >
                      {copiedField === 'modal-ref' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 inline" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 inline" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status Badge */}
                {viewModal.item.status === 'paid' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                    Paid
                  </span>
                )}
                {viewModal.item.status === 'approved' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 capitalize">
                    Approved
                  </span>
                )}
                {viewModal.item.status === 'requested' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                    Requested
                  </span>
                )}
                {viewModal.item.status === 'rejected' && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 capitalize">
                    Rejected
                  </span>
                )}

                <button
                  onClick={() => setViewModal({ isOpen: false, item: null, showAccountNumber: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* SECTION A: WITHDRAWAL FINANCIAL OVERVIEW */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Requested Payout Amount
                  </span>
                  <div className="text-3xl font-extrabold text-slate-900 mt-1 font-sans">
                    ₹{Number(viewModal.item.amount || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      Requested on{' '}
                      {new Date(viewModal.item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}{' '}
                      at{' '}
                      {new Date(viewModal.item.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Payout Method
                  </span>
                  <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-800">
                    {viewModal.item.payoutMethod === 'upi' ? (
                      <CreditCard className="h-4 w-4 text-purple-600" />
                    ) : (
                      <Building className="h-4 w-4 text-sky-600" />
                    )}
                    {viewModal.item.payoutMethod === 'upi' ? 'UPI Instant Transfer' : 'Direct Bank NEFT/IMPS'}
                  </span>
                </div>
              </div>

              {/* SECTION B: PROVIDER IDENTITY */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-slate-400" />
                  Provider Account Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-xl p-4">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Business / Trade Name</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {viewModal.item.provider?.businessName || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Provider ID</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-xs text-slate-700 truncate">
                        {String(viewModal.item.provider?._id || 'N/A')}
                      </span>
                      <button
                        onClick={() => handleCopy(viewModal.item.provider?._id, 'provider-id')}
                        className="text-slate-400 hover:text-slate-600"
                        title="Copy Provider ID"
                      >
                        {copiedField === 'provider-id' ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Contact Name</span>
                    <span className="text-xs font-medium text-slate-800">
                      {viewModal.item.provider?.user?.name || 'Registered Provider'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Phone & Email</span>
                    <div className="text-xs text-slate-700">
                      {viewModal.item.provider?.user?.phone || viewModal.item.provider?.phone || '—'}
                      {viewModal.item.provider?.user?.email && (
                        <span className="block text-slate-500">{viewModal.item.provider.user.email}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION C: PAYOUT DESTINATION DETAILS (WITH ACCOUNT MASKING) */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-slate-400" />
                  Payout Destination Coordinates
                </h4>

                {viewModal.item.payoutMethod === 'bank_transfer' ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Account Holder Name</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {viewModal.item.payoutDetails?.accountHolderName || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Bank Name</span>
                        <span className="text-sm font-medium text-slate-800">
                          {viewModal.item.payoutDetails?.bankName || 'Not specified'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">IFSC Code</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {viewModal.item.payoutDetails?.ifscCode || '—'}
                          </span>
                          {viewModal.item.payoutDetails?.ifscCode && (
                            <button
                              onClick={() => handleCopy(viewModal.item.payoutDetails.ifscCode, 'ifsc-code')}
                              className="text-slate-400 hover:text-slate-600"
                              title="Copy IFSC Code"
                            >
                              {copiedField === 'ifsc-code' ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bank Account Number with Mask / Reveal Toggle */}
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Bank Account Number</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-bold text-slate-900 tracking-wider">
                            {viewModal.showAccountNumber
                              ? viewModal.item.payoutDetails?.accountNumber || '—'
                              : formatMaskedAccount(viewModal.item.payoutDetails?.accountNumber)}
                          </span>

                          {/* Reveal/Hide Toggle Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setViewModal((prev) => ({
                                ...prev,
                                showAccountNumber: !prev.showAccountNumber
                              }))
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                          >
                            {viewModal.showAccountNumber ? (
                              <>
                                <EyeOff className="h-3 w-3 text-slate-500" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3 text-slate-500" />
                                <span>Reveal</span>
                              </>
                            )}
                          </button>

                          {/* Copy Full Number (When Revealed) */}
                          {viewModal.showAccountNumber && viewModal.item.payoutDetails?.accountNumber && (
                            <button
                              type="button"
                              onClick={() => handleCopy(viewModal.item.payoutDetails.accountNumber, 'acc-num')}
                              className="text-slate-400 hover:text-slate-600"
                              title="Copy Full Account Number"
                            >
                              {copiedField === 'acc-num' ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Account number masked for security compliance. Never stored in local storage.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <span className="text-[11px] font-medium text-slate-400 block">Virtual Payment Address (UPI ID)</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {viewModal.item.payoutDetails?.upiId || '—'}
                      </span>
                      {viewModal.item.payoutDetails?.upiId && (
                        <button
                          onClick={() => handleCopy(viewModal.item.payoutDetails.upiId, 'upi-id')}
                          className="text-slate-400 hover:text-slate-600"
                          title="Copy UPI ID"
                        >
                          {copiedField === 'upi-id' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION D: PROVIDER WALLET LEDGER SNAPSHOT */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  Provider Wallet Ledger Snapshot
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Available Balance</span>
                    <div className="text-sm font-bold text-emerald-700 mt-0.5">
                      {viewModal.item.wallet?.availableBalance !== undefined
                        ? `₹${Number(viewModal.item.wallet.availableBalance).toLocaleString('en-IN')}`
                        : 'Active'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Pending Payouts</span>
                    <div className="text-sm font-bold text-amber-600 mt-0.5">
                      {viewModal.item.wallet?.pendingWithdrawal !== undefined
                        ? `₹${Number(viewModal.item.wallet.pendingWithdrawal).toLocaleString('en-IN')}`
                        : 'Reserved'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Lifetime Earnings</span>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">
                      {viewModal.item.wallet?.totalEarnings !== undefined
                        ? `₹${Number(viewModal.item.wallet.totalEarnings).toLocaleString('en-IN')}`
                        : '—'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Withdrawn</span>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">
                      {viewModal.item.wallet?.totalWithdrawn !== undefined
                        ? `₹${Number(viewModal.item.wallet.totalWithdrawn).toLocaleString('en-IN')}`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION E: LIFECYCLE AUDIT TIMELINE */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Lifecycle & Audit Timeline
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  {/* Step 1: Request Created */}
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-slate-800">Withdrawal Initiated by Provider</div>
                      <div className="text-slate-500">
                        {new Date(viewModal.item.createdAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Administrative Review */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1 rounded-full mt-0.5 ${viewModal.item.status === 'requested'
                          ? 'bg-amber-100 text-amber-700'
                          : viewModal.item.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                    >
                      {viewModal.item.status === 'requested' ? (
                        <Clock className="h-3 w-3" />
                      ) : viewModal.item.status === 'rejected' ? (
                        <X className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-slate-800">
                        {viewModal.item.status === 'requested'
                          ? 'Awaiting Administrative Review'
                          : viewModal.item.status === 'rejected'
                            ? 'Withdrawal Request Rejected'
                            : 'Approved by Administrator'}
                      </div>
                      {viewModal.item.adminNote && (
                        <div className="text-slate-600 mt-0.5 italic">Note: "{viewModal.item.adminNote}"</div>
                      )}
                      {viewModal.item.rejectionReason && (
                        <div className="text-rose-600 mt-0.5 font-medium">
                          Reason: {viewModal.item.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Disbursement */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1 rounded-full mt-0.5 ${viewModal.item.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                        }`}
                    >
                      {viewModal.item.status === 'paid' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-slate-800">
                        {viewModal.item.status === 'paid'
                          ? 'Disbursed to Provider Bank / UPI'
                          : 'Bank Disbursement Execution'}
                      </div>
                      {viewModal.item.transactionReference ? (
                        <div className="text-emerald-700 font-mono mt-0.5">
                          UTR Reference: {viewModal.item.transactionReference}
                        </div>
                      ) : (
                        <div className="text-slate-400">Pending bank settlement execution</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setViewModal({ isOpen: false, item: null, showAccountNumber: false })}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-2xs"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {viewModal.item.status === 'requested' && (
                  <>
                    <button
                      onClick={() => {
                        const target = viewModal.item;
                        setRejectModal({
                          isOpen: true,
                          item: target,
                          reason: '',
                          isSubmitting: false,
                          error: ''
                        });
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => openApproveModal(viewModal.item)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve Request
                    </button>
                  </>
                )}

                {viewModal.item.status === 'approved' && (
                  <>
                    <button
                      onClick={() => {
                        const target = viewModal.item;
                        setRejectModal({
                          isOpen: true,
                          item: target,
                          reason: '',
                          isSubmitting: false,
                          error: ''
                        });
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => {
                        const target = viewModal.item;
                        setPayoutModal({
                          isOpen: true,
                          item: target,
                          utr: '',
                          note: '',
                          isSubmitting: false,
                          error: ''
                        });
                      }}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Complete Disbursal
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: APPROVAL CONFIRMATION MODAL                       */}
      {/* ========================================================= */}
      {approveModal.isOpen && approveModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Approve Withdrawal Request</h3>
                <span className="font-mono text-xs text-slate-500">
                  {approveModal.item.requestReference}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Confirming approval verifies eligibility for{' '}
              <strong className="text-slate-900">{approveModal.item.provider?.businessName}</strong>. Funds of{' '}
              <strong className="text-emerald-700 font-bold">
                ₹{Number(approveModal.item.amount || 0).toLocaleString('en-IN')}
              </strong>{' '}
              will remain locked in Pending Withdrawals until bank transfer execution.
            </p>

            {approveModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {approveModal.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Internal Processing Note (Optional)
              </label>
              <input
                type="text"
                value={approveModal.note}
                onChange={(e) => setApproveModal((p) => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Verified KYC and bank account details"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setApproveModal({ isOpen: false, item: null, note: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={approveModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {approveModal.isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: COMPLETE PAYOUT / DISBURSAL MODAL                 */}
      {/* ========================================================= */}
      {payoutModal.isOpen && payoutModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Execute Disbursal Settlement</h3>
                <span className="font-mono text-xs text-slate-500">
                  Ref: {payoutModal.item.requestReference}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Recording payout of{' '}
              <strong className="text-slate-900 font-bold">
                ₹{Number(payoutModal.item.amount || 0).toLocaleString('en-IN')}
              </strong>{' '}
              to <strong className="text-slate-900">{payoutModal.item.provider?.businessName}</strong>. This action
              marks the request as Paid and moves reserved funds into Total Disbursed.
            </p>

            {payoutModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {payoutModal.error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bank UTR / Transaction Reference ID *
                </label>
                <input
                  type="text"
                  value={payoutModal.utr}
                  onChange={(e) => setPayoutModal((p) => ({ ...p, utr: e.target.value }))}
                  placeholder="e.g. UTR1234567890 or UPI-REF-9988"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Internal Settlement Note (Optional)
                </label>
                <input
                  type="text"
                  value={payoutModal.note}
                  onChange={(e) => setPayoutModal((p) => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. Disbursed via corporate NetBanking account"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setPayoutModal({ isOpen: false, item: null, utr: '', note: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayout}
                disabled={payoutModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {payoutModal.isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirm Disbursal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: REJECTION CONFIRMATION MODAL                      */}
      {/* ========================================================= */}
      {rejectModal.isOpen && rejectModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Withdrawal Request</h3>
                <span className="font-mono text-xs text-slate-500">
                  Ref: {rejectModal.item.requestReference}
                </span>
              </div>
            </div>

            <div className="p-3 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
              <strong>Atomic Refund Notice:</strong> The reserved amount of{' '}
              <strong className="text-slate-900 font-bold">
                ₹{Number(rejectModal.item.amount || 0).toLocaleString('en-IN')}
              </strong>{' '}
              will be atomically refunded back into{' '}
              <strong className="text-slate-900">{rejectModal.item.provider?.businessName}</strong>'s available
              wallet balance.
            </div>

            {rejectModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {rejectModal.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mandatory Rejection Reason (Visible to Provider) *
              </label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((p) => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Invalid bank account IFSC code or account holder name mismatch"
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setRejectModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejectModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {rejectModal.isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirm Rejection & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: MANUAL LEDGER BALANCE ADJUSTMENT                  */}
      {/* ========================================================= */}
      {adjustModal.isOpen && adjustModal.wallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Sliders className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Manual Ledger Adjustment</h3>
                <span className="text-xs text-slate-500">
                  {adjustModal.wallet.provider?.businessName || 'Provider'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Current Available Balance:{' '}
              <strong className="text-emerald-700 font-bold font-sans">
                ₹{Number(adjustModal.wallet.availableBalance || 0).toLocaleString('en-IN')}
              </strong>
            </p>

            {adjustModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {adjustModal.error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModal((p) => ({ ...p, type: 'credit' }))}
                    className={`py-2 text-xs font-bold rounded-lg border transition-colors ${adjustModal.type === 'credit'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    + Credit Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustModal((p) => ({ ...p, type: 'debit' }))}
                    className={`py-2 text-xs font-bold rounded-lg border transition-colors ${adjustModal.type === 'debit'
                        ? 'bg-rose-50 border-rose-500 text-rose-700'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    - Debit Balance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adjustment Amount (₹) *</label>
                <input
                  type="number"
                  value={adjustModal.amount}
                  onChange={(e) => setAdjustModal((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="e.g. 500"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Audited Business Reason *</label>
                <textarea
                  rows={2}
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Compensation for customer dispute or promotional grant"
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setAdjustModal({ isOpen: false, wallet: null, type: 'credit', amount: '', reason: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjust}
                disabled={adjustModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {adjustModal.isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletsPage;
