import React from 'react';

export const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="relative">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200"></div>
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent absolute top-0 left-0"></div>
    </div>
  </div>
);