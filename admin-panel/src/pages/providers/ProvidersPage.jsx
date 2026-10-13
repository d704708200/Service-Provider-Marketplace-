import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileText,
  ExternalLink,
  Phone,
  Mail,
  User,
  Star,
  ToggleLeft,
  ToggleRight,
  X
} from 'lucide-react';
import { providerApi, categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const ProvidersPage = () => {
  // State
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Detail Modal State
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Confirmation Modal State (e.g. for account activation toggle)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
    isLoading: false
  });

  // Fetch Categories for Filter Dropdown
  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoryApi.getAdminCategories({ limit: 100 });
      if (response?.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load categories filter:', err);
    }
  }, []);

  // Fetch Providers from API
  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm.trim() || undefined,
        verificationStatus: verificationFilter !== 'all' ? verificationFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined
      };
      const response = await providerApi.getAdminProviders(params);
      if (response?.success) {
        setProviders(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        setApiError(response?.message || 'Failed to retrieve providers');
      }
    } catch (err) {
      setApiError(err.userMessage || 'Failed to connect to provider backend API.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, verificationFilter, categoryFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Dismiss auto success alert
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Open Provider Detail Modal
  const handleOpenDetailModal = (provider) => {
    setSelectedProvider(provider);
    setIsDetailModalOpen(true);
  };

  // Toggle Account Active / Inactive
  const handleToggleAccountStatus = (provider) => {
    const newStatus = !provider.user?.isActive;
    const actionLabel = newStatus ? 'Activate' : 'Suspend';

    setConfirmModal({
      isOpen: true,
      title: `${actionLabel} Provider Account`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} the account for '${
        provider.businessName || provider.user?.name
      }'? ${
        !newStatus
          ? 'The provider will be prevented from logging in or receiving customer bookings.'
          : 'The provider will regain access to their dashboard.'
      }`,
      confirmText: actionLabel,
      confirmVariant: newStatus ? 'primary' : 'danger',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await providerApi.updateAccountStatus(provider._id, newStatus);
          setSuccessMessage(
            `Provider account ${newStatus ? 'activated' : 'suspended'} successfully.`
          );
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchProviders();
          if (selectedProvider?._id === provider._id) {
            setSelectedProvider((prev) => ({
              ...prev,
              user: { ...prev.user, isActive: newStatus }
            }));
          }
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || 'Failed to update account status.');
        }
      }
    });
  };

  // Verification status badge renderer
  const renderVerificationBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Verified</span>
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending Review</span>
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="danger" className="gap-1">
            <ShieldX className="w-3 h-3 text-rose-600" />
            <span>Rejected</span>
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="default" className="gap-1 bg-slate-200 text-slate-700">
            <ShieldAlert className="w-3 h-3 text-slate-500" />
            <span>Suspended</span>
          </Badge>
        );
      default:
        return <Badge variant="default">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Providers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage registered marketplace service professionals, business profiles, and account statuses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchProviders}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
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
              <span className="font-semibold block text-rose-900">Provider Operation Notice</span>
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

      {/* Filter and Search Bar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by business name, email, or owner..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          {/* Verification Status Filter */}
          <div>
            <select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            >
              <option value="all">Verification: All Statuses</option>
              <option value="pending">Pending Verification</option>
              <option value="verified">Verified (Approved)</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            >
              <option value="all">Category: All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Providers Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner size="lg" text="Loading service providers..." />
          </div>
        ) : providers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Briefcase}
              title={
                searchTerm || verificationFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No matching providers found'
                  : 'No Providers Registered'
              }
              description={
                searchTerm || verificationFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Try adjusting your search criteria or resetting verification status filters.'
                  : 'New provider onboarding registrations will appear here once submitted.'
              }
              action={
                searchTerm || verificationFilter !== 'all' || categoryFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setVerificationFilter('all');
                      setCategoryFilter('all');
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Reset Filters
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
                      Provider / Business
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Contact Details
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Specialties
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Verification
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-center">
                      Documents
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Account Status
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {providers.map((provider) => (
                    <tr key={provider._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Business & Owner */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-semibold shrink-0 mt-0.5">
                            {provider.user?.avatar ? (
                              <img
                                src={provider.user.avatar}
                                alt={provider.businessName}
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Briefcase className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block leading-snug">
                              {provider.businessName || 'Business Name Pending'}
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Owner: {provider.user?.name || 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{provider.user?.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{provider.user?.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Categories / Specialties */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {provider.categories && provider.categories.length > 0 ? (
                            provider.categories.slice(0, 2).map((cat) => (
                              <Badge key={cat._id} variant="primary" className="text-[11px]">
                                {cat.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">None assigned</span>
                          )}
                          {provider.categories && provider.categories.length > 2 && (
                            <span className="text-[11px] text-slate-500 self-center">
                              +{provider.categories.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Verification Status */}
                      <td className="px-6 py-4">{renderVerificationBadge(provider.verificationStatus)}</td>

                      {/* Submitted Documents Count */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>{provider.documents?.length || 0}</span>
                        </span>
                      </td>

                      {/* Account Active Status Toggle */}
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAccountStatus(provider)}
                          title={provider.user?.isActive ? 'Suspend account' : 'Activate account'}
                          className="inline-flex items-center gap-1.5 text-xs transition-colors"
                        >
                          {provider.user?.isActive ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                              <span className="text-emerald-700 font-medium">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                              <span className="text-slate-500 font-medium">Suspended</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(provider)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
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
                of <span className="font-semibold text-slate-700">{pagination.total}</span> providers
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

      {/* Provider Details Modal */}
      {isDetailModalOpen && selectedProvider && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedProvider.businessName || 'Business Profile'}
                  </h3>
                  <span className="text-xs text-slate-500">
                    ID: {selectedProvider._id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Profile Header Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Account Owner
                  </span>
                  <span className="font-medium text-slate-900 text-sm mt-0.5 block">
                    {selectedProvider.user?.name}
                  </span>
                  <span className="text-xs text-slate-600 block mt-0.5">
                    {selectedProvider.user?.email}
                  </span>
                  <span className="text-xs text-slate-600 block">
                    {selectedProvider.user?.phone}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Status Overview
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {renderVerificationBadge(selectedProvider.verificationStatus)}
                    <Badge variant={selectedProvider.user?.isActive ? 'success' : 'danger'}>
                      {selectedProvider.user?.isActive ? 'Account Active' : 'Account Suspended'}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500 block mt-2">
                    Experience: {selectedProvider.experienceYears || 0} years
                  </span>
                </div>
              </div>

              {/* Bio */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Professional Bio
                </span>
                <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                  {selectedProvider.bio || 'No professional bio provided.'}
                </p>
              </div>

              {/* Categories */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Assigned Categories
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProvider.categories && selectedProvider.categories.length > 0 ? (
                    selectedProvider.categories.map((cat) => (
                      <Badge key={cat._id} variant="primary">
                        {cat.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No categories linked</span>
                  )}
                </div>
              </div>

              {/* Service Areas */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Designated Service Areas
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProvider.serviceAreas && selectedProvider.serviceAreas.length > 0 ? (
                    selectedProvider.serviceAreas.map((area) => (
                      <span
                        key={area._id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium bg-slate-100 text-slate-800 border border-slate-200"
                      >
                        <span className="font-semibold">{area.name}</span>
                        <span className="text-slate-500">({area.city})</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No service areas registered</span>
                  )}
                </div>
              </div>

              {/* Rejection / Suspension Notice */}
              {selectedProvider.rejectionReason && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <span className="font-semibold block mb-0.5">Verification Review Notice:</span>
                  <p>{selectedProvider.rejectionReason}</p>
                </div>
              )}

              {/* Submitted Documents Section */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-2">
                  Submitted Documents ({selectedProvider.documents?.length || 0})
                </span>
                {selectedProvider.documents && selectedProvider.documents.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProvider.documents.map((doc) => (
                      <div
                        key={doc._id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <div>
                            <span className="text-xs font-semibold text-slate-800 uppercase block">
                              {doc.type}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
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

                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Open Document"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No documents uploaded yet.</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
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

export default ProvidersPage;
