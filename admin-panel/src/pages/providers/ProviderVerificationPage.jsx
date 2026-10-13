import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
  ShieldX,
  Mail,
  Phone,
  Briefcase,
  AlertTriangle,
  X,
  Check,
  Ban
} from 'lucide-react';
import { providerApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const ProviderVerificationPage = () => {
  // Data State
  const [pendingProviders, setPendingProviders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Review Drawer / Modal State
  const [reviewingProvider, setReviewingProvider] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Rejection Dialog State (for requiring mandatory rejection reason)
  const [rejectionDialog, setRejectionDialog] = useState({
    isOpen: false,
    type: 'provider', // 'provider' or 'document'
    documentId: null,
    reason: '',
    error: null
  });

  // Generic Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmVariant: 'primary',
    onConfirm: () => {},
    isLoading: false
  });

  // Fetch Pending Providers Queue
  const fetchPendingQueue = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm.trim() || undefined
      };
      const response = await providerApi.getPendingVerifications(params);
      if (response?.success) {
        setPendingProviders(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        setApiError(response?.message || 'Failed to retrieve verification queue');
      }
    } catch (err) {
      setApiError(err.userMessage || 'Failed to connect to verification queue API.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    fetchPendingQueue();
  }, [fetchPendingQueue]);

  // Auto-dismiss success alert
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Open Review Modal for Provider
  const handleOpenReview = async (provider) => {
    setIsReviewModalOpen(true);
    setReviewingProvider(provider);
    // Refresh latest detailed provider dossier
    try {
      const response = await providerApi.getAdminProviderById(provider._id);
      if (response?.success && response.data) {
        setReviewingProvider(response.data);
      }
    } catch (err) {
      console.error('Failed to reload fresh provider dossier:', err);
    }
  };

  // Action: Approve Individual Document
  const handleApproveDocument = async (docId) => {
    if (!reviewingProvider) return;
    setIsActionLoading(true);
    try {
      const response = await providerApi.reviewDocument(reviewingProvider._id, docId, {
        status: 'approved',
        reviewNote: 'Verified and approved by administrator'
      });
      if (response?.success) {
        setReviewingProvider(response.data);
        setSuccessMessage('Document marked as approved.');
        fetchPendingQueue();
      }
    } catch (err) {
      setApiError(err.userMessage || 'Failed to approve document.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Action: Open Document Rejection Prompt
  const handleOpenRejectDocument = (docId) => {
    setRejectionDialog({
      isOpen: true,
      type: 'document',
      documentId: docId,
      reason: '',
      error: null
    });
  };

  // Action: Open Provider Rejection Prompt
  const handleOpenRejectProvider = () => {
    setRejectionDialog({
      isOpen: true,
      type: 'provider',
      documentId: null,
      reason: '',
      error: null
    });
  };

  // Submit Rejection (Either Document or Provider)
  const handleSubmitRejection = async () => {
    if (!rejectionDialog.reason.trim()) {
      setRejectionDialog((prev) => ({
        ...prev,
        error: 'A detailed reason is required to notify the provider.'
      }));
      return;
    }

    setIsActionLoading(true);
    try {
      if (rejectionDialog.type === 'document') {
        const response = await providerApi.reviewDocument(
          reviewingProvider._id,
          rejectionDialog.documentId,
          {
            status: 'rejected',
            reviewNote: rejectionDialog.reason.trim()
          }
        );
        if (response?.success) {
          setReviewingProvider(response.data);
          setSuccessMessage('Document rejected with review note.');
          setRejectionDialog({ isOpen: false, type: 'provider', documentId: null, reason: '', error: null });
          fetchPendingQueue();
        }
      } else {
        // Reject whole provider
        const response = await providerApi.updateVerification(reviewingProvider._id, {
          status: 'rejected',
          rejectionReason: rejectionDialog.reason.trim()
        });
        if (response?.success) {
          setSuccessMessage(`Application for '${reviewingProvider.businessName}' rejected.`);
          setIsReviewModalOpen(false);
          setRejectionDialog({ isOpen: false, type: 'provider', documentId: null, reason: '', error: null });
          fetchPendingQueue();
        }
      }
    } catch (err) {
      setRejectionDialog((prev) => ({
        ...prev,
        error: err.userMessage || 'Operation failed. Please try again.'
      }));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Action: Approve Overall Provider Verification
  const handleApproveProvider = () => {
    if (!reviewingProvider) return;

    setConfirmModal({
      isOpen: true,
      title: 'Approve Provider Onboarding',
      message: `Are you sure you want to verify '${reviewingProvider.businessName || reviewingProvider.user?.name}'? The provider will immediately become publicly discoverable in the marketplace for customer bookings.`,
      confirmText: 'Approve & Verify',
      confirmVariant: 'primary',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          const response = await providerApi.updateVerification(reviewingProvider._id, {
            status: 'verified'
          });
          if (response?.success) {
            setSuccessMessage(
              `Provider '${reviewingProvider.businessName}' approved and verified successfully.`
            );
            setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
            setIsReviewModalOpen(false);
            fetchPendingQueue();
          }
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || 'Failed to approve provider verification.');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Provider Verification Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit submitted contractor credentials, verify government identity documents, and onboard vetted service professionals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchPendingQueue}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Global Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Global Error Alert */}
      {apiError && (
        <div
          role="alert"
          className="flex items-start justify-between p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-900">Verification Notice</span>
              <span className="text-xs text-rose-700 leading-relaxed">{apiError}</span>
            </div>
          </div>
          <button
            onClick={() => setApiError(null)}
            className="text-rose-600 hover:text-rose-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Queue Filter Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search pending applications by business or owner..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>
                Queue Status:{' '}
                <strong className="font-semibold">{pagination.total} Candidates Awaiting Verification</strong>
              </span>
            </span>
          </div>
        </div>
      </Card>

      {/* Pending Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner size="lg" text="Loading verification candidates..." />
          </div>
        ) : pendingProviders.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ShieldCheck}
              title={
                searchTerm
                  ? 'No matching candidates in pending queue'
                  : 'Verification Queue is Clear'
              }
              description={
                searchTerm
                  ? 'Try broadening your search keywords or resetting filters.'
                  : 'All provider onboarding applications have been verified. New registrations will automatically appear here.'
              }
              action={
                searchTerm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Clear Search
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">
                      Candidate / Business
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Owner Contact
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Experience
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-center">
                      Submitted Documents
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Submission Date
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Audit Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pendingProviders.map((provider) => (
                    <tr key={provider._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Business Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-semibold shrink-0 mt-0.5">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block leading-snug">
                              {provider.businessName || 'Business Name Pending'}
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Applicant: {provider.user?.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{provider.user?.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{provider.user?.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Experience */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          {provider.experienceYears || 0} Years
                        </span>
                      </td>

                      {/* Documents Count */}
                      <td className="px-6 py-4 text-center">
                        <Badge
                          variant={provider.documents?.length > 0 ? 'primary' : 'warning'}
                          className="gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{provider.documents?.length || 0} Documents</span>
                        </Badge>
                      </td>

                      {/* Submission Date */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {provider.createdAt ? new Date(provider.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Audit Action Button */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(provider)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Review Dossier</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-700">
                  {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-700">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-semibold text-slate-700">{pagination.total}</span> pending candidates
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="px-3 py-1 text-xs font-medium text-slate-600">
                  Page {pagination.page} of {pagination.pages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= pagination.pages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Review Dossier Modal */}
      {isReviewModalOpen && reviewingProvider && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Verification Audit: {reviewingProvider.businessName}
                  </h3>
                  <span className="text-xs text-slate-500">
                    Candidate: {reviewingProvider.user?.name} ({reviewingProvider.user?.email})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-5">
              {/* Applicant Overview Card */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block">
                    Contact Details
                  </span>
                  <span className="font-medium text-slate-900 block mt-1">
                    Phone: {reviewingProvider.user?.phone}
                  </span>
                  <span className="text-slate-600 block mt-0.5">
                    Experience: {reviewingProvider.experienceYears || 0} years
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block">
                    Current Status
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="warning">{reviewingProvider.verificationStatus}</Badge>
                    <Badge variant={reviewingProvider.user?.isActive ? 'success' : 'danger'}>
                      {reviewingProvider.user?.isActive ? 'Active User' : 'Suspended'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Submitted Business Profile & Bio
                </span>
                <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                  {reviewingProvider.bio || 'No bio submitted.'}
                </p>
              </div>

              {/* Documents Audit Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Verification Documents Checklist ({reviewingProvider.documents?.length || 0})
                  </span>
                </div>

                {reviewingProvider.documents && reviewingProvider.documents.length > 0 ? (
                  <div className="space-y-3">
                    {reviewingProvider.documents.map((doc) => (
                      <div
                        key={doc._id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-bold text-slate-900 uppercase">
                              {doc.type} Document
                            </span>
                            <Badge
                              variant={
                                doc.verificationStatus === 'approved'
                                  ? 'success'
                                  : doc.verificationStatus === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {doc.verificationStatus}
                            </Badge>
                          </div>

                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            <span>Inspect File</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {doc.reviewNote && (
                          <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded-md border border-rose-100">
                            <strong>Review Note:</strong> {doc.reviewNote}
                          </div>
                        )}

                        {/* Individual Document Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                          <button
                            type="button"
                            disabled={isActionLoading || doc.verificationStatus === 'rejected'}
                            onClick={() => handleOpenRejectDocument(doc._id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Document</span>
                          </button>

                          <button
                            type="button"
                            disabled={isActionLoading || doc.verificationStatus === 'approved'}
                            onClick={() => handleApproveDocument(doc._id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-40"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Document</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Candidate has not uploaded any verification documents yet.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Decision Bar */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close Dossier
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenRejectProvider}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" />
                  <span>Reject Application</span>
                </button>

                <button
                  type="button"
                  onClick={handleApproveProvider}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Verify</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Rejection Reason Dialog */}
      {rejectionDialog.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {rejectionDialog.type === 'document' ? 'Reject Document' : 'Reject Provider Application'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRejectionDialog({ isOpen: false, type: 'provider', documentId: null, reason: '', error: null })
                }
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              Please enter a clear explanation for this rejection. The candidate will see this reason to fix and resubmit their credentials.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="4"
                placeholder="e.g. Identity document expired; business license mismatch with registered name..."
                value={rejectionDialog.reason}
                onChange={(e) =>
                  setRejectionDialog({ ...rejectionDialog, reason: e.target.value, error: null })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500"
              />
              {rejectionDialog.error && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{rejectionDialog.error}</p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setRejectionDialog({ isOpen: false, type: 'provider', documentId: null, reason: '', error: null })
                }
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleSubmitRejection}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        isLoading={confirmModal.isLoading}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ProviderVerificationPage;
