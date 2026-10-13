import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertCircle,
  Filter,
  Clock,
  DollarSign,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarCheck,
  Tag,
  AlertTriangle
} from 'lucide-react';
import { serviceApi, categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const initialFormData = {
  name: '',
  category: '',
  description: '',
  price: '',
  priceType: 'fixed',
  estimatedDurationMinutes: 60,
  image: '',
  isActive: true
};

const ServicesPage = () => {
  // Data state
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [priceTypeFilter, setPriceTypeFilter] = useState('all'); // 'all', 'fixed', 'hourly', 'quote'
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
    isLoading: false
  });

  // Load Categories for dropdowns
  const fetchCategories = useCallback(async () => {
    setIsCategoriesLoading(true);
    try {
      const response = await categoryApi.getAdminCategories({ limit: 100 });
      if (response?.success) {
        setCategories(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load categories for services filter:', err);
    } finally {
      setIsCategoriesLoading(false);
    }
  }, []);

  // Fetch Services from API
  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm.trim() || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priceType: priceTypeFilter !== 'all' ? priceTypeFilter : undefined
      };
      const response = await serviceApi.getAdminServices(params);
      if (response?.success) {
        setServices(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        setApiError(response?.message || 'Failed to retrieve services');
      }
    } catch (err) {
      setApiError(err.userMessage || 'Failed to connect to services backend API.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, categoryFilter, statusFilter, priceTypeFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Auto-dismiss success alert
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingService(null);
    setFormData({
      ...initialFormData,
      category: categories.length > 0 ? (categories.find((c) => c.isActive)?._id || categories[0]._id) : ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      category: service.category?._id || service.category || '',
      description: service.description || '',
      price: service.price !== undefined ? service.price : '',
      priceType: service.priceType || 'fixed',
      estimatedDurationMinutes: service.estimatedDurationMinutes || 60,
      image: service.image || '',
      isActive: service.isActive !== undefined ? service.isActive : true
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Client-side Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Service name is required';
    } else if (formData.name.trim().length < 2 || formData.name.trim().length > 150) {
      errors.name = 'Service name must be between 2 and 150 characters';
    }

    if (!formData.category) {
      errors.category = 'A valid category must be selected';
    }

    const priceNum = parseFloat(formData.price);
    if (formData.price === '' || isNaN(priceNum) || priceNum < 0) {
      errors.price = 'Price must be a non-negative number';
    } else if ((formData.priceType === 'fixed' || formData.priceType === 'hourly') && priceNum <= 0) {
      errors.price = `Price must be greater than 0 for ${formData.priceType} pricing model`;
    }

    const durationNum = parseInt(formData.estimatedDurationMinutes, 10);
    if (isNaN(durationNum) || durationNum < 1) {
      errors.estimatedDurationMinutes = 'Estimated duration must be at least 1 minute';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Form Submit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setApiError(null);

    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim(),
      price: parseFloat(formData.price) || 0,
      priceType: formData.priceType,
      estimatedDurationMinutes: parseInt(formData.estimatedDurationMinutes, 10) || 60,
      image: formData.image.trim() || null,
      isActive: formData.isActive
    };

    try {
      if (editingService) {
        await serviceApi.updateService(editingService._id, payload);
        setSuccessMessage(`Service '${payload.name}' updated successfully.`);
      } else {
        await serviceApi.createService(payload);
        setSuccessMessage(`Service '${payload.name}' created successfully.`);
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      const msg = err.userMessage || err.message || 'Operation failed';
      setFormErrors((prev) => ({ ...prev, api: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Service Status
  const handleToggleStatus = (service) => {
    const newStatus = !service.isActive;
    const actionLabel = newStatus ? 'Activate' : 'Deactivate';

    setConfirmModal({
      isOpen: true,
      title: `${actionLabel} Service`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} '${service.name}'? ${
        !newStatus
          ? 'It will be hidden from customer booking catalogues.'
          : 'It will become available for customer bookings.'
      }`,
      confirmText: actionLabel,
      confirmVariant: newStatus ? 'primary' : 'danger',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await serviceApi.updateServiceStatus(service._id, newStatus);
          setSuccessMessage(`Service '${service.name}' ${newStatus ? 'activated' : 'deactivated'} successfully.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchServices();
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || `Failed to ${actionLabel.toLowerCase()} service.`);
        }
      }
    });
  };

  // Delete Service with Booking Conflict Handling
  const handleDeleteService = (service) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Service '${service.name}'`,
      message: `Are you sure you want to permanently delete this service? If bookings are referenced to it, deletion will be safely rejected to maintain transactional history.`,
      confirmText: 'Delete Service',
      confirmVariant: 'danger',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await serviceApi.deleteService(service._id);
          setSuccessMessage(`Service '${service.name}' deleted successfully.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchServices();
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || 'Failed to delete service.');
        }
      }
    });
  };

  // Helper to format price label
  const renderPriceBadge = (service) => {
    if (service.priceType === 'quote') {
      return (
        <div className="flex flex-col items-start">
          <Badge variant="info">Quote Based</Badge>
          {service.price > 0 && (
            <span className="text-[11px] text-slate-500 mt-0.5">Est. ${service.price.toFixed(2)}</span>
          )}
        </div>
      );
    }
    if (service.priceType === 'hourly') {
      return (
        <span className="font-semibold text-slate-900 text-sm">
          ${service.price.toFixed(2)}{' '}
          <span className="text-xs font-normal text-slate-500">/ hr</span>
        </span>
      );
    }
    return (
      <span className="font-semibold text-slate-900 text-sm">
        ${service.price.toFixed(2)}
      </span>
    );
  };

  // Helper to format duration label
  const formatDuration = (mins) => {
    if (!mins) return '60m';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Services Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure standardized marketplace service offerings, pricing models, durations, and category taxonomies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchServices();
              fetchCategories();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service</span>
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
              <span className="font-semibold block text-rose-900">Catalog Action Notice</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
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
                  {cat.name} {!cat.isActive ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Model Filter */}
          <div>
            <select
              value={priceTypeFilter}
              onChange={(e) => {
                setPriceTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            >
              <option value="all">Pricing: All Types</option>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Hourly Rate</option>
              <option value="quote">Quote Based</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            >
              <option value="all">Status: All (Active & Inactive)</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Services Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner size="lg" text="Loading marketplace services..." />
          </div>
        ) : services.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Wrench}
              title={
                searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || priceTypeFilter !== 'all'
                  ? 'No matching services found'
                  : 'Services Catalog is Empty'
              }
              description={
                searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || priceTypeFilter !== 'all'
                  ? 'Try broadening your search keywords or resetting category and status filters.'
                  : 'Start configuring platform services by clicking the "Add Service" button above.'
              }
              action={
                searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || priceTypeFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                      setPriceTypeFilter('all');
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Service</span>
                  </button>
                )
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
                      Service Offering
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Pricing Model
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Duration
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-center">
                      Bookings
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {services.map((service) => (
                    <tr key={service._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                            {service.image ? (
                              <img
                                src={service.image}
                                alt={service.name}
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Wrench className="w-4 h-4" />
                            )}
                          </div>
                          <div className="max-w-xs">
                            <span className="font-semibold text-slate-900 block leading-snug">
                              {service.name}
                            </span>
                            {service.description && (
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="primary" className="text-xs">
                            <Layers className="w-3 h-3 mr-1 opacity-70" />
                            {service.category?.name || 'Unassigned'}
                          </Badge>
                          {service.category && !service.category.isActive && (
                            <span className="text-[10px] text-amber-600 font-medium" title="Category is inactive">
                              (Inactive Cat)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Pricing Model & Price */}
                      <td className="px-6 py-4">{renderPriceBadge(service)}</td>

                      {/* Duration */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDuration(service.estimatedDurationMinutes)}
                        </span>
                      </td>

                      {/* Bookings Count */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            service.bookingsCount > 0
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <CalendarCheck className="w-3 h-3" />
                          {service.bookingsCount || 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {service.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(service)}
                            title={service.isActive ? 'Deactivate service' : 'Activate service'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              service.isActive
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {service.isActive ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(service)}
                            title="Edit service details"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteService(service)}
                            title="Delete service"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                of <span className="font-semibold text-slate-700">{pagination.total}</span> services
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

      {/* Create / Edit Service Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingService ? 'Edit Service Offering' : 'Create New Service Offering'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Error Banner */}
            {formErrors.api && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formErrors.api}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
              {/* Service Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep Home Cleaning, AC Compressor Repair"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                >
                  <option value="">Select a Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name} {!cat.isActive ? '(Inactive Category)' : ''}
                    </option>
                  ))}
                </select>
                {formErrors.category && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.category}</p>
                )}
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Price Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pricing Model <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.priceType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        ...formData,
                        priceType: newType,
                        // If switching to quote and price is 0, keep 0; if switching to fixed/hourly and price is 0, suggest 50
                        price: (newType === 'fixed' || newType === 'hourly') && parseFloat(formData.price) <= 0 ? '' : formData.price
                      });
                    }}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="hourly">Hourly Rate</option>
                    <option value="quote">Custom Quote (Quote Based)</option>
                  </select>
                </div>

                {/* Base Price */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formData.priceType === 'quote'
                      ? 'Base / Estimate ($) (0 for On-Consultation)'
                      : formData.priceType === 'hourly'
                      ? 'Hourly Rate ($)'
                      : 'Fixed Price ($)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={formData.priceType === 'quote' ? '0.00' : '50.00'}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                    />
                  </div>
                  {formErrors.price && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.price}</p>
                  )}
                </div>
              </div>

              {/* Estimated Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Duration (Minutes) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="60"
                    value={formData.estimatedDurationMinutes}
                    onChange={(e) => setFormData({ ...formData, estimatedDurationMinutes: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                  />
                  {/* Preset chips */}
                  <div className="flex items-center gap-1 shrink-0">
                    {[30, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFormData({ ...formData, estimatedDurationMinutes: m })}
                        className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                          Number(formData.estimatedDurationMinutes) === m
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
                {formErrors.estimatedDurationMinutes && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {formErrors.estimatedDurationMinutes}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Detail service scope, equipment provided, and service guarantees..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Catalog Visibility</span>
                  <span className="text-[11px] text-slate-500">
                    Active services appear in customer discovery and booking workflows.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingService ? 'Save Changes' : 'Create Service'}</span>
                </button>
              </div>
            </form>
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

export default ServicesPage;
