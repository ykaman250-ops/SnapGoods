import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, Search, Plus, Filter, Minus, 
  ShoppingCart, AlertCircle, Clock, Trash2, Edit2, Archive, Printer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '../components/ui/dialog';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useActionManager } from '../lib/actionManager';
import { useCurrencyFormatter } from '../lib/useCurrencyFormatter';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import type { InventoryItem, InventoryTransaction, Location, AssetCategory } from '../lib/types';
import { cn } from '../lib/utils';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Inventory() {
  const { organization, profile } = useAuth();
  const formatCurrency = useCurrencyFormatter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [itemCategory, setItemCategory] = useState('');
  const [itemType, setItemType] = useState('');
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});
  
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockAction, setStockAction] = useState<'add' | 'consume'>('add');
  const [stockQuantity, setStockQuantity] = useState(1);
  const [stockNotes, setStockNotes] = useState('');
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmittingState] = useState(false);
  const isSubmittingRef = useRef(false);

  const actionManager = useActionManager();

  const setIsSubmitting = (val: boolean) => {
    isSubmittingRef.current = val;
    setIsSubmittingState(val);
  };

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invItems, locs, cats] = await Promise.all([
        api.list('inventory_items'),
        api.list('locations'),
        api.list('asset_categories')
      ]);
      setItems((invItems as InventoryItem[]) || []);
      setLocations((locs as Location[]) || []);
      
      const loadedCats = (cats as AssetCategory[] || []).filter(c => !c.usage || c.usage === 'inventory' || c.usage === 'both');
      setCategories(loadedCats);
    } catch (error) {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!organization?.id || isSubmittingRef.current) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      orgId: organization.id,
      name: formData.get('name') as string,
      itemCode: formData.get('itemCode') as string,
      category: itemCategory,
      type: itemType,
      locationId: formData.get('locationId') as string,
      quantity: parseInt(formData.get('quantity') as string) || 0,
      lowStockThreshold: parseInt(formData.get('lowStockThreshold') as string) || 0,
      purchaseCost: parseFloat(formData.get('purchaseCost') as string) || 0,
    };

    const selectedCat = categories.find(c => c.name === itemCategory);
    const typeDef = selectedCat?.assetTypes?.find(t => t.name === itemType);
    if (typeDef?.customFields) {
      for (const field of typeDef.customFields) {
        if (field.required) {
          const value = customFieldsData[field.name];
          if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
            toast.error(`${field.name} is required`);
            setIsSubmitting(false);
            return;
          }
        }
      }
    }

    const finalData = {
      ...data,
      customData: customFieldsData
    };

    try {
      if (editingItem?.id) {
        await actionManager.update('inventory_items', editingItem.id, { 
          ...finalData,
          updatedAt: new Date().toISOString()
        }, editingItem, 'Inventory item updated');
      } else {
        const itemData = {
          ...finalData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const txData = data.quantity > 0 ? {
            orgId: organization.id,
            action: 'add',
            quantity: data.quantity,
            previousQuantity: 0,
            newQuantity: data.quantity,
            locationId: data.locationId,
            notes: 'Initial stock',
            userId: profile?.uid,
            timestamp: new Date().toISOString()
          } : null;

        let newItemId = '';
        let txId = '';
        await actionManager.executeComplex('Inventory item added', 
          async () => {
            if (!newItemId) {
              newItemId = await api.create('inventory_items', itemData) as string;
              if (txData && newItemId) {
                txId = await api.create('inventory_transactions', { ...txData, itemId: newItemId }) as string;
              }
            } else {
              await api.set('inventory_items', newItemId, itemData);
              if (txData && txId) {
                await api.set('inventory_transactions', txId, { ...txData, itemId: newItemId });
              }
            }
          },
          async () => {
            if (txId) await api.delete('inventory_transactions', txId);
            if (newItemId) await api.delete('inventory_items', newItemId);
          }
        );
      }
      setIsAddOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save inventory item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStockUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stockItem?.id || !organization?.id || isSubmittingRef.current) return;
    setIsSubmitting(true);

    const qty = parseInt(stockQuantity.toString());
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      setIsSubmitting(false);
      return;
    }

    if (stockAction === 'consume' && qty > stockItem.quantity) {
      toast.error('Cannot consume more than available stock');
      setIsSubmitting(false);
      return;
    }

    const previousQuantity = stockItem.quantity;
    const newQuantity = stockAction === 'add' 
      ? previousQuantity + qty 
      : previousQuantity - qty;

    try {
      let txId = '';
      const txData = {
        orgId: organization.id,
        itemId: stockItem.id,
        action: stockAction,
        quantity: stockAction === 'add' ? qty : -qty,
        previousQuantity,
        newQuantity,
        locationId: stockItem.locationId,
        notes: stockNotes,
        userId: profile?.uid,
        timestamp: new Date().toISOString()
      };

      await actionManager.executeComplex(`Successfully ${stockAction === 'add' ? 'added' : 'consumed'} ${qty} items`,
        async () => {
          await api.update('inventory_items', stockItem.id!, {
            quantity: newQuantity,
            updatedAt: new Date().toISOString()
          });
          if (!txId) {
            txId = await api.create('inventory_transactions', txData) as string;
          } else {
            await api.set('inventory_transactions', txId, txData);
          }
        },
        async () => {
          await api.update('inventory_items', stockItem.id!, {
            quantity: previousQuantity,
            updatedAt: new Date().toISOString()
          });
          if (txId) {
            await api.delete('inventory_transactions', txId);
          }
        }
      );

      setIsStockOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to update stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'inventory_transactions'),
        where('orgId', '==', organization?.id),
        where('itemId', '==', item.id),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
      setTransactions(txs);
    } catch (error) {
      toast.error('Failed to load transaction history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (isSubmittingRef.current || !confirm(`Are you sure you want to delete ${name}? This will not delete transaction history but will remove the item.`)) return;
    setIsSubmitting(true);
    try {
      const itemToDelete = items.find(i => i.id === id);
      if (itemToDelete) {
        await actionManager.delete('inventory_items', id, itemToDelete, 'Item deleted');
      }
      loadData();
    } catch (error) {
      toast.error('Failed to delete item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => {
    const searchLower = search.toLowerCase();
    const locName = locations.find(l => l.id === i.locationId)?.name?.toLowerCase() || '';
    
    const matchesSearch = 
      (i.name?.toLowerCase() || '').includes(searchLower) ||
      (i.itemCode?.toLowerCase() || '').includes(searchLower) ||
      locName.includes(searchLower);
      
    const matchesCat = categoryFilter === 'all' || i.category === categoryFilter;
    const matchesLoc = locationFilter === 'all' || i.locationId === locationFilter;
    
    return matchesSearch && matchesCat && matchesLoc;
  });

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id!));
    }
  };

  const toggleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 border-red-200' };
    if (item.lowStockThreshold && item.quantity <= item.lowStockThreshold) return { label: 'Low Stock', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-700 border-green-200' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Inventory</h1>
          <p className="text-muted-foreground">Manage bulk items and consumables.</p>
        </div>
        {profile?.role !== 'viewer' && (
          <Button disabled={isSubmitting} onClick={() => {
            setEditingItem(null);
            const firstCat = categories[0];
            setItemCategory(firstCat?.name || '');
            const validTypes = firstCat?.assetTypes?.filter((t: any) => !t.usage || t.usage === 'inventory' || t.usage === 'both') || [];
            const initialType = validTypes[0]?.name || '';
            setItemType(initialType);
            
            if (initialType && validTypes[0]) {
              const initialData: any = {};
              validTypes[0].customFields?.forEach((f: any) => {
                initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
              });
              setCustomFieldsData(initialData);
            } else {
              setCustomFieldsData({});
            }

            setIsAddOpen(true);
          }} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap bg-card/80 p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search items by name, code..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full bg-background/50 border-input hover:bg-background transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-background/50">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.filter(c => !c.usage || c.usage === 'inventory' || c.usage === 'both').map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[160px] bg-background/50">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id as string}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card/95 backdrop-blur-sm rounded-xl border border-border shadow-sm overflow-hidden">
        {selectedItems.length > 0 && (
          <div className="bg-gold-50 dark:bg-gold-900/20 border-b border-gold-200 dark:border-gold-800 p-3 flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm font-medium text-gold-800 dark:text-gold-200">
              {selectedItems.length} item(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="bg-card" onClick={() => window.open(`/print-labels?type=inventory&ids=${selectedItems.join(',')}`, '_blank')}>
                <Printer className="w-4 h-4 mr-2" /> Print QR Codes
              </Button>
            </div>
          </div>
        )}
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {profile?.role !== 'viewer' && (
                <TableHead className="w-[40px]">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                    checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Item</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={profile?.role !== 'viewer' ? 7 : 6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={profile?.role !== 'viewer' ? 7 : 6} className="text-center py-8 text-muted-foreground">No items found.</TableCell>
              </TableRow>
            ) : filteredItems.map(item => {
              const status = getStockStatus(item);
              return (
                <TableRow key={item.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setViewingItem(item)}>
                  {profile?.role !== 'viewer' && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                        checked={selectedItems.includes(item.id!)}
                        onChange={(e) => toggleSelectItem(item.id!, e as any)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                  </TableCell>
                  <TableCell>
                    {locations.find(l => l.id === item.locationId)?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <div>{item.category}</div>
                    {item.type && <div className="text-xs text-muted-foreground">{item.type}</div>}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {item.quantity}
                  </TableCell>
                  <TableCell>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", status.color)}>
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {profile?.role !== 'viewer' && (
                        <>
                          <Button variant="outline" size="sm" disabled={isSubmitting} onClick={(e) => {
                            e.stopPropagation();
                            setStockItem(item);
                            setStockAction('consume');
                            setStockQuantity(1);
                            setStockNotes('');
                            setIsStockOpen(true);
                          }} title="Consume Stock">
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" disabled={isSubmitting} onClick={(e) => {
                            e.stopPropagation();
                            setStockItem(item);
                            setStockAction('add');
                            setStockQuantity(1);
                            setStockNotes('');
                            setIsStockOpen(true);
                          }} title="Add Stock" className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" disabled={isSubmitting} onClick={(e) => { e.stopPropagation(); loadHistory(item); }} title="History">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="outline" size="icon" disabled={isSubmitting} onClick={(e) => { e.stopPropagation(); window.open(`/print-labels?type=inventory&ids=${item.id}`, '_blank'); }} title="Print QR Code">
                        <Printer className="w-4 h-4" />
                      </Button>
                      {(profile?.role === 'admin' || profile?.role === 'owner') && (
                        <Button variant="ghost" size="icon" disabled={isSubmitting} onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setItemCategory(item.category);
                          setItemType(item.type || '');
                          setCustomFieldsData(item.customData || {});
                          setIsAddOpen(true);
                        }} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Name</label>
                <Input name="name" required defaultValue={editingItem?.name} placeholder="e.g. Printer Paper A4" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Item/SKU Code</label>
                <Input name="itemCode" required defaultValue={editingItem?.itemCode} placeholder="P-A4-001" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={itemCategory} onValueChange={(val) => {
                  setItemCategory(val);
                  const selectedCat = categories.find(c => c.name === val);
                  const validTypes = selectedCat?.assetTypes?.filter(t => !t.usage || t.usage === 'inventory' || t.usage === 'both') || [];
                  const firstType = validTypes[0]?.name || '';
                  setItemType(firstType);

                  if (firstType && validTypes[0]) {
                    const initialData: any = {};
                    validTypes[0].customFields?.forEach((f: any) => {
                      initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
                    });
                    setCustomFieldsData(initialData);
                  } else {
                    setCustomFieldsData({});
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => !c.usage || c.usage === 'inventory' || c.usage === 'both').map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                {(() => {
                  const selectedCat = categories.find(c => c.name === itemCategory);
                  const validTypes = selectedCat?.assetTypes?.filter(t => !t.usage || t.usage === 'inventory' || t.usage === 'both') || [];
                  if (validTypes.length > 0) {
                    return (
                      <Select value={itemType} onValueChange={(val) => {
                        setItemType(val);
                        const typeDef = validTypes.find((t: any) => t.name === val);
                        if (typeDef) {
                          const initialData: any = {};
                          typeDef.customFields?.forEach((f: any) => {
                            initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
                          });
                          setCustomFieldsData(initialData);
                        } else {
                          setCustomFieldsData({});
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {validTypes.map(t => (
                            <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  return (
                    <Input disabled value="No types available" className="text-muted-foreground bg-muted" />
                  );
                })()}
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Location</label>
                <Select name="locationId" defaultValue={editingItem?.locationId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id as string}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!editingItem && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Initial Quantity</label>
                  <Input name="quantity" type="number" required min="0" defaultValue="0" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Low Stock Threshold</label>
                <Input name="lowStockThreshold" type="number" min="0" defaultValue={editingItem?.lowStockThreshold || 5} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Unit Cost (Optional)</label>
                <Input name="purchaseCost" type="number" min="0" step="0.01" defaultValue={editingItem?.purchaseCost} />
              </div>
            </div>

            {(() => {
              const selectedCat = categories.find(c => c.name === itemCategory);
              const typeDef = selectedCat?.assetTypes?.find(t => t.name === itemType);
              if (!typeDef || !typeDef.customFields || typeDef.customFields.length === 0) return null;
              
              return (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold border-b pb-1">Additional Specifications ({itemType})</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {typeDef.customFields.map((f: any) => {
                      const value = customFieldsData[f.name] || '';
                      const onChange = (val: any) => setCustomFieldsData({ ...customFieldsData, [f.name]: val });

                      return (
                        <div key={f.name} className="space-y-2">
                          <label className="text-sm font-medium">
                            {f.name} {f.required && <span className="text-red-500 font-bold ml-0.5">*</span>}
                          </label>
                          {f.type === 'text' && (
                            <Input 
                              value={value} 
                              onChange={(e) => onChange(e.target.value)}
                              required={f.required}
                            />
                          )}
                          {f.type === 'number' && (
                            <Input 
                              type="number" 
                              value={value} 
                              onChange={(e) => onChange(e.target.value)}
                              required={f.required}
                            />
                          )}
                          {f.type === 'boolean' && (
                            <Select value={value ? 'yes' : 'no'} onValueChange={(v) => onChange(v === 'yes')}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {f.type === 'date' && (
                            <Input 
                              type="date" 
                              value={value} 
                              onChange={(e) => onChange(e.target.value)}
                              required={f.required}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <DialogFooter className="pt-4 flex justify-between sm:justify-between items-center">
              {editingItem && (profile?.role === 'admin' || profile?.role === 'owner') ? (
                <Button type="button" variant="destructive" onClick={() => handleDelete(editingItem.id!, editingItem.name)} disabled={isSubmitting}>
                  <Trash2 className="w-4 h-4 mr-2" /> {isSubmitting ? 'Deleting...' : 'Delete'}
                </Button>
              ) : <span></span>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Update Modal */}
      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {stockAction === 'add' ? 'Add Stock' : 'Consume Stock'}
            </DialogTitle>
            <DialogDescription>
              {stockItem?.name} ({stockItem?.itemCode})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStockUpdate} className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="text-sm text-muted-foreground">Current Available</div>
              <div className="font-mono text-lg font-bold">{stockItem?.quantity}</div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity to {stockAction}</label>
              <Input 
                type="number" 
                required 
                min="1" 
                max={stockAction === 'consume' ? stockItem?.quantity : undefined}
                value={stockQuantity} 
                onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Input 
                placeholder={stockAction === 'consume' ? 'e.g., Used for Marketing Event' : 'e.g., PO #1234'}
                value={stockNotes}
                onChange={(e) => setStockNotes(e.target.value)}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStockOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} variant={stockAction === 'add' ? 'default' : 'destructive'} className={stockAction === 'add' ? "bg-green-600 hover:bg-green-700" : ""}>
                {isSubmitting ? 'Processing...' : (stockAction === 'add' ? 'Add Stock' : 'Confirm Consumption')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Stock History: {historyItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1 min-h-0 pt-4">
            {loadingHistory ? (
              <div className="text-center py-4">Loading history...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No history found.</div>
            ) : (
              <div className="space-y-4">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-start border-b border-border/50 pb-4 last:border-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-semibold uppercase",
                          tx.action === 'add' ? "bg-green-100 text-green-700" : 
                          tx.action === 'consume' ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {tx.action}
                        </span>
                        <span className="font-semibold">{Math.abs(tx.quantity)} units</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Stock went from {tx.previousQuantity} to {tx.newQuantity}
                      </div>
                      {tx.notes && <div className="text-sm italic mt-1 text-muted-foreground">"{tx.notes}"</div>}
                    </div>
                    <div className="text-xs text-muted-foreground text-right shrink-0">
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Item Details {viewingItem?.itemCode ? `- ${viewingItem.itemCode}` : ''}</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="details">General</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="qrcode">QR Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">Name</p><p className="font-medium">{viewingItem.name}</p></div>
                  <div><p className="text-sm text-muted-foreground">Item/SKU Code</p><p className="font-medium">{viewingItem.itemCode || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Category</p><p className="font-medium">{viewingItem.category}</p></div>
                  <div><p className="text-sm text-muted-foreground">Type</p><p className="font-medium">{viewingItem.type || '-'}</p></div>
                  {viewingItem.customData && Object.keys(viewingItem.customData).length > 0 && (
                    Object.entries(viewingItem.customData).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-sm text-muted-foreground">{key}</p>
                        <p className="font-medium">{value === true ? 'Yes' : value === false ? 'No' : String(value || '-')}</p>
                      </div>
                    ))
                  )}
                  <div><p className="text-sm text-muted-foreground">Quantity</p><p className="font-medium">{viewingItem.quantity || 0}</p></div>
                  <div><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{locations.find(l => l.id === viewingItem.locationId)?.name || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Unit Cost</p><p className="font-medium">{viewingItem.purchaseCost ? formatCurrency(viewingItem.purchaseCost) : '-'}</p></div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4 space-y-4">
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => loadHistory(viewingItem)}>
                    <Clock className="w-4 h-4 mr-2" />
                    View Stock History
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="qrcode" className="mt-4 space-y-4">
                <div className="flex flex-col items-center justify-center space-y-6 py-6 border rounded-lg bg-muted/20">
                  <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <QRCodeSVG 
                      value={`${window.location.origin}/inventory?id=${viewingItem.id}`}
                      size={200}
                      level="Q"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-lg">{organization?.name}</p>
                    {viewingItem.itemCode && <p className="text-muted-foreground font-mono">{viewingItem.itemCode}</p>}
                  </div>
                  <Button onClick={() => window.open(`/print-labels?type=inventory&ids=${viewingItem.id}`, '_blank')}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Label
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
