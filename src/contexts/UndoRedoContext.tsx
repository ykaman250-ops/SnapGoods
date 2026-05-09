import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Command {
  id: string;
  description: string;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
}

interface UndoRedoContextType {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  pushCommand: (command: Command) => void;
  clear: () => void;
  lastActionTime: number;
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastActionTime, setLastActionTime] = useState<number>(Date.now());

  const pushCommand = useCallback((command: Command) => {
    setUndoStack(prev => {
      const newStack = [...prev, command];
      // Limit to 20 items to prevent memory bloat
      if (newStack.length > 20) {
        return newStack.slice(newStack.length - 20);
      }
      return newStack;
    });
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  const undo = useCallback(async () => {
    if (undoStack.length === 0 || isExecuting) return;
    
    setIsExecuting(true);
    const commandToUndo = undoStack[undoStack.length - 1];
    
    try {
      await commandToUndo.undo();
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, commandToUndo]);
      toast.success(`Undid: ${commandToUndo.description}`);
      setLastActionTime(Date.now());
    } catch (error: any) {
      console.error('Undo failed:', error);
      toast.error(`Undo failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [undoStack, isExecuting]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0 || isExecuting) return;
    
    setIsExecuting(true);
    const commandToRedo = redoStack[redoStack.length - 1];
    
    try {
      await commandToRedo.execute();
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, commandToRedo]);
      toast.success(`Redid: ${commandToRedo.description}`);
      setLastActionTime(Date.now());
    } catch (error: any) {
      console.error('Redo failed:', error);
      toast.error(`Redo failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [redoStack, isExecuting]);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoRedoContext.Provider value={{
      canUndo: undoStack.length > 0 && !isExecuting,
      canRedo: redoStack.length > 0 && !isExecuting,
      undo,
      redo,
      pushCommand,
      clear,
      lastActionTime
    }}>
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (context === undefined) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider');
  }
  return context;
}
