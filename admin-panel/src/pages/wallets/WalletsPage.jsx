import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
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
  Send,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  FileText
} from 'lucide-react';
import { walletApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const WalletsPage = () => {
  const [activeTab, setActiveTab] = useState('withdrawals'); // 'withdrawals' | 'wallets'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Stats
  const [stats, setStats] = useState({
    totalAvailableLiability: 0,
    totalPendingWithdrawals: 0,
    totalEarningsCredited: 0,
    totalDisbursed: 0
  });

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState('all');
  const [withdrawalPagination, setWithdrawalPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Wallets State
  const [wallets, setWallets] = useState([]);
  const [walletSearch, setWalletSearch] = useState('');
  const [walletPagination, setWalletPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Modals
  const [payoutModal, setPayoutModal] = useState({ isOpen: false, item: null, utr: '', note: '', isSubmitting: false, error: '' });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
  const [adjustModal, setAdjustModal] = useState({ isOpen: false, wallet: null, type: 'credit', amount: '', reason: '', isSubmitting: false, error: '' });

  const fetchData = useCallback(async () => {
    try {
      setApiError(null);
      if (activeTab === 'withdrawals') {
        const [wRes, wltRes] = await Promise.all([
          walletApi.getWithdrawals({ status: withdrawalStatus, page: withdrawalPagination.page, limit: 15 }),
          walletApi.getWallets({ limit: 1 })
        ]);
        if (wRes?.data) {
          setWithdrawals(wRes.data);
          setWithdrawalPagination(wRes.pagination || { page: 1, limit: 15, total: wRes.data.length, pages: 1 });
        }
        if (wltRes?.stats) {
          setStats(wltRes.stats);
        }
      } else {
        const wltRes = await walletApi.getWallets({ search: walletSearch, page: walletPagination.page, limit: 15 });
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
      setApiError(err.message || 'Failed to fetch wallet data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, withdrawalStatus, withdrawalPagination.page, walletSearch, walletPagination.page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Payout actions
  const handleApproveRequest = async (item) => {
    try {
      await walletApi.approveWithdrawal(item._id, 'Approved by admin, pending bank transfer execution');
      showNotification(`Withdrawal #${item.requestReference} approved for processing.`);
      fetchData();
    } catch (err) {
      setApiError(err.message || 'Failed to approve withdrawal');
    }
  };

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
      showNotification('Payout marked completed and funds successfully deducted from liability.');
      fetchData();
    } catch (err) {
      setPayoutModal((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Payout failed' }));
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal.reason.trim() || rejectModal.reason.trim().length < 4) {
      setRejectModal((prev) => ({ ...prev, error: 'Please enter a valid rejection reason (min 4 characters)' }));
      return;
    }
    setRejectModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await walletApi.rejectWithdrawal(rejectModal.item._id, rejectModal.reason.trim());
      setRejectModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' });
      showNotification('Withdrawal rejected and funds refunded to provider available balance.');
      fetchData();
    } catch (err) {
      setRejectModal((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Rejection failed' }));
    }
  };

  const handleConfirmAdjust = async () => {
    const numAmt = parseFloat(adjustModal.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setAdjustModal((prev) => ({ ...prev, error: 'Please enter a positive numeric amount' }));
      return;
    }
    if (!adjustModal.reason.trim() || adjustModal.reason.trim().length < 4) {
      setAdjustModal((prev) => ({ ...prev, error: 'A clear reason is required for administrative audit (min 4 chars)' }));
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
      setAdjustModal((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Adjustment failed' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Wallet className="h-7 w-7 text-indigo-400" />
            Wallet & Payout Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor platform liabilities, review contractor payout requests, execute bank transfers, and adjust provider ledger balances.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {apiError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Available Liability</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              ₹{(stats.totalAvailableLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">Platform balance owed to active providers</p>
          </div>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Withdrawals</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              ₹{(stats.totalPendingWithdrawals || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">Reserved in open withdrawal requests</p>
          </div>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Disbursed</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              ₹{(stats.totalDisbursed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">Lifetime completed bank & UPI payouts</p>
          </div>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lifetime Net Earnings</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              ₹{(stats.totalEarningsCredited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total earnings credited across all jobs</p>
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-3 text-sm font-semibold transition relative ${
            activeTab === 'withdrawals' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Withdrawal Requests
          {activeTab === 'withdrawals' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('wallets')}
          className={`pb-3 text-sm font-semibold transition relative ${
            activeTab === 'wallets' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Provider Wallets & Ledgers
          {activeTab === 'wallets' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB 1: WITHDRAWAL REQUESTS */}
      {activeTab === 'withdrawals' && (
        <Card className="p-6 bg-slate-900/60 border-slate-800">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              {['all', 'requested', 'approved', 'paid', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setWithdrawalStatus(st);
                    setWithdrawalPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    withdrawalStatus === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : withdrawals.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Withdrawal Requests"
              description={`No withdrawal requests found matching status filter '${withdrawalStatus}'.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payout Method</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {withdrawals.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                        {item.requestReference}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{item.provider?.businessName || 'Provider'}</div>
                        <div className="text-xs text-slate-400">{item.provider?.user?.name || item.provider?.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        ₹{item.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                          {item.payoutMethod === 'upi' ? (
                            <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                          ) : (
                            <Building className="h-3.5 w-3.5 text-sky-400" />
                          )}
                          {item.payoutMethod === 'upi' ? 'UPI' : 'Bank Transfer'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300 max-w-xs truncate">
                        {item.payoutMethod === 'upi' ? (
                          <span>{item.payoutDetails?.upiId}</span>
                        ) : (
                          <div>
                            <div>{item.payoutDetails?.accountHolderName}</div>
                            <div className="font-mono text-slate-400">
                              A/C {item.payoutDetails?.accountNumber} ({item.payoutDetails?.ifscCode})
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            item.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'approved'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : item.status === 'requested'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {item.status === 'requested' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveRequest(item)}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModal({ isOpen: true, item, reason: '', isSubmitting: false, error: '' })}
                              className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-medium border border-rose-500/30 transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {item.status === 'approved' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPayoutModal({ isOpen: true, item, utr: '', note: '', isSubmitting: false, error: '' })}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                            >
                              Pay / Disburse
                            </button>
                            <button
                              onClick={() => setRejectModal({ isOpen: true, item, reason: '', isSubmitting: false, error: '' })}
                              className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-medium border border-rose-500/30 transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {item.status === 'paid' && (
                          <span className="text-xs text-emerald-400 font-mono">
                            UTR: {item.transactionReference || 'Complete'}
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="text-xs text-rose-400" title={item.rejectionReason}>
                            {item.rejectionReason?.slice(0, 20)}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {withdrawalPagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-400">
                    Showing page {withdrawalPagination.page} of {withdrawalPagination.pages} ({withdrawalPagination.total} requests)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={withdrawalPagination.page <= 1}
                      onClick={() => setWithdrawalPagination((p) => ({ ...p, page: p.page - 1 }))}
                      className="p-1.5 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      disabled={withdrawalPagination.page >= withdrawalPagination.pages}
                      onClick={() => setWithdrawalPagination((p) => ({ ...p, page: p.page + 1 }))}
                      className="p-1.5 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: PROVIDER WALLETS & LEDGERS */}
      {activeTab === 'wallets' && (
        <Card className="p-6 bg-slate-900/60 border-slate-800">
          {/* Search Header */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={walletSearch}
                onChange={(e) => {
                  setWalletSearch(e.target.value);
                  setWalletPagination((p) => ({ ...p, page: 1 }));
                }}
                placeholder="Search provider by name or phone..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : wallets.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No Wallets Found"
              description="No provider wallets found in the system."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Available Balance</th>
                    <th className="py-3 px-4">Pending Payout</th>
                    <th className="py-3 px-4">Total Earnings</th>
                    <th className="py-3 px-4">Total Withdrawn</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {wallets.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{item.provider?.businessName || 'Business'}</div>
                        <div className="text-xs text-slate-400">
                          {item.provider?.user?.name || item.provider?.phone} • {item.provider?.user?.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">
                        ₹{(item.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-amber-400 font-semibold">
                        ₹{(item.pendingWithdrawal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">
                        ₹{(item.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">
                        ₹{(item.totalWithdrawn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                          {item.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setAdjustModal({ isOpen: true, wallet: item, type: 'credit', amount: '', reason: '', isSubmitting: false, error: '' })}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 ml-auto transition"
                        >
                          <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                          Adjust Balance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {walletPagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-400">
                    Showing page {walletPagination.page} of {walletPagination.pages} ({walletPagination.total} wallets)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={walletPagination.page <= 1}
                      onClick={() => setWalletPagination((p) => ({ ...p, page: p.page - 1 }))}
                      className="p-1.5 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      disabled={walletPagination.page >= walletPagination.pages}
                      onClick={() => setWalletPagination((p) => ({ ...p, page: p.page + 1 }))}
                      className="p-1.5 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* MODAL 1: COMPLETE PAYOUT */}
      {payoutModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Complete Payout Disbursement
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Payout of <strong className="text-white">₹{payoutModal.item?.amount.toLocaleString('en-IN')}</strong> to{' '}
              <strong className="text-white">{payoutModal.item?.provider?.businessName}</strong>.
            </p>

            {payoutModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {payoutModal.error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Bank UTR / Transaction Reference ID *
                </label>
                <input
                  type="text"
                  value={payoutModal.utr}
                  onChange={(e) => setPayoutModal((p) => ({ ...p, utr: e.target.value }))}
                  placeholder="e.g. UTR1234567890 or UPI-REF-9988"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Admin Internal Note (Optional)
                </label>
                <input
                  type="text"
                  value={payoutModal.note}
                  onChange={(e) => setPayoutModal((p) => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. Disbursed via corporate NetBanking"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPayoutModal({ isOpen: false, item: null, utr: '', note: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayout}
                disabled={payoutModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition flex items-center gap-2"
              >
                {payoutModal.isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                Confirm Disbursal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT WITHDRAWAL */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 text-rose-400">
              <XCircle className="h-5 w-5" />
              Reject Withdrawal Request
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              The reserved amount of <strong className="text-white">₹{rejectModal.item?.amount.toLocaleString('en-IN')}</strong> will automatically be refunded back to the provider's available balance.
            </p>

            {rejectModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {rejectModal.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reason for Rejection *
              </label>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((p) => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Invalid IFSC Code or incorrect bank account number"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setRejectModal({ isOpen: false, item: null, reason: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejectModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition flex items-center gap-2"
              >
                {rejectModal.isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                Confirm Rejection & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUST BALANCE */}
      {adjustModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-400" />
              Manual Ledger Balance Adjustment
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Provider: <strong className="text-white">{adjustModal.wallet?.provider?.businessName}</strong> • Current Available Balance:{' '}
              <strong className="text-emerald-400">₹{adjustModal.wallet?.availableBalance}</strong>
            </p>

            {adjustModal.error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {adjustModal.error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModal((p) => ({ ...p, type: 'credit' }))}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      adjustModal.type === 'credit'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    + Credit Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustModal((p) => ({ ...p, type: 'debit' }))}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      adjustModal.type === 'debit'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    - Debit Balance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  value={adjustModal.amount}
                  onChange={(e) => setAdjustModal((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="e.g. 500"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Administrative Reason (Audited) *</label>
                <textarea
                  rows={2}
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Promotional onboarding bonus or customer dispute reimbursement"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setAdjustModal({ isOpen: false, wallet: null, type: 'credit', amount: '', reason: '', isSubmitting: false, error: '' })}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjust}
                disabled={adjustModal.isSubmitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition flex items-center gap-2"
              >
                {adjustModal.isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
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

