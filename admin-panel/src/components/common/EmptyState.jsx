import React from 'react';
import { Database, AlertCircle } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Database,
  title = 'No Data Available',
  description = 'No records match the current criteria.',
  pendingApi = false,
  apiEndpoint = '',
  action = null
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-md">{description}</p>
      
      {pendingApi && (
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs font-medium text-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Pending Backend API Integration {apiEndpoint ? `(${apiEndpoint})` : ''}</span>
        </div>
      )}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

export default EmptyState;
