import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileQuestion,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const initialFormData = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  image: '',
  displayOrder: 0,
  isActive: true,
  showInQuickServices: false,
  quickServicesOrder: 0,
  showInPopularServices: false,
  popularServicesOrder: 0
};

const CategoriesPage = () => {
  // State
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
    isLoading: false
  });

  // Fetch Categories from Backend API
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: searchTerm.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };
      const response = await categoryApi.getAdminCategories(params);
      if (response?.success) {
        setCategories(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        setApiError(response?.message || 'Failed to retrieve categories');
      }
    } catch (err) {
      setApiError(err.userMessage || 'Failed to fetch categories from the server');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Dismiss auto success alert
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setFormData(initialFormData);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
      icon: category.icon || '',
      image: category.image || '',
      displayOrder: category.displayOrder !== undefined ? category.displayOrder : 0,
      isActive: category.isActive !== undefined ? category.isActive : true,
      showInQuickServices: category.showInQuickServices !== undefined ? category.showInQuickServices : false,
      quickServicesOrder: category.quickServicesOrder !== undefined ? category.quickServicesOrder : 0,
      showInPopularServices: category.showInPopularServices !== undefined ? category.showInPopularServices : false,
      popularServicesOrder: category.popularServicesOrder !== undefined ? category.popularServicesOrder : 0
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Client-side Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Category name cannot exceed 100 characters';
    }

    if (formData.displayOrder < 0 || isNaN(formData.displayOrder)) {
      errors.displayOrder = 'Display order must be 0 or higher';
    }

    if (formData.quickServicesOrder < 0 || isNaN(formData.quickServicesOrder)) {
      errors.quickServicesOrder = 'Quick services order must be 0 or higher';
    }

    if (formData.popularServicesOrder < 0 || isNaN(formData.popularServicesOrder)) {
      errors.popularServicesOrder = 'Popular services order must be 0 or higher';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setApiError(null);

    const payload = {
      name: formData.name.trim(),
      slug: formData.slug.trim() || undefined,
      description: formData.description.trim(),
      icon: formData.icon.trim() || null,
      image: formData.image.trim() || null,
      displayOrder: parseInt(formData.displayOrder, 10) || 0,
      isActive: formData.isActive,
      showInQuickServices: Boolean(formData.showInQuickServices),
      quickServicesOrder: parseInt(formData.quickServicesOrder, 10) || 0,
      showInPopularServices: Boolean(formData.showInPopularServices),
      popularServicesOrder: parseInt(formData.popularServicesOrder, 10) || 0
    };

    try {
      if (editingCategory) {
        await categoryApi.updateCategory(editingCategory._id, payload);
        setSuccessMessage(`Category '${payload.name}' updated successfully.`);
      } else {
        await categoryApi.createCategory(payload);
        setSuccessMessage(`Category '${payload.name}' created successfully.`);
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      const msg = err.userMessage || err.message || 'Operation failed';
      setFormErrors((prev) => ({ ...prev, api: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Category Status (Activate / Deactivate)
  const handleToggleStatus = (category) => {
    const newStatus = !category.isActive;
    const actionLabel = newStatus ? 'Activate' : 'Deactivate';

    setConfirmModal({
      isOpen: true,
      title: `${actionLabel} Category`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} '${category.name}'? ${
        !newStatus ? 'It will be hidden from customer-facing discovery.' : 'It will be visible for customer bookings.'
      }`,
      confirmText: actionLabel,
      confirmVariant: newStatus ? 'primary' : 'danger',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await categoryApi.updateCategoryStatus(category._id, newStatus);
          setSuccessMessage(`Category '${category.name}' ${newStatus ? 'activated' : 'deactivated'} successfully.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchCategories();
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || 'Failed to update category status.');
        }
      }
    });
  };

  // Delete Category
  const handleDeleteCategory = (category) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Category '${category.name}'`,
      message: `Are you sure you want to permanently delete this category? If services are assigned to it, the system will prevent deletion to preserve relational integrity.`,
      confirmText: 'Delete Category',
      confirmVariant: 'danger',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await categoryApi.deleteCategory(category._id);
          setSuccessMessage(`Category '${category.name}' deleted successfully.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchCategories();
        } catch (err) {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          setApiError(err.userMessage || 'Failed to delete category.');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure marketplace taxonomies, manage active discovery hierarchies, and monitor service associations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCategories}
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
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
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

      {apiError && (
        <div
          role="alert"
          className="flex items-start justify-between p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-900">Operation Notice</span>
              <span className="text-xs text-rose-700 leading-relaxed">{apiError}</span>
            </div>
          </div>
          <button
            onClick={() => setApiError(null)}
            className="text-rose-600 hover:text-rose-900 text-xs font-semibold shrink-0 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by category name, slug, or keywords..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status:</span>
            <div className="inline-flex rounded-lg p-1 bg-slate-100 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white shadow-xs text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('active');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-white shadow-xs text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('inactive');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'inactive'
                    ? 'bg-white shadow-xs text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Categories Data Table */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" color="indigo" />
          <span className="mt-4 text-sm font-medium text-slate-500">Loading categories from MongoDB...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Categories Found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm">
            {searchTerm || statusFilter !== 'all'
              ? 'No categories match your search or filter parameters.'
              : 'The marketplace has no category records in the database yet.'}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Category</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Services</th>
                  <th className="py-3.5 px-4">Display Order</th>
                  <th className="py-3.5 px-4">Home Sections</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <tr key={cat._id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Name & Description */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-900 block">{cat.name}</span>
                        {cat.description && (
                          <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">{cat.description}</span>
                        )}
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="py-3.5 px-4">
                      <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        {cat.slug}
                      </code>
                    </td>

                    {/* Associated Services Count */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {cat.servicesCount || 0} service{cat.servicesCount === 1 ? '' : 's'}
                      </span>
                    </td>

                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">{cat.displayOrder || 0}</td>

                    {/* Section Visibility Badges */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        {cat.showInQuickServices ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                            ⚡ Quick (#{cat.quickServicesOrder ?? 0})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Quick: Off</span>
                        )}
                        {cat.showInPopularServices ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            ★ Popular (#{cat.popularServicesOrder ?? 0})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Popular: Off</span>
                        )}
                      </div>
                    </td>

                    {/* Active Status Badge */}
                    <td className="py-3.5 px-4">
                      {cat.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Toggle Status */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(cat)}
                          title={cat.isActive ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            cat.isActive
                              ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                              : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          {cat.isActive ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(cat)}
                          title="Edit Category"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete Category"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
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

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total categories)
              </span>

              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={currentPage >= pagination.pages || isLoading}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Category Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingCategory ? 'Edit Service Category' : 'Create New Service Category'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
              {formErrors.api && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {formErrors.api}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical Services, Plumbing, Home Deep Cleaning"
                  value={formData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name: val,
                      // Auto-update slug suggestion if creating and slug not manually edited
                      slug: !editingCategory ? val.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '') : prev.slug
                    }));
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: null }));
                  }}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 ${
                    formErrors.name
                      ? 'border-rose-400 focus:ring-rose-400/40'
                      : 'border-slate-200 focus:ring-indigo-500/40 focus:border-indigo-500'
                  }`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.name}</p>
                )}
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. electrical-services (leave blank for automatic generation)"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 font-mono text-xs"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Unique kebab-case URL path. Normalized automatically if left blank.
                </p>
              </div>

              {/* Icon & Image URL Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Icon Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. flash-outline, construct-outline"
                    value={formData.icon}
                    onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 font-mono text-xs"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Ionicons icon name</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formData.image}
                    onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-xs"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Optional banner or image link</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of services encompassed by this category..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>

              {/* Display Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    General Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData((prev) => ({ ...prev, displayOrder: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Lower numbers appear first.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <label className="flex items-center gap-2.5 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-slate-700">Active (Publicly Visible)</span>
                  </label>
                </div>
              </div>

              {/* Quick Services Configuration Box */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showInQuickServices}
                      onChange={(e) => setFormData((prev) => ({ ...prev, showInQuickServices: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 rounded-sm border-purple-300 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-purple-900">Show in Customer "Quick Services"</span>
                  </label>
                  <span className="text-[11px] font-semibold text-purple-600">Home Screen Section 1</span>
                </div>
                {formData.showInQuickServices && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-medium text-purple-900 whitespace-nowrap">
                      Quick Services Order:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.quickServicesOrder}
                      onChange={(e) => setFormData((prev) => ({ ...prev, quickServicesOrder: e.target.value }))}
                      className="w-24 px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-[11px] text-purple-600">Order on home screen grid (0, 1, 2...)</span>
                  </div>
                )}
              </div>

              {/* Popular Services Configuration Box */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showInPopularServices}
                      onChange={(e) => setFormData((prev) => ({ ...prev, showInPopularServices: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded-sm border-indigo-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-indigo-900">Show in Customer "Popular Services"</span>
                  </label>
                  <span className="text-[11px] font-semibold text-indigo-600">Home Screen Section 2</span>
                </div>
                {formData.showInPopularServices && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-medium text-indigo-900 whitespace-nowrap">
                      Popular Services Order:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.popularServicesOrder}
                      onChange={(e) => setFormData((prev) => ({ ...prev, popularServicesOrder: e.target.value }))}
                      className="w-24 px-2.5 py-1 bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-indigo-600">Order on home screen cards (0, 1, 2...)</span>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
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

export default CategoriesPage;
