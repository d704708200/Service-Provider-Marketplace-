import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Star,
  ExternalLink,
  ShieldCheck,
  Building
} from 'lucide-react';
import { tagApi, categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const initialFormData = {
  name: '',
  category: '',
  subcategoryName: 'General',
  description: '',
  displayOrder: 0,
  isActive: true,
  isCustomerVisible: true
};

const ServiceTagsPage = () => {
  // Main Data States
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & Search
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'visible', 'hidden'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Associated Providers Modal
  const [providersModal, setProvidersModal] = useState({ isOpen: false, tag: null, providers: [], loading: false });

  // Delete/Archive Confirmation Modal
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, tag: null, isSubmitting: false });

  // Fetch Categories for modal dropdown and filter
  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      let res;
      try {
        res = await categoryApi.getAdminCategories({ limit: 100 });
      } catch (adminErr) {
        // Fallback to public categories if admin requires different permissions
        res = await categoryApi.getPublicCategories({ limit: 100 });
      }

      let catList = [];
      if (Array.isArray(res?.data)) {
        catList = res.data;
      } else if (Array.isArray(res?.categories)) {
        catList = res.categories;
      } else if (Array.isArray(res)) {
        catList = res;
      }

      const validCats = catList.filter((c) => c && c._id && c.name);
      setCategories(validCats);
    } catch (err) {
      console.error('Failed to load categories for service tags:', err);
      setCategoriesError(err.message || 'Failed to load categories');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // Fetch Tags
  const fetchTags = useCallback(async () => {
    try {
      setApiError(null);
      const params = {
        page: currentPage,
        limit: 20
      };

      if (selectedCategoryFilter !== 'all') {
        params.category = selectedCategoryFilter;
      }
      if (selectedSubcategoryFilter !== 'all') {
        params.subcategory = selectedSubcategoryFilter;
      }
      if (statusFilter === 'active') {
        params.isActive = true;
      } else if (statusFilter === 'inactive') {
        params.isActive = false;
      } else if (statusFilter === 'visible') {
        params.isCustomerVisible = true;
      } else if (statusFilter === 'hidden') {
        params.isCustomerVisible = false;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await tagApi.getTags(params);
      if (res?.data) {
        setTags(res.data);
        setPagination(res.pagination || { page: 1, limit: 20, total: res.data.length, pages: 1 });
      }
    } catch (err) {
      console.error('[SERVICE_TAGS_FETCH_ERROR]', err);
      setApiError(err.message || 'Failed to fetch service tags');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, selectedCategoryFilter, selectedSubcategoryFilter, statusFilter, searchTerm]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTags();
  };

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Extract unique subcategories from loaded tags
  const availableSubcategories = useMemo(() => {
    const subs = new Set();
    tags.forEach((t) => {
      if (t.subcategory?.name) subs.add(t.subcategory.name);
    });
    return Array.from(subs);
  }, [tags]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = pagination.total || tags.length;
    const active = tags.filter((t) => t.isActive).length;
    const visible = tags.filter((t) => t.isCustomerVisible).length;
    const totalProviderSelections = tags.reduce((sum, t) => sum + (t.providerCount || 0), 0);
    return { total, active, visible, totalProviderSelections };
  }, [pagination.total, tags]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTag(null);
    if (categories.length === 0) {
      fetchCategories();
    }
    setFormData({
      ...initialFormData,
      category: categories.length > 0 ? categories[0]._id : ''
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (tag) => {
    if (categories.length === 0) {
      fetchCategories();
    }
    setEditingTag(tag);
    setFormData({
      name: tag.name || '',
      category: tag.category?._id || tag.category || '',
      subcategoryName: tag.subcategory?.name || 'General',
      description: tag.description || '',
      displayOrder: tag.displayOrder || 0,
      isActive: tag.isActive !== false,
      isCustomerVisible: tag.isCustomerVisible !== false
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Associated Providers Modal
  const handleViewProviders = async (tag) => {
    setProvidersModal({ isOpen: true, tag, providers: [], loading: true });
    try {
      const res = await tagApi.getTagProviders(tag._id);
      setProvidersModal({ isOpen: true, tag, providers: res?.data || [], loading: false });
    } catch (err) {
      setApiError(err.message || 'Failed to load associated providers');
      setProvidersModal({ isOpen: false, tag: null, providers: [], loading: false });
    }
  };

  // Toggle Tag Status
  const handleToggleStatus = async (tag, field) => {
    try {
      const payload = {};
      if (field === 'isActive') {
        payload.isActive = !tag.isActive;
      } else if (field === 'isCustomerVisible') {
        payload.isCustomerVisible = !tag.isCustomerVisible;
      }
      await tagApi.updateStatus(tag._id, payload);
      showNotification(`Service tag '${tag.name}' updated.`);
      fetchTags();
    } catch (err) {
      setApiError(err.message || 'Failed to update tag status');
    }
  };

  // Validate and Submit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Tag name is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.subcategoryName?.trim()) errors.subcategoryName = 'Subcategory is required';

    // Client-side duplicate check
    const cleanName = formData.name.trim().toLowerCase();
    const cleanSub = (formData.subcategoryName || 'General').trim().toLowerCase();
    const isDuplicate = tags.some((t) => {
      const matchCat = String(t.category?._id || t.category) === String(formData.category);
      const matchSub = (t.subcategory?.name || 'General').trim().toLowerCase() === cleanSub;
      const matchName = t.name.trim().toLowerCase() === cleanName;
      const isSelf = editingTag && String(t._id) === String(editingTag._id);
      return matchCat && matchSub && matchName && !isSelf;
    });

    if (isDuplicate) {
      errors.name = `Tag '${formData.name.trim()}' already exists in this category and subcategory`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);
    try {
      if (editingTag) {
        await tagApi.updateTag(editingTag._id, formData);
        showNotification(`Tag '${formData.name}' updated successfully.`);
      } else {
        await tagApi.createTag(formData);
        showNotification(`Tag '${formData.name}' created successfully.`);
      }
      setIsFormModalOpen(false);
      fetchTags();
    } catch (err) {
      setFormErrors({ submit: err.message || 'Failed to save tag' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete / Archive
  const handleConfirmDelete = async () => {
    if (!deleteModal.tag) return;
    setDeleteModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await tagApi.deleteTag(deleteModal.tag._id);
      showNotification(res.message || `Tag '${deleteModal.tag.name}' processed.`);
      setDeleteModal({ isOpen: false, tag: null, isSubmitting: false });
      fetchTags();
    } catch (err) {
      setApiError(err.message || 'Failed to delete tag');
      setDeleteModal({ isOpen: false, tag: null, isSubmitting: false });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Tag className="h-7 w-7 text-indigo-600" />
            Dynamic Service Tags
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Admin-controlled service catalog tags. Providers select tags they provide, and customers discover vetted providers by tag.
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
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Create Service Tag
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs">
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
          <button onClick={() => setApiError(null)} className="text-rose-700 hover:text-rose-900 text-xs">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 Financial & Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Service Tags</span>
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">{stats.total}</div>
            <p className="text-xs text-slate-500 mt-1">Configured service tags in catalog</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Tags</span>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">{stats.active}</div>
            <p className="text-xs text-slate-500 mt-1">Available for provider onboarding</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Visible</span>
            <div className="p-2 rounded-lg bg-sky-50 border border-sky-100 text-sky-600">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">{stats.visible}</div>
            <p className="text-xs text-slate-500 mt-1">Visible on customer category discovery</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Provider Selections</span>
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-100 text-purple-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-sans">{stats.totalProviderSelections}</div>
            <p className="text-xs text-slate-500 mt-1">Active provider tag associations</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Filter Controls Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="min-w-[180px]">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => {
                  setSelectedCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory Filter */}
            {availableSubcategories.length > 0 && (
              <div className="min-w-[150px]">
                <select
                  value={selectedSubcategoryFilter}
                  onChange={(e) => {
                    setSelectedSubcategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Subcategories</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="min-w-[140px]">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="visible">Customer Visible</option>
                <option value="hidden">Hidden from Customers</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by tag name or description..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : tags.length === 0 ? (
          <div className="py-16 text-center">
            <Tag className="h-10 w-10 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No Service Tags Found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or click 'Create Service Tag' to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/80">
                  <th className="py-3 px-4">Tag Name & Subcategory</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Customer Visible</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Providers Offering</th>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tags.map((tag) => (
                  <tr key={tag._id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Tag Name & Subcategory */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{tag.name}</span>
                        {tag.subcategory?.name && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {tag.subcategory.name}
                          </span>
                        )}
                      </div>
                      {tag.description ? (
                        <p className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{tag.description}</p>
                      ) : null}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Layers className="h-3.5 w-3.5 text-indigo-600" />
                        {tag.category?.name || 'Unassigned'}
                      </span>
                    </td>

                    {/* Customer Visible */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(tag, 'isCustomerVisible')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                          tag.isCustomerVisible
                            ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {tag.isCustomerVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {tag.isCustomerVisible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>

                    {/* Active Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(tag, 'isActive')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                          tag.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tag.isActive ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        {tag.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Associated Providers Count */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewProviders(tag)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>{tag.providerCount || 0} Provider(s)</span>
                      </button>
                    </td>

                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                      #{tag.displayOrder || 0}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewProviders(tag)}
                          title="View Providers"
                          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(tag)}
                          title="Edit Tag"
                          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, tag, isSubmitting: false })}
                          title="Archive or Delete Tag"
                          className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 shadow-2xs transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  Showing page <strong className="text-slate-700">{pagination.page}</strong> of{' '}
                  <strong className="text-slate-700">{pagination.pages}</strong> ({pagination.total} total tags)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 inline mr-1" />
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
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

      {/* ========================================================= */}
      {/* MODAL 1: CREATE / EDIT SERVICE TAG                         */}
      {/* ========================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-600" />
                {editingTag ? 'Edit Service Tag' : 'Create New Service Tag'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formErrors.submit && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {formErrors.submit}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Category Select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Category *
                  </label>
                  {categoriesLoading && (
                    <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-medium">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Loading categories...
                    </span>
                  )}
                  {categoriesError && (
                    <button
                      type="button"
                      onClick={fetchCategories}
                      className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium"
                    >
                      Failed to load. Click to retry
                    </button>
                  )}
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={categoriesLoading}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {categoriesLoading ? 'Loading categories...' : 'Select Category'}
                  </option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {formErrors.category && <p className="text-xs text-rose-600 mt-1">{formErrors.category}</p>}
              </div>

              {/* Tag Name & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tag Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bike Repair or Deep Cleaning"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  {formErrors.name && <p className="text-xs text-rose-600 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subcategory (Grouping) *
                  </label>
                  <input
                    type="text"
                    value={formData.subcategoryName}
                    onChange={(e) => setFormData({ ...formData, subcategoryName: e.target.value })}
                    placeholder="e.g. Two Wheeler or Residential"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  {formErrors.subcategoryName && <p className="text-xs text-rose-600 mt-1">{formErrors.subcategoryName}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Explain what specific service this tag represents..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              {/* Checkboxes: Active & Customer Visible */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-700">Active in System</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isCustomerVisible}
                    onChange={(e) => setFormData({ ...formData, isCustomerVisible: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-700">Visible to Customers as Chip</span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingTag ? 'Save Changes' : 'Create Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: VIEW ASSOCIATED PROVIDERS                         */}
      {/* ========================================================= */}
      {providersModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Providers Offering: {providersModal.tag?.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Category: {providersModal.tag?.category?.name} • Total Active Providers: {providersModal.providers.length}
                </p>
              </div>
              <button
                onClick={() => setProvidersModal({ isOpen: false, tag: null, providers: [], loading: false })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {providersModal.loading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : providersModal.providers.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No active providers have currently selected this service tag.
                </div>
              ) : (
                providersModal.providers.map((p) => (
                  <div
                    key={p._id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                        <span>{p.businessName}</span>
                        {p.verificationStatus === 'verified' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.phone || p.email || 'Contact on file'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800">
                        {p.tagConfig?.basePrice ? `₹${p.tagConfig.basePrice}` : 'Standard Catalog Price'}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {p.tagConfig?.pricingType || 'fixed'} • Status: {p.tagConfig?.approvalStatus || 'approved'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 mt-4 flex justify-end">
              <button
                onClick={() => setProvidersModal({ isOpen: false, tag: null, providers: [], loading: false })}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DELETE / ARCHIVE CONFIRMATION                     */}
      {/* ========================================================= */}
      {deleteModal.isOpen && (
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, tag: null, isSubmitting: false })}
          onConfirm={handleConfirmDelete}
          title="Archive or Delete Service Tag"
          message={`Are you sure you want to remove tag '${deleteModal.tag?.name}'? If existing customer bookings reference this tag, the system will safely archive it instead of hard-deleting, preserving all booking records and wallet transactions.`}
          confirmText="Yes, Remove Tag"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleteModal.isSubmitting}
        />
      )}
    </div>
  );
};

export default ServiceTagsPage;

