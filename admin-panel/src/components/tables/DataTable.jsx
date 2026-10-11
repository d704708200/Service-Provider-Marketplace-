import React from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';

const DataTable = ({
  columns = [],
  data = [],
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are currently no records to display.',
  pendingApi = false,
  apiEndpoint = '',
  action = null
}) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center">
        <LoadingSpinner size="md" color="indigo" />
        <span className="mt-3 text-sm text-slate-500">Loading data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        pendingApi={pendingApi}
        apiEndpoint={apiEndpoint}
        action={action}
      />
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
              {columns.map((col, idx) => (
                <th key={col.key || idx} className={`py-3.5 px-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, rowIdx) => (
              <tr key={row.id || row._id || rowIdx} className="hover:bg-slate-50/60 transition-colors">
                {columns.map((col, colIdx) => (
                  <td key={col.key || colIdx} className={`py-3.5 px-4 text-slate-700 ${col.cellClassName || ''}`}>
                    {typeof col.render === 'function' ? col.render(row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
