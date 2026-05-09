import React, { useEffect, useState } from 'react';
import { Plus, Trash2, MapPin, Tag, Truck, X, ChevronRight, Settings2, Save, ArrowLeft, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { useActionManager } from '../lib/actionManager';
import { AssetCategory, AssetType, CustomFieldDefinition } from '../lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';

function CategoryAssetCount({ orgId, categoryName }: { orgId?: string, categoryName: string }) {
  const [count, setCount] = useState<number | null>(null);
  
  useEffect(() => {
    if (!orgId) return;
    const fetchCount = async () => {
      try {
        const q = query(
          collection(db, 'assets'), 
          where('orgId', '==', orgId),
          where('category', '==', categoryName)
        );
        const snapshot = await getCountFromServer(q);
        setCount(snapshot.data().count);
      } catch (e) {
        console.error("Failed to fetch category count:", e);
      }
    };
    fetchCount();
  }, [orgId, categoryName]);

  if (count === null) return null;
  return <span className="text-xs font-normal text-muted-foreground ml-2">({count} assets)</span>;
}

function TypeAssetCount({ orgId, categoryName, typeName }: { orgId?: string, categoryName: string, typeName: string }) {
  const [count, setCount] = useState<number | null>(null);
  
  useEffect(() => {
    if (!orgId) return;
    const fetchCount = async () => {
      try {
        const q = query(
          collection(db, 'assets'), 
          where('orgId', '==', orgId),
          where('category', '==', categoryName),
          where('type', '==', typeName)
        );
        const snapshot = await getCountFromServer(q);
        setCount(snapshot.data().count);
      } catch (e) {
        console.error("Failed to fetch type count:", e);
      }
    };
    fetchCount();
  }, [orgId, categoryName, typeName]);

  if (count === null) return null;
  return <span className="ml-1 opacity-70">({count})</span>;
}

type ConfigType = 'asset_categories' | 'locations' | 'vendors';

interface ConfigItem {
  id?: string;
  name: string;
  orgId: string;
  types?: string[]; // Legacy
  assetTypes?: AssetType[]; // New
}

export default function AssetConfiguration() {
  const { organization } = useAuth();
  const [activeTab, setActiveTab] = useState<ConfigType>('asset_categories');
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCategoryUsage, setNewCategoryUsage] = useState<'asset' | 'inventory' | 'both'>('asset');
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [newName, setNewName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationCity, setNewLocationCity] = useState('');
  const [newLocationDistrict, setNewLocationDistrict] = useState('');
  const [newLocationState, setNewLocationState] = useState('');
  const [newLocationCountry, setNewLocationCountry] = useState('');
  const [newLocationPinCode, setNewLocationPinCode] = useState('');
  const [newLocationDepartments, setNewLocationDepartments] = useState('');
  const [newVendorCode, setNewVendorCode] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [newVendorBankName, setNewVendorBankName] = useState('');
  const [newVendorAccountName, setNewVendorAccountName] = useState('');
  const [newVendorAccountNumber, setNewVendorAccountNumber] = useState('');
  const [newVendorIfscCode, setNewVendorIfscCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: ConfigType; id: string; name?: string; itemData?: any } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionManager = useActionManager();

  const loadItems = async (type: ConfigType) => {
    setLoading(true);
    try {
      const res = await api.list(type);
      setItems(res as ConfigItem[] || []);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization?.id) {
      loadItems(activeTab);
    }
  }, [activeTab, organization?.id]);

  const handleAdd = async () => {
    if (!newName.trim() || isSubmitting) return;
    if (!organization?.id) {
      toast.error('No organization context.');
      return;
    }

    if (activeTab === 'vendors' && newVendorAccountNumber.trim()) {
      if (!/^[a-zA-Z0-9]+$/.test(newVendorAccountNumber.trim())) {
        toast.error('Account number must not contain special characters or spaces');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const data = {
        name: newName.trim(), 
        orgId: organization.id,
        ...(activeTab === 'asset_categories' ? { assetTypes: [], usage: newCategoryUsage } : {}),
        ...(activeTab === 'locations' ? { 
          address: newLocationAddress.trim(), 
          city: newLocationCity.trim(),
          district: newLocationDistrict.trim(),
          state: newLocationState.trim(),
          country: newLocationCountry.trim(),
          pinCode: newLocationPinCode.trim(), 
          departments: newLocationDepartments.split(',').map(d => d.trim()).filter(d => !!d) 
        } : {}),
        ...(activeTab === 'vendors' ? { 
          vendorCode: newVendorCode.trim(), 
          phoneNumber: newVendorPhone.trim(), 
          emailAddress: newVendorEmail.trim(), 
          address: newVendorAddress.trim(),
          bankName: newVendorBankName.trim(),
          accountName: newVendorAccountName.trim(),
          accountNumber: newVendorAccountNumber.trim(),
          ifscCode: newVendorIfscCode.trim() 
        } : {})
      };

      if (editingItem && editingItem.id) {
        await actionManager.update(activeTab, editingItem.id, data, editingItem, activeTab.slice(0, -1).replace('_', ' ') + ' updated successfully');
      } else {
        await actionManager.create(activeTab, { ...data, createdAt: new Date().toISOString() }, activeTab.slice(0, -1).replace('_', ' ') + ' added successfully');
      }

      setNewName('');
      setNewLocationAddress('');
      setNewLocationCity('');
      setNewLocationDistrict('');
      setNewLocationState('');
      setNewLocationCountry('');
      setNewLocationPinCode('');
      setNewLocationDepartments('');
      setNewVendorCode('');
      setNewVendorPhone('');
      setNewVendorEmail('');
      setNewVendorAddress('');
      setNewVendorBankName('');
      setNewVendorAccountName('');
      setNewVendorAccountNumber('');
      setNewVendorIfscCode('');
      setEditingItem(null);
      setIsAddOpen(false);
      loadItems(activeTab);
    } catch (error: any) {
      toast.error(editingItem ? 'Failed to update item' : 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (item: ConfigItem) => {
    setEditingItem(item);
    setNewName(item.name);
    if (activeTab === 'asset_categories') {
      setNewCategoryUsage((item as AssetCategory).usage || 'asset');
    }
    if (activeTab === 'locations') {
      setNewLocationAddress((item as any).address || '');
      setNewLocationCity((item as any).city || '');
      setNewLocationDistrict((item as any).district || '');
      setNewLocationState((item as any).state || '');
      setNewLocationCountry((item as any).country || '');
      setNewLocationPinCode((item as any).pinCode || '');
      setNewLocationDepartments(((item as any).departments || []).join(', '));
    }
    if (activeTab === 'vendors') {
      setNewVendorCode((item as any).vendorCode || '');
      setNewVendorPhone((item as any).phoneNumber || '');
      setNewVendorEmail((item as any).emailAddress || '');
      setNewVendorAddress((item as any).address || '');
      setNewVendorBankName((item as any).bankName || '');
      setNewVendorAccountName((item as any).accountName || '');
      setNewVendorAccountNumber((item as any).accountNumber || '');
      setNewVendorIfscCode((item as any).ifscCode || '');
    }
    setIsAddOpen(true);
  };

  const handleDeleteClick = async (type: ConfigType, id: string) => {
    if (isSubmitting) return;

    const itemToDelete = items.find(i => i.id === id);
    if (type === 'asset_categories') {
      if (itemToDelete && organization?.id) {
        try {
          const q = query(
            collection(db, 'assets'), 
            where('orgId', '==', organization.id), 
            where('category', '==', itemToDelete.name)
          );
          const snapshot = await getCountFromServer(q);
          const count = snapshot.data().count;
          if (count > 0) {
            toast.error(`Cannot delete category "${itemToDelete.name}". It is currently assigned to ${count} asset(s).`);
            return;
          }
        } catch (e) {
          toast.error("Failed to check for existing assets");
          return;
        }
      }
    }
    setDeleteConfirmation({ type, id, name: itemToDelete?.name, itemData: itemToDelete });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation || isSubmitting) return;
    setIsSubmitting(true);
    setIsDeleting(true);
    try {
      if (deleteConfirmation.itemData) {
        await actionManager.delete(deleteConfirmation.type, deleteConfirmation.id, deleteConfirmation.itemData, 'Item deleted successfully');
      } else {
        await api.delete(deleteConfirmation.type, deleteConfirmation.id);
        toast.success('Item deleted successfully');
      }
      loadItems(deleteConfirmation.type);
      setDeleteConfirmation(null);
    } catch (error: any) {
      console.error('Delete failed:', error);
      let errorMsg = 'Failed to delete item';
      try {
        const firestoreError = JSON.parse(error.message);
        errorMsg = firestoreError.error || errorMsg;
      } catch (e) {
        errorMsg = error.message || errorMsg;
      }
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
      setIsSubmitting(false);
    }
  };

  if (selectedCategory && activeTab === 'asset_categories') {
    return (
      <CategoryDetailView 
        category={selectedCategory} 
        onBack={() => {
          setSelectedCategory(null);
          loadItems('asset_categories');
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Asset Configuration</h1>
          <p className="text-muted-foreground">Manage categories, locations, and vendors for your assets.</p>
        </div>
        <Button onClick={() => {
          setEditingItem(null);
          setNewName('');
          setNewLocationAddress('');
          setNewLocationCity('');
          setNewLocationDistrict('');
          setNewLocationState('');
          setNewLocationCountry('');
          setNewLocationPinCode('');
          setNewLocationDepartments('');
          setNewVendorCode('');
          setNewVendorPhone('');
          setNewVendorEmail('');
          setNewVendorAddress('');
          setNewVendorBankName('');
          setNewVendorAccountName('');
          setNewVendorAccountNumber('');
          setNewVendorIfscCode('');
          setIsAddOpen(true);
        }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Add New {activeTab === 'asset_categories' ? 'Category' : activeTab === 'locations' ? 'Location' : 'Vendor'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as ConfigType)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="asset_categories" className="gap-2"><Tag className="w-4 h-4" /> Categories</TabsTrigger>
          <TabsTrigger value="locations" className="gap-2"><MapPin className="w-4 h-4" /> Locations</TabsTrigger>
          <TabsTrigger value="vendors" className="gap-2"><Truck className="w-4 h-4" /> Vendors</TabsTrigger>
        </TabsList>

        {['asset_categories', 'locations', 'vendors'].map((type) => (
          <TabsContent key={type} value={type} className="mt-6">
            <div className="bg-card/95 backdrop-blur-sm rounded-xl border border-border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="font-semibold">Name</TableHead>
                    {type === 'asset_categories' && <TableHead className="font-semibold">Asset Types</TableHead>}
                    {type === 'locations' && (
                      <>
                        <TableHead className="font-semibold">Address</TableHead>
                        <TableHead className="font-semibold">City</TableHead>
                        <TableHead className="font-semibold">State</TableHead>
                        <TableHead className="font-semibold">Departments</TableHead>
                      </>
                    )}
                    {type === 'vendors' && (
                      <>
                        <TableHead className="font-semibold">Vendor Code</TableHead>
                        <TableHead className="font-semibold">Phone</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Address</TableHead>
                      </>
                    )}
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={type === 'asset_categories' ? 3 : type === 'locations' ? 5 : type === 'vendors' ? 6 : 2} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={type === 'asset_categories' ? 3 : type === 'locations' ? 5 : type === 'vendors' ? 6 : 2} className="text-center py-8 text-muted-foreground">No items found.</TableCell>
                    </TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50 transition-colors group">
                      <TableCell className="font-medium text-foreground">
                        {type === 'asset_categories' ? (
                          <div className="flex items-center">
                            <button 
                              onClick={() => setSelectedCategory(item as AssetCategory)}
                              className="flex items-center gap-2 text-primary hover:underline font-semibold"
                            >
                              {item.name}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                            <CategoryAssetCount orgId={organization?.id} categoryName={item.name} />
                          </div>
                        ) : item.name}
                      </TableCell>
                      {type === 'asset_categories' && (
                        <TableCell>
                          <div className="flex flex-wrap gap-2 items-center">
                            {(item as AssetCategory).assetTypes?.map(t => (
                              <Badge key={t.name} variant="secondary">
                                {t.name}
                                <TypeAssetCount orgId={organization?.id} categoryName={item.name} typeName={t.name} />
                              </Badge>
                            ))}
                            {(!(item as AssetCategory).assetTypes || (item as AssetCategory).assetTypes?.length === 0) && (
                              <span className="text-xs text-muted-foreground italic">No types defined</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {type === 'locations' && (
                        <>
                          <TableCell className="text-muted-foreground">{[
                            (item as any).address,
                            (item as any).pinCode
                          ].filter(Boolean).join(', ') || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{(item as any).city || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{(item as any).state || '-'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {((item as any).departments || []).map((d: string) => (
                                <Badge key={d} variant="outline" className="bg-blue-50/50 text-blue-700 hover:bg-blue-50/80 border-blue-200 font-normal">
                                  {d}
                                </Badge>
                              ))}
                              {(!(item as any).departments || (item as any).departments.length === 0) && (
                                <span className="text-xs text-muted-foreground italic">-</span>
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                      {type === 'vendors' && (
                        <>
                          <TableCell className="text-muted-foreground">{(item as any).vendorCode || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{(item as any).phoneNumber || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{(item as any).emailAddress || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{(item as any).address || '-'}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                           {type === 'asset_categories' && (
                             <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(item as AssetCategory)}>
                               <Settings2 className="w-4 h-4" />
                             </Button>
                           )}
                           {(type === 'locations' || type === 'vendors') && (
                             <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                               <Edit2 className="w-4 h-4 text-blue-600 hover:text-blue-700" />
                             </Button>
                           )}
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => item.id && handleDeleteClick(type as ConfigType, item.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[600px] gap-0">
          <DialogHeader className="pb-4">
            <DialogTitle>{editingItem ? 'Edit' : 'Add New'} {activeTab.replace('_', ' ').replace('asset ', '')}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4 overflow-y-auto min-h-0 flex-1 px-1">
            <div className="space-y-2">
              <label className="text-sm font-medium capitalize">Name</label>
              <Input 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder={`Enter name for new ${activeTab.replace('_', ' ')}`}
                onKeyDown={(e) => e.key === 'Enter' && activeTab !== 'locations' && handleAdd()}
              />
            </div>
            {activeTab === 'asset_categories' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Category Usage</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newCategoryUsage}
                  onChange={(e) => setNewCategoryUsage(e.target.value as 'asset' | 'inventory' | 'both')}
                >
                  <option value="both">Both (Assets & Inventory)</option>
                  <option value="asset">Assets Only</option>
                  <option value="inventory">Inventory Only</option>
                </select>
              </div>
            )}
            {activeTab === 'locations' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address Line 1</label>
                  <Input 
                    value={newLocationAddress} 
                    onChange={(e) => setNewLocationAddress(e.target.value)} 
                    placeholder="Enter street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input 
                      value={newLocationCity} 
                      onChange={(e) => setNewLocationCity(e.target.value)} 
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">District</label>
                    <Input 
                      value={newLocationDistrict} 
                      onChange={(e) => setNewLocationDistrict(e.target.value)} 
                      placeholder="Enter district"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <Input 
                      value={newLocationState} 
                      onChange={(e) => setNewLocationState(e.target.value)} 
                      placeholder="Enter state"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Input 
                      value={newLocationCountry} 
                      onChange={(e) => setNewLocationCountry(e.target.value)} 
                      placeholder="Enter country"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pin Code</label>
                  <Input 
                    value={newLocationPinCode} 
                    onChange={(e) => setNewLocationPinCode(e.target.value)} 
                    placeholder="Enter pin code"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Departments (Comma Separated)</label>
                  <Input 
                    value={newLocationDepartments} 
                    onChange={(e) => setNewLocationDepartments(e.target.value)} 
                    placeholder="e.g. IT, HR, Marketing"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
              </>
            )}
            {activeTab === 'vendors' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vendor Code</label>
                  <Input 
                    value={newVendorCode} 
                    onChange={(e) => setNewVendorCode(e.target.value)} 
                    placeholder="Enter vendor code"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input 
                    value={newVendorPhone} 
                    onChange={(e) => setNewVendorPhone(e.target.value)} 
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input 
                    type="email"
                    value={newVendorEmail} 
                    onChange={(e) => setNewVendorEmail(e.target.value)} 
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input 
                    value={newVendorAddress} 
                    onChange={(e) => setNewVendorAddress(e.target.value)} 
                    placeholder="Enter physical address"
                  />
                </div>
                
                <div className="space-y-3 pt-4 border-t border-border mt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-sm font-medium">Bank Name</label>
                       <Input value={newVendorBankName} onChange={(e) => setNewVendorBankName(e.target.value)} placeholder="e.g. JPMorgan Chase" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-medium">Account Name</label>
                       <Input value={newVendorAccountName} onChange={(e) => setNewVendorAccountName(e.target.value)} placeholder="e.g. Acme Corp" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-medium">Account Number</label>
                       <Input value={newVendorAccountNumber} onChange={(e) => setNewVendorAccountNumber(e.target.value)} placeholder="Enter account number" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-medium">IFSC / Routing Code</label>
                       <Input value={newVendorIfscCode} onChange={(e) => setNewVendorIfscCode(e.target.value)} placeholder="Enter routing code" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="pt-4 mt-2 border-t border-border/40">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground">{editingItem ? 'Save Changes' : 'Add Item'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete the {deleteConfirmation?.type === 'asset_categories' ? 'category' : deleteConfirmation?.type.slice(0,-1)} <strong>"{deleteConfirmation?.name}"</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmation(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryDetailView({ category, onBack }: { category: AssetCategory, onBack: () => void }) {
  const [cat, setCat] = useState<AssetCategory>(category);
  const [isSaving, setIsSaving] = useState(false);
  const [editingType, setEditingType] = useState<AssetType | null>(null);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);

  const [deleteTypeConfirmation, setDeleteTypeConfirmation] = useState<string | null>(null);
  const actionManager = useActionManager();

  const handleSaveCategory = async (updatedCat: AssetCategory) => {
    if (!updatedCat.id) return;
    setIsSaving(true);
    try {
      await actionManager.update('asset_categories', updatedCat.id, { 
        name: updatedCat.name,
        usage: updatedCat.usage || 'asset',
        targetStock: updatedCat.targetStock || null,
        assetTypes: updatedCat.assetTypes || []
      }, category, 'Category updated successfully');
    } catch (error) {
      toast.error('Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveType = async (type: AssetType) => {
    if (isSaving) return;
    const types = [...(cat.assetTypes || [])];
    const index = types.findIndex(t => t.name === (editingType?.name || type.name));
    
    if (index > -1) {
      types[index] = type;
    } else {
      types.push(type);
    }

    const updatedCat = { ...cat, assetTypes: types };
    setCat(updatedCat);
    await handleSaveCategory(updatedCat);
    
    setIsTypeDialogOpen(false);
    setEditingType(null);
  };

  const removeTypeClick = async (typeName: string) => {
    try {
      const q = query(
        collection(db, 'assets'), 
        where('orgId', '==', cat.orgId), 
        where('category', '==', cat.name),
        where('type', '==', typeName)
      );
      const snapshot = await getCountFromServer(q);
      const count = snapshot.data().count;
      if (count > 0) {
        toast.error(`Cannot remove type "${typeName}". It is currently assigned to ${count} asset(s).`);
        return;
      }
    } catch (e) {
      toast.error('Failed to check for existing assets');
      return;
    }
    setDeleteTypeConfirmation(typeName);
  };

  const confirmRemoveType = async () => {
    if (!deleteTypeConfirmation || isSaving) return;
    const typeName = deleteTypeConfirmation;
    const updatedCat = {
      ...cat,
      assetTypes: (cat.assetTypes || []).filter(t => t.name !== typeName)
    };
    setCat(updatedCat);
    await handleSaveCategory(updatedCat);
    setDeleteTypeConfirmation(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cat.name}</h1>
          <p className="text-muted-foreground">Detailed configuration for this category.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>Back to config</Button>
          <Button onClick={() => handleSaveCategory(cat)} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Category Info</CardTitle>
            <CardDescription>Basic settings for the category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category Name</label>
                <Input 
                  value={cat.name}
                  onChange={(e) => setCat({ ...cat, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category Usage</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={cat.usage || 'asset'}
                  onChange={(e) => setCat({ ...cat, usage: e.target.value as 'asset' | 'inventory' | 'both' })}
                >
                  <option value="both">Both (Assets & Inventory)</option>
                  <option value="asset">Assets Only</option>
                  <option value="inventory">Inventory Only</option>
                </select>
              </div>
              {(cat.usage === 'inventory' || cat.usage === 'both') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Average / Target Stock</label>
                  <Input 
                    type="number"
                    placeholder="E.g. 50"
                    value={cat.targetStock || ''}
                    onChange={(e) => setCat({ ...cat, targetStock: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                  <p className="text-xs text-muted-foreground">Used to calculate stock health progress bars on the dashboard.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Asset Types</CardTitle>
              <CardDescription>Define specific types and their custom fields within this category.</CardDescription>
            </div>
            <Button size="sm" onClick={() => {
              setEditingType(null);
              setIsTypeDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Type
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type Name</TableHead>
                  <TableHead>Custom Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!cat.assetTypes || cat.assetTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No types defined yet.</TableCell>
                  </TableRow>
                ) : cat.assetTypes.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-semibold">
                      <div className="flex items-center">
                        {t.name}
                        <TypeAssetCount orgId={cat.orgId} categoryName={cat.name} typeName={t.name} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.customFields?.map(f => (
                          <Badge key={f.name} variant="outline" className="text-[10px]">
                            {f.name} ({f.type})
                          </Badge>
                        ))}
                        {(!t.customFields || t.customFields.length === 0) && '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingType(t);
                          setIsTypeDialogOpen(true);
                        }}>
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeTypeClick(t.name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AssetTypeDialog 
        open={isTypeDialogOpen}
        onOpenChange={setIsTypeDialogOpen}
        assetType={editingType}
        onSave={handleSaveType}
        categoryUsage={cat.usage || 'asset'}
      />

      <Dialog open={!!deleteTypeConfirmation} onOpenChange={(open) => !open && setDeleteTypeConfirmation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to remove type <strong>"{deleteTypeConfirmation}"</strong>?</p>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTypeConfirmation(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveType}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetTypeDialog({ open, onOpenChange, assetType, onSave, categoryUsage = 'asset' }: { 
  open: boolean, 
  onOpenChange: (o: boolean) => void,
  assetType: AssetType | null,
  onSave: (t: AssetType) => void,
  categoryUsage?: 'asset' | 'inventory' | 'both'
}) {
  const [name, setName] = useState('');
  const [usage, setUsage] = useState<'asset' | 'inventory' | 'both'>('asset');
  const [includeSerialNumber, setIncludeSerialNumber] = useState(true);
  const [includeAssetTag, setIncludeAssetTag] = useState(true);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldDefinition['type']>('text');

  useEffect(() => {
    if (assetType) {
      setName(assetType.name);
      setUsage(assetType.usage || 'asset');
      setIncludeSerialNumber(assetType.includeSerialNumber ?? true);
      setIncludeAssetTag(assetType.includeAssetTag ?? true);
      setFields(assetType.customFields || []);
    } else {
      setName('');
      setUsage(categoryUsage === 'both' ? 'asset' : categoryUsage);
      setIncludeSerialNumber(true);
      setIncludeAssetTag(true);
      setFields([]);
    }
  }, [assetType, open, categoryUsage]);

  const addField = () => {
    if (!newFieldName.trim()) return;
    if (fields.some(f => f.name.toLowerCase() === newFieldName.toLowerCase())) {
      toast.error('Field name already exists');
      return;
    }
    setFields([...fields, { name: newFieldName.trim(), type: newFieldType, required: false }]);
    setNewFieldName('');
  };

  const removeField = (fieldName: string) => {
    setFields(fields.filter(f => f.name !== fieldName));
  };

  const updateField = (index: number, updates: Partial<CustomFieldDefinition>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{assetType ? 'Edit Asset Type' : 'Add Asset Type'}</DialogTitle>
          <DialogDescription>Define a specific model or type and its unique properties.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type Name</label>
            <Input 
              placeholder="e.g. Dell Latitude 5420" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          {categoryUsage === 'both' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Type Usage</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={usage}
                onChange={(e) => setUsage(e.target.value as 'asset' | 'inventory' | 'both')}
              >
                <option value="both">Both (Assets & Inventory)</option>
                <option value="asset">Assets Only</option>
                <option value="inventory">Inventory Only</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Serial Number</label>
                <div className="text-[10px] text-muted-foreground">Include field</div>
              </div>
              <Switch checked={includeSerialNumber} onCheckedChange={setIncludeSerialNumber} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Asset Tag</label>
                <div className="text-[10px] text-muted-foreground">Include field</div>
              </div>
              <Switch checked={includeAssetTag} onCheckedChange={setIncludeAssetTag} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Custom Fields</label>
              <Badge variant="secondary">{fields.length} Fields</Badge>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {fields.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border group">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{f.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Req?</span>
                      <Switch 
                        checked={f.required} 
                        onCheckedChange={(checked) => updateField(idx, { required: checked })}
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 opacity-0 group-hover:opacity-100" onClick={() => removeField(f.name)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-4">No custom fields defined for this type.</p>
              )}
            </div>

            <div className="flex gap-2 items-end pt-2 border-t">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Field Name</label>
                <Input 
                  placeholder="CPU, RAM, IMEI..." 
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-[100px] space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Type</label>
                <Select value={newFieldType} onValueChange={(val: any) => setNewFieldType(val)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="boolean">Yes/No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={addField}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ name, usage, customFields: fields, includeSerialNumber, includeAssetTag })} disabled={!name.trim()}>
            {assetType ? 'Update Type' : 'Add Type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
