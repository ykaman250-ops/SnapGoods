import React, { createContext, useContext, ReactNode } from 'react';
import { api } from './api';
import { Command, useUndoRedo } from '../contexts/UndoRedoContext';
import { toast } from 'sonner';

interface ActionManagerType {
  create: (path: string, data: any, description: string) => Promise<string>;
  update: (path: string, id: string, newData: any, previousData: any, description: string) => Promise<void>;
  delete: (path: string, id: string, previousData: any, description: string) => Promise<void>;
  // For specialized multi-document transactions like assigning an asset
  executeComplex: (description: string, executeFunc: () => Promise<void>, undoFunc: () => Promise<void>) => Promise<void>;
}

const ActionManagerContext = createContext<ActionManagerType | undefined>(undefined);

export function ActionManagerProvider({ children }: { children: ReactNode }) {
  const { pushCommand } = useUndoRedo();

  const showUndoToast = (description: string, command: Command) => {
    toast.success(description, {
      action: {
        label: 'Undo',
        onClick: () => {
          command.undo().then(() => {
            toast.info('Action undone');
          }).catch(console.error);
        }
      }
    });
  };

  const handleCreate = async (path: string, data: any, description: string) => {
    const docId = await api.create(path, data);
    
    if (docId) {
      const command: Command = {
        id: Math.random().toString(36).substring(7),
        description,
        execute: async () => {
          await api.set(path, docId, data);
        },
        undo: async () => {
          await api.delete(path, docId);
        }
      };
      pushCommand(command);
      showUndoToast(description, command);
    }
    
    return docId as string;
  };

  const handleUpdate = async (path: string, id: string, newData: any, previousData: any, description: string) => {
    await api.update(path, id, newData);
    
    const command: Command = {
      id: Math.random().toString(36).substring(7),
      description,
      execute: async () => {
        await api.update(path, id, newData);
      },
      undo: async () => {
        await api.update(path, id, previousData);
      }
    };
    
    pushCommand(command);
    showUndoToast(description, command);
  };

  const handleDelete = async (path: string, id: string, previousData: any, description: string) => {
    await api.delete(path, id);
    
    const command: Command = {
      id: Math.random().toString(36).substring(7),
      description,
      execute: async () => {
        await api.delete(path, id);
      },
      undo: async () => {
        await api.set(path, id, previousData);
      }
    };
    
    pushCommand(command);
    showUndoToast(description, command);
  };

  const handleExecuteComplex = async (description: string, executeFunc: () => Promise<void>, undoFunc: () => Promise<void>) => {
    await executeFunc();
    
    const command: Command = {
      id: Math.random().toString(36).substring(7),
      description,
      execute: executeFunc,
      undo: undoFunc
    };
    
    pushCommand(command);
    showUndoToast(description, command);
  };

  return (
    <ActionManagerContext.Provider value={{
      create: handleCreate,
      update: handleUpdate,
      delete: handleDelete,
      executeComplex: handleExecuteComplex
    }}>
      {children}
    </ActionManagerContext.Provider>
  );
}

export function useActionManager() {
  const context = useContext(ActionManagerContext);
  if (context === undefined) {
    throw new Error('useActionManager must be used within an ActionManagerProvider');
  }
  return context;
}
