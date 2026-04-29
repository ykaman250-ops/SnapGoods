import React from 'react';
import { cn } from '../lib/utils';

interface EmployeeAvatarProps {
  name: string;
  email?: string;
  className?: string;
}

export function EmployeeAvatar({ name, className }: EmployeeAvatarProps) {
  return (
    <div className={cn("w-8 h-8 rounded-full bg-gold-50 text-gold-600 flex items-center justify-center text-xs font-bold uppercase shrink-0", className)}>
      {name?.charAt(0) || '?'}
    </div>
  );
}
