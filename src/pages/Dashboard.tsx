import React, { useEffect, useState } from 'react';
import { orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Laptop, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowLeftRight,
  ArrowRight,
  Wrench,
  UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { useDateFormatter } from '../lib/useDateFormatter';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function Dashboard() {
  const { profile, organization } = useAuth();
  const formatDate = useDateFormatter();
  const [stats, setStats] = useState({
    totalAssets: 0,
    assignedAssets: 0,
    availableAssets: 0,
    maintenanceAssets: 0,
    inRepairAssets: 0,
    damagedAssets: 0,
    totalEmployees: 0,
  });

  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [locationData, setLocationData] = useState<any[]>([]);
  const [recentAssets, setRecentAssets] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<{title: string, status: string | null} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !organization) return;
    
    // We use a caching/memory aggregation strategy to prevent O(n) read costs from missing indexes
    // Fetch all active assets and employees once and aggregate
    const fetchData = async () => {
      try {
        setLoading(true);
        const [assets, employees, locations] = await Promise.all([
          api.list('assets'),
          api.list('employees'),
          api.list('locations')
        ]);
        
        setAllAssets(assets);

        setStats({
          totalAssets: assets.length,
          assignedAssets: assets.filter((a: any) => a.status === 'assigned').length,
          availableAssets: assets.filter((a: any) => a.status === 'available').length,
          maintenanceAssets: assets.filter((a: any) => a.status === 'maintenance').length,
          inRepairAssets: assets.filter((a: any) => a.status === 'in repair' || a.status === 'repair').length,
          damagedAssets: assets.filter((a: any) => a.status === 'damaged').length,
          totalEmployees: employees.length,
        });

        // Category Breakdown
        const catMap: Record<string, number> = {};
        assets.forEach((a: any) => {
           const cat = a.category || 'Uncategorized';
           catMap[cat] = (catMap[cat] || 0) + 1;
        });
        const catData = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] }));
        setCategoryData(catData.length > 0 ? catData : [{ name: 'No Assets', value: 0 }]);

        // Department Breakdown
        const deptMap: Record<string, number> = {};
        employees.forEach((e: any) => {
           const dept = e.department || 'Unknown';
           deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        const deptData = Object.keys(deptMap).map(k => ({ name: k, value: deptMap[k] }));
        setDepartmentData(deptData.length > 0 ? deptData : [{ name: 'No Data', value: 1 }]);

        // Location Breakdown
        const locMap: Record<string, number> = {};
        const locIdMap: Record<string, string> = {};
        locations.forEach((l: any) => { locIdMap[l.id] = l.name });
        
        assets.forEach((a: any) => {
           const locName = locIdMap[a.locationId] || 'Unassigned / Unknown';
           locMap[locName] = (locMap[locName] || 0) + 1;
        });
        const lData = Object.keys(locMap).map(k => ({ name: k, value: locMap[k] }));
        setLocationData(lData.length > 0 ? lData : [{ name: 'No Assets', value: 0 }]);

        // Recent Assets (Top 5 recently added or updated)
        const sortedAssets = [...assets].sort((a: any, b: any) => {
          const d1 = new Date(b.updatedAt || b.createdAt || 0).getTime();
          const d2 = new Date(a.updatedAt || a.createdAt || 0).getTime();
          return d1 - d2;
        });
        setRecentAssets(sortedAssets.slice(0, 5));

      } catch (error) {
        console.error("Dashboard fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.uid, organization?.id]);

  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);

  const handleStatClick = (title: string, status: string | null) => {
    setSelectedStatus({ title, status });
    // Aggregation from allAssets directly (0 reads)
    const filtered = status 
      ? allAssets.filter(a => a.status === status || (status === 'in repair' && a.status === 'repair'))
      : allAssets;
      
    const catMap: Record<string, number> = {};
    filtered.forEach(a => {
        const cat = a.category || 'Uncategorized';
        catMap[cat] = (catMap[cat] || 0) + 1;
    });
    
    const breakdown = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] }));
    setStatusBreakdown(breakdown);
  };

  const COLORS = ['#d4af37', '#10b981', '#3b82f6', '#f43f5e', '#8b5cf6', '#f59e0b', '#06b6d4', '#6366f1'];

  if (loading) return <div className="animate-pulse space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
    </div>
  </div>;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground">Real-time status of all assets across the organization.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto mt-2 md:mt-0">
          <Link to="/assets" className="flex-1 sm:flex-none">
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-2 sm:px-4">
              <Plus className="w-4 h-4 shrink-0 mr-1.5 sm:mr-2" />
              <span className="truncate text-xs sm:text-sm">Add Asset</span>
            </Button>
          </Link>
          <Link to="/employees" className="flex-1 sm:flex-none">
            <Button className="w-full bg-gold-600 hover:bg-gold-700 text-primary-foreground shadow-sm px-2 sm:px-4">
              <UserPlus className="w-4 h-4 shrink-0 mr-1.5 sm:mr-2" />
              <span className="truncate text-xs sm:text-sm">Add Employee</span>
            </Button>
          </Link>
          <Link to="/assignments" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full shadow-sm border-border px-2 sm:px-4">
              <ArrowLeftRight className="w-4 h-4 shrink-0 mr-1.5 sm:mr-2" />
              <span className="truncate text-xs sm:text-sm">Assign</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard 
          title="Total Assets" 
          value={stats.totalAssets} 
          icon={Laptop} 
          color="gold"
          trend="+2.5%"
          trendUp={true}
          onClick={() => handleStatClick('Total Assets', null)}
        />
        <StatCard 
          title="Assigned" 
          value={stats.assignedAssets} 
          icon={CheckCircle2} 
          color="green"
          trend="+4.1%"
          trendUp={true}
          onClick={() => handleStatClick('Assigned Assets', 'assigned')}
        />
        <StatCard 
          title="Available" 
          value={stats.availableAssets} 
          icon={Clock} 
          color="amber"
          trend="-1.2%"
          trendUp={false}
          onClick={() => handleStatClick('Available Assets', 'available')}
        />
        <StatCard 
          title="Maintenance" 
          value={stats.maintenanceAssets} 
          icon={AlertCircle} 
          color="red"
          trend="+0.5%"
          trendUp={true}
          onClick={() => handleStatClick('Assets in Maintenance', 'maintenance')}
        />
        <StatCard 
          title="In Repair" 
          value={stats.inRepairAssets} 
          icon={Wrench} 
          color="orange"
          trend="+1.0%"
          trendUp={true}
          onClick={() => handleStatClick('Assets in Repair', 'in repair')}
        />
        <StatCard 
          title="Damaged" 
          value={stats.damagedAssets} 
          icon={AlertCircle} 
          color="red"
          trend="-0.5%"
          trendUp={false}
          onClick={() => handleStatClick('Damaged Assets', 'damaged')}
        />
      </div>

      {/* Row 1: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-border/50 bg-card/95 backdrop-blur-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Assets by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" fill="#d4af37" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 flex flex-col bg-card/95 backdrop-blur-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Assets by Location</CardTitle>
            <CardDescription>Asset distribution across locations</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={locationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                >
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Charts and recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <Card className="lg:col-span-1 shadow-sm border-border/50 flex flex-col bg-card/95 backdrop-blur-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Employees by Department</CardTitle>
            <CardDescription>Employee distribution across teams</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity Section */}
        <Card className="lg:col-span-2 shadow-sm border-border/50 overflow-hidden bg-card/95 backdrop-blur-sm rounded-2xl h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Recently Added / Updated Assets</CardTitle>
              <CardDescription>Latest assets added or modified in the system</CardDescription>
            </div>
            <Link to="/assets">
              <Button variant="ghost" size="sm" className="text-gold-600 hover:text-gold-700 hover:bg-gold-50">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            <div className="divide-y divide-border/50">
              {recentAssets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No recent assets found.</div>
              ) : (
                recentAssets.map((asset) => (
                  <div key={asset.id} className="p-4 flex items-center justify-between hover:bg-muted transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gold-50 flex items-center justify-center text-gold-600 shrink-0">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{asset.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {asset.assetCode} • {asset.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                      <Badge variant="outline" className={
                        asset.status === 'available' ? 'bg-green-50 text-green-700 border-green-200' : 
                        asset.status === 'assigned' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-muted text-muted-foreground'
                      }>
                        {asset.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(asset.updatedAt || asset.createdAt, false)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      <Dialog open={!!selectedStatus} onOpenChange={(open) => !open && setSelectedStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedStatus?.title} - Category Breakdown</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {statusBreakdown.length > 0 ? (
              <div className="space-y-4">
                {statusBreakdown.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                     <span className="text-muted-foreground capitalize">{item.name}</span>
                     <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No assets found for this status.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, trendUp, onClick }: any) {
  const colors: any = {
    gold: 'from-amber-50 to-amber-100/50 text-amber-600',
    blue: 'from-blue-50 to-blue-100/50 text-blue-600',
    green: 'from-emerald-50 to-emerald-100/50 text-emerald-600',
    amber: 'from-orange-50 to-orange-100/50 text-orange-600',
    red: 'from-rose-50 to-rose-100/50 text-rose-600',
    orange: 'from-orange-50 to-orange-100/50 text-orange-600',
  };

  return (
    <Card 
      className={cn(
        "relative overflow-hidden bg-card border border-border/50 rounded-2xl transition-all duration-300",
        "shadow-sm",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-border"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>
          </div>
          <div className={cn("p-3 rounded-2xl bg-gradient-to-br", colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

