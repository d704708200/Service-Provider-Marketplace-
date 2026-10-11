import React, { useState } from 'react';
import { Briefcase, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const providerColumns = [
  { header: 'Provider / Business', key: 'businessName' },
  { header: 'Contact Name', key: 'name' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
  { header: 'Verification Status', key: 'verificationStatus' },
  { header: 'Availability', key: 'isAvailable' },
  { header: 'Rating', key: 'rating' }
];

const ProvidersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Providers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor registered service professionals, business profiles, and overall account status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar Shell */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search providers by business name, specialty, or email..."
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
              <span>Verification: All</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Providers Table Shell */}
      <DataTable
        columns={providerColumns}
        data={[]}
        isLoading={false}
        emptyTitle="Provider Directory Pending Integration"
        emptyDescription="Provider profile listing and status management will populate when the administrative provider endpoints are operational."
        pendingApi={true}
        apiEndpoint="/api/admin/providers"
      />
    </div>
  );
};

export default ProvidersPage;
