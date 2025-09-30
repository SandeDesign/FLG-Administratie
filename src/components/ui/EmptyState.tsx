import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}) => (
  <div className="text-center py-12">
    <Icon className="mx-auto h-12 w-12 text-gray-400" />
    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
      {title}
    </h3>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
      {description}
    </p>
    {actionLabel && onAction && (
      <div className="mt-6">
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    )}
  </div>
);