import React, { useEffect, useState, useRef } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Mail,
  Building2,
  Briefcase,
  Laptop,
  Printer,
  RefreshCw,
  MapPin
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
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { printTable } from '../lib/print';
import { useDateFormatter } from '../lib/useDateFormatter';
import { toast } from 'sonner';
import { useActionManager } from '../lib/actionManager';
import { Location } from '../lib/types';

const DEPARTMENTS = ['HR', 'Purchase', 'Accounts', 'Mechanical', 'Bottling', 'Power Plant', 'Production', 'Excise'];

export default function Employees() {
  const { profile, organization } = useAuth();
  const formatDate = useDateFormatter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [employeeLocation, setEmployeeLocation] = useState('');
  const [employeeDept, setEmployeeDept] = useState('');
  
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  
  // Assets view state
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);

  const [offboardData, setOffboardData] = useState<{ employeeId: string, employeeCode: string, data: any, editingEmployee: any, assignments: any[] } | null>(null);
  const [offboardAction, setOffboardAction] = useState<'unassign' | 'transfer'>('unassign');
  const [transferTargetEmployee, setTransferTargetEmployee] = useState<string>('');

  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadEmployees = async (isNextPage = false) => {
    setLoading(true);
    const { docs, lastDoc: newLast, hasMore: more } = await api.listPaginated(
       'employees', 
       [orderBy('createdAt', 'desc')], 
       50, 
       isNextPage ? lastDoc : undefined
    );
    
    if (isNextPage) {
       setEmployees(prev => [...prev, ...docs]);
    } else {
       setEmployees(docs);
    }
    setLastDoc(newLast);
    setHasMore(more);
    setLoading(false);
  };

  useEffect(() => {
    if (!profile || !organization) return;
    loadEmployees();
    api.list('locations').then(res => setLocations(res as Location[]));
    
    api.listPaginated('assignments', [where('status', '==', 'active')], 500).then(res => setAllAssignments(res.docs));
    api.listPaginated('assets', [where('status', '==', 'assigned')], 500).then(res => setAllAssets(res.docs));
  }, [profile, organization]);

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name?.toLowerCase().includes(search.toLowerCase()) || 
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.department?.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode?.toLowerCase().includes(search.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getEmployeeAssets = (employeeId: string) => {
    const employeeAssignments = allAssignments.filter(a => a.employeeId === employeeId && !a.returnedAt);
    return employeeAssignments.map(a => {
      const asset = allAssets.find(as => as.id === a.assetId);
      return { ...asset, assignmentId: a.id, assignedAt: a.assignedAt };
    });
  };

  const handleSendMail = (employee: any) => {
    const assets = getEmployeeAssets(employee.id);
    const assetList = assets.map(a => `- ${a.brand || ''} ${a.model || ''} (${a.assetCode || a.tag || 'Unknown'})`).join('\r\n');
    
    const subject = encodeURIComponent('Asset Management Update');
    const body = encodeURIComponent(`Hi ${employee.name},\r\n\r\nThis is an update regarding your assigned assets.\r\n\r\nCurrently assigned assets:\r\n${assetList || 'No assets currently assigned.'}\r\n\r\nRegards,\r\nManagement`);
    
    window.location.href = `mailto:${employee.email}?subject=${subject}&body=${body}`;
  };

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmittingState] = useState(false);
  const actionManager = useActionManager();

  const isSubmittingRef = useRef(false);

  const setIsSubmitting = (val: boolean) => {
    isSubmittingRef.current = val;
    setIsSubmittingState(val);
  };

  const handleDeleteClick = (id: string) => {
    const assets = getEmployeeAssets(id);
    if (assets.length > 0) {
      toast.error('Unassign the assets first to delete the employee');
      return;
    }
    setEmployeeToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete || isSubmittingRef.current) return;
    setIsSubmitting(true);
    try {
      const empToDelete = employees.find(e => e.id === employeeToDelete);
      if (empToDelete) {
        await actionManager.delete('employees', employeeToDelete, empToDelete, 'Employee deleted');
      }
      setEmployees(prev => prev.filter(e => e.id !== employeeToDelete));
      setIsDeleteOpen(false);
      setEmployeeToDelete(null);
    } catch (error) {
      toast.error('Failed to delete employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isUnassignOpen, setIsUnassignOpen] = useState(false);
  const [assetToUnassign, setAssetToUnassign] = useState<{assignmentId: string, assetId: string} | null>(null);

  const handleUnassignClick = (assignmentId: string, assetId: string) => {
    setAssetToUnassign({ assignmentId, assetId });
    setIsUnassignOpen(true);
  };

  const confirmUnassign = async () => {
    if (!assetToUnassign || isSubmittingRef.current) return;
    setIsSubmitting(true);
    try {
      const assignmentId = assetToUnassign.assignmentId;
      const assetId = assetToUnassign.assetId;
      const prevAssignment = allAssignments.find(a => a.id === assignmentId);
      const prevAsset = allAssets.find(a => a.id === assetId);

      await actionManager.executeComplex('Asset unassigned successfully',
        async () => {
          try {
            await api.update('assignments', assignmentId, { 
              returnedAt: new Date().toISOString(),
              status: 'returned'
            });
          } catch (e: any) {
            throw new Error('UpdateAssignment Failed: ' + e.message);
          }
          
          try {
            await api.update('assets', assetId, { 
              status: 'available',
              assignedTo: '',
              orgId: profile?.activeOrgId
            });
          } catch (e: any) {
            throw new Error('UpdateAsset Failed: ' + e.message);
          }
        },
        async () => {
          if (prevAssignment) {
            await api.update('assignments', assignmentId, prevAssignment);
          }
          if (prevAsset) {
            await api.update('assets', assetId, prevAsset);
          }
        }
      );
      
      // We don't have to refetch employees, but we do need to refresh assignments since Employees view depends on it
      api.listPaginated('assignments', [where('status', '==', 'active')], 500).then(res => setAllAssignments(res.docs));

      setIsUnassignOpen(false);
      setAssetToUnassign(null);
    } catch (error: any) {
      toast.error('Failed to unassign asset: ' + (error?.message || String(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOffboardSubmit = async () => {
    if (!offboardData) return;
    setIsSubmitting(true);
    
    try {
      const { data, editingEmployee, employeeCode, assignments } = offboardData;
      
      // Handle the assignments first
      if (offboardAction === 'unassign') {
        for (const assignment of assignments) {
          await api.update('assignments', assignment.id, {
            returnedAt: new Date().toISOString(),
            status: 'returned'
          });
          await api.update('assets', assignment.assetId, { status: 'available' });
        }
      } else if (offboardAction === 'transfer') {
        if (!transferTargetEmployee) {
          toast.error('Please select an employee to transfer assets to.');
          setIsSubmitting(false);
          return;
        }
        for (const assignment of assignments) {
          // Return the old assignment
          await api.update('assignments', assignment.id, {
            returnedAt: new Date().toISOString(),
            status: 'returned'
          });
          
          // Create new assignment
          await api.create('assignments', {
            assetId: assignment.assetId,
            orgId: organization?.id,
            assigneeType: 'employee',
            employeeId: transferTargetEmployee, // ID of new employee
            assignedAt: new Date().toISOString(),
            status: 'active',
            performedBy: profile?.name || 'System'
          });
          
          // Asset status remains 'assigned', but we might need to update its location
          const targetEmp = employees.find(e => e.id === transferTargetEmployee);
          if (targetEmp?.locationId) {
             await api.update('assets', assignment.assetId, { locationId: targetEmp.locationId });
          }
        }
      }
      
      // Run normal update
      await actionManager.update('employees', editingEmployee.id, data, editingEmployee, 'Employee updated and assets handled successfully');
      const updatedDoc = await api.get('employees', editingEmployee.id);
      if (updatedDoc) {
        setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? updatedDoc : e));
      }
      
      // Refresh assignments
      api.listPaginated('assignments', [where('status', '==', 'active')], 500).then(res => setAllAssignments(res.docs));
      
      setOffboardData(null);
      setIsAddOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      toast.error('Error during offboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      ...Object.fromEntries(formData.entries()),
      department: employeeDept,
      locationId: employeeLocation,
      orgId: profile!.activeOrgId!
    } as any;
    const employeeCode = data.employeeCode as string;

    if (data.dateOfLeaving && new Date(data.dateOfLeaving) <= new Date()) {
      data.status = 'left';
    } else {
      data.status = 'active';
    }
    
    // Check if this is an offboarding action
    if (editingEmployee && data.dateOfLeaving && !editingEmployee.dateOfLeaving) {
      const activeAssignments = allAssignments.filter(a => a.employeeId === editingEmployee.id && (!a.status || a.status === 'active'));
      if (activeAssignments.length > 0) {
        setOffboardData({
          employeeId: editingEmployee.id,
          employeeCode,
          data,
          editingEmployee,
          assignments: activeAssignments
        });
        setIsSubmitting(false);
        return; // Pause the save operation to show modal
      }
    }

    setIsSubmitting(true);
    try {
      const matches = (await api.list('employees', [where('employeeCode', '==', employeeCode)])) as any[];
      const existing = matches.find(e => e.id !== editingEmployee?.id);
      
      if (existing) {
        toast.error('Employee code already in use');
        return;
      }
      
      if (editingEmployee) {
        await actionManager.update('employees', editingEmployee.id, data, editingEmployee, 'Employee updated successfully');
        const updatedDoc = await api.get('employees', editingEmployee.id);
        if (updatedDoc) {
          setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? updatedDoc : e));
        }
      } else {
        let newId = '';
        await actionManager.executeComplex('Employee created successfully',
          async () => {
            newId = await api.create('employees', { ...data, status: data.status || 'active' }) as string;
          },
          async () => {
            if (newId) await api.delete('employees', newId);
          }
        );
        if (newId) {
          const newDoc = await api.get('employees', newId);
          if (newDoc) {
            setEmployees(prev => [newDoc, ...prev]);
          }
        }
      }
      setIsAddOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      toast.error('Failed to save employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSelected = () => {
    const selectedData = employees
      .filter(e => selectedEmployees.includes(e.id))
      .map(emp => [
        emp.employeeCode || '-',
        emp.name || '-',
        emp.email || '-',
        emp.department || '-',
        emp.designation || '-',
        emp.status || '-'
      ]);

    printTable(
      'Selected Employees',
      ['Code', 'Name', 'Email', 'Department', 'Designation', 'Status'],
      selectedData
    );
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Employee Directory</h2>
          <p className="text-muted-foreground">Manage personnel and their asset assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadEmployees()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {profile?.role !== 'viewer' && (
            <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setEditingEmployee(null);
              setEmployeeLocation('');
              setEmployeeDept('');
            }
          }}>
            <DialogTrigger render={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
              </DialogHeader>
              <form key={editingEmployee ? editingEmployee.id : 'new'} onSubmit={handleSave} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employee Code</label>
                    <Input 
                      name="employeeCode" 
                      defaultValue={editingEmployee?.employeeCode} 
                      required 
                      placeholder="12345" 
                      pattern="\d{5}" 
                      maxLength={5}
                      title="Employee code must be exactly 5 digits"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input name="name" defaultValue={editingEmployee?.name} required placeholder="John Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input name="email" type="email" defaultValue={editingEmployee?.email} required placeholder="john@nvgroup.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Joining</label>
                    <Input name="dateOfJoining" type="date" defaultValue={editingEmployee?.dateOfJoining} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Leaving</label>
                    <Input name="dateOfLeaving" type="date" defaultValue={editingEmployee?.dateOfLeaving} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Location</label>
                    <Select value={employeeLocation} onValueChange={(val) => { setEmployeeLocation(val); setEmployeeDept(''); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Location">
                          {(val: any) => val ? locations.find(l => l.id === val)?.name : 'Select Location'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(l => <SelectItem key={l.id} value={l.id!}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <Select value={employeeDept} onValueChange={setEmployeeDept} disabled={!employeeLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.find(l => l.id === employeeLocation)?.departments?.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>) || <SelectItem value="_none" disabled>No departments</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Designation</label>
                  <Input name="designation" defaultValue={editingEmployee?.designation} required placeholder="Manager" />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isSubmitting ? 'Processing...' : (editingEmployee ? 'Update Employee' : 'Create Employee')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input 
            placeholder="Search by code, name, email or department..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="left">Left (Inactive)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedEmployees.length > 0 && (
        <div className="bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-medium text-gold-800 dark:text-gold-200">
            {selectedEmployees.length} employee(s) selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="bg-card" onClick={handlePrintSelected}>
              <Printer className="w-4 h-4 mr-2" /> Print Selected
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card/95 backdrop-blur-sm rounded-xl border border-border overflow-hidden shadow-sm">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-12 text-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                  checked={filteredEmployees.length > 0 && selectedEmployees.length === filteredEmployees.length}
                  onChange={() => {
                    if (selectedEmployees.length === filteredEmployees.length) {
                      setSelectedEmployees([]);
                    } else {
                      setSelectedEmployees(filteredEmployees.map(e => e.id));
                    }
                  }}
                />
              </TableHead>
              <TableHead className="font-semibold">Code</TableHead>
              <TableHead className="font-semibold">Employee</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="font-semibold">Department</TableHead>
              <TableHead className="font-semibold">Designation</TableHead>
              <TableHead className="font-semibold">DOJ</TableHead>
              <TableHead className="font-semibold">DOL</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading employees...</TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No employees found.</TableCell>
              </TableRow>
            ) : filteredEmployees.map((employee) => (
              <TableRow key={employee.id} className="hover:bg-muted transition-colors">
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployees([...selectedEmployees, employee.id]);
                      } else {
                        setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium text-gold-600">
                  <button 
                    onClick={() => {
                      setViewingEmployee(employee);
                      setIsAssetsOpen(true);
                    }}
                    className="hover:underline text-left"
                  >
                    {employee.employeeCode}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar name={employee.name} email={employee.email} />
                    <div>
                      <button 
                        onClick={() => {
                          setViewingEmployee(employee);
                          setIsAssetsOpen(true);
                        }}
                        className="font-medium text-foreground hover:text-gold-600 hover:underline text-left block"
                      >
                        {employee.name}
                      </button>
                      <p className="text-xs text-muted-foreground">{employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                    <MapPin className="w-4 h-4 text-muted-foreground/70" />
                    {locations.find(l => l.id === employee.locationId)?.name || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4 text-muted-foreground/70" />
                    {employee.department || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4 text-muted-foreground/70" />
                    {employee.designation}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">
                    {employee.dateOfJoining ? formatDate(employee.dateOfJoining) : '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">
                    {employee.dateOfLeaving ? formatDate(employee.dateOfLeaving) : '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={employee.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-foreground/80 border-border capitalize'}>
                    {employee.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => {
                        setViewingEmployee(employee);
                        setIsAssetsOpen(true);
                      }}>
                        <Laptop className="w-4 h-4 mr-2" /> View Assets
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingEmployee(employee);
                        setEmployeeLocation(employee.locationId || '');
                        setEmployeeDept(employee.department || '');
                        setIsAddOpen(true);
                      }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendMail(employee)}>
                        <Mail className="w-4 h-4 mr-2" /> Send Email
                      </DropdownMenuItem>
                      {(profile?.role === 'admin' || profile?.role === 'owner') && (
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleDeleteClick(employee.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Employee
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
             <Button variant="outline" onClick={() => loadEmployees(true)} disabled={loading}>
               {loading ? 'Loading...' : 'Load More Employees'}
             </Button>
           </div>
        )}
      </div>
      <Dialog open={isAssetsOpen} onOpenChange={setIsAssetsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Assigned Assets - {viewingEmployee?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {viewingEmployee && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg border border-border/50">
                  <EmployeeAvatar name={viewingEmployee.name} email={viewingEmployee.email} className="w-12 h-12 text-lg" />
                  <div>
                    <h3 className="font-bold text-foreground">{viewingEmployee.name}</h3>
                    <p className="text-sm text-muted-foreground">{viewingEmployee.employeeCode} • {viewingEmployee.department}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Currently Assigned</h4>
                  {getEmployeeAssets(viewingEmployee.id).length === 0 ? (
                    <div className="text-center py-8 bg-muted rounded-lg border border-dashed border-border">
                      <Laptop className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No assets currently assigned to this employee.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y divide-border/50 overflow-hidden">
                      {getEmployeeAssets(viewingEmployee.id).map((asset: any) => (
                        <div key={asset.assignmentId} className="p-4 flex items-center justify-between hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gold-50 rounded-lg">
                              <Laptop className="w-5 h-5 text-gold-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {asset.name || 'Unknown Asset'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {asset.assetCode || 'No Code'} • {asset.category || 'Unknown Category'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="bg-gold-50 text-gold-700 border-gold-100">
                              Active
                            </Badge>
                            {profile?.role !== 'viewer' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleUnassignClick(asset.assignmentId, asset.id)}
                              >
                                Unassign
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssetsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Are you sure you want to delete this employee? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-primary-foreground" onClick={confirmDelete}>
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUnassignOpen} onOpenChange={setIsUnassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign Asset</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Are you sure you want to unassign this asset from the employee?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setIsUnassignOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-primary-foreground" onClick={confirmUnassign}>
              {isSubmitting ? 'Unassigning...' : 'Unassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!offboardData} onOpenChange={(open) => { if (!open) setOffboardData(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Handle Assigned Assets</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This employee has <strong>{offboardData?.assignments?.length}</strong> active asset assignment(s). Please choose how to handle them before marking the employee as leaving.
            </p>
            
            <div className="space-y-4 pt-2">
              <div 
                className={`p-3 border rounded-lg cursor-pointer flex gap-3 transition-colors ${offboardAction === 'unassign' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                onClick={() => setOffboardAction('unassign')}
              >
                <input type="radio" className="mt-1" checked={offboardAction === 'unassign'} onChange={() => {}} />
                <div>
                  <h4 className="font-medium text-sm">Unassign All Assets</h4>
                  <p className="text-xs text-muted-foreground">Assets will be marked as available and returned to inventory.</p>
                </div>
              </div>
              
              <div 
                className={`p-3 border rounded-lg cursor-pointer flex gap-3 transition-colors ${offboardAction === 'transfer' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                onClick={() => setOffboardAction('transfer')}
              >
                <input type="radio" className="mt-1" checked={offboardAction === 'transfer'} onChange={() => {}} />
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium text-sm">Transfer Assets to Another Employee</h4>
                  <p className="text-xs text-muted-foreground">All assets will be reassigned to the selected employee.</p>
                  
                  {offboardAction === 'transfer' && (
                    <div className="pt-2" onClick={e => e.stopPropagation()}>
                      <Select value={transferTargetEmployee} onValueChange={setTransferTargetEmployee}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select an employee...">
                            {(val: any) => {
                              if (!val) return 'Select an employee...';
                              const emp = employees.find(e => e.id === val);
                              return emp ? `${emp.name} (${emp.employeeCode})` : 'Select an employee...';
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {employees.filter(e => e.id !== offboardData?.employeeId && !e.dateOfLeaving).map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name} ({e.employeeCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Show a mini list of assets */}
            <div className="mt-4 border rounded-md overflow-hidden max-h-40 overflow-y-auto">
               <div className="bg-muted px-3 py-2 text-xs font-semibold">Assets to be handled:</div>
               <div className="divide-y divide-border">
                 {offboardData?.assignments?.map((a: any) => {
                   const assetInfo = allAssets.find(as => as.id === a.assetId);
                   return (
                     <div key={a.id} className="px-3 py-2 text-xs flex justify-between">
                       <span>{assetInfo?.name || 'Unknown'}</span>
                       <span className="text-muted-foreground">{assetInfo?.assetCode}</span>
                     </div>
                   );
                 })}
               </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setOffboardData(null)}>Cancel</Button>
            <Button disabled={isSubmitting || (offboardAction === 'transfer' && !transferTargetEmployee)} className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleOffboardSubmit}>
              {isSubmitting ? 'Processing...' : 'Confirm & Save Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
