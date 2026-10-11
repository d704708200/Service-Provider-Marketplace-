import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const verificationColumns = [
  { header: 'Provider Candidate', key: 'businessName' },
  { header: 'Owner Name', key: 'name' },
  { header: 'Experience (Years)', key: 'experienceYears' },
  { header: 'Submitted Documents', key: 'documentsCount' },
  { header: 'Application Date', key: 'appliedAt' },
  { header: 'Status', key: 'status' },
  { header: 'Verification Actions', key: 'actions' }
];

const ProviderVerificationPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Provider Verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review submitted contractor credentials, verify identity documents, and approve or reject marketplace onboarding applications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Queue Filter Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search pending applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Queue Status: 0 Pending Verification</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Verification Queue Table Shell */}
      <DataTable
        columns={verificationColumns}
        data={[]}
        isLoading={false}
        emptyTitle="No Pending Verifications"
        emptyDescription="All service provider onboarding applications have been processed or backend verification queue integration is pending."
        pendingApi={true}
        apiEndpoint="/api/admin/providers/verifications"
      />
    </div>
  );
};

export default ProviderVerificationPage;
