import React, { useEffect, useState, useRef } from 'react';
import { cn } from '../lib/utils';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  History,
  User,
  Laptop,
  Calendar,
  ArrowLeftRight,
  Plus,
  Printer,
  Building2,
  Trash2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
import { Badge } from '../components/ui/badge';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from '../components/ui/dialog';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { printTable } from '../lib/print';
import { useDateFormatter } from '../lib/useDateFormatter';
import { toast } from 'sonner';
import { useActionManager } from '../lib/actionManager';

const DEPARTMENTS = ['HR', 'Purchase', 'Accounts', 'Mechanical', 'Bottling', 'Power Plant', 'Production', 'Excise'];

export default function Assignments() {
  const { profile, organization } = useAuth();
  const formatDate = useDateFormatter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [inactiveAssignments, setInactiveAssignments] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [isSubmitting, setIsSubmittingState] = useState(false);
  const isSubmittingRef = useRef(false);

  const setIsSubmitting = (val: boolean) => {
    isSubmittingRef.current = val;
    setIsSubmittingState(val);
  };
  
  // Assign state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [assigneeType, setAssigneeType] = useState<'employee' | 'department'>('employee');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'department' | 'category'>('list');

  // Return state
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returningAssignment, setReturningAssignment] = useState<any>(null);
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);

  // Delete history state
  const [isDeleteHistoryOpen, setIsDeleteHistoryOpen] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState<any>(null);

  useEffect(() => {
    if (!profile || !organization) return;
    const unsubAssignments = api.subscribe('assignments', [], (data) => {
      // Separate active and inactive assignments
      const active = data.filter(a => !a.returnedAt);
      const inactive = data.filter(a => a.returnedAt);

      // Sort assignments by date descending
      setAssignments(active.sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()));
      setInactiveAssignments(inactive.sort((a, b) => new Date(b.returnedAt).getTime() - new Date(a.returnedAt).getTime()));
      setLoading(false);
    });
    const unsubAssets = api.subscribe('assets', [], setAssets);
    const unsubEmployees = api.subscribe('employees', [], setEmployees);

    return () => {
      unsubAssignments();
      unsubAssets();
      unsubEmployees();
    };
  }, [profile, organization]);

  const getAssetName = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return 'Unknown Asset';
    return asset.assetCode ? `${asset.assetCode} - ${asset.name}` : asset.name;
  };

  const getEmployeeName = (id: string) => {
    const employee = employees.find(e => e.id === id);
    return employee ? employee.name : 'Unknown Employee';
  };

  const getEmployeeCode = (id: string) => {
    const employee = employees.find(e => e.id === id);
    return employee ? employee.employeeCode : 'N/A';
  };

  const actionManager = useActionManager();

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!selectedAsset) return toast.error('Please select an asset');
    if (assigneeType === 'employee' && !selectedEmployee) return toast.error('Please select an employee');
    if (assigneeType === 'department' && !selectedDepartment) return toast.error('Please select a department');

    const formData = new FormData(e.currentTarget);
    const remarks = formData.get('remarks') as string;

    setIsSubmitting(true);
    try {
      let assignmentId = '';
      const asset = assets.find((a: any) => a.id === selectedAsset);
      const prevAssetStatus = asset ? asset.status : 'available';

      await actionManager.executeComplex('Asset assigned successfully',
        async () => {
          if (!assignmentId) {
            assignmentId = await api.create('assignments', {
              assetId: selectedAsset,
              assigneeType,
              ...(assigneeType === 'employee' ? { employeeId: selectedEmployee } : { department: selectedDepartment }),
              assignedAt: new Date().toISOString(),
              status: 'active',
              remarks: remarks || ''
            }) as string;
          } else {
            await api.set('assignments', assignmentId, {
              assetId: selectedAsset,
              assigneeType,
              ...(assigneeType === 'employee' ? { employeeId: selectedEmployee } : { department: selectedDepartment }),
              assignedAt: new Date().toISOString(),
              status: 'active',
              remarks: remarks || ''
            });
          }
          await api.update('assets', selectedAsset, { status: 'assigned' });
        },
        async () => {
          if (assignmentId) {
            await api.delete('assignments', assignmentId);
          }
          await api.update('assets', selectedAsset, { status: prevAssetStatus });
        }
      );
      
      setIsAssignOpen(false);
      setSelectedAsset('');
      setSelectedEmployee('');
      setSelectedDepartment('');
      setEmployeeSearch('');
      setAssetSearch('');
    } catch (error) {
      toast.error('Failed to assign asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReturn = async () => {
    if (!returningAssignment || isSubmittingRef.current) return;
    setIsSubmitting(true);
    try {
      const prevAssignmentStatus = returningAssignment.status;
      const prevReturnedAt = returningAssignment.returnedAt;
      const asset = assets.find((a: any) => a.id === returningAssignment.assetId);
      const prevAssetStatus = asset ? asset.status : 'assigned';

      await actionManager.executeComplex('Asset returned successfully',
        async () => {
          await api.update('assignments', returningAssignment.id, { 
            returnedAt: new Date().toISOString(),
            status: 'returned'
          });
          await api.update('assets', returningAssignment.assetId, { 
            status: 'available'
          });
        },
        async () => {
          await api.update('assignments', returningAssignment.id, { 
            returnedAt: prevReturnedAt || null,
            status: prevAssignmentStatus
          });
          await api.update('assets', returningAssignment.assetId, { 
            status: prevAssetStatus
          });
        }
      );
      
      setIsReturnOpen(false);
      setReturningAssignment(null);
    } catch (error) {
      toast.error('Failed to return asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteHistory = async () => {
    if (!deletingHistory || isSubmittingRef.current) return;
    setIsSubmitting(true);
    try {
      await actionManager.delete('assignments', deletingHistory.id, deletingHistory, 'Assignment history deleted successfully');
      setIsDeleteHistoryOpen(false);
      setDeletingHistory(null);
    } catch (error) {
      toast.error('Failed to delete assignment history');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAssignments = assignments.filter(a => {
    const assetName = getAssetName(a.assetId).toLowerCase();
    const employeeName = a.assigneeType === 'department' ? (a.department || '').toLowerCase() : getEmployeeName(a.employeeId).toLowerCase();
    const employeeCode = a.assigneeType === 'department' ? '' : getEmployeeCode(a.employeeId).toLowerCase();
    return assetName.includes(search.toLowerCase()) || 
           employeeName.includes(search.toLowerCase()) ||
           employeeCode.includes(search.toLowerCase());
  });

  const filteredInactiveAssignments = inactiveAssignments.filter(a => {
    const assetName = getAssetName(a.assetId).toLowerCase();
    const employeeName = a.assigneeType === 'department' ? (a.department || '').toLowerCase() : getEmployeeName(a.employeeId).toLowerCase();
    const employeeCode = a.assigneeType === 'department' ? '' : getEmployeeCode(a.employeeId).toLowerCase();
    return assetName.includes(search.toLowerCase()) || 
           employeeName.includes(search.toLowerCase()) ||
           employeeCode.includes(search.toLowerCase());
  });

  const availableAssets = assets.filter(a => a.status === 'available');

  const handlePrintActive = () => {
    const selectedData = assignments
      .filter(a => selectedAssignments.includes(a.id))
      .map(a => [
        getAssetName(a.assetId),
        a.assigneeType === 'department' ? `Department: ${a.department}` : getEmployeeName(a.employeeId),
        formatDate(a.assignedAt),
        'Active'
      ]);

    printTable(
      'Selected Active Assignments',
      ['Asset', 'Assignee', 'Assigned Date & Time', 'Status'],
      selectedData
    );
  };

  const handlePrintHistory = () => {
    const selectedData = inactiveAssignments
      .filter(a => selectedHistory.includes(a.id))
      .map(a => [
        getAssetName(a.assetId),
        a.assigneeType === 'department' ? `Department: ${a.department}` : getEmployeeName(a.employeeId),
        formatDate(a.assignedAt),
        a.returnedAt ? formatDate(a.returnedAt) : '-',
        'Returned'
      ]);

    printTable(
      'Selected Assignment History',
      ['Asset', 'Assignee', 'Assigned Date & Time', 'Returned Date & Time', 'Status'],
      selectedData
    );
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Asset Assignments</h2>
          <p className="text-muted-foreground">Track and manage asset allocations to employees.</p>
        </div>
        
        {profile?.role !== 'viewer' && (
          <Dialog open={isAssignOpen} onOpenChange={(open) => {
        setIsAssignOpen(open);
        if (!open) {
          setEmployeeSearch('');
          setAssetSearch('');
        }
      }}>
            <DialogTrigger render={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Assign Asset</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAssign} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Asset</label>
                  <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose an available asset" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                        <Input 
                          placeholder="Search asset..." 
                          value={assetSearch}
                          onChange={e => setAssetSearch(e.target.value)}
                          onKeyDown={e => e.stopPropagation()}
                        />
                      </div>
                      {availableAssets
                        .filter(a => {
                          const searchStr = assetSearch.toLowerCase();
                          return a.name?.toLowerCase().includes(searchStr) ||
                                 a.assetCode?.toLowerCase().includes(searchStr) ||
                                 a.serialNumber?.toLowerCase().includes(searchStr);
                        })
                        .map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.assetCode ? `${a.assetCode} - ${a.name}` : a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Assign To</label>
                  <Select value={assigneeType} onValueChange={(val: any) => setAssigneeType(val)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Specific Employee</SelectItem>
                      <SelectItem value="department">Entire Department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {assigneeType === 'employee' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Employee</label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose an employee" />
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
                          .filter(e => {
                            if (e.dateOfLeaving) return false;
                            
                            return e.name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                            e.employeeCode?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                            e.designation?.toLowerCase().includes(employeeSearch.toLowerCase());
                          })
                          .map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.employeeCode} - {e.name} ({e.designation})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Department</label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Assignment Remarks (Optional)</label>
                  <textarea 
                    name="remarks" 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                    placeholder="Any notes specifically about this assignment..."
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSubmitting ? 'Assigning...' : 'Assign Asset'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Return Confirmation Dialog */}
      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Return</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this asset as returned? This will make the asset available for reassignment.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsReturnOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={confirmReturn}>
              {isSubmitting ? 'Returning...' : 'Confirm Return'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete History Confirmation Dialog */}
      <Dialog open={isDeleteHistoryOpen} onOpenChange={setIsDeleteHistoryOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this assignment history? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteHistoryOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={confirmDeleteHistory}>
              {isSubmitting ? 'Deleting...' : 'Delete History'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input 
            placeholder="Search by asset or employee..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <SelectTrigger>
              <SelectValue placeholder="View Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">All Assignments</SelectItem>
              <SelectItem value="department">View by Department</SelectItem>
              <SelectItem value="category">View by Asset Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="bg-card/80 backdrop-blur-sm">
          <TabsTrigger value="active">Active Assignments</TabsTrigger>
          <TabsTrigger value="inactive">Assignment History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {selectedAssignments.length > 0 && (
            <div className="bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm font-medium text-gold-800 dark:text-gold-200">
                {selectedAssignments.length} assignment(s) selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="bg-card" onClick={handlePrintActive}>
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
                      checked={filteredAssignments.length > 0 && selectedAssignments.length === filteredAssignments.length}
                      onChange={() => {
                        if (selectedAssignments.length === filteredAssignments.length) {
                          setSelectedAssignments([]);
                        } else {
                          setSelectedAssignments(filteredAssignments.map(a => a.id));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Asset</TableHead>
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Assigned Date & Time</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (loading) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading assignments...</TableCell></TableRow>;
                  if (filteredAssignments.length === 0) return <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No active assignments found.</TableCell></TableRow>;
                  
                  let groups: Record<string, any[]> = { 'All': filteredAssignments };
                  if (viewMode === 'department') {
                    groups = filteredAssignments.reduce((acc, assignment) => {
                      let dept = 'Unknown Department';
                      if (assignment.assigneeType === 'department' && assignment.department) {
                        dept = assignment.department;
                      } else {
                        const emp = employees.find(e => e.id === assignment.employeeId);
                        if (emp?.department) dept = emp.department;
                      }
                      if (!acc[dept]) acc[dept] = [];
                      acc[dept].push(assignment);
                      return acc;
                    }, {} as Record<string, any[]>);
                  } else if (viewMode === 'category') {
                    groups = filteredAssignments.reduce((acc, assignment) => {
                      const asset = assets.find(a => a.id === assignment.assetId);
                      const cat = asset?.category || 'Unknown Category';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(assignment);
                      return acc;
                    }, {} as Record<string, any[]>);
                  }

                  return Object.keys(groups).sort().map(groupName => (
                    <React.Fragment key={groupName}>
                      {viewMode !== 'list' && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30 border-y">
                          <TableCell colSpan={6} className="font-semibold text-primary py-3">
                            {viewMode === 'department' ? 'Department: ' : 'Category: '} {groupName} 
                            <Badge variant="outline" className="ml-2">{groups[groupName].length}</Badge>
                          </TableCell>
                        </TableRow>
                      )}
                      {groups[groupName].map((assignment) => (
                        <TableRow key={assignment.id} className="hover:bg-muted transition-colors cursor-pointer" onClick={() => setViewingAssignment(assignment)}>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                              checked={selectedAssignments.includes(assignment.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAssignments([...selectedAssignments, assignment.id]);
                                } else {
                                  setSelectedAssignments(selectedAssignments.filter(id => id !== assignment.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Laptop className="w-4 h-4 text-muted-foreground/70" />
                              <span className="font-medium">{getAssetName(assignment.assetId)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {assignment.assigneeType === 'department' ? (
                                <>
                                  <div className="w-10 h-10 rounded-full flex-shrink-0 bg-blue-100 flex items-center justify-center text-blue-700">
                                    <Building2 className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-blue-900">{assignment.department}</p>
                                    <p className="text-xs text-muted-foreground mr-1">Department</p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <EmployeeAvatar 
                                    name={getEmployeeName(assignment.employeeId)} 
                                    email={employees.find(e => e.id === assignment.employeeId)?.email || ''} 
                                  />
                                  <div>
                                    <p className="font-medium">{getEmployeeName(assignment.employeeId)}</p>
                                    <p className="text-xs text-muted-foreground">{getEmployeeCode(assignment.employeeId)}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {formatDate(assignment.assignedAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-gold-50 text-gold-700 border-gold-200">
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {profile?.role !== 'viewer' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-gold-600 border-gold-200 hover:bg-gold-50"
                                onClick={() => {
                                  setReturningAssignment(assignment);
                                  setIsReturnOpen(true);
                                }}
                              >
                                <ArrowLeftRight className="w-4 h-4 mr-2" />
                                Return
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          {selectedHistory.length > 0 && (
            <div className="bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm font-medium text-gold-800 dark:text-gold-200">
                {selectedHistory.length} assignment(s) selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="bg-card" onClick={handlePrintHistory}>
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
                      checked={filteredInactiveAssignments.length > 0 && selectedHistory.length === filteredInactiveAssignments.length}
                      onChange={() => {
                        if (selectedHistory.length === filteredInactiveAssignments.length) {
                          setSelectedHistory([]);
                        } else {
                          setSelectedHistory(filteredInactiveAssignments.map(a => a.id));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Asset</TableHead>
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold">Assigned Date & Time</TableHead>
                  <TableHead className="font-semibold">Returned Date & Time</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  {profile?.role === 'owner' && <TableHead className="text-right font-semibold">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (loading) return <TableRow><TableCell colSpan={ profile?.role === 'owner' ? 7 : 6} className="text-center py-8 text-muted-foreground">Loading assignments...</TableCell></TableRow>;
                  if (filteredInactiveAssignments.length === 0) return <TableRow><TableCell colSpan={ profile?.role === 'owner' ? 7 : 6} className="text-center py-8 text-muted-foreground">No assignment history found.</TableCell></TableRow>;
                  
                  let groups: Record<string, any[]> = { 'All': filteredInactiveAssignments };
                  if (viewMode === 'department') {
                    groups = filteredInactiveAssignments.reduce((acc, assignment) => {
                      let dept = 'Unknown Department';
                      if (assignment.assigneeType === 'department' && assignment.department) {
                        dept = assignment.department;
                      } else {
                        const emp = employees.find(e => e.id === assignment.employeeId);
                        if (emp?.department) dept = emp.department;
                      }
                      if (!acc[dept]) acc[dept] = [];
                      acc[dept].push(assignment);
                      return acc;
                    }, {} as Record<string, any[]>);
                  } else if (viewMode === 'category') {
                    groups = filteredInactiveAssignments.reduce((acc, assignment) => {
                      const asset = assets.find(a => a.id === assignment.assetId);
                      const cat = asset?.category || 'Unknown Category';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(assignment);
                      return acc;
                    }, {} as Record<string, any[]>);
                  }

                  return Object.keys(groups).sort().map(groupName => (
                    <React.Fragment key={groupName}>
                      {viewMode !== 'list' && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30 border-y">
                          <TableCell colSpan={profile?.role === 'owner' ? 7 : 6} className="font-semibold text-primary py-3">
                            {viewMode === 'department' ? 'Department: ' : 'Category: '} {groupName} 
                            <Badge variant="outline" className="ml-2">{groups[groupName].length}</Badge>
                          </TableCell>
                        </TableRow>
                      )}
                      {groups[groupName].map((assignment) => (
                        <TableRow key={assignment.id} className="hover:bg-muted transition-colors cursor-pointer" onClick={() => setViewingAssignment(assignment)}>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-gray-300 text-gold-600 focus:ring-gold-600 cursor-pointer"
                              checked={selectedHistory.includes(assignment.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedHistory([...selectedHistory, assignment.id]);
                                } else {
                                  setSelectedHistory(selectedHistory.filter(id => id !== assignment.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Laptop className="w-4 h-4 text-muted-foreground/70" />
                              <span className="font-medium">{getAssetName(assignment.assetId)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {assignment.assigneeType === 'department' ? (
                                <>
                                  <div className="w-10 h-10 rounded-full flex-shrink-0 bg-blue-100 flex items-center justify-center text-blue-700">
                                    <Building2 className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-blue-900">{assignment.department}</p>
                                    <p className="text-xs text-muted-foreground mr-1">Department</p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <EmployeeAvatar 
                                    name={getEmployeeName(assignment.employeeId)} 
                                    email={employees.find(e => e.id === assignment.employeeId)?.email || ''} 
                                  />
                                  <div>
                                    <p className="font-medium">{getEmployeeName(assignment.employeeId)}</p>
                                    <p className="text-xs text-muted-foreground">{getEmployeeCode(assignment.employeeId)}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {formatDate(assignment.assignedAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {assignment.returnedAt ? (
                                <>
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(assignment.returnedAt)}
                                </>
                              ) : (
                                <span className="text-muted-foreground/70">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-muted text-foreground/80">
                              Returned
                            </Badge>
                          </TableCell>
                          {profile?.role === 'owner' && (
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingHistory(assignment);
                                  setIsDeleteHistoryOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewingAssignment} onOpenChange={(open) => !open && setViewingAssignment(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
            <DialogDescription>Information about this specific assignment allocation</DialogDescription>
          </DialogHeader>
          {viewingAssignment && (() => {
            const asset = assets.find(a => a.id === viewingAssignment.assetId);
            return (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Asset</p>
                    <p className="font-semibold">{getAssetName(viewingAssignment.assetId)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assignee</p>
                    <p className="font-semibold">{viewingAssignment.assigneeType === 'department' ? viewingAssignment.department : getEmployeeName(viewingAssignment.employeeId)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned Date</p>
                    <p className="font-medium">{formatDate(viewingAssignment.assignedAt)}</p>
                  </div>
                  {viewingAssignment.returnedAt && (
                    <div>
                      <p className="text-muted-foreground">Returned Date</p>
                      <p className="font-medium">{formatDate(viewingAssignment.returnedAt)}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Assignment Remarks</p>
                    <p className="bg-muted/50 p-3 rounded-md min-h-[60px] whitespace-pre-wrap border border-muted">{viewingAssignment.remarks || 'No remarks for this assignment.'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Asset Remarks</p>
                    <p className="bg-muted p-3 rounded-md min-h-[60px] whitespace-pre-wrap">{asset?.remarks || 'No general remarks for this asset.'}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
