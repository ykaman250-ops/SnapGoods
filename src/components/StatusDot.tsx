import React from 'react';
import { cn } from '../lib/utils';

interface StatusDotProps {
  status: 'available' | 'assigned' | 'repair' | 'retired' | 'maintenance' | 'deployed';
  className?: string;
}

const statusConfig = {
  available: { color: 'bg-emerald-500', label: 'Available' },
  deployed: { color: 'bg-emerald-500', label: 'Deployed' },
  assigned: { color: 'bg-blue-500', label: 'Assigned' },
  repair: { color: 'bg-amber-500', label: 'In Repair' },
  maintenance: { color: 'bg-amber-500', label: 'Maintenance' },
  retired: { color: 'bg-zinc-500', label: 'Retired' },
};

export function StatusDot({ status, className }: StatusDotProps) {
  const config = statusConfig[status] || statusConfig.available;
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex h-2 w-2">
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-20", config.color)}></span>
        <span className={cn("relative inline-flex rounded-full h-2 w-2", config.color)}></span>
      </div>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 capitalize">{config.label}</span>
    </div>
  );
}
