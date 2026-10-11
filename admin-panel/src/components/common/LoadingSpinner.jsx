import React from 'react';

const LoadingSpinner = ({ size = 'md', color = 'indigo', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3'
  };

  const colorClasses = {
    white: 'border-white/30 border-t-white',
    indigo: 'border-indigo-200 border-t-indigo-600',
    slate: 'border-slate-300 border-t-slate-700'
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full ${sizeClasses[size] || sizeClasses.md} ${colorClasses[color] || colorClasses.indigo} ${className}`}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;
