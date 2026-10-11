import React, { useState } from 'react';
import { Wrench, Plus, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const serviceColumns = [
  { header: 'Service Title', key: 'title' },
  { header: 'Category', key: 'category' },
  { header: 'Base Price', key: 'basePrice' },
  { header: 'Duration (Est.)', key: 'duration' },
  { header: 'Active Providers', key: 'providersCount' },
  { header: 'Status', key: 'status' },
  { header: 'Actions', key: 'actions' }
];

const ServicesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Services Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure standardized marketplace service offerings, pricing tiers, and assignment rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search services by title, category, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Category: All</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Services Table Shell */}
      <DataTable
        columns={serviceColumns}
        data={[]}
        isLoading={false}
        emptyTitle="Services Catalog Pending Integration"
        emptyDescription="Configured marketplace offerings and pricing structures will be listed here once services API endpoints are connected."
        pendingApi={true}
        apiEndpoint="/api/admin/services"
      />
    </div>
  );
};

export default ServicesPage;
