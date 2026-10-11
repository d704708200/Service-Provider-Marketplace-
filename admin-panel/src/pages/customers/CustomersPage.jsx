import React, { useState } from 'react';
import { Users, Search, Filter, RefreshCw, UserCheck } from 'lucide-react';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const customerColumns = [
  { header: 'Customer Name', key: 'name' },
  { header: 'Email Address', key: 'email' },
  { header: 'Phone Number', key: 'phone' },
  { header: 'Total Bookings', key: 'totalBookings' },
  { header: 'Account Status', key: 'status' },
  { header: 'Joined Date', key: 'createdAt' }
];

const CustomersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage registered marketplace consumers, inspect profile details, and supervise account status.
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
              placeholder="Search customers by name, email, or phone..."
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
              <span>Status: All</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Customer Table Shell with Honest Empty State */}
      <DataTable
        columns={customerColumns}
        data={[]}
        isLoading={false}
        emptyTitle="Customer Management Integration Pending"
        emptyDescription="Customer directory data stream will populate once the administrative customer management REST endpoints are established."
        pendingApi={true}
        apiEndpoint="/api/admin/customers"
      />
    </div>
  );
};

export default CustomersPage;
