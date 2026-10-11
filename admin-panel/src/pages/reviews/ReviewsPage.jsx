import React, { useState } from 'react';
import { Star, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import DataTable from '../../components/tables/DataTable';

const reviewColumns = [
  { header: 'Review ID', key: 'id' },
  { header: 'Provider Reviewed', key: 'providerName' },
  { header: 'Reviewer', key: 'customerName' },
  { header: 'Score Rating', key: 'rating' },
  { header: 'Review Content', key: 'comment' },
  { header: 'Date Posted', key: 'createdAt' },
  { header: 'Moderation Status', key: 'status' }
];

const ReviewsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reviews & Ratings Moderation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Moderate submitted feedback, inspect provider rating trends, and manage flagged reviews.
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

      {/* Filter / Search Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by provider, customer, or keyword..."
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
              <span>Score: All Ratings</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Reviews Table Shell */}
      <DataTable
        columns={reviewColumns}
        data={[]}
        isLoading={false}
        emptyTitle="No Customer Reviews Recorded"
        emptyDescription="Customer feedback, ratings, and moderation flags will appear here once booking completion and review services are integrated."
        pendingApi={true}
        apiEndpoint="/api/admin/reviews"
      />
    </div>
  );
};

export default ReviewsPage;
