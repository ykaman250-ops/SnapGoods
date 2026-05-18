import React, { useEffect, useState } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { 
  Shield, 
  UserCog, 
  History, 
  Download, 
  Upload,
  Database,
  Trash2,
  UserPlus,
  Plus,
  Lock,
  Unlock,
  PlusCircle,
  Edit,
  Info,
  Printer,
  RefreshCw,
  Users,
  Settings,
  Globe
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
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../lib/api';
import { printTable } from '../lib/print';
import { useDateFormatter } from '../lib/useDateFormatter';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function Admin() {
  const { profile, organization, refreshContext } = useAuth();
  const formatDate = useDateFormatter();
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [newUserPassword, setNewUserPassword] = useState('');

  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [exportType, setExportType] = useState('all');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportStatus, setExportStatus] = useState('all');
  const [exportCategory, setExportCategory] = useState('all');
  const [dateFilterType, setDateFilterType] = useState('all_time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const handleDateFilterChange = (value: string) => {
    setDateFilterType(value);
    if (value === 'this_month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(firstDay.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    } else if (value === 'all_time') {
      setFromDate('');
      setToDate('');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { docs: usersData } = await api.listPaginated('users', [where(`orgRoles.${organization?.id}`, 'in', ['admin', 'manager', 'viewer', 'owner', 'superadmin'])], 100);
      setUsers(usersData);
      
      const { docs: logsData } = await api.listPaginated('audit_logs', [where('orgId', '==', organization?.id), orderBy('timestamp', 'desc')], 100);
      setAuditLogs(logsData);
      
      // For stats only, skip loading all assets and employees
      setAssets([]);
      setEmployees([]);
    } catch (error) {
      console.error("Admin fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile || !organization) return;
    fetchData();
  }, [profile, organization]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: organization?.name || '',
    currency: organization?.currency || 'USD'
  });

  useEffect(() => {
    if (organization) {
      setOrgForm({
        name: organization.name,
        currency: organization.currency || 'USD'
      });
    }
  }, [organization]);

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    setIsSubmitting(true);
    try {
      await api.update('organizations', organization.id, orgForm);
      await refreshContext();
      toast.success('Organization settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
    { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  ];

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const password = newUserPassword;
    const role = newUserRole;

    if (!email || !name || !password) return toast.error('Please fill all fields');

    setIsSubmitting(true);
    try {
      // Get the current user's token
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, name, password, role, orgId: organization?.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      toast.success('User account generated securely. They can now log in.');
      fetchData();
      setIsCreateUserOpen(false);
      setNewUserPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/users/${uid}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole, orgId: organization?.id })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      
      toast.success('User role updated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleStatusChange = async (uid: string, newStatus: string) => {
    try {
      await api.update('users', uid, { status: newStatus });
      toast.success('User status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      toast.loading('Preparing export...', { id: 'export' });
      
      let filename = `nv-assets-${exportType}-${new Date().toISOString().split('T')[0]}`;
      
      const filterData = (items: any[], type: string) => {
        return items.filter(item => {
          // Date filter
          if (dateFilterType !== 'all_time') {
            let itemDateStr = item.createdAt || item.assignedAt || item.timestamp;
            if (itemDateStr?.seconds) {
              itemDateStr = new Date(itemDateStr.seconds * 1000).toISOString();
            }
            
            if (fromDate || toDate) {
              if (!itemDateStr) return false;
              const itemDate = new Date(itemDateStr).getTime();
              const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
              const toTime = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : Infinity;
              if (itemDate < fromTime || itemDate > toTime) return false;
            }
          }

          // Status filter
          if (exportStatus !== 'all' && type !== 'audit_logs') {
            if (item.status !== exportStatus) return false;
          }

          // Category filter (only for assets)
          if (exportCategory !== 'all' && type === 'assets') {
            if (item.category !== exportCategory) return false;
          }

          return true;
        });
      };

      if (exportFormat === 'excel') {
        const wb = XLSX.utils.book_new();
        
        const allAssets = await api.list('assets');
        const allEmployees = await api.list('employees');
        const allAssignments = await api.list('assignments');
        
        const filteredAssets = filterData(allAssets, 'assets');
        const filteredEmployees = filterData(allEmployees, 'employees');
        const filteredAssignments = filterData(allAssignments, 'assignments');

        const formatDate = (d: any) => {
          if (!d) return '';
          if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
          return new Date(d).toLocaleDateString();
        };

        const formatSheet = (ws: any, aoa: any[][], freezeRow: number) => {
          const colWidths = [];
          for (let c = 0; c < Math.max(...aoa.map(r => r.length)); c++) {
            let max = 10;
            for (let r = 0; r < aoa.length; r++) {
              const val = aoa[r][c];
              if (val) {
                const len = String(val).length;
                if (len > max) max = len;
              }
            }
            colWidths.push({ wch: Math.min(max + 2, 50) });
          }
          ws['!cols'] = colWidths;
          ws['!views'] = [{ state: 'frozen', ySplit: freezeRow }];
          return ws;
        };

        const reportTitle = `Asset Management Report`;
        const generatedOn = `Generated on: ${new Date().toLocaleDateString()}`;

        if (exportType === 'all' || exportType === 'assets') {
          const aoa: any[][] = [
            [reportTitle],
            [generatedOn],
            []
          ];
          
          const groupedAssets = {
            'Laptop/Desktop': filteredAssets.filter(a => a.category === 'Laptop' || a.category === 'Desktop'),
            'Printer': filteredAssets.filter(a => a.category === 'Printer'),
            'SIM Card': filteredAssets.filter(a => a.category === 'SIM Card'),
            'Other': filteredAssets.filter(a => !['Laptop', 'Desktop', 'Printer', 'SIM Card'].includes(a.category))
          };

          for (const [group, items] of Object.entries(groupedAssets)) {
            if (items.length === 0) continue;
            
            aoa.push([`${group} Assets`]);
            
            let headers: string[] = [];
            if (group === 'Laptop/Desktop') {
              headers = ['Asset Code', 'Tag', 'Brand', 'Model', 'Processor', 'RAM', 'Storage', 'Serial Number', 'Status', 'Created Date', 'Remarks'];
              aoa.push(headers);
              items.forEach(a => {
                aoa.push([a.assetCode || '', a.tag || '', a.brand || '', a.model || '', a.processor || '', a.ram || '', a.storage || '', a.serialNumber || '', a.status || '', formatDate(a.createdAt), a.remarks || '']);
              });
            } else if (group === 'Printer') {
              headers = ['Asset Code', 'Tag', 'Brand', 'Model', 'Printer Type', 'Connectivity', 'Serial Number', 'Status', 'Created Date', 'Remarks'];
              aoa.push(headers);
              items.forEach(a => {
                aoa.push([a.assetCode || '', a.tag || '', a.brand || '', a.model || '', a.printerType || '', a.connectivity || '', a.serialNumber || '', a.status || '', formatDate(a.createdAt), a.remarks || '']);
              });
            } else if (group === 'SIM Card') {
              headers = ['Mobile Number', 'Service Provider', 'Plan Status', 'SIM Number', 'Status', 'Created Date', 'Remarks'];
              aoa.push(headers);
              items.forEach(a => {
                aoa.push([a.mobileNumber || '', a.serviceProvider || '', a.planStatus || '', a.simNumber || '', a.status || '', formatDate(a.createdAt), a.remarks || '']);
              });
            } else {
              headers = ['Asset Code', 'Tag', 'Category', 'Brand', 'Model', 'Status', 'Created Date', 'Remarks'];
              aoa.push(headers);
              items.forEach(a => {
                aoa.push([a.assetCode || '', a.tag || '', a.category || '', a.brand || '', a.model || '', a.status || '', formatDate(a.createdAt), a.remarks || '']);
              });
            }
            aoa.push([]);
          }
          
          if (aoa.length > 3) {
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
            formatSheet(ws, aoa, 3);
            XLSX.utils.book_append_sheet(wb, ws, 'Assets');
          } else {
            aoa.push(['No assets found for the selected criteria.']);
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
            formatSheet(ws, aoa, 3);
            XLSX.utils.book_append_sheet(wb, ws, 'Assets');
          }
        }

        if (exportType === 'all' || exportType === 'employees') {
          const aoa: any[][] = [
            [reportTitle],
            [generatedOn],
            [],
            ['Employee Code', 'Name', 'Email', 'Department', 'Designation', 'Status', 'Created Date']
          ];
          
          filteredEmployees.forEach(e => {
            aoa.push([e.employeeCode || '', e.name || '', e.email || '', e.department || '', e.designation || '', e.status || '', formatDate(e.createdAt)]);
          });
          
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
          formatSheet(ws, aoa, 4);
          XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        }

        if (exportType === 'all' || exportType === 'assignments') {
          const aoa: any[][] = [
            [reportTitle],
            [generatedOn],
            [],
            ['Asset Code', 'Asset Category', 'Assignee Type', 'Assignee Code', 'Assignee Name', 'Designation', 'Department', 'Mobile Number', 'Assigned Date', 'Returned Date', 'Status', 'Remarks']
          ];
          
          filteredAssignments.forEach(a => {
            const asset = (allAssets.find(as => as.id === a.assetId) || {}) as any;
            const assigneeType = a.assigneeType || 'employee';
            let assigneeCode = '';
            let assigneeName = '';
            let designation = '';
            let department = '';
            
            if (assigneeType === 'department') {
              assigneeCode = 'DEPT';
              assigneeName = a.department || '';
              department = a.department || '';
            } else {
              const emp = (allEmployees.find(e => e.id === a.employeeId) || {}) as any;
              assigneeCode = emp.employeeCode || '';
              assigneeName = emp.name || '';
              designation = emp.designation || '';
              department = emp.department || '';
            }
            
            aoa.push([
              asset.assetCode || asset.tag || '', 
              asset.category || '', 
              assigneeType.charAt(0).toUpperCase() + assigneeType.slice(1),
              assigneeCode, 
              assigneeName, 
              designation,
              department,
              asset.category === 'SIM Card' ? (asset.mobileNumber || '') : '-',
              formatDate(a.assignedAt), 
              formatDate(a.returnedAt), 
              a.status || (a.returnedAt ? 'Returned' : 'Active'),
              a.remarks || ''
            ]);
          });
          
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
          formatSheet(ws, aoa, 4);
          XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
        }

        if (exportType === 'all' || exportType === 'audit_logs') {
          const allAuditLogs = await api.list('audit_logs');
          const filteredAuditLogs = filterData(allAuditLogs, 'audit_logs');
          
          const aoa: any[][] = [
            [reportTitle],
            [generatedOn],
            [],
            ['Action', 'Entity Type', 'Entity ID', 'Performed By', 'Timestamp', 'Details']
          ];
          
          filteredAuditLogs.forEach(log => {
            aoa.push([
              log.action || '',
              log.entityType || '',
              log.entityId || '',
              log.performedBy || '',
              formatDate(log.timestamp),
              log.details ? JSON.stringify(log.details) : ''
            ]);
          });
          
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
          formatSheet(ws, aoa, 4);
          XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
        }
        
        if (wb.SheetNames.length === 0) {
          const ws = XLSX.utils.aoa_to_sheet([['No data found']]);
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        }

        XLSX.writeFile(wb, `${filename}.xlsx`);
        toast.success('Excel report exported successfully!', { id: 'export' });
        return;
      }
      
      if (exportType === 'all') {
        const assetsData = filterData(await api.list('assets'), 'assets').map(({ location, ...rest }) => rest);
        const employeesData = filterData(await api.list('employees'), 'employees');
        const assignmentsData = filterData(await api.list('assignments'), 'assignments');
        const usersData = filterData(await api.list('users'), 'users');
        
        const dataToExport = {
          assets: assetsData,
          employees: employeesData,
          assignments: assignmentsData,
          users: usersData,
          timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${filename}.json`);
        toast.success('Backup exported successfully!', { id: 'export' });
        return;
      }

      // For individual collections
      let data = filterData(await api.list(exportType), exportType);
      
      if (exportType === 'assets') {
        data = data.map(({ location, ...rest }) => rest);
      }
      
      if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${filename}.json`);
      } else {
        // CSV Export
        if (!data || data.length === 0) {
          toast.error('No data to export', { id: 'export' });
          return;
        }
        
        const headers = Array.from(new Set(data.flatMap(Object.keys)));
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) return '';
            if (val?.seconds) val = new Date(val.seconds * 1000).toISOString(); // Handle Firestore timestamps
            if (typeof val === 'object') val = JSON.stringify(val);
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${filename}.csv`);
      }
      
      toast.success(`${exportType} exported successfully!`, { id: 'export' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to export data', { id: 'export' });
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading('Reading file...', { id: 'import' });
      
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.assets && !data.employees) {
          throw new Error('Invalid backup file format');
        }

        setPendingImportData(data);
        setIsImportConfirmOpen(true);
        toast.dismiss('import');
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        
        let totalImported = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const wsName of wb.SheetNames) {
          const ws = wb.Sheets[wsName];
          const data: any[] = XLSX.utils.sheet_to_json(ws);
          
          if (!data || data.length === 0) {
            continue;
          }

          const firstRow = data[0];
          const firstRowKeysLower = Object.keys(firstRow).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
          
          let detectedType = '';
          if (
            firstRowKeysLower.some(k => ['assigneetype', 'assignmentdate', 'returndate', 'assignmentid', 'assignmentnotes', 'returntype'].includes(k)) || 
            (firstRowKeysLower.includes('assetid') && (firstRowKeysLower.includes('employeeid') || firstRowKeysLower.includes('employeecode')))
          ) {
            detectedType = 'assignments';
          } else if (
            firstRowKeysLower.some(k => ['assetcode', 'category', 'assettag', 'tag', 'serialnumber', 'brand', 'model', 'assetcategory', 'assetmake', 'assetmodel', 'assetid', 'assettype', 'make', 'serial'].includes(k))
          ) {
            detectedType = 'assets';
          } else if (
            firstRowKeysLower.some(k => ['employeecode', 'empcode', 'name', 'department', 'email', 'employeename', 'employeeemail', 'employeedepartment', 'designation', 'role'].includes(k))
          ) {
            detectedType = 'employees';
          } else {
            console.warn(`Could not auto-detect data type for sheet ${wsName}, skipping.`);
            continue;
          }

          let importedCount = 0;
          let skippedCount = 0;
          let errorCount = 0;

          toast.loading(`Importing ${detectedType} from ${wsName}...`, { id: 'import' });

          const trimStr = (val: any) => typeof val === 'string' ? val.trim() : val;
          const assetFields = ['assetCode', 'tag', 'category', 'brand', 'model', 'processor', 'ram', 'storage', 'serialNumber', 'status', 'printerType', 'connectivity', 'mobileNumber', 'serviceProvider', 'planStatus', 'simNumber', 'createdAt'];
          const employeeFields = ['employeeCode', 'name', 'email', 'department', 'designation', 'status', 'createdAt'];

          const seenAssetCodes = new Set(assets.map(a => a.assetCode?.toLowerCase()).filter(Boolean));
          const seenSerials = new Set(assets.map(a => a.serialNumber?.toLowerCase()).filter(Boolean));

          for (const row of data) {
            try {
              const normalizedRow: any = {};
              for (const [key, value] of Object.entries(row)) {
                const normalizedKey = key.trim().replace(/\s+(.)/g, (match, group1) => group1.toUpperCase()).replace(/^[A-Z]/, match => match.toLowerCase());
                normalizedRow[normalizedKey] = trimStr(value);
              }

              if (row['Asset Code']) normalizedRow.assetCode = trimStr(row['Asset Code']);
              if (row['Employee Code']) normalizedRow.employeeCode = trimStr(row['Employee Code']);
              if (row['Created Date']) normalizedRow.createdAt = trimStr(row['Created Date']);
              if (row['Mobile Number']) normalizedRow.mobileNumber = trimStr(row['Mobile Number']);
              if (row['Service Provider']) normalizedRow.serviceProvider = trimStr(row['Service Provider']);
              if (row['Plan Status']) normalizedRow.planStatus = trimStr(row['Plan Status']);
              if (row['SIM Number']) normalizedRow.simNumber = trimStr(row['SIM Number']);
              if (row['Printer Type']) normalizedRow.printerType = trimStr(row['Printer Type']);
              if (row['Serial Number']) normalizedRow.serialNumber = trimStr(row['Serial Number']);

              if (detectedType === 'assets') {
                const assetCode = normalizedRow.assetCode || normalizedRow.tag || normalizedRow.assetTag || normalizedRow.assetId;
                const category = normalizedRow.category || normalizedRow.assetCategory || normalizedRow.assetType || normalizedRow.type;
                const serialNumber = normalizedRow.serialNumber || normalizedRow.serial;
                
                if (!assetCode || !category) {
                  skippedCount++;
                  continue;
                }
                
                const isDuplicate = 
                  (assetCode && seenAssetCodes.has(assetCode.toLowerCase())) ||
                  (serialNumber && seenSerials.has(serialNumber.toLowerCase()));

                if (isDuplicate) {
                  skippedCount++;
                  continue;
                }

                if (assetCode) seenAssetCodes.add(assetCode.toLowerCase());
                if (serialNumber) seenSerials.add(serialNumber.toLowerCase());

                const cleanData: any = {};
                assetFields.forEach(f => {
                  if (normalizedRow[f] !== undefined) cleanData[f] = normalizedRow[f];
                });
                
                cleanData.assetCode = assetCode;
                cleanData.category = category;
                cleanData.status = cleanData.status || 'available'; // Default to lowercase statuses
                cleanData.createdAt = cleanData.createdAt ? new Date(cleanData.createdAt) : new Date();

                await api.create('assets', cleanData);
                importedCount++;
              } else if (detectedType === 'employees') {
                const employeeCode = String(normalizedRow.employeeCode || normalizedRow.empCode || normalizedRow.employeeId || '').trim();
                const name = normalizedRow.name || normalizedRow.employeeName || normalizedRow.employee;

                // Validate employee code is exactly 5 digits
                if (!employeeCode || !name || !/^\d{5}$/.test(employeeCode)) {
                  skippedCount++;
                  continue;
                }

                const existing = employees.find(e => e.employeeCode === employeeCode);
                if (existing) {
                  skippedCount++;
                  continue;
                }

                const cleanData: any = {};
                employeeFields.forEach(f => {
                  if (normalizedRow[f] !== undefined) cleanData[f] = normalizedRow[f];
                });

                cleanData.employeeCode = employeeCode;
                cleanData.name = name;
                cleanData.status = cleanData.status || 'active'; // Default to lowercase statuses
                cleanData.createdAt = cleanData.createdAt ? new Date(cleanData.createdAt) : new Date();

                await api.create('employees', cleanData);
                importedCount++;
              } else if (detectedType === 'assignments') {
                const rawAssetId = trimStr(row['assetId']);
                const rawEmployeeId = trimStr(row['employeeId']);
                const assetCodeRow = trimStr(row['Asset Code'] || row.assetCode);
                const assigneeTypeRow = trimStr(row['Assignee Type'] || row.assigneeType)?.toLowerCase() || 'employee';
                const assigneeCodeRow = trimStr(row['Assignee Code/Dept'] || row.employeeCode || row.department);
                const statusRow = trimStr(row['Status'] || row.status)?.toLowerCase() || 'active';

                const assignedAtExtracted = row['Assigned Date'] || row.assignedAt;
                const returnedAtExtracted = row['Returned Date'] || row.returnedAt;

                if (!assetCodeRow && !rawAssetId) {
                  skippedCount++;
                  continue;
                }

                let asset;
                if (rawAssetId) {
                  asset = assets.find(a => a.id === rawAssetId);
                } else if (assetCodeRow) {
                  asset = assets.find(a => (a.assetCode || a.tag)?.toLowerCase() === assetCodeRow.toLowerCase());
                }

                if (!asset) {
                  skippedCount++;
                  continue; // Cannot assign an asset that doesn't exist
                }

                let employeeId: string | undefined;
                let department: string | undefined;

                if (assigneeTypeRow === 'department' || assigneeCodeRow === 'DEPT') {
                  department = trimStr(row['Assignee Name'] || row.department || assigneeCodeRow);
                  if (department === 'DEPT') department = row['Assignee Name'];
                } else {
                  if (rawEmployeeId) {
                    const emp = employees.find(e => e.id === rawEmployeeId);
                    if (emp) {
                      employeeId = emp.id;
                    } else {
                      skippedCount++;
                      continue;
                    }
                  } else if (assigneeCodeRow) {
                    const emp = employees.find(e => e.employeeCode === assigneeCodeRow);
                    if (emp) {
                      employeeId = emp.id;
                    } else {
                      skippedCount++;
                      continue; // Employee not found
                    }
                  } else {
                    skippedCount++;
                    continue;
                  }
                }

                const cleanData: any = {
                  assetId: asset.id,
                  assigneeType: assigneeTypeRow === 'department' ? 'department' : 'employee',
                  status: statusRow === 'returned' || returnedAtExtracted ? 'returned' : 'active',
                  assignedAt: assignedAtExtracted ? new Date(assignedAtExtracted).toISOString() : new Date().toISOString(),
                };

                if (employeeId) cleanData.employeeId = employeeId;
                if (department) cleanData.department = department;
                if (cleanData.status === 'returned') cleanData.returnedAt = returnedAtExtracted ? new Date(returnedAtExtracted).toISOString() : new Date().toISOString();

                await api.create('assignments', cleanData);
                // Also update status of the physical asset if the status is active
                if (cleanData.status === 'active') {
                  await api.update('assets', asset.id, { status: 'assigned' });
                }
                importedCount++;
              }
            } catch (err) {
              console.error('Error importing row:', row, err);
              errorCount++;
            }
          }
          
          totalImported += importedCount;
          totalSkipped += skippedCount;
          totalErrors += errorCount;
        }

        if (totalImported === 0 && totalSkipped === 0 && totalErrors === 0) {
          throw new Error('No valid data found in the file to import.');
        }
        
        toast.success(`Import complete! Imported: ${totalImported}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`, { id: 'import', duration: 5000 });
        fetchData();
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to import file.', { id: 'import' });
    } finally {
      if (e.target) e.target.value = ''; // reset input
    }
  };

  const executeJsonImport = async () => {
    if (!pendingImportData) return;
    
    setIsSubmitting(true);
    try {
      toast.loading('Restoring data... This may take a moment.', { id: 'import' });
      
      const restoreCollection = async (collectionName: string, items: any[]) => {
        if (!items || !items.length) return;
        for (const item of items) {
          const { id, ...rest } = item;
          if (id) {
            await api.setMerge(collectionName, id, rest);
          } else {
            await api.create(collectionName, rest);
          }
        }
      };

      await restoreCollection('assets', pendingImportData.assets);
      await restoreCollection('employees', pendingImportData.employees);
      await restoreCollection('assignments', pendingImportData.assignments);

      toast.success('Backup restored successfully!', { id: 'import' });
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to restore backup.', { id: 'import' });
    } finally {
      setIsImportConfirmOpen(false);
      setPendingImportData(null);
      setIsSubmitting(false);
    }
  };

  const handleExportBackup = async () => {
    setExportType('all');
    setExportFormat('json');
    await handleExport();
  };

  const handleClearAllData = async () => {
    if (clearPassword !== 'clearAllAssetsrpj') {
      toast.error('Invalid confirmation code', { id: 'clear-data' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      toast.loading('Clearing all data...', { id: 'clear-data' });
      
      // Get all collections
      const assets = await api.list('assets');
      const employees = await api.list('employees');
      const assignments = await api.list('assignments');
      const auditLogs = await api.list('audit_logs');
      
      // Delete all documents
      for (const asset of assets || []) await api.delete('assets', asset.id);
      for (const emp of employees || []) await api.delete('employees', emp.id);
      for (const assignment of assignments || []) await api.delete('assignments', assignment.id);
      for (const log of auditLogs || []) await api.delete('audit_logs', log.id);
      
      setIsClearDataOpen(false);
      setClearPassword('');
      toast.success('All data cleared successfully!', { id: 'clear-data' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to clear data', { id: 'clear-data' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteAccountPassword !== 'deletePermanentlyrpj') {
      toast.error('Invalid confirmation code', { id: 'delete-account' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      toast.loading('Deleting account permanently...', { id: 'delete-account' });
      
      // Delete the organization itself via API
      if (organization?.id) {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/admin/organizations/${organization.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.error || 'Failed to delete organization');
        }
      }
      
      setIsDeleteAccountOpen(false);
      setDeleteAccountPassword('');
      toast.success('Account and organization deleted successfully!', { id: 'delete-account' });
      
      try {
         await auth.currentUser?.delete();
      } catch (e) {
         console.error("Failed to delete auth user:", e);
      }
      await auth.signOut();
      window.location.href = '/login';
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to delete account', { id: 'delete-account' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSelectedUsers = () => {
    const selectedData = users
      .filter(u => selectedUsers.includes(u.id))
      .map(user => [
        user.name || '-',
        user.email || '-',
        user.role || '-',
        user.status || '-'
      ]);

    printTable(
      'Selected Users',
      ['Name', 'Email', 'Role', 'Status'],
      selectedData
    );
  };

  const downloadAssetTemplate = () => {
    try {
      const ws = XLSX.utils.json_to_sheet([
        { 'Asset Code': 'LPT-001', 'Category': 'Laptop', 'Brand': 'Dell', 'Model': 'Latitude 5420', 'Serial Number': 'ABC12345', 'Processor': 'i5', 'RAM': '16GB', 'Storage': '512GB SSD', 'Connectivty': '', 'Mobile Number': '', 'Service Provider': '', 'Plan Status': '', 'SIM Number': '', 'Status': 'Available' }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Assets");
      XLSX.writeFile(wb, "Asset_Import_Template.xlsx");
    } catch (error) {
      toast.error('Failed to generate template');
    }
  };

  const downloadEmployeeTemplate = () => {
    try {
      const ws = XLSX.utils.json_to_sheet([
        { 'Employee Code': '10001', 'Name': 'John Doe', 'Email': 'john.doe@example.com', 'Department': 'IT', 'Designation': 'Engineer', 'Status': 'Active' }
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employees");
      XLSX.writeFile(wb, "Employee_Import_Template.xlsx");
    } catch (error) {
      toast.error('Failed to generate template');
    }
  };

  const downloadFullTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      const wsAssets = XLSX.utils.json_to_sheet([
        { 'Asset Code': 'LPT-001', 'Category': 'Laptop', 'Brand': 'Dell', 'Model': 'Latitude 5420', 'Serial Number': 'ABC12345', 'Processor': 'i5', 'RAM': '16GB', 'Storage': '512GB SSD', 'Status': 'Available' }
      ]);
      XLSX.utils.book_append_sheet(wb, wsAssets, "Assets");

      const wsEmployees = XLSX.utils.json_to_sheet([
        { 'Employee Code': '10001', 'Name': 'John Doe', 'Email': 'john.doe@example.com', 'Department': 'IT', 'Designation': 'Engineer', 'Status': 'Active' }
      ]);
      XLSX.utils.book_append_sheet(wb, wsEmployees, "Employees");

      const wsAssignments = XLSX.utils.json_to_sheet([
        { 'Asset Code': 'LPT-001', 'Assignee Type': 'Employee', 'Assignee Code/Dept': '10001', 'Status': 'Active', 'Assigned Date': new Date().toISOString().split('T')[0] }
      ]);
      XLSX.utils.book_append_sheet(wb, wsAssignments, "Assignments");

      XLSX.writeFile(wb, "Full_System_Import_Template.xlsx");
    } catch (error) {
      toast.error('Failed to generate template');
    }
  };

  return (
    <div className="space-y-8 flex-1 flex flex-col min-h-0">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Settings</h2>
        <p className="text-muted-foreground">Manage system users, roles, and view audit trails.</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card/95 backdrop-blur-sm border border-border p-1">
          <TabsTrigger value="users" className="data-[state=active]:bg-gold-50 data-[state=active]:text-gold-700">
            <UserCog className="w-4 h-4 mr-2" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-gold-50 data-[state=active]:text-gold-700">
            <History className="w-4 h-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-gold-50 data-[state=active]:text-gold-700">
            <Database className="w-4 h-4 mr-2" />
            Data Management
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-gold-50 data-[state=active]:text-gold-700">
            <Settings className="w-4 h-4 mr-2" />
            Organization Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="flex-1 flex flex-col min-h-0">
          <Card className="shadow-sm border-border bg-card/95 backdrop-blur-sm flex-1 flex flex-col min-h-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>System Users</CardTitle>
                <CardDescription>Manage user access levels and account status.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fetchData()} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                  <DialogTrigger render={
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Create User
                    </Button>
                  } />
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input name="name" required placeholder="User's Name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <Input name="email" type="email" required placeholder="user@nvgroup.co.in" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password (8+ chars, 1 uppercase, 1 lowercase, 1 special)</label>
                      <Input name="password" type="text" required placeholder="Temporary Password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select name="role" value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">Staff</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isSubmitting ? 'Creating...' : 'Create User Profile'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 p-0">
              {selectedUsers.length > 0 && (
                <div className="bg-gold-50 dark:bg-gold-900/20 border-b border-gold-200 dark:border-gold-800 p-3 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-sm font-medium text-gold-800 dark:text-gold-200">
                    {selectedUsers.length} user(s) selected
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="bg-card" onClick={handlePrintSelectedUsers}>
                      <Printer className="w-4 h-4 mr-2" /> Print Selected
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                          checked={users.length > 0 && selectedUsers.length === users.length}
                          onChange={() => {
                            if (selectedUsers.length === users.length) {
                              setSelectedUsers([]);
                            } else {
                              setSelectedUsers(users.map(u => u.id));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === profile?.uid || user.id === auth.currentUser?.uid || user.email === profile?.email || user.email === auth.currentUser?.email;
                    const isSuperAdmin = user.email === 'adminrajpura@nvgroup.co.in' || user.email === 'ykaman250@gmail.com';
                    const userRole = user.orgRoles?.[organization?.id as string] || 'viewer';
                    const profileRole = profile?.orgRoles?.[organization?.id as string] || 'viewer';
                    const canManageUser = profileRole === 'owner' || profileRole === 'superadmin' || 
                                          (profileRole === 'admin' && userRole !== 'owner' && userRole !== 'admin');
                    
                    return (
                    <TableRow key={user.id}>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select 
                          value={userRole} 
                          onValueChange={(val) => handleRoleChange(user.id, val)}
                          disabled={isSelf || isSuperAdmin || !canManageUser}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(profileRole === 'owner' || profileRole === 'superadmin') && <SelectItem value="owner">Owner</SelectItem>}
                            {(profileRole === 'owner' || profileRole === 'superadmin') && <SelectItem value="admin">Admin</SelectItem>}
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={user.status || 'active'} 
                          onValueChange={(val) => handleStatusChange(user.id, val)}
                          disabled={isSelf || isSuperAdmin || !canManageUser}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="frozen">Frozen</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={user.status === 'frozen' ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"} 
                          disabled={isSelf || isSuperAdmin || !canManageUser}
                          onClick={() => handleStatusChange(user.id, user.status === 'frozen' ? 'active' : 'frozen')}
                          title={user.status === 'frozen' ? "Unfreeze Account" : "Freeze Account"}
                        >
                          {user.status === 'frozen' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                          disabled={isSelf || isSuperAdmin || !canManageUser}
                          onClick={() => setUserToDelete(user)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
          
          <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete User</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p>Are you sure you want to delete user <strong>{userToDelete?.email}</strong>?</p>
                <p className="text-sm text-muted-foreground mt-2">This action cannot be undone and will permanently remove their access.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUserToDelete(null)}>Cancel</Button>
                <Button 
                  variant="destructive" 
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (!userToDelete) return;
                    setIsSubmitting(true);
                    try {
                      if (userToDelete.email === 'adminrajpura@nvgroup.co.in') {
                        toast.error('Super admin cannot be deleted.');
                        return;
                      }

                      // Delete via Backend API to ensure it deletes both Auth and Firestore securely
                      const res = await fetch(`/api/admin/users/${userToDelete.id}?orgId=${organization?.id}`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
                        }
                      });

                      if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.error || 'Failed to delete user');
                      }

                      toast.success('User deleted successfully.');
                      fetchData();
                      setUserToDelete(null);
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to delete user. Check permissions.');
                      console.error(error);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete User'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="shadow-sm border-border bg-card/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>History of all critical system actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {auditLogs.map((log) => {
                  const action = log.action?.toUpperCase() || 'UNKNOWN';
                  let Icon = Info;
                  let colorClass = 'bg-muted border-border text-muted-foreground';
                  let iconColorClass = 'text-muted-foreground';
                  let badgeClass = 'bg-muted/80 text-foreground/80 border-border';

                  if (action === 'CREATE') {
                    Icon = PlusCircle;
                    colorClass = 'bg-green-50/50 border-green-100';
                    iconColorClass = 'text-green-600';
                    badgeClass = 'bg-green-100 text-green-700 border-green-200';
                  } else if (action === 'UPDATE') {
                    Icon = Edit;
                    colorClass = 'bg-blue-50/50 border-blue-100';
                    iconColorClass = 'text-blue-600';
                    badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
                  } else if (action === 'DELETE') {
                    Icon = Trash2;
                    colorClass = 'bg-red-50/50 border-red-100';
                    iconColorClass = 'text-red-600';
                    badgeClass = 'bg-red-100 text-red-700 border-red-200';
                  }

                  const renderDetails = (details: any) => {
                    if (!details || typeof details !== 'object' || Object.keys(details).length === 0) return null;
                    const filteredDetails = Object.entries(details).filter(([key]) => !['createdAt', 'updatedAt'].includes(key));
                    if (filteredDetails.length === 0) return null;

                    return (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-card p-3 rounded-md border border-border/50 shadow-sm">
                        {filteredDetails.map(([key, value]) => {
                          let displayValue = String(value);
                          if (key === 'assetId') {
                            const asset = assets.find(a => a.id === value);
                            if (asset) displayValue = asset.category === 'SIM Card' ? `${asset.mobileNumber} - ${asset.serviceProvider}` : `${asset.tag} - ${asset.brand} ${asset.model}`;
                          } else if (key === 'employeeId') {
                            const emp = employees.find(e => e.id === value);
                            if (emp) displayValue = `${emp.name} (${emp.department})`;
                          } else if (typeof value === 'object') {
                            displayValue = JSON.stringify(value);
                          }

                          return (
                            <div key={key} className="flex flex-col overflow-hidden">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-0.5">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <span className="text-xs text-foreground/80 font-medium truncate" title={displayValue}>
                                {displayValue}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  let readableEntityName = log.entityId;
                  if (log.entityType === 'assets') {
                    const asset = assets.find(a => a.id === log.entityId);
                    if (asset) readableEntityName = asset.category === 'SIM Card' ? `${asset.mobileNumber}` : `${asset.tag}`;
                  } else if (log.entityType === 'employees') {
                    const emp = employees.find(e => e.id === log.entityId);
                    if (emp) readableEntityName = emp.name;
                  } else if (log.entityType === 'users') {
                    const user = users.find(u => u.id === log.entityId);
                    if (user) readableEntityName = user.name || user.email;
                  } else if (log.entityType === 'assignments') {
                    if (log.details?.assetId) {
                       const asset = assets.find(a => a.id === log.details.assetId);
                       if (asset) readableEntityName = `Assignment for ${asset.tag || asset.category}`;
                    }
                  }
                  
                  if (readableEntityName === log.entityId && log.entityId.length > 10) {
                    readableEntityName = `ID: ${log.entityId.slice(0, 8)}...`;
                  }

                  return (
                    <div key={log.id} className={`flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl border transition-colors ${colorClass}`}>
                      <div className={`p-2.5 bg-card rounded-lg shadow-sm border border-border/50 shrink-0`}>
                        <Icon className={`w-5 h-5 ${iconColorClass}`} />
                      </div>
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}>
                              {action}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {log.entityType}
                            </span>
                            <span className="text-sm text-muted-foreground" title={log.entityId}>
                              ({readableEntityName})
                            </span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground shrink-0 bg-card px-2 py-1 rounded-md border border-border/50 shadow-sm">
                            {formatDate(log.timestamp?.toDate())}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Performed by: <span className="font-medium text-foreground">{log.performedBy}</span>
                        </p>
                        {renderDetails(log.details)}
                      </div>
                    </div>
                  );
                })}
                {auditLogs.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>No audit logs found.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border bg-card/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>Select the data you want to export and download it to your device.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data to Export</label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select data" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Complete System Backup (All Data)</SelectItem>
                      <SelectItem value="assets">Assets Only</SelectItem>
                      <SelectItem value="employees">Employees Only</SelectItem>
                      <SelectItem value="assignments">Assignments Only</SelectItem>
                      <SelectItem value="audit_logs">Audit Logs Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (Best for backups)</SelectItem>
                      <SelectItem value="csv" disabled={exportType === 'all'}>CSV (Best for spreadsheets)</SelectItem>
                      <SelectItem value="excel">Excel (Full Report)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Select value={dateFilterType} onValueChange={handleDateFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_time">All Time</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dateFilterType === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From Date</label>
                      <Input 
                        type="date" 
                        value={fromDate} 
                        onChange={(e) => setFromDate(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">To Date</label>
                      <Input 
                        type="date" 
                        value={toDate} 
                        onChange={(e) => setToDate(e.target.value)} 
                      />
                    </div>
                  </div>
                )}
                
                {exportType !== 'audit_logs' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status Filter</label>
                    <Select value={exportStatus} onValueChange={setExportStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="In Repair">In Repair</SelectItem>
                        <SelectItem value="Retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(exportType === 'all' || exportType === 'assets') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset Category Filter</label>
                    <Select value={exportCategory} onValueChange={setExportCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="Laptop">Laptop</SelectItem>
                        <SelectItem value="Desktop">Desktop</SelectItem>
                        <SelectItem value="Printer">Printer</SelectItem>
                        <SelectItem value="SIM Card">SIM Card</SelectItem>
                        <SelectItem value="CPU">CPU</SelectItem>
                        <SelectItem value="Monitor">Monitor</SelectItem>
                        <SelectItem value="Network Device">Network Device</SelectItem>
                        <SelectItem value="CCTV Camera">CCTV Camera</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" /> Download Export
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border bg-card/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Import Data</CardTitle>
                <CardDescription>Restore from a JSON backup or import CSV data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted transition-colors flex flex-col items-center justify-center min-h-[140px]">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground/70 mb-2" />
                  <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JSON (Full Backup) or CSV/Excel (Assets/Employees)
                  </p>
                  <input 
                    type="file" 
                    accept=".json,.csv,.xlsx,.xls" 
                    className="hidden" 
                    id="backup-upload"
                    onChange={handleImportBackup}
                  />
                  <Button variant="outline" className="mt-4" onClick={() => document.getElementById('backup-upload')?.click()}>
                    Select File
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border bg-card/95 backdrop-blur-sm md:col-span-2">
              <CardHeader>
                <CardTitle>Download Import Templates</CardTitle>
                <CardDescription>Download standardized Excel templates for manual data entry. Follow the instructions to avoid import errors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-end border-b pb-4">
                  <Button onClick={downloadFullTemplate}>
                    <Download className="w-4 h-4 mr-2" /> Download Full System Template
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center text-sm"><Database className="w-4 h-4 mr-2" /> Asset Import Instructions</h3>
                    <ul className="text-sm text-muted-foreground list-disc ml-5 space-y-1">
                      <li><strong>Asset Code</strong> and <strong>Category</strong> are strictly required.</li>
                      <li>Avoid changing the core column headers (Asset Code, Category, Status, etc.).</li>
                      <li>Categories must match existing logic (e.g. Laptop, Printer, Mobile).</li>
                      <li>Check for duplicate Asset Codes before importing.</li>
                    </ul>
                    <Button variant="outline" className="w-full mt-2" onClick={downloadAssetTemplate}>
                      <Download className="w-4 h-4 mr-2" /> Asset Template
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center text-sm"><Users className="w-4 h-4 mr-2" /> Employee Import Instructions</h3>
                    <ul className="text-sm text-muted-foreground list-disc ml-5 space-y-1">
                      <li><strong>Employee Code</strong> and <strong>Name</strong> are strictly required.</li>
                      <li><strong>Employee Code</strong> must be exactly 5 digits.</li>
                      <li>Avoid changing the core column headers (Employee Code, Name, Email, etc.).</li>
                      <li>Duplicate Employee Codes will be skipped during import.</li>
                    </ul>
                    <Button variant="outline" className="w-full mt-2" onClick={downloadEmployeeTemplate}>
                      <Download className="w-4 h-4 mr-2" /> Employee Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Full Data Import</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    You are about to import a full JSON backup. This will merge the imported data with your existing records. Existing data will <strong>not</strong> be deleted.
                  </p>
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
                    <strong>Summary of data to import:</strong>
                    <ul className="list-disc ml-5 mt-2">
                      <li>Assets: {pendingImportData?.assets?.length || 0}</li>
                      <li>Employees: {pendingImportData?.employees?.length || 0}</li>
                      <li>Assignments: {pendingImportData?.assignments?.length || 0}</li>
                    </ul>
                  </div>
                  <p className="text-sm font-medium text-foreground">Are you sure you want to proceed?</p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" disabled={isSubmitting} onClick={() => setIsImportConfirmOpen(false)}>Cancel</Button>
                  <Button disabled={isSubmitting} onClick={executeJsonImport} className="bg-blue-600 hover:bg-blue-700 text-primary-foreground">
                    {isSubmitting ? 'Importing...' : 'Yes, Import Data'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card className="shadow-sm border-border bg-card/95 backdrop-blur-sm md:col-span-2 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>System reset utilities.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex flex-col md:flex-row gap-4">
                <Dialog open={isClearDataOpen} onOpenChange={(open) => {
                  setIsClearDataOpen(open);
                  if (!open) setClearPassword('');
                }}>
                  <DialogTrigger render={
                    <Button className="w-full md:w-auto bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200">
                      <Trash2 className="w-4 h-4 mr-2" /> Clear All Data
                    </Button>
                  } />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-red-600">Clear All System Data?</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <p className="text-muted-foreground">
                        This action will permanently delete all assets, employees, assignments, and audit logs. This cannot be undone.
                      </p>
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-4">
                        <p className="text-sm text-amber-800 font-medium mb-2">
                          Highly Recommended: Export a backup before proceeding.
                        </p>
                        <Button variant="outline" className="w-full bg-card border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handleExportBackup}>
                          <Download className="w-4 h-4 mr-2" /> Export Backup Now
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Type "clearAllAssetsrpj" to confirm:
                        </label>
                        <Input 
                          type="text" 
                          value={clearPassword}
                          onChange={(e) => setClearPassword(e.target.value)}
                          placeholder="Enter confirmation code"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" disabled={isSubmitting} onClick={() => setIsClearDataOpen(false)}>Cancel</Button>
                      <Button 
                        disabled={isSubmitting || clearPassword !== 'clearAllAssetsrpj'} 
                        className="bg-red-600 hover:bg-red-700 text-primary-foreground disabled:opacity-50" 
                        onClick={handleClearAllData}
                      >
                        {isSubmitting ? 'Clearing...' : 'Yes, Clear All Data'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="max-w-2xl mx-auto shadow-sm border-border bg-card/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Configure global settings for your organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateOrg} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization Name</label>
                  <Input 
                    value={orgForm.name} 
                    onChange={e => setOrgForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter organization name"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Currency</label>
                  <Select 
                    value={orgForm.currency} 
                    onValueChange={val => setOrgForm(prev => ({ ...prev, currency: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">This currency will be used across the system for purchase costs and depreciation.</p>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
              
              <div className="mt-8 pt-8 border-t border-border">
                <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
                {(organization?.createdBy === profile?.uid || (!organization?.createdBy && (organization?.ownerIds?.includes(profile?.uid || '') || profile?.orgRoles?.[organization?.id as string] === 'owner' || profile?.orgRoles?.[organization?.id as string] === 'superadmin'))) && (
                  <Dialog open={isDeleteAccountOpen} onOpenChange={(open) => {
                    setIsDeleteAccountOpen(open);
                    if (!open) setDeleteAccountPassword('');
                  }}>
                    <DialogTrigger render={
                      <Button className="w-full md:w-auto bg-red-600 text-white hover:bg-red-700 border border-red-700">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Account Permanently
                      </Button>
                    } />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Account Permanently?</DialogTitle>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <p className="text-muted-foreground font-bold">
                          This is a destructive action!
                        </p>
                        <p className="text-muted-foreground">
                          This action will permanently delete all your data and the entire organization account. This cannot be undone.
                        </p>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Type "deletePermanentlyrpj" to confirm:
                          </label>
                          <Input 
                            type="text" 
                            value={deleteAccountPassword}
                            onChange={(e) => setDeleteAccountPassword(e.target.value)}
                            placeholder="Enter confirmation code"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" disabled={isSubmitting} onClick={() => setIsDeleteAccountOpen(false)}>Cancel</Button>
                        <Button 
                          disabled={isSubmitting || deleteAccountPassword !== 'deletePermanentlyrpj'} 
                          className="bg-red-600 hover:bg-red-700 text-primary-foreground disabled:opacity-50" 
                          onClick={handleDeleteAccount}
                        >
                          {isSubmitting ? 'Deleting...' : 'Yes, Delete Account'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
