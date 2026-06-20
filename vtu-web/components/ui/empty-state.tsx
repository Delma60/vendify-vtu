import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Assuming you have this standard utility, otherwise just use template literals

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[350px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 text-center transition-all hover:bg-gray-50",
        className
      )}
    >
      {Icon && (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100 mb-5">
          <Icon className="h-8 w-8 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      
      <h3 className="text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h3>
      
      {description && (
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-8">
          <Button 
            onClick={action.onClick}
            className="shadow-sm"
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}