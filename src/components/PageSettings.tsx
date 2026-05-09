import React, { useState, ReactNode } from 'react';
import { Settings, Eye, EyeOff, ChevronUp, ChevronDown, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Switch } from './ui/switch';

export interface LayoutGroup {
  id: string;
  title: string;
  layout: { id: string; visible: boolean }[];
  toggleVisibility: (id: string) => void;
  moveItem: (index: number, direction: 'up' | 'down') => void;
  reorderItems?: (startIndex: number, endIndex: number) => void;
  labels: Record<string, string>;
}

interface PageSettingsProps {
  title?: string;
  triggerText?: string;
  groups: LayoutGroup[];
  children?: ReactNode; // For extra settings like the chart position toggle
}

export function PageSettings({ 
  title = "Page Settings", 
  triggerText = "Settings", 
  groups,
  children
}: PageSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ groupId: string, index: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ groupId: string, index: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, groupId: string, index: number) => {
    setDraggedItem({ groupId, index });
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to prevent the dragged item from disappearing immediately
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50');
      }
    }, 0);
  };

  const handleDragEnter = (e: React.DragEvent, groupId: string, index: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.groupId === groupId) {
      setDragOverItem({ groupId, index });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50');
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, group: LayoutGroup, dropIndex: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.groupId === group.id && draggedItem.index !== dropIndex) {
      if (group.reorderItems) {
        group.reorderItems(draggedItem.index, dropIndex);
      } else {
        // Fallback using moveItem multiple times (not ideal, but works if reorderItems is missing)
        let currentIndex = draggedItem.index;
        const direction = currentIndex < dropIndex ? 'down' : 'up';
        // Hacky way to simulate a drop without reorderItems
        if (direction === 'down') {
          for (let i = currentIndex; i < dropIndex; i++) {
            group.moveItem(i, 'down');
          }
        } else {
          for (let i = currentIndex; i > dropIndex; i--) {
            group.moveItem(i, 'up');
          }
        }
      }
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 shrink-0 bg-white shadow-sm border-[oklch(0.922_0_0)]" onClick={() => setOpen(true)}>
        <Settings className="w-4 h-4 text-muted-foreground" />
        <span className="hidden sm:inline font-medium">{triggerText}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden bg-[#fafafa]">
          <DialogHeader className="px-6 py-4 border-b bg-white">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Customize the layout and visibility of sections on this page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            {children && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">General</h4>
                <div className="p-4 bg-white rounded-xl border border-[oklch(0.922_0_0)] shadow-sm">
                  {children}
                </div>
              </div>
            )}
            
            {groups.map(group => (
              <div key={group.id} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.title}</h4>
                <div className="space-y-2">
                  {group.layout.map((item, index) => {
                    const isDragging = draggedItem?.groupId === group.id && draggedItem?.index === index;
                    const isDragOver = dragOverItem?.groupId === group.id && dragOverItem?.index === index;
                    const dragOverDirection = isDragOver && draggedItem ? (draggedItem.index < index ? 'down' : 'up') : null;

                    return (
                    <div 
                      key={item.id} 
                      className={`flex items-center gap-3 p-3 bg-white rounded-xl transition-all ${
                        item.visible 
                          ? 'border border-[oklch(0.922_0_0)] shadow-sm' 
                          : 'border border-dashed border-[oklch(0.922_0_0)] opacity-60 bg-muted/20'
                      } ${isDragging ? 'shadow-lg border-primary/50' : ''} ${
                        isDragOver ? (dragOverDirection === 'down' ? 'border-b-2 border-b-primary' : 'border-t-2 border-t-primary') : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, group.id, index)}
                      onDragEnter={(e) => handleDragEnter(e, group.id, index)}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, group, index)}
                    >
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="cursor-grab hover:text-foreground hover:bg-muted p-1 rounded transition-colors active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                        </div>
                        <span className={`font-medium text-sm truncate ${item.visible ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                          {group.labels[item.id] || item.id}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
                          <button 
                            className="p-1.5 hover:bg-white hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)] rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
                            onClick={() => group.moveItem(index, 'up')}
                            disabled={index === 0}
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            className="p-1.5 hover:bg-white hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)] rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
                            onClick={() => group.moveItem(index, 'down')}
                            disabled={index === group.layout.length - 1}
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <div className="h-6 w-[1px] bg-border/50" />
                        
                        <Switch 
                          checked={item.visible} 
                          onCheckedChange={() => group.toggleVisibility(item.id)}
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
