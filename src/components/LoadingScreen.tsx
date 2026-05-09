import React from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6"
      >
        <Logo className="w-48 h-12" variant="full" />
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut', delay: 0 }}
            className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut', delay: 0.2 }}
            className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut', delay: 0.4 }}
            className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600"
          />
        </div>
      </motion.div>
    </div>
  );
}
