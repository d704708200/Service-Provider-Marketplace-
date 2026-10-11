import React, { useState } from 'react';
import { CalendarCheck, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const requestColumns = [
  { header: 'Booking ID', key: 'bookingId' },
  { header: 'Customer', key: 'customerName' },
  { header: 'Service Requested', key: 'serviceTitle' },
  { header: 'Provider Assigned', key: 'providerName' },
  { header: 'Scheduled Date/Time', key: 'scheduledTime' },
  { header: 'Order Total', key: 'amount' },
  { header: 'Status', key: 'status' },
  { header: 'Actions', key: 'actions' }
];

const RequestsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Requests & Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Supervise consumer order dispatching, booking progression, dispute mediation, and status lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Orders</span>
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
              placeholder="Search by Booking ID, customer or provider..."
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
              <span>Status: All Bookings</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Requests Table Shell */}
      <DataTable
        columns={requestColumns}
        data={[]}
        isLoading={false}
        emptyTitle="No Service Bookings Recorded"
        emptyDescription="Consumer requests and provider assignments will stream here in real time once booking lifecycle endpoints are active."
        pendingApi={true}
        apiEndpoint="/api/admin/bookings"
      />
    </div>
  );
};

export default RequestsPage;
