import { useState, useEffect } from 'react';

export interface LayoutItem {
  id: string;
  visible: boolean;
}

export function useCardLayout(tabName: string, defaultItems: string[]) {
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    const saved = localStorage.getItem(`layout_${tabName}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const currentIds = parsed.map((p: any) => p.id);
        const newItems = defaultItems.filter(id => !currentIds.includes(id));
        return [...parsed, ...newItems.map(id => ({ id, visible: true }))];
      } catch (e) {
        return defaultItems.map(id => ({ id, visible: true }));
      }
    }
    return defaultItems.map(id => ({ id, visible: true }));
  });

  useEffect(() => {
    localStorage.setItem(`layout_${tabName}`, JSON.stringify(layout));
  }, [layout, tabName]);

  const toggleVisibility = (id: string) => {
    setLayout(prev => prev.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setLayout(prev => {
      const newLayout = [...prev];
      if (direction === 'up' && index > 0) {
        [newLayout[index - 1], newLayout[index]] = [newLayout[index], newLayout[index - 1]];
      } else if (direction === 'down' && index < newLayout.length - 1) {
        [newLayout[index], newLayout[index + 1]] = [newLayout[index + 1], newLayout[index]];
      }
      return newLayout;
    });
  };

  const reorderItems = (startIndex: number, endIndex: number) => {
    setLayout(prev => {
      const newLayout = Array.from(prev);
      const [removed] = newLayout.splice(startIndex, 1);
      newLayout.splice(endIndex, 0, removed);
      return newLayout;
    });
  };

  return { layout, toggleVisibility, moveItem, reorderItems };
}
