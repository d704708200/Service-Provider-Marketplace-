import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertCircle,
  Users,
  MapPin,
  X,
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';
import { serviceRadiusApi, categoryApi } from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

const ServiceRadiusPage = () => {
  const [configs, setConfigs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [maxRadiusKm, setMaxRadiusKm] = useState('15');
  const [allowedRadiiList, setAllowedRadiiList] = useState([]);
  const [newRadiusInput, setNewRadiusInput] = useState('');
  const [isActiveConfig, setIsActiveConfig] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // View Providers Modal
  const [providersModal, setProvidersModal] = useState({
    isOpen: false,
    config: null,
    selectedKm: 'all',
    providers: [],
    isLoading: false,
    error: null
  });

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {}
  });

  // Fetch all service radius configurations
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [configsRes, catsRes] = await Promise.all([
        serviceRadiusApi.getAll(),
        categoryApi.getAll({ isActive: true })
      ]);

      if (configsRes?.success) {
        setConfigs(configsRes.data || []);
      }
      if (catsRes?.success) {
        setCategories(catsRes.data || []);
      }
    } catch (err) {
      setApiError(err.userMessage || err.message || 'Failed to load service radius configurations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash message timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingConfig(null);
    // Find first unconfigured category
    const configuredCatIds = new Set(
      configs.map((c) => (c.category?._id || c.category)?.toString())
    );
    const availableCats = categories.filter((c) => !configuredCatIds.has(c._id.toString()));
    setSelectedCategoryId(availableCats[0]?._id || '');
    setMaxRadiusKm('15');
    setAllowedRadiiList([
      { km: 2, isActive: true },
      { km: 5, isActive: true },
      { km: 10, isActive: true }
    ]);
    setNewRadiusInput('');
    setIsActiveConfig(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (config) => {
    setEditingConfig(config);
    setSelectedCategoryId((config.category?._id || config.category)?.toString());
    setMaxRadiusKm(String(config.maxRadiusKm || 15));
    setAllowedRadiiList(
      (config.allowedRadii || []).map((r) => ({
        _id: r._id,
        km: r.km,
        isActive: r.isActive !== false,
        providerCount: r.providerCount || 0
      }))
    );
    setNewRadiusInput('');
    setIsActiveConfig(config.isActive !== false);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Add a radius option chip in modal
  const handleAddRadiusOption = () => {
    const kmNum = Number(newRadiusInput.trim());
    if (isNaN(kmNum) || kmNum <= 0) {
      setModalError('Radius must be a valid number greater than 0 KM');
      return;
    }
    const maxNum = Number(maxRadiusKm);
    if (kmNum > maxNum) {
      setModalError(`Radius option (${kmNum} KM) cannot exceed the maximum permitted radius (${maxNum} KM)`);
      return;
    }
    if (allowedRadiiList.some((r) => Number(r.km) === kmNum)) {
      setModalError(`Radius option ${kmNum} KM is already added`);
      return;
    }

    const updated = [...allowedRadiiList, { km: kmNum, isActive: true }];
    updated.sort((a, b) => a.km - b.km);
    setAllowedRadiiList(updated);
    setNewRadiusInput('');
    setModalError(null);
  };

  // Toggle radius option active/inactive in edit modal
  const handleToggleRadiusOption = (index) => {
    setAllowedRadiiList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], isActive: !next[index].isActive };
      return next;
    });
  };

  // Remove radius option in modal (with in-use warning)
  const handleRemoveRadiusOption = (index) => {
    const item = allowedRadiiList[index];
    if (item.providerCount && item.providerCount > 0) {
      setModalError(
        `Cannot remove ${item.km} KM radius option because ${item.providerCount} provider(s) have selected it. Disable it instead to prevent future selections.`
      );
      return;
    }
    if (allowedRadiiList.length <= 1) {
      setModalError('At least one radius option is required');
      return;
    }
    setAllowedRadiiList((prev) => prev.filter((_, i) => i !== index));
    setModalError(null);
  };

  // Save Config (Create or Update)
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setModalError(null);

    const maxNum = Number(maxRadiusKm);
    if (isNaN(maxNum) || maxNum <= 0) {
      setModalError('Maximum permitted radius must be greater than 0 KM');
      return;
    }

    if (allowedRadiiList.length === 0) {
      setModalError('At least one allowed radius option is required');
      return;
    }

    // Ensure all options are <= max
    for (const opt of allowedRadiiList) {
      if (opt.km > maxNum) {
        setModalError(`Radius option ${opt.km} KM exceeds maximum permitted radius of ${maxNum} KM`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingConfig) {
        const payload = {
          maxRadiusKm: maxNum,
          allowedRadii: allowedRadiiList,
          isActive: isActiveConfig
        };
        const res = await serviceRadiusApi.update(editingConfig._id, payload);
        if (res?.success) {
          setSuccessMessage(`Service radius updated for '${editingConfig.serviceName}'`);
          setIsModalOpen(false);
          await loadData();
        }
      } else {
        const payload = {
          categoryId: selectedCategoryId,
          maxRadiusKm: maxNum,
          allowedRadii: allowedRadiiList,
          isActive: isActiveConfig
        };
        const res = await serviceRadiusApi.create(payload);
        if (res?.success) {
          setSuccessMessage('Service radius configuration created successfully');
          setIsModalOpen(false);
          await loadData();
        }
      }
    } catch (err) {
      setModalError(err.userMessage || err.message || 'Failed to save configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open View Providers Modal
  const handleOpenProvidersModal = async (config, km = 'all') => {
    setProvidersModal({
      isOpen: true,
      config,
      selectedKm: km,
      providers: [],
      isLoading: true,
      error: null
    });

    try {
      const res = await serviceRadiusApi.getProviders(config._id, {
        km: km === 'all' ? undefined : km
      });
      if (res?.success) {
        setProvidersModal((prev) => ({
          ...prev,
          providers: res.data?.providers || [],
          isLoading: false
        }));
      }
    } catch (err) {
      setProvidersModal((prev) => ({
        ...prev,
        isLoading: false,
        error: err.userMessage || err.message || 'Failed to load providers'
      }));
    }
  };

  // Filter providers in modal when KM changes
  const handleProvidersKmChange = async (km) => {
    if (!providersModal.config) return;
    setProvidersModal((prev) => ({ ...prev, selectedKm: km, isLoading: true, error: null }));
    try {
      const res = await serviceRadiusApi.getProviders(providersModal.config._id, {
        km: km === 'all' ? undefined : km
      });
      if (res?.success) {
        setProvidersModal((prev) => ({
          ...prev,
          providers: res.data?.providers || [],
          isLoading: false
        }));
      }
    } catch (err) {
      setProvidersModal((prev) => ({
        ...prev,
        isLoading: false,
        error: err.userMessage || err.message || 'Failed to load providers'
      }));
    }
  };

  // Filtered configs for display
  const filteredConfigs = configs.filter((c) => {
    const matchesSearch =
      c.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? c.isActive !== false
        : c.isActive === false;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-7 h-7 text-indigo-600" />
            Service Radius Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure serviceable distance limits (KM) separately for each service. Providers can only choose from your active options.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Service Radius
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {apiError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Configured Services</p>
              <p className="text-2xl font-bold text-slate-900">{configs.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Service Rules</p>
              <p className="text-2xl font-bold text-slate-900">
                {configs.filter((c) => c.isActive !== false).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Providers with Configured Area</p>
              <p className="text-2xl font-bold text-slate-900">
                {configs.reduce((sum, c) => sum + (c.totalProvidersCount || 0), 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search service name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner message="Loading service radius configurations..." />
          </div>
        ) : filteredConfigs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Compass}
              title="No service radius rules found"
              message={
                searchTerm
                  ? 'No services matched your search query.'
                  : 'Get started by configuring allowed radius options for a service.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs tracking-wider">
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Allowed Radius Options</th>
                  <th className="py-3 px-4">Maximum Radius</th>
                  <th className="py-3 px-4">Coverage & Providers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredConfigs.map((config) => (
                  <tr key={config._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{config.serviceName}</div>
                      <div className="text-xs text-slate-500">
                        {config.category?.name || 'Category'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(config.allowedRadii || []).map((rad) => (
                          <button
                            key={rad._id || rad.km}
                            onClick={() => handleOpenProvidersModal(config, rad.km)}
                            title={`Click to view providers (${rad.providerCount || 0} active)`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              rad.isActive !== false
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 line-through'
                            }`}
                          >
                            <span>{rad.km} KM</span>
                            {rad.providerCount !== undefined && rad.providerCount > 0 && (
                              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px]">
                                {rad.providerCount}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Max {config.maxRadiusKm} KM
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleOpenProvidersModal(config, 'all')}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{config.totalProvidersCount || 0} provider(s)</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      {config.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(config)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="Edit Radius Options"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingConfig
                  ? `Edit Radius Options: ${editingConfig.serviceName}`
                  : 'Configure New Service Radius'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Service Selection (Only on create) */}
              {!editingConfig ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Select Service Category *
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>
                      Choose a service category...
                    </option>
                    {categories.map((cat) => {
                      const isAlreadyConfigured = configs.some(
                        (c) => (c.category?._id || c.category)?.toString() === cat._id.toString()
                      );
                      return (
                        <option
                          key={cat._id}
                          value={cat._id}
                          disabled={isAlreadyConfigured}
                        >
                          {cat.name} {isAlreadyConfigured ? '(Already configured)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                  <span className="font-semibold">Service:</span> {editingConfig.serviceName}
                </div>
              )}

              {/* Maximum Permitted Radius */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Maximum Permitted Radius (KM) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(e.target.value)}
                    required
                    placeholder="e.g. 15"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    KM
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upper ceiling. No provider can choose a radius larger than this value.
                </p>
              </div>

              {/* Allowed Radius Options List */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Allowed Radius Options for Providers
                </label>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px] items-center mb-3">
                  {allowedRadiiList.map((rad, idx) => (
                    <div
                      key={rad._id || idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        rad.isActive
                          ? 'bg-white text-indigo-700 border-indigo-200 shadow-2xs'
                          : 'bg-slate-200 text-slate-500 border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleRadiusOption(idx)}
                        title={rad.isActive ? 'Click to disable' : 'Click to enable'}
                        className="hover:underline flex items-center gap-1"
                      >
                        {rad.isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{rad.km} KM</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveRadiusOption(idx)}
                        className="text-slate-400 hover:text-rose-600 ml-1 p-0.5 rounded"
                        title="Delete option"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new option input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0.5"
                      max={maxRadiusKm || 100}
                      step="0.5"
                      placeholder="e.g. 8"
                      value={newRadiusInput}
                      onChange={(e) => setNewRadiusInput(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      KM
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRadiusOption}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Option
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click a pill to toggle active/disabled. Disabled options cannot be selected by providers.
                </p>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Rule Active Status</div>
                  <div className="text-[11px] text-slate-500">
                    When active, providers offering this service must choose from these options.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActiveConfig(!isActiveConfig)}
                  className="text-2xl text-indigo-600"
                >
                  {isActiveConfig ? (
                    <ToggleRight className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Providers Modal */}
      {providersModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Providers for {providersModal.config?.serviceName}
                </h3>
                <p className="text-xs text-slate-500">
                  Providers who configured their service location and radius for this service.
                </p>
              </div>
              <button
                onClick={() => setProvidersModal({ ...providersModal, isOpen: false })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Radius Filter Pills in modal */}
            <div className="flex flex-wrap gap-1.5 py-3 border-b border-slate-100">
              <button
                onClick={() => handleProvidersKmChange('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  providersModal.selectedKm === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Radii
              </button>
              {(providersModal.config?.allowedRadii || []).map((rad) => (
                <button
                  key={rad.km}
                  onClick={() => handleProvidersKmChange(rad.km)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    String(providersModal.selectedKm) === String(rad.km)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {rad.km} KM
                </button>
              ))}
            </div>

            {/* Providers List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {providersModal.isLoading ? (
                <div className="p-8 flex justify-center">
                  <LoadingSpinner message="Loading providers..." />
                </div>
              ) : providersModal.error ? (
                <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-lg">
                  {providersModal.error}
                </div>
              ) : providersModal.providers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No providers currently configured with this radius.
                </div>
              ) : (
                providersModal.providers.map((item) => (
                  <div
                    key={item.providerId}
                    className="p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {item.businessName}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{item.user?.phone || 'No phone'}</span>
                        <span>•</span>
                        <span>{item.user?.email || 'No email'}</span>
                      </div>
                      {item.serviceArea?.address?.formattedAddress && (
                        <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-sm">
                            {item.serviceArea.address.formattedAddress}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.serviceArea?.radiusKm} KM Radius
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 capitalize">
                        Source: {item.serviceArea?.locationSource || 'gps'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setProvidersModal({ ...providersModal, isOpen: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRadiusPage;

