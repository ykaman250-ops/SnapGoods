import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy, where, limit } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  History,
  Wrench,
  UserPlus,
  UserMinus,
  Printer,
  Building2,
  RefreshCw
} from 'lucide-react';
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
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { QRCodeSVG } from 'qrcode.react';
import { printTable } from '../lib/print';
import { useDateFormatter } from '../lib/useDateFormatter';
import { useCurrencyFormatter } from '../lib/useCurrencyFormatter';
import { toast } from 'sonner';
import { calculateDepreciation } from '../lib/depreciation';
import { assetService } from '../lib/assetService';
import { AssetScanner } from '../components/AssetScanner';
import { ScanLine } from 'lucide-react';
import type { Asset, AssetHistory, MaintenanceLog, Employee, Vendor, Location, AssetCategory, AssetStatus, Assignment } from '../lib/types';

const STATUSES = ['available', 'assigned', 'repair', 'retired'];
const DEPRECIATION_METHODS = ['straight_line', 'wdv'];
const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Operations', 'Sales', 'Marketing', 'Legal'];

export default function Assets() {
  const { profile, organization } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlAssetId = searchParams.get('id');

  const formatDate = useDateFormatter();
  const formatCurrency = useCurrencyFormatter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assetCategory, setAssetCategory] = useState('');
  const [assetType, setAssetType] = useState('');
  const [assetLocationId, setAssetLocationId] = useState('');
  const [assetDepartment, setAssetDepartment] = useState('');
  const [assetVendorId, setAssetVendorId] = useState('');
  const [assetDepreciationMethod, setAssetDepreciationMethod] = useState<'straight_line' | 'wdv'>('straight_line');
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});
  
  useEffect(() => {
    if (categories.length > 0 && !assetCategory) {
      setAssetCategory(categories[0].name);
    }
  }, [categories]);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetHistory[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  
  // Assignment state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [assigneeType, setAssigneeType] = useState<'employee' | 'department'>('employee');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  
  // Unassign state
  const [isUnassignOpen, setIsUnassignOpen] = useState(false);
  const [unassigningAsset, setUnassigningAsset] = useState<Asset | null>(null);

  // Status change state
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusAsset, setStatusAsset] = useState<Asset | null>(null);
  const [newStatus, setNewStatus] = useState<AssetStatus>('available');

  // Bulk actions state
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkUnassignOpen, setIsBulkUnassignOpen] = useState(false);

  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadInitialData = async () => {
    try {
      const [empRes, venRes, locRes, catRes] = await Promise.all([
        api.list('employees'),
        api.list('vendors'),
        api.list('locations'),
        api.list('asset_categories')
      ]);
      setEmployees(empRes as Employee[] || []);
      setVendors(venRes as Vendor[] || []);
      setLocations(locRes as Location[] || []);
      
      const loadedCategories = catRes as AssetCategory[] || [];
      setCategories(loadedCategories);
      
      // Safety: set default category if not already set
      if (loadedCategories.length > 0 && !assetCategory) {
        setAssetCategory(loadedCategories[0].name);
      }
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast.error('Failed to load supporting data (employees, categories, etc.)');
    }
  };

  const loadAssets = async (isNextPage = false) => {
    setLoading(true);
    try {
      const { docs, lastDoc: newLast, hasMore: more } = await api.listPaginated(
         'assets', 
         [orderBy('createdAt', 'desc')], 
         50, 
         isNextPage ? lastDoc : undefined
      );
      
      if (isNextPage) {
         setAssets(prev => [...prev, ...(docs as Asset[])]);
      } else {
         setAssets(docs as Asset[]);
      }
      setLastDoc(newLast);
      setHasMore(more);
    } catch (error) {
      console.error('Failed to load assets', error);
      toast.error('Failed to load assets inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile || !organization) return;
    loadAssets();
    loadInitialData();
  }, [profile, organization]);

  useEffect(() => {
    async function loadUrlAsset() {
      if (urlAssetId && profile) {
        try {
          const doc = await api.get('assets', urlAssetId);
          if (doc) {
            setViewingAsset(doc as Asset);
          }
        } catch (error) {
          console.error("Failed to fetch asset from URL id", error);
        }
      }
    }
    loadUrlAsset();
  }, [urlAssetId, profile]);

  useEffect(() => {
    if (viewingAsset?.id) {
      // Load history and maintenance
      api.list('asset_history', [where('assetId', '==', viewingAsset.id), orderBy('timestamp', 'desc'), limit(10)])
        .then(res => setAssetHistory(res as AssetHistory[]));
      api.list('maintenance_logs', [where('assetId', '==', viewingAsset.id), orderBy('date', 'desc')])
        .then(res => setMaintenanceLogs(res as MaintenanceLog[]));
    }
  }, [viewingAsset]);

  const filteredAssets = assets.filter(a => {
    const searchLower = search.toLowerCase();
    const locName = locations.find(l => l.id === a.locationId)?.name?.toLowerCase() || '';
    const matchesSearch = (
      a.name?.toLowerCase().includes(searchLower) || 
      a.assetCode?.toLowerCase().includes(searchLower) ||
      a.serialNumber?.toLowerCase().includes(searchLower) ||
      a.category?.toLowerCase().includes(searchLower) ||
      a.type?.toLowerCase().includes(searchLower) ||
      locName.includes(searchLower)
    );
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    const matchesLocation = locationFilter === 'all' || a.locationId === locationFilter;
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
  });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isEditMaintenanceOpen, setIsEditMaintenanceOpen] = useState(false);
  const [maintenanceLogToEdit, setMaintenanceLogToEdit] = useState<MaintenanceLog | null>(null);
  const [isDeleteMaintenanceOpen, setIsDeleteMaintenanceOpen] = useState(false);
  const [maintenanceLogToDelete, setMaintenanceLogToDelete] = useState<string | null>(null);

  const handleScanResult = async (decodedText: string) => {
    try {
      const url = new URL(decodedText);
      const id = url.searchParams.get('id');
      if (id) {
        setIsScannerOpen(false);
        const asset = await api.get('assets', id);
        if (asset) {
          setViewingAsset(asset as Asset);
          toast.success('Asset scanned successfully');
        } else {
          toast.error('Asset not found');
        }
      } else {
        toast.error('Invalid QR code format');
      }
    } catch (e) {
      toast.error('Could not process scanned data');
    }
  };

  const [newMaintenanceLog, setNewMaintenanceLog] = useState<{
    type: 'service' | 'repair';
    date: string;
    cost: number | '';
    vendorId: string;
    notes: string;
  }>({
    type: 'service',
    date: new Date().toISOString().split('T')[0],
    cost: '',
    vendorId: '',
    notes: ''
  });

  const handleAddMaintenanceLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewingAsset || !organization) return;
    setIsSubmitting(true);
    try {
      const logData = {
        assetId: viewingAsset.id,
        orgId: organization.id,
        type: newMaintenanceLog.type,
        date: newMaintenanceLog.date,
        cost: Number(newMaintenanceLog.cost) || 0,
        vendorId: newMaintenanceLog.vendorId,
        notes: newMaintenanceLog.notes,
        timestamp: new Date().toISOString()
      };
      const logId = await api.create('maintenance_logs', logData);
      setMaintenanceLogs(prev => [{...logData, id: logId} as MaintenanceLog, ...prev]);
      setIsMaintenanceOpen(false);
      setNewMaintenanceLog({
        type: 'service',
        date: new Date().toISOString().split('T')[0],
        cost: '',
        vendorId: '',
        notes: ''
      });
      toast.success('Maintenance log added successfully');
    } catch (error) {
      toast.error('Failed to add maintenance log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMaintenanceLogClick = (log: MaintenanceLog) => {
    setMaintenanceLogToEdit(log);
    setIsEditMaintenanceOpen(true);
  };

  const handleEditMaintenanceLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!maintenanceLogToEdit || !maintenanceLogToEdit.id) return;
    setIsSubmitting(true);
    try {
      const updatedLog = {
        type: maintenanceLogToEdit.type,
        date: maintenanceLogToEdit.date,
        cost: Number(maintenanceLogToEdit.cost) || 0,
        vendorId: maintenanceLogToEdit.vendorId,
        notes: maintenanceLogToEdit.notes,
      };
      await api.update('maintenance_logs', maintenanceLogToEdit.id, updatedLog);
      
      setMaintenanceLogs(prev => prev.map(log => 
        log.id === maintenanceLogToEdit.id ? { ...log, ...updatedLog } : log
      ));
      
      setIsEditMaintenanceOpen(false);
      setMaintenanceLogToEdit(null);
      toast.success('Maintenance log updated successfully');
    } catch (error) {
      toast.error('Failed to update maintenance log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaintenanceLogClick = (id: string) => {
    setMaintenanceLogToDelete(id);
    setIsDeleteMaintenanceOpen(true);
  };

  const handleDeleteMaintenanceLog = async () => {
    if (!maintenanceLogToDelete) return;
    setIsSubmitting(true);
    try {
      await api.delete('maintenance_logs', maintenanceLogToDelete);
      setMaintenanceLogs(prev => prev.filter(log => log.id !== maintenanceLogToDelete));
      setIsDeleteMaintenanceOpen(false);
      setMaintenanceLogToDelete(null);
      toast.success('Maintenance log deleted successfully');
    } catch (error) {
      toast.error('Failed to delete maintenance log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setAssetToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!assetToDelete) return;
    setIsSubmitting(true);
    try {
      await api.delete('assets', assetToDelete);
      setAssets(prev => prev.filter(a => a.id !== assetToDelete));
      toast.success('Asset deleted successfully');
      setIsDeleteOpen(false);
      setAssetToDelete(null);
      setSelectedAssets(prev => prev.filter(id => id !== assetToDelete));
    } catch (error) {
      toast.error('Failed to delete asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    
    // Type conversions
    data.purchaseCost = parseFloat(data.purchaseCost || '0');
    data.usefulLifeYears = parseInt(data.usefulLifeYears || '0');
    data.salvageValue = parseFloat(data.salvageValue || '0');
    
    // Validation
    if (data.purchaseCost < 0) return toast.error('Purchase cost must be non-negative');
    if (data.usefulLifeYears <= 0) return toast.error('Useful life must be greater than zero');
    if (data.salvageValue > data.purchaseCost) return toast.error('Salvage value cannot exceed purchase cost');

    // Custom Fields Validation
    const selectedCat = categories.find(c => c.name === assetCategory);
    const typeDef = selectedCat?.assetTypes?.find(t => t.name === assetType);
    if (typeDef?.customFields) {
      for (const field of typeDef.customFields) {
        if (field.required) {
          const value = customFieldsData[field.name];
          if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
            toast.error(`${field.name} is required`);
            return;
          }
        }
      }
    }

    const finalData = {
      ...data,
      customData: customFieldsData,
      type: assetType || data.type,
      department: assetDepartment || '',
      depreciationMethod: assetDepreciationMethod
    };

    // Uniqueness checks
    const duplicateAssetCode = data.assetCode && assets.find(a => a.id !== editingAsset?.id && a.assetCode?.toLowerCase() === (data.assetCode as string).toLowerCase());
    if (duplicateAssetCode) {
      toast.error(`Asset Code "${data.assetCode}" is already in use.`);
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingAsset && editingAsset.id) {
        await assetService.updateAsset(editingAsset.id, finalData, profile!.orgId!, editingAsset);
        const updatedDoc = await api.get('assets', editingAsset.id);
        if (updatedDoc) setAssets(prev => prev.map(a => a.id === editingAsset.id ? (updatedDoc as Asset) : a));
        toast.success('Asset updated successfully');
      } else {
        const newId = await assetService.createAsset({ 
          ...finalData, 
          status: 'available',
          depreciationMethod: assetDepreciationMethod
        }, profile!.orgId!);
        
        if (typeof newId === 'string') {
          const newDoc = await api.get('assets', newId);
          if (newDoc) setAssets(prev => [newDoc as Asset, ...prev]);
        }
        toast.success('Asset created successfully');
      }
      setIsAddOpen(false);
      setEditingAsset(null);
    } catch (error) {
      toast.error('Failed to save asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (assigneeType === 'employee' && !selectedEmployee) return toast.error('Please select an employee');
    if (assigneeType === 'department' && !selectedDepartment) return toast.error('Please select a department');

    const formData = new FormData(e.currentTarget);
    const remarks = formData.get('remarks') as string;

    setIsSubmitting(true);
    try {
      if (!assigningAsset?.id) return;
      
      const updates = {
        status: 'assigned' as AssetStatus,
        assignedTo: assigneeType === 'employee' ? selectedEmployee : '' // department is tracked in assignment record
      };
      
      await assetService.updateAsset(assigningAsset.id, updates, profile!.orgId!, assigningAsset);

      // Create assignment record
      await api.create('assignments', {
        assetId: assigningAsset.id,
        assigneeType,
        ...(assigneeType === 'employee' ? { employeeId: selectedEmployee } : { department: selectedDepartment }),
        assignedAt: new Date().toISOString(),
        status: 'active',
        remarks: remarks || ''
      });

      const updatedDoc = await api.get('assets', assigningAsset.id);
      if (updatedDoc) setAssets(prev => prev.map(a => a.id === assigningAsset.id ? (updatedDoc as Asset) : a));
      toast.success('Asset assigned successfully');
      setIsAssignOpen(false);
      setAssigningAsset(null);
      setSelectedEmployee('');
      setSelectedDepartment('');
      setEmployeeSearch('');
    } catch (error) {
      toast.error('Failed to assign asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!statusAsset?.id) return;

    setIsSubmitting(true);
    try {
      await assetService.updateAsset(statusAsset.id, { status: newStatus }, profile!.orgId!, statusAsset);

      const updatedDoc = await api.get('assets', statusAsset.id);
      if (updatedDoc) setAssets(prev => prev.map(a => a.id === statusAsset.id ? (updatedDoc as Asset) : a));

      toast.success('Asset status updated successfully');
      setIsStatusOpen(false);
      setStatusAsset(null);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      available: 'bg-green-100 text-green-700 border-green-200',
      assigned: 'bg-gold-100 text-gold-700 border-gold-200',
      maintenance: 'bg-amber-100 text-amber-700 border-amber-200',
      'in repair': 'bg-orange-100 text-orange-700 border-orange-200',
      damaged: 'bg-red-100 text-red-700 border-red-200',
      retired: 'bg-muted/80 text-foreground/80 border-border',
      dead: 'bg-red-100 text-red-700 border-red-200',
    };
    return <Badge variant="outline" className={variants[status] || 'bg-muted/80 text-foreground/80'}>{status}</Badge>;
  };

  const toggleSelectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map(a => a.id));
    }
  };

  const toggleSelectAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAssets(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (assigneeType === 'employee' && !selectedEmployee) return toast.error('Please select an employee');
    if (assigneeType === 'department' && !selectedDepartment) return toast.error('Please select a department');

    const formData = new FormData(e.currentTarget);
    const remarks = formData.get('remarks') as string;

    setIsSubmitting(true);
    try {
      await Promise.all(selectedAssets.map(async (assetId) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset && asset.status !== 'assigned') {
          const updates = {
            status: 'assigned' as AssetStatus,
            assignedTo: assigneeType === 'employee' ? selectedEmployee : ''
          };
          await assetService.updateAsset(assetId, updates, profile!.orgId!, asset);
          
          await api.create('assignments', {
            assetId,
            assigneeType,
            ...(assigneeType === 'employee' ? { employeeId: selectedEmployee } : { department: selectedDepartment }),
            assignedAt: new Date().toISOString(),
            status: 'active',
            remarks: remarks || ''
          });

          const updatedDoc = await api.get('assets', assetId);
          if (updatedDoc) setAssets(prev => prev.map(a => a.id === assetId ? (updatedDoc as Asset) : a));
        }
      }));
      toast.success('Assets assigned successfully');
      setIsBulkAssignOpen(false);
      setSelectedAssets([]);
      setSelectedEmployee('');
      setSelectedDepartment('');
      setEmployeeSearch('');
    } catch (error) {
      toast.error('Failed to assign some assets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!unassigningAsset?.id) return;

    setIsSubmitting(true);
    try {
      const updates = {
        status: 'available' as AssetStatus,
        assignedTo: ''
      };
      
      await assetService.updateAsset(unassigningAsset.id, updates, profile!.orgId!, unassigningAsset);
      
      // Update assignment record to returned
      const assignments = (await api.list('assignments')) as Assignment[];
      const activeAssignment = assignments?.find(a => a.assetId === unassigningAsset.id && !a.returnedAt);
      if (activeAssignment && activeAssignment.id) {
        await api.update('assignments', activeAssignment.id, {
          returnedAt: new Date().toISOString(),
          status: 'returned'
        });
      }

      const updatedDoc = await api.get('assets', unassigningAsset.id);
      if (updatedDoc) setAssets(prev => prev.map(a => a.id === unassigningAsset.id ? (updatedDoc as Asset) : a));
      toast.success('Asset unassigned successfully');
      setIsUnassignOpen(false);
      setUnassigningAsset(null);
    } catch (error) {
      toast.error('Failed to unassign asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUnassign = async () => {
    setIsSubmitting(true);
    try {
      const allAssignments = (await api.list('assignments')) as Assignment[];
      await Promise.all(selectedAssets.map(async (assetId) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset && asset.status === 'assigned') {
          const updates = {
            status: 'available' as AssetStatus,
            assignedTo: ''
          };
          await assetService.updateAsset(assetId, updates, profile!.orgId!, asset);
          
          const activeAssignment = allAssignments?.find(a => a.assetId === assetId && !a.returnedAt);
          if (activeAssignment && activeAssignment.id) {
            await api.update('assignments', activeAssignment.id, {
              returnedAt: new Date().toISOString(),
              status: 'returned'
            });
          }

          const updatedDoc = await api.get('assets', assetId);
          if (updatedDoc) setAssets(prev => prev.map(a => a.id === assetId ? (updatedDoc as Asset) : a));
        }
      }));
      toast.success('Assets unassigned successfully');
      setIsBulkUnassignOpen(false);
      setSelectedAssets([]);
    } catch (error) {
      toast.error('Failed to unassign some assets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkStatusChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const remarks = formData.get('remarks') as string;

    setIsSubmitting(true);
    try {
      await Promise.all(selectedAssets.map(async (assetId) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset && asset.status !== 'assigned') {
          await assetService.updateAsset(assetId, { status: newStatus }, profile!.orgId!, asset);
          const updatedDoc = await api.get('assets', assetId);
          if (updatedDoc) setAssets(prev => prev.map(a => a.id === assetId ? (updatedDoc as Asset) : a));
        }
      }));
      toast.success('Asset statuses updated successfully');
      setIsBulkStatusOpen(false);
      setSelectedAssets([]);
    } catch (error) {
      toast.error('Failed to update some statuses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsSubmitting(true);
    try {
      const unassignedSelected = selectedAssets.filter(id => {
        const asset = assets.find(a => a.id === id);
        return asset && asset.status !== 'assigned';
      });

      if (unassignedSelected.length === 0) {
        toast.error('No unassigned assets selected to delete');
        setIsBulkDeleteOpen(false);
        setIsSubmitting(false);
        return;
      }

      await Promise.all(unassignedSelected.map(async (assetId) => {
        await api.delete('assets', assetId);
      }));
      
      if (unassignedSelected.length < selectedAssets.length) {
        toast.warning(`Deleted ${unassignedSelected.length} assets. Assigned assets were skipped.`);
      } else {
        toast.success('Assets deleted successfully');
      }
      
      setAssets(prev => prev.filter(a => !unassignedSelected.includes(a.id)));
      setIsBulkDeleteOpen(false);
      setSelectedAssets([]);
    } catch (error) {
      toast.error('Failed to delete some assets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSelected = () => {
    const selectedData = assets
      .filter(a => selectedAssets.includes(a.id))
      .map(asset => {
        let user = '-';
        if (asset.status === 'assigned' && asset.assignedTo) {
          const emp = employees.find(e => e.id === asset.assignedTo);
          user = emp ? emp.name : '-';
        }

        return [
          asset.assetCode || '-',
          asset.category,
          asset.name,
          user,
          asset.status
        ];
      });

    printTable(
      'Selected Assets',
      ['Asset Code', 'Category', 'Name', 'User', 'Status'],
      selectedData
    );
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Asset Inventory</h2>
          <p className="text-muted-foreground">Manage and track all hardware assets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadAssets()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
            <ScanLine className="w-4 h-4 mr-2" />
            Scan QR
          </Button>
          {profile?.role !== 'viewer' && (
            <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingAsset(null);
          setAssetCategory(categories[0]?.name || '');
          setAssetLocationId('');
          setAssetVendorId('');
        }
      }}>
        <DialogTrigger render={
          <Button onClick={() => {
          setEditingAsset(null);
          setCustomFieldsData({});
          setAssetLocationId('');
          setAssetDepartment('');
          setAssetVendorId('');
          if (categories.length > 0) {
            const firstCat = categories[0];
            setAssetCategory(firstCat.name);
            const firstType = firstCat.assetTypes?.[0]?.name || '';
            setAssetType(firstType);
            
            if (firstType && firstCat.assetTypes?.[0]) {
              const initialData: any = {};
              firstCat.assetTypes[0].customFields?.forEach(f => {
                initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
              });
              setCustomFieldsData(initialData);
            }
          } else {
            setAssetCategory('');
            setAssetType('');
          }
          setIsAddOpen(true);
        }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
        } />
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
          </DialogHeader>
          <form key={editingAsset ? editingAsset.id : 'new'} onSubmit={handleSave} className="space-y-6 py-4 px-1">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold border-b pb-1">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select name="category" value={assetCategory} onValueChange={(val) => {
                    setAssetCategory(val);
                    // Reset type when category changes
                    const cat = categories.find(c => c.name === val);
                    const firstType = cat?.assetTypes?.[0]?.name || '';
                    setAssetType(firstType);
                    
                    if (firstType && cat?.assetTypes?.[0]) {
                      const initialData: any = {};
                      cat.assetTypes[0].customFields?.forEach(f => {
                        initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
                      });
                      setCustomFieldsData(initialData);
                    } else {
                      setCustomFieldsData({});
                    }
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <div className="p-4 text-xs text-center text-muted-foreground">
                          {loading ? 'Loading categories...' : 'No categories found. Click "Add Category" in Configuration.'}
                        </div>
                      ) : (
                        categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Asset Name</label>
                  <Input name="name" defaultValue={editingAsset?.name} required placeholder="Dell Latitude Laptop" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Asset Code</label>
                  <Input name="assetCode" defaultValue={editingAsset?.assetCode} required placeholder="ASSET-001" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  {(() => {
                    const selectedCat = categories.find(c => c.name === assetCategory);
                    const hasLegacyTypes = selectedCat?.types && selectedCat.types.length > 0;
                    const hasNewTypes = selectedCat?.assetTypes && selectedCat.assetTypes.length > 0;
                    
                    if (hasNewTypes) {
                      return (
                        <Select 
                          name="type" 
                          value={assetType} 
                          onValueChange={(val) => {
                            setAssetType(val);
                            const typeDef = selectedCat?.assetTypes?.find(t => t.name === val);
                            if (typeDef) {
                              const initialData: any = {};
                              typeDef.customFields?.forEach(f => {
                                initialData[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
                              });
                              setCustomFieldsData(initialData);
                            } else {
                              setCustomFieldsData({});
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedCat?.assetTypes?.map(t => (
                              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }

                    return hasLegacyTypes ? (
                      <Select name="type" value={assetType} onValueChange={setAssetType}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCat?.types?.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input 
                        name="type" 
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        placeholder="Core i7, 16GB RAM" 
                      />
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Serial Number</label>
                  <Input name="serialNumber" defaultValue={editingAsset?.serialNumber} placeholder="SN12345678" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Select name="locationId" value={assetLocationId} onValueChange={(val) => {
                    setAssetLocationId(val);
                    setAssetDepartment(''); // reset department when location changes
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Location">
                        {assetLocationId ? locations.find(l => l.id === assetLocationId)?.name : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(l => <SelectItem key={l.id} value={l.id || ''}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {assetLocationId && locations.find(l => l.id === assetLocationId)?.departments && locations.find(l => l.id === assetLocationId)!.departments!.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department (Optional)</label>
                    <Select name="department" value={assetDepartment} onValueChange={setAssetDepartment}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.find(l => l.id === assetLocationId)?.departments?.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const selectedCat = categories.find(c => c.name === assetCategory);
              const typeDef = selectedCat?.assetTypes?.find(t => t.name === assetType);
              if (!typeDef || !typeDef.customFields || typeDef.customFields.length === 0) return null;
              
              return (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold border-b pb-1">Additional Specifications ({assetType})</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {typeDef.customFields.map((f) => {
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
                          {f.type === 'date' && (
                            <Input 
                              type="date"
                              value={value} 
                              onChange={(e) => onChange(e.target.value)}
                              required={f.required}
                            />
                          )}
                          {f.type === 'boolean' && (
                            <div className="flex items-center gap-2 h-10">
                              <input 
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600"
                                checked={value === true}
                                onChange={(e) => onChange(e.target.checked)}
                              />
                              <span className="text-sm text-muted-foreground">Yes</span>
                            </div>
                          )}
                          {f.type === 'select' && (
                            <Select 
                              value={value} 
                              onValueChange={onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Select ${f.name}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {f.options?.map(opt => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              <h4 className="text-sm font-semibold border-b pb-1">Purchase & Financials</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Purchase Date</label>
                  <Input name="purchaseDate" type="date" defaultValue={editingAsset?.purchaseDate} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warranty Expiry</label>
                  <Input name="warrantyExpiry" type="date" defaultValue={editingAsset?.warrantyExpiry} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vendor</label>
                  <Select name="vendorId" value={assetVendorId} onValueChange={setAssetVendorId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Vendor">
                        {assetVendorId ? vendors.find(v => v.id === assetVendorId)?.name : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => <SelectItem key={v.id} value={v.id || ''}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Purchase Cost ({organization?.currency || 'USD'})</label>
                  <Input name="purchaseCost" type="number" step="0.01" defaultValue={editingAsset?.purchaseCost} required />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold border-b pb-1">Depreciation</h4>
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium">Method</label>
                <Select value={assetDepreciationMethod} onValueChange={(val) => setAssetDepreciationMethod(val as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">Straight Line Method (SLM)</SelectItem>
                    <SelectItem value="wdv">Written Down Value (WDV)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Useful Life (Years)</label>
                  <Input name="usefulLifeYears" type="number" defaultValue={editingAsset?.usefulLifeYears || 5} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Salvage Value ({organization?.currency || 'USD'})</label>
                  <Input name="salvageValue" type="number" step="0.01" defaultValue={editingAsset?.salvageValue || 0} required />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Additional Remarks</label>
              <textarea 
                name="remarks" 
                defaultValue={editingAsset?.remarks} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                placeholder="Notes about purchase, condition, etc..."
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? 'Saving...' : (editingAsset ? 'Update Asset' : 'Create Asset')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        )}
        </div>
      </div>

      {selectedAssets.length > 0 && (
        <div className="bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-medium text-gold-800 dark:text-gold-200">
            {selectedAssets.length} asset(s) selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="bg-card" onClick={handlePrintSelected}>
              <Printer className="w-4 h-4 mr-2" /> Print Summary
            </Button>
            <Button variant="outline" size="sm" className="bg-card" onClick={() => window.open(`/print-labels?ids=${selectedAssets.join(',')}`, '_blank')}>
              <Printer className="w-4 h-4 mr-2" /> Print Labels
            </Button>
            {profile?.role !== 'viewer' && (
              <>
                <Button variant="outline" size="sm" className="bg-card" onClick={() => setIsBulkAssignOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" /> Assign
                </Button>
                <Button variant="outline" size="sm" className="bg-card" onClick={() => setIsBulkUnassignOpen(true)}>
                  <UserMinus className="w-4 h-4 mr-2" /> Unassign
                </Button>
                <Button variant="outline" size="sm" className="bg-card" onClick={() => setIsBulkStatusOpen(true)}>
                  <Wrench className="w-4 h-4 mr-2" /> Change Status
                </Button>
                {(profile?.role === 'admin' || profile?.role === 'owner') && (
                  <Button variant="outline" size="sm" className="bg-card text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setIsBulkDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Unassign Confirmation Dialog */}
      <Dialog open={isUnassignOpen} onOpenChange={setIsUnassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unassign</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to unassign asset <strong>{unassigningAsset?.name || unassigningAsset?.assetCode}</strong>? This will make the asset available for reassignment.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsUnassignOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleUnassign}>
              {isSubmitting ? 'Unassigning...' : 'Yes, Unassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Asset Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={(open) => {
        setIsAssignOpen(open);
        if (!open) setEmployeeSearch('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Asset: {assigningAsset?.name || assigningAsset?.assetCode}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an employee">
                    {selectedEmployee ? (() => {
                      const emp = employees.find(e => e.id === selectedEmployee);
                      return emp ? `${emp.employeeCode || ''} - ${emp.name} (${emp.department || 'No Dept'})` : null;
                    })() : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                    <Input 
                      placeholder="Search employee..." 
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                    />
                  </div>
                  {employees
                    .filter(e => 
                      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                      e.employeeCode?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      e.department?.toLowerCase().includes(employeeSearch.toLowerCase())
                    )
                    .map(e => (
                    <SelectItem key={e.id} value={e.id || ''}>{e.employeeCode || ''} - {e.name} ({e.department || 'No Dept'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignment Remarks (Optional)</label>
              <textarea 
                name="remarks" 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                placeholder="Any notes specifically about this assignment..."
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status: {statusAsset?.name || statusAsset?.assetCode}</DialogTitle>
          </DialogHeader>
          <form key={statusAsset ? statusAsset.id : 'status'} onSubmit={handleStatusChange} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status">
                    {newStatus ? newStatus.charAt(0).toUpperCase() + newStatus.slice(1) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="in repair">In Repair</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="dead">Dead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Remarks</label>
              <Input name="remarks" placeholder="Add remarks or issue description..." defaultValue={statusAsset?.remarks || ''} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkAssignOpen} onOpenChange={(open) => {
        setIsBulkAssignOpen(open);
        if (!open) setEmployeeSearch('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedAssets.length} Assets</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkAssign} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an employee">
                    {selectedEmployee ? (() => {
                      const emp = employees.find(e => e.id === selectedEmployee);
                      return emp ? `${emp.employeeCode || ''} - ${emp.name} (${emp.department || 'No Dept'})` : null;
                    })() : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                    <Input 
                      placeholder="Search employee..." 
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                    />
                  </div>
                  {employees
                    .filter(e => 
                      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                      e.employeeCode?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      e.department?.toLowerCase().includes(employeeSearch.toLowerCase())
                    )
                    .map(e => (
                    <SelectItem key={e.id} value={e.id || ''}>{e.employeeCode || ''} - {e.name} ({e.department || 'No Dept'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignment Remarks (Optional)</label>
              <textarea 
                name="remarks" 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                placeholder="Any notes specifically about this assignment..."
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Dialog */}
      <Dialog open={isBulkStatusOpen} onOpenChange={setIsBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status for {selectedAssets.length} Assets</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkStatusChange} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status">
                    {newStatus ? newStatus.charAt(0).toUpperCase() + newStatus.slice(1) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="in repair">In Repair</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="dead">Dead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Remarks (Optional)</label>
              <Input name="remarks" placeholder="Add notes for these assets..." />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedAssets.length} Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Are you sure you want to delete {selectedAssets.length} assets? Assigned assets will be skipped. This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsBulkDeleteOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-primary-foreground" onClick={handleBulkDelete}>
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Unassign Dialog */}
      <Dialog open={isBulkUnassignOpen} onOpenChange={setIsBulkUnassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign {selectedAssets.length} Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Are you sure you want to unassign the selected assets? They will be marked as available.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsBulkUnassignOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-gold-600 hover:bg-gold-700 text-primary-foreground" onClick={handleBulkUnassign}>
              {isSubmitting ? 'Unassigning...' : 'Unassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input 
            placeholder="Search by tag, name or serial..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2 text-muted-foreground/70" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">No categories found</div>
              ) : (
                categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-card/80 backdrop-blur-sm flex flex-wrap h-auto">
          <TabsTrigger value="all">All Assets</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="location">By Location</TabsTrigger>
          <TabsTrigger value="status">By Status</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderTable(filteredAssets)}
        </TabsContent>

        <TabsContent value="category" className="space-y-8">
          {categories.map(cat => {
            const category = cat.name;
            const catAssets = filteredAssets.filter(a => a.category === category);
            if (catAssets.length === 0) return null;
            return (
              <div key={category} className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground/90 border-b pb-2">{category}</h3>
                {renderTable(catAssets)}
              </div>
            );
          })}
          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card/95 backdrop-blur-sm rounded-xl border border-border">No assets found.</div>
          )}
        </TabsContent>

        <TabsContent value="location" className="space-y-8">
          {locations.map(loc => {
            const val = loc.id;
            const locAssets = filteredAssets.filter(a => a.locationId === val);
            if (locAssets.length === 0) return null;
            return (
              <div key={loc.id} className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground/90 border-b pb-2">{loc.name}</h3>
                {renderTable(locAssets)}
              </div>
            );
          })}
          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card/95 backdrop-blur-sm rounded-xl border border-border">No assets found.</div>
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-8">
          {STATUSES.map(status => {
            const statAssets = filteredAssets.filter(a => a.status === status);
            if (statAssets.length === 0) return null;
            return (
              <div key={status} className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground/90 border-b pb-2 capitalize">{status}</h3>
                {renderTable(statAssets)}
              </div>
            );
          })}
          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card/95 backdrop-blur-sm rounded-xl border border-border">No assets found.</div>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Are you sure you want to delete this asset? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-primary-foreground" onClick={confirmDelete}>
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Maintenance Log</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMaintenanceLog} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={newMaintenanceLog.type} onValueChange={(val: 'service' | 'repair') => setNewMaintenanceLog(prev => ({...prev, type: val}))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input type="date" required value={newMaintenanceLog.date} onChange={e => setNewMaintenanceLog(prev => ({...prev, date: e.target.value}))} />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Cost</label>
              <Input type="number" min="0" step="0.01" value={newMaintenanceLog.cost} onChange={e => setNewMaintenanceLog(prev => ({...prev, cost: e.target.value === '' ? '' : Number(e.target.value)}))} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vendor</label>
              <Select value={newMaintenanceLog.vendorId} onValueChange={val => setNewMaintenanceLog(prev => ({...prev, vendorId: val === 'none' ? '' : val}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor (optional)">
                    {newMaintenanceLog.vendorId ? vendors.find(v => v.id === newMaintenanceLog.vendorId)?.name : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id!}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input placeholder="Description of maintenance..." value={newMaintenanceLog.notes} onChange={e => setNewMaintenanceLog(prev => ({...prev, notes: e.target.value}))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsMaintenanceOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Log'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditMaintenanceOpen} onOpenChange={setIsEditMaintenanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Maintenance Log</DialogTitle>
          </DialogHeader>
          {maintenanceLogToEdit && (
            <form onSubmit={handleEditMaintenanceLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={maintenanceLogToEdit.type} onValueChange={(val: 'service' | 'repair') => setMaintenanceLogToEdit(prev => ({...prev!, type: val}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service/Inspection</SelectItem>
                      <SelectItem value="repair">Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" required value={maintenanceLogToEdit.date} onChange={e => setMaintenanceLogToEdit(prev => ({...prev!, date: e.target.value}))} />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost</label>
                <Input type="number" min="0" step="0.01" value={maintenanceLogToEdit.cost} onChange={e => setMaintenanceLogToEdit(prev => ({...prev!, cost: e.target.value === '' ? 0 : Number(e.target.value)}))} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Vendor</label>
                <Select value={maintenanceLogToEdit.vendorId || 'none'} onValueChange={val => setMaintenanceLogToEdit(prev => ({...prev!, vendorId: val === 'none' ? undefined : val}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor (optional)">
                      {maintenanceLogToEdit.vendorId ? vendors.find(v => v.id === maintenanceLogToEdit.vendorId)?.name : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id!}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Description of maintenance..." value={maintenanceLogToEdit.notes || ''} onChange={e => setMaintenanceLogToEdit(prev => ({...prev!, notes: e.target.value}))} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditMaintenanceOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteMaintenanceOpen} onOpenChange={setIsDeleteMaintenanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Maintenance Log</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">Are you sure you want to delete this maintenance log? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteMaintenanceOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMaintenanceLog} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingAsset} onOpenChange={(open) => !open && setViewingAsset(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Details {viewingAsset?.assetCode ? `- ${viewingAsset.assetCode}` : ''}</DialogTitle>
          </DialogHeader>
          {viewingAsset && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="details">General</TabsTrigger>
                <TabsTrigger value="assign">Assignment</TabsTrigger>
                <TabsTrigger value="financial">Financials</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="qrcode">QR Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">Name</p><p className="font-medium">{viewingAsset.name}</p></div>
                  <div><p className="text-sm text-muted-foreground">Asset Code</p><p className="font-medium">{viewingAsset.assetCode || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Category</p><p className="font-medium">{viewingAsset.category}</p></div>
                  <div><p className="text-sm text-muted-foreground">Type</p><p className="font-medium">{viewingAsset.type || '-'}</p></div>
                  {viewingAsset.customData && Object.keys(viewingAsset.customData).length > 0 && (
                    Object.entries(viewingAsset.customData).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-sm text-muted-foreground">{key}</p>
                        <p className="font-medium">{value === true ? 'Yes' : value === false ? 'No' : String(value || '-')}</p>
                      </div>
                    ))
                  )}
                  <div><p className="text-sm text-muted-foreground">Status</p><div className="mt-1">{getStatusBadge(viewingAsset.status)}</div></div>
                  <div><p className="text-sm text-muted-foreground">Serial Number</p><p className="font-medium">{viewingAsset.serialNumber || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{locations.find(l => l.id === viewingAsset.locationId)?.name || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Department</p><p className="font-medium">{viewingAsset.department || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Vendor</p><p className="font-medium">{vendors.find(v => v.id === viewingAsset.vendorId)?.name || '-'}</p></div>
                </div>
              </TabsContent>

              <TabsContent value="assign" className="mt-4 space-y-4">
                {viewingAsset.assignedTo ? (
                  <div className="bg-gold-50/50 p-4 rounded-lg border border-gold-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned To</p>
                      <p className="font-semibold text-lg">{employees.find(e => e.id === viewingAsset.assignedTo)?.name || 'Unknown Employee'}</p>
                      <p className="text-xs text-muted-foreground">{employees.find(e => e.id === viewingAsset.assignedTo)?.employeeCode}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                    Not currently assigned to any employee.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="financial" className="mt-4 space-y-4">
                {(() => {
                  const dep = calculateDepreciation(
                    viewingAsset.purchaseCost,
                    viewingAsset.salvageValue,
                    viewingAsset.usefulLifeYears,
                    viewingAsset.purchaseDate,
                    viewingAsset.depreciationMethod as any
                  );
                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-3 rounded-lg border">
                          <p className="text-sm text-muted-foreground">Purchase Date</p>
                          <p className="font-medium">{viewingAsset.purchaseDate || '-'}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border">
                          <p className="text-sm text-muted-foreground">Warranty Expiry</p>
                          <p className="font-medium">{viewingAsset.warrantyExpiry || '-'}</p>
                        </div>
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                          <p className="text-sm text-muted-foreground text-primary">Purchase Cost</p>
                          <p className="font-bold text-lg">{formatCurrency(viewingAsset.purchaseCost)}</p>
                        </div>
                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                          <p className="text-sm text-muted-foreground text-primary">Salvage Value</p>
                          <p className="font-bold text-lg">{formatCurrency(viewingAsset.salvageValue)}</p>
                        </div>
                      </div>
                      
                      <div className="bg-card border rounded-xl overflow-hidden">
                        <div className="bg-muted px-4 py-2 border-b">
                          <h4 className="font-semibold text-sm">
                            Depreciation Details ({viewingAsset.depreciationMethod === 'wdv' ? 'Written Down Value' : 'Straight-Line'})
                          </h4>
                        </div>
                        <div className="p-4 grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Useful Life</p>
                            <p className="font-semibold">{viewingAsset.usefulLifeYears} Years</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Annual Dep.</p>
                            <p className="font-semibold text-red-600">-{formatCurrency(dep.annualDepreciation)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Current Value</p>
                            <p className="font-bold text-green-600">{formatCurrency(dep.currentValue)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="history" className="mt-4 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    {assetHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No history records found.</p>
                    ) : (
                      <div className="relative pl-4 space-y-4 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                        {assetHistory.map((h, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gold-500 border-2 border-background" />
                            <p className="text-sm font-medium capitalize">{h.action.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(h.timestamp)}</p>
                            {h.performedBy && <p className="text-xs text-muted-foreground">By: {h.performedBy}</p>}
                            {h.from && <p className="text-xs mt-1 text-muted-foreground italic">Changed from {h.from} to {h.to}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="maintenance" className="mt-4 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-semibold text-sm">Maintenance Logs</h4>
                    <Button variant="outline" size="sm" onClick={() => setIsMaintenanceOpen(true)}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add Log
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {maintenanceLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No maintenance logs found.</p>
                    ) : (
                      <div className="space-y-2">
                        {maintenanceLogs.map((l, i) => (
                          <div key={i} className="p-3 bg-muted/30 rounded-lg border text-sm">
                            <div className="flex justify-between font-medium items-start">
                              <div>
                                <span className="capitalize">{l.type}</span>
                                <span className="text-xs text-muted-foreground ml-2">{l.date}</span>
                              </div>
                              {profile?.role && ['owner', 'admin'].includes(profile.role) && (
                                <div className="flex gap-1 ml-2">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditMaintenanceLogClick(l)}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => handleDeleteMaintenanceLogClick(l.id!)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {l.notes && <p className="text-muted-foreground mt-1">{l.notes}</p>}
                            {l.cost ? <p className="text-xs mt-1 font-medium text-primary">Cost: {formatCurrency(l.cost)}</p> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="qrcode" className="mt-4 space-y-4">
                <div className="flex flex-col items-center justify-center space-y-6 py-6 border rounded-lg bg-muted/20">
                  <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <QRCodeSVG 
                      value={`${window.location.origin}/assets?id=${viewingAsset.id}`}
                      size={200}
                      level="Q"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-lg">{viewingAsset.name}</p>
                    <p className="text-muted-foreground font-mono">{viewingAsset.assetCode || viewingAsset.serialNumber || viewingAsset.id}</p>
                  </div>
                  <Button onClick={() => window.open(`/print-labels?ids=${viewingAsset.id}`, '_blank')}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Label
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingAsset(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetScanner 
        open={isScannerOpen} 
        onOpenChange={setIsScannerOpen} 
        onScanResult={handleScanResult} 
      />
    </div>
  );

  function renderTable(assetsToRender: Asset[]) {
    return (
      <div className="bg-card/95 backdrop-blur-sm rounded-xl border border-border overflow-hidden shadow-sm">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-12 text-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                  checked={assetsToRender.length > 0 && selectedAssets.length === assetsToRender.length}
                  onChange={() => {
                    if (selectedAssets.length === assetsToRender.length) {
                      setSelectedAssets([]);
                    } else {
                      setSelectedAssets(assetsToRender.map(a => a.id));
                    }
                  }}
                />
              </TableHead>
              <TableHead className="font-semibold">Asset Code</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading assets...</TableCell>
              </TableRow>
            ) : assetsToRender.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No assets found.</TableCell>
              </TableRow>
            ) : assetsToRender.map((asset) => (
              <TableRow key={asset.id} className="hover:bg-muted transition-colors cursor-pointer" onClick={() => setViewingAsset(asset)}>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                    checked={selectedAssets.includes(asset.id)}
                    onChange={(e) => toggleSelectAsset(asset.id, e as any)}
                  />
                </TableCell>
                <TableCell className="font-medium">{asset.assetCode || '-'}</TableCell>
                <TableCell>{asset.name}</TableCell>
                <TableCell>{asset.category}</TableCell>
                <TableCell>
                  {asset.type || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{asset.locationId ? (locations.find(l => l.id === asset.locationId)?.name || '-') : '-'}</span>
                    {asset.department && <span className="text-xs text-muted-foreground">{asset.department}</span>}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(asset.status)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => {
                        setEditingAsset(asset);
                        setAssetCategory(asset.category);
                        setAssetType(asset.type || '');
                        setAssetLocationId(asset.locationId || '');
                        setAssetDepartment(asset.department || '');
                        setAssetVendorId(asset.vendorId || '');
                        setAssetDepreciationMethod(asset.depreciationMethod || 'straight_line');
                        setCustomFieldsData(asset.customData || {});
                        setIsAddOpen(true);
                      }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                      </DropdownMenuItem>
                      {asset.status === 'available' && (
                        <DropdownMenuItem onClick={() => {
                          setAssigningAsset(asset);
                          setIsAssignOpen(true);
                        }}>
                          <UserPlus className="w-4 h-4 mr-2" /> Assign Asset
                        </DropdownMenuItem>
                      )}
                      {asset.status === 'assigned' && (
                        <DropdownMenuItem onClick={() => {
                          setUnassigningAsset(asset);
                          setIsUnassignOpen(true);
                        }}>
                          <UserMinus className="w-4 h-4 mr-2" /> Unassign Asset
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => {
                        setStatusAsset(asset);
                        setNewStatus(asset.status);
                        setIsStatusOpen(true);
                      }}>
                        <Wrench className="w-4 h-4 mr-2" /> Change Status
                      </DropdownMenuItem>
                      {(profile?.role === 'admin' || profile?.role === 'owner') && (
                        <DropdownMenuItem 
                          className={asset.status === 'assigned' ? "text-muted-foreground/70" : "text-red-600 focus:text-red-600"} 
                          onClick={(e) => {
                            if (asset.status === 'assigned') {
                              e.preventDefault();
                              toast.error('Cannot delete an assigned asset. Please unassign it first.');
                              return;
                            }
                            handleDeleteClick(asset.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Asset
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {hasMore && (
           <div className="flex justify-center p-4 border-t border-border">
             <Button variant="outline" onClick={() => loadAssets(true)} disabled={loading}>
               {loading ? 'Loading...' : 'Load More Assets'}
             </Button>
           </div>
        )}
      </div>
    );
  }
}
