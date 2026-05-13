import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Trash2, Edit2, Link, Printer, List } from 'lucide-react';
import { cn } from '../lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  onAssign?: () => void;
  onUpdateStatus?: () => void;
  onDelete?: () => void;
  onPrintLabels?: () => void;
  onPrintSummary?: () => void;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  onAssign,
  onUpdateStatus,
  onDelete,
  onPrintLabels,
  onPrintSummary,
  className,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{ willChange: 'transform, opacity' }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 py-1.5 px-4 bg-zinc-900 border-zinc-800 text-white rounded-full shadow-2xl backdrop-blur-md border",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 bg-zinc-800 text-zinc-100 rounded-full text-[11px] font-bold">
              {selectedCount}
            </span>
            <span className="text-xs font-medium text-zinc-300">selected</span>
          </div>
          
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          
          <div className="flex items-center gap-0.5">
            {onAssign && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full" onClick={onAssign}>
                <Link className="mr-1.5 w-3.5 h-3.5" />
                Assign
              </Button>
            )}
            {onUpdateStatus && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full" onClick={onUpdateStatus}>
                <Edit2 className="mr-1.5 w-3.5 h-3.5" />
                Status
              </Button>
            )}
            {onPrintLabels && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full" onClick={onPrintLabels}>
                <Printer className="mr-1.5 w-3.5 h-3.5" />
                Labels
              </Button>
            )}
            {onPrintSummary && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full" onClick={onPrintSummary}>
                <List className="mr-1.5 w-3.5 h-3.5" />
                Summary
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-full ml-1" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
