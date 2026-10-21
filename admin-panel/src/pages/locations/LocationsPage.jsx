import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Building,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { locationApi } from '../../services/api';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const LocationsPage = () => {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    zipCodes: '',
    isActive: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await locationApi.getAdminLocations(params);
      if (res?.success) {
        setLocations(res.data || []);
        if (res.pagination) setPagination(res.pagination);
      } else {
        throw new Error(res?.message || 'Failed to load service areas');
      }
    } catch (err) {
      setError(err.userMessage || err.message || 'Failed to load service areas from backend server.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, statusFilter]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  const handleOpenAddModal = () => {
    setEditingLocation(null);
    setFormData({
      name: '',
      city: '',
      state: '',
      zipCodes: '',
      isActive: true
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loc) => {
    setEditingLocation(loc);
    setFormData({
      name: loc.name || '',
      city: loc.city || '',
      state: loc.state || '',
      zipCodes: Array.isArray(loc.zipCodes) ? loc.zipCodes.join(', ') : '',
      isActive: loc.isActive !== undefined ? loc.isActive : true
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.city.trim()) {
      setActionError('Name and City are required fields.');
      return;
    }

    setIsSaving(true);
    setActionError(null);

    const payload = {
      name: formData.name.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      zipCodes: formData.zipCodes
        ? formData.zipCodes.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      isActive: Boolean(formData.isActive)
    };

    try {
      if (editingLocation) {
        await locationApi.updateLocation(editingLocation._id, payload);
        setActionSuccess(`Service area "${payload.name}" updated successfully.`);
      } else {
        await locationApi.createLocation(payload);
        setActionSuccess(`Service area "${payload.name}" created successfully.`);
      }
      setIsModalOpen(false);
      fetchLocations();
    } catch (err) {
      setActionError(err.userMessage || err.message || 'Failed to save service area.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (loc) => {
    setActionError(null);
    setActionSuccess(null);
    const newStatus = !loc.isActive;
    try {
      const res = await locationApi.toggleLocationStatus(loc._id, newStatus);
      if (res?.success) {
        setActionSuccess(`Service area "${loc.name}" ${newStatus ? 'activated' : 'deactivated'} successfully.`);
        fetchLocations();
      }
    } catch (err) {
      setActionError(err.userMessage || 'Failed to toggle service area status.');
    }
  };

  const handleDeleteLocation = async (loc) => {
    if (!window.confirm(`Are you sure you want to delete service area "${loc.name}"? It will also be removed from any linked service providers.`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await locationApi.deleteLocation(loc._id);
      if (res?.success) {
        setActionSuccess(`Service area "${loc.name}" deleted successfully.`);
        fetchLocations();
      }
    } catch (err) {
      setActionError(err.userMessage || 'Failed to delete service area.');
    }
  };

  const locationColumns = [
    {
      header: 'Area / Zone Name',
      key: 'name',
      render: (item) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 block">{item.name}</span>
          <span className="text-[11px] text-slate-400">{item.state || 'State Unspecified'}</span>
        </div>
      )
    },
    {
      header: 'City',
      key: 'city',
      render: (item) => <span className="font-medium text-xs text-slate-800">{item.city}</span>
    },
    {
      header: 'Postal / Zip Codes',
      key: 'zipCodes',
      render: (item) => (
        <div className="max-w-xs">
          {item.zipCodes?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.zipCodes.slice(0, 4).map((zip, idx) => (
                <span key={idx} className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm">
                  {zip}
                </span>
              ))}
              {item.zipCodes.length > 4 && (
                <span className="text-[11px] text-slate-400">+{item.zipCodes.length - 4} more</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Entire City</span>
          )}
        </div>
      )
    },
    {
      header: 'Active Providers',
      key: 'providerCount',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          <span>{item.providerCount || 0} Providers</span>
        </div>
      )
    },
    {
      header: 'Service Availability',
      key: 'status',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
            item.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleStatus(item)}
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            title={item.isActive ? 'Deactivate' : 'Activate'}
          >
            {item.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => handleOpenEditModal(item)}
            className="p-1 text-slate-600 hover:text-indigo-600 rounded-md transition-colors"
            title="Edit Area"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteLocation(item)}
            className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
            title="Delete Area"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Areas & Operating Zones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Define operating municipalities, configure postal code coverage boundaries, and manage service eligibility.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchLocations}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service Area</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && !isModalOpen && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by area name, city, state, or postal code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="all">All Service Availability</option>
              <option value="active">Active Service Areas</option>
              <option value="inactive">Inactive Service Areas</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchLocations}
            className="text-xs text-rose-700 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Locations Table */}
      <DataTable
        columns={locationColumns}
        data={locations}
        isLoading={isLoading}
        emptyTitle="No Service Areas Configured"
        emptyDescription="Regional coverage zones and postal codes added here will be available for contractor assignment."
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} Total Areas)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Location Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingLocation ? 'Edit Service Area' : 'Add New Service Area'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLocation} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Area / Zone Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. South Mumbai Metro Zone"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/40 text-slate-900 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/40 text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/40 text-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Postal / Zip Codes (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.zipCodes}
                  onChange={(e) => setFormData({ ...formData, zipCodes: e.target.value })}
                  placeholder="e.g. 400001, 400002, 400005"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/40 text-slate-900 text-xs"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Leave empty if this zone encompasses the entire city.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="locActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="locActive" className="text-xs font-semibold text-slate-700">
                  Mark this service area as active and eligible for bookings
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingLocation ? 'Update Service Area' : 'Create Service Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationsPage;
