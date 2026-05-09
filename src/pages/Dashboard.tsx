import React, { useEffect, useState } from 'react';
import { orderBy, limit, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { calculateDepreciation } from '../lib/depreciation';
import { 
  Laptop, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  Plus,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowRight,
  Wrench,
  UserPlus,
  Coins,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Layers
} from 'lucide-react';
import { PageSettings } from '../components/PageSettings';
import { useCardLayout } from '../lib/useCardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { useDateFormatter } from '../lib/useDateFormatter';
import { useCurrencyFormatter } from '../lib/useCurrencyFormatter';
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
  const formatCurrency = useCurrencyFormatter();

  const { layout: kpiLayout, toggleVisibility: toggleKpi, moveItem: moveKpi, reorderItems: reorderKpi } = useCardLayout('dashboard_kpi', ['total', 'assigned', 'available', 'maintenance', 'repair', 'damaged', 'inventory']);
  const { layout: chartLayout, toggleVisibility: toggleChart, moveItem: moveChart, reorderItems: reorderChart } = useCardLayout('dashboard_charts', ['category', 'category_list', 'location', 'department', 'recent', 'activity_table', 'alerts', 'financial', 'inventory_recent']);

  const [chartPosition, setChartPosition] = useState<'above' | 'below'>(() => {
    return (localStorage.getItem('dashboard_chart_position') as 'above' | 'below') || 'below';
  });

  useEffect(() => {
    localStorage.setItem('dashboard_chart_position', chartPosition);
  }, [chartPosition]);

  const [stats, setStats] = useState({
    totalAssets: 0,
    assignedAssets: 0,
    availableAssets: 0,
    maintenanceAssets: 0,
    inRepairAssets: 0,
    damagedAssets: 0,
    totalEmployees: 0,
    inventoryStock: 0,
    lowStockItems: 0,
  });

  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [inventoryCategoryData, setInventoryCategoryData] = useState<any[]>([]);
  const [categoryChartType, setCategoryChartType] = useState<'asset' | 'inventory'>('asset');
  const [categoryListChartType, setCategoryListChartType] = useState<'asset' | 'inventory'>('asset');
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [inventoryDepartmentData, setInventoryDepartmentData] = useState<any[]>([]);
  const [departmentChartType, setDepartmentChartType] = useState<'asset' | 'inventory'>('asset');
  const [locationData, setLocationData] = useState<any[]>([]);
  const [inventoryLocationData, setInventoryLocationData] = useState<any[]>([]);
  const [locationChartType, setLocationChartType] = useState<'asset' | 'inventory'>('asset');
  const [recentAssets, setRecentAssets] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [recentInventoryActivity, setRecentInventoryActivity] = useState<any[]>([]);
  const [financialStats, setFinancialStats] = useState({ totalValue: 0, netBookValue: 0, depreciation: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<{title: string, status: string | null} | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<{title: string, data: any[], type: 'asset' | 'inventory'} | null>(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryModalData, setInventoryModalData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  const handleInventoryClick = async () => {
    setShowInventoryModal(true);
    setInventoryModalData(null);
    try {
      const items = await api.list('inventory_items');
      setInventoryModalData((items as any[]) || []);
    } catch (e) {
      console.error(e);
      setInventoryModalData([]);
    }
  };

  useEffect(() => {
    if (!profile?.activeOrgId) return;
    
    // We use a caching/memory aggregation strategy to prevent O(n) read costs from missing indexes
    // Fetch all active assets and employees once and aggregate
    const fetchData = async () => {
      try {
        setLoading(true);
        const orgIdConstraint = where('orgId', '==', profile.activeOrgId);
        const [assets, employees, locations, history, categories, inventoryTxs, invStats, inventory] = await Promise.all([
          api.list('assets', [orgIdConstraint]),
          api.list('employees', [orgIdConstraint]),
          api.list('locations', [orgIdConstraint]),
          api.list('asset_history', [orgIdConstraint]),
          api.list('asset_categories', [orgIdConstraint]),
          api.list('inventory_transactions', [orgIdConstraint, orderBy('timestamp', 'desc'), limit(10)]),
          api.getInventoryStats(),
          api.list('inventory_items', [orgIdConstraint])
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
          inventoryStock: invStats?.totalStock || 0,
          lowStockItems: invStats?.lowStockItems || 0,
        });

        // Category Breakdown
        const catMap: Record<string, number> = {};
        
        // Initialize with all configured categories that are NOT inventory-only
        categories.forEach((cat: any) => {
           if (cat.name && (!cat.usage || cat.usage === 'asset' || cat.usage === 'both')) {
             catMap[cat.name] = 0;
           }
        });

        assets.forEach((a: any) => {
           const cat = a.category || 'Uncategorized';
           const catDef = categories.find((c: any) => c.name === cat) as any;
           if (!catDef || !catDef.usage || catDef.usage === 'asset' || catDef.usage === 'both') {
             catMap[cat] = (catMap[cat] || 0) + 1;
           }
        });
        const catData = Object.keys(catMap).map(k => {
          const catDef = categories.find((c: any) => c.name === k) as any;
          return { name: k, value: catMap[k], targetStock: catDef?.targetStock };
        });
        setCategoryData(catData.length > 0 ? catData : [{ name: 'No Assets', value: 0 }]);

        // Inventory Category Breakdown
        const invCatMap: Record<string, number> = {};
        inventory.forEach((i: any) => {
           const cat = i.category || 'Uncategorized';
           invCatMap[cat] = (invCatMap[cat] || 0) + (Number(i.quantity) || 0);
        });
        const invCatData = Object.keys(invCatMap).map(k => {
          const catDef = categories.find((c: any) => c.name === k) as any;
          return { name: k, value: invCatMap[k], targetStock: catDef?.targetStock };
        });
        setInventoryCategoryData(invCatData.length > 0 ? invCatData : [{ name: 'No Inventory', value: 0 }]);

        // Department Breakdown
        const deptMap: Record<string, number> = {};
        employees.forEach((e: any) => {
           const dept = e.department || 'Unknown';
           deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        const deptData = Object.keys(deptMap).map(k => ({ name: k, value: deptMap[k] }));
        setDepartmentData(deptData.length > 0 ? deptData : [{ name: 'No Data', value: 1 }]);
        setInventoryDepartmentData([{ name: 'No Data', value: 0 }]);

        // Location Breakdown
        const locMap: Record<string, number> = {};
        const invLocMap: Record<string, number> = {};
        const locIdMap: Record<string, string> = {};
        locations.forEach((l: any) => { locIdMap[l.id] = l.name });
        
        assets.forEach((a: any) => {
           const locName = locIdMap[a.locationId] || 'Unassigned / Unknown';
           locMap[locName] = (locMap[locName] || 0) + 1;
        });
        const lData = Object.keys(locMap).map(k => ({ name: k, value: locMap[k] }));
        setLocationData(lData.length > 0 ? lData : [{ name: 'No Assets', value: 0 }]);

        inventory.forEach((i: any) => {
           const locName = locIdMap[i.locationId] || 'Unassigned / Unknown';
           invLocMap[locName] = (invLocMap[locName] || 0) + (Number(i.quantity) || 0);
        });
        const invLData = Object.keys(invLocMap).map(k => ({ name: k, value: invLocMap[k] }));
        setInventoryLocationData(invLData.length > 0 ? invLData : [{ name: 'No Inventory', value: 0 }]);

        // Recent Assets (Top 5 recently added or updated)
        const sortedAssets = [...assets].sort((a: any, b: any) => {
          const d1 = new Date(b.updatedAt || b.createdAt || 0).getTime();
          const d2 = new Date(a.updatedAt || a.createdAt || 0).getTime();
          return d1 - d2;
        });
        setRecentAssets(sortedAssets.slice(0, 5));

        // Sort and format recent activity
        const sortedHistory = (history || []).sort((a: any, b: any) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
        const activityMap = sortedHistory.map((log: any) => {
           let actionText = log.action;
           let statusColor = 'neutral';
           if (log.action === 'assigned') { actionText = 'Assigned'; statusColor = 'success'; }
           if (log.action === 'created') { actionText = 'Added'; statusColor = 'success'; }
           if (log.action === 'status_changed') { actionText = 'Status Update'; statusColor = 'warning'; }
           if (log.action === 'moved') { actionText = 'Moved'; statusColor = 'neutral'; }
           if (log.action === 'updated') { actionText = 'Updated'; statusColor = 'neutral'; }
           
           const assetObj: any = assets.find((a: any) => a.id === log.assetId);
           const assetName = assetObj?.name || 'Unknown Asset';
           const assetCode = assetObj?.assetCode || log.assetId;
           let timeA = log.timestamp || log.createdAt || Date.now();
           let timeStr = 'Recently';
           try {
              const dt = timeA?.toDate ? timeA.toDate() : (typeof timeA === 'number' || typeof timeA === 'string' ? new Date(timeA) : new Date());
              timeStr = formatDistanceToNow(dt, { addSuffix: true });
           } catch(e) {}
           
           return {
             id: log.id,
             user: log.performedBy || 'System',
             action: actionText,
             asset: assetName,
             assetId: assetCode,
             time: timeStr,
             status: statusColor
           };
        });
        setRecentActivity(activityMap.slice(0, 8)); // Top 8

        // Pre-fetch items for transactions
        const txItemIds = [...new Set((inventoryTxs || []).map((tx: any) => tx.itemId))];
        const txItems = await Promise.all(txItemIds.map(id => api.get('inventory_items', id)));
        const itemMap: Record<string, string> = {};
        txItems.forEach((i: any) => { if (i) itemMap[i.id] = i.name; });

        const inventoryActivityMap = (inventoryTxs || []).map((tx: any) => {
          let timeA = tx.timestamp || Date.now();
          let timeStr = 'Recently';
          try { 
             const dt = timeA?.toDate ? timeA.toDate() : (typeof timeA === 'number' || typeof timeA === 'string' ? new Date(timeA) : new Date());
             timeStr = formatDistanceToNow(dt, { addSuffix: true }); 
          } catch(e) {}
          return {
             id: tx.id,
             item: itemMap[tx.itemId] || 'Unknown Item',
             action: tx.action.toUpperCase(),
             qty: Math.abs(tx.quantity),
             time: timeStr
          };
        });
        setRecentInventoryActivity(inventoryActivityMap.slice(0, 5));

        // Financials calculation
        let totalValue = 0;
        let nbv = 0;
        let ytdDep = 0;
        
        // Alerts calculation
        const generatedAlerts: any[] = [];
        
        const lowStockInventory = inventory.filter((item: any) => (item.quantity || 0) <= 10);
        if (lowStockInventory.length > 0) {
           generatedAlerts.push({ 
             id: 'low_stock', 
             title: 'Low Inventory Stock', 
             desc: `${lowStockInventory.length} inventory items are running low (<= 10 items).`, 
             type: 'danger', 
             time: 'Just now', 
             data: lowStockInventory,
             dataType: 'inventory'
           });
        }
        
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        
        const categoryCount: Record<string, number> = {};
        
        const expiringWarranties: any[] = [];
        const pendingRepairs: any[] = [];
        const eolAssets: any[] = [];
        const serviceDueAssets: any[] = [];

        assets.forEach((asset: any) => {
          // Financials
          const cost = Number(asset.purchaseCost) || 0;
          totalValue += cost;
          
          if (cost > 0 && asset.usefulLifeYears > 0 && asset.purchaseDate) {
             const dep = calculateDepreciation(cost, asset.salvageValue || 0, asset.usefulLifeYears, asset.purchaseDate, asset.depreciationMethod || 'straight_line');
             nbv += dep.currentValue;
             ytdDep += dep.annualDepreciation;
          } else {
             nbv += cost;
          }
          
          // Conditions for alerts
          if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) <= thirtyDaysFromNow && new Date(asset.warrantyExpiry) >= now) {
            expiringWarranties.push(asset);
          }
          if (asset.status === 'repair' || asset.status === 'in repair' || asset.status === 'maintenance') {
            pendingRepairs.push(asset);
          }
          if (asset.nextServiceDate && new Date(asset.nextServiceDate) <= thirtyDaysFromNow) {
            serviceDueAssets.push(asset);
          }
          if (asset.purchaseDate && asset.usefulLifeYears) {
            const eolDate = new Date(asset.purchaseDate);
            eolDate.setFullYear(eolDate.getFullYear() + asset.usefulLifeYears);
            if (eolDate <= thirtyDaysFromNow) {
              eolAssets.push(asset);
            }
          }
          
          if (asset.status === 'available') {
            const cat = asset.category || 'Uncategorized';
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
          }
        });
        
        if (expiringWarranties.length > 0) {
           generatedAlerts.push({ id: 'warranty', title: 'Warranties Expiring Soon', desc: `${expiringWarranties.length} assets have warranties expiring in less than 30 days.`, type: 'warning', time: 'Just now', data: expiringWarranties, dataType: 'asset' });
        }
        if (serviceDueAssets.length > 0) {
           generatedAlerts.push({ id: 'service', title: 'Service Due', desc: `${serviceDueAssets.length} assets have maintenance/service due soon or overdue.`, type: 'warning', time: 'Just now', data: serviceDueAssets, dataType: 'asset' });
        }
        if (eolAssets.length > 0) {
           generatedAlerts.push({ id: 'eol', title: 'End of Life Approaching', desc: `${eolAssets.length} assets are nearing or past their end of life based on expected useful life.`, type: 'danger', time: 'Just now', data: eolAssets, dataType: 'asset' });
        }
        if (pendingRepairs.length > 0) {
           generatedAlerts.push({ id: 'repair', title: 'Maintenance Pending', desc: `${pendingRepairs.length} hardware assets are in repair or maintenance.`, type: 'neutral', time: 'Just now', data: pendingRepairs, dataType: 'asset' });
        }
        
        Object.entries(categoryCount).forEach(([cat, count]) => {
           if (count <= 2) {
              const lowStockAssets = assets.filter((a: any) => a.category === cat && a.status === 'available');
              generatedAlerts.push({ id: `stock-${cat}`, title: `Low Stock Alert: ${cat}`, desc: `Only ${count} items left in unassigned/available inventory.`, type: 'danger', time: 'Just now', data: lowStockAssets, dataType: 'asset' });
           }
        });

        if (generatedAlerts.length === 0) {
           generatedAlerts.push({ id: 'welcome', title: 'System Healthy', desc: 'No pending alerts or issues require your attention right now.', type: 'neutral', time: 'Just now' });
        }

        setFinancialStats({ totalValue, netBookValue: nbv, depreciation: ytdDep });
        setAlerts(generatedAlerts);

      } catch (error) {
        console.error("Dashboard fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.activeOrgId]);

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

  const renderChartLayoutItem = (l: { id: string; visible: boolean }) => {
    if (l.id === 'category') {
      return (
        <Card key="category" className="flex-1 basis-full lg:basis-[calc(33.33%-1rem)] min-w-[300px] shadow-sm border-border/50 bg-card/95 backdrop-blur-sm rounded-2xl h-[400px] flex flex-col resize overflow-auto">
          <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">
              {categoryChartType === 'asset' ? 'Assets by Category' : 'Inventory by Category'}
            </CardTitle>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setCategoryChartType('asset')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${categoryChartType === 'asset' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Assets
              </button>
              <button
                onClick={() => setCategoryChartType('inventory')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${categoryChartType === 'inventory' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Inventory
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 relative min-h-[250px]">
            <div className="absolute inset-x-6 inset-y-0 bottom-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartType === 'asset' ? categoryData : inventoryCategoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={(props: any) => {
                    const { x, y, payload } = props;
                    const dataList = categoryChartType === 'asset' ? categoryData : inventoryCategoryData;
                    const count = dataList.find((d: any) => d.name === payload.value)?.value || 0;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={500}>{payload.value}</text>
                        <text x={0} y={0} dy={32} textAnchor="middle" fill="#94a3b8" fontSize={11}>{count}</text>
                      </g>
                    );
                  }} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="value" fill="#d4af37" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (l.id === 'location') {
      const activeLocationData = locationChartType === 'asset' ? locationData : inventoryLocationData;
      return (
        <Card key="location" className="flex-1 basis-full lg:basis-[calc(33.33%-1rem)] min-w-[300px] shadow-sm border-border/50 flex flex-col bg-card/95 backdrop-blur-sm rounded-2xl h-[400px] resize overflow-auto">
          <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">
                {locationChartType === 'asset' ? 'Assets by Location' : 'Inventory by Location'}
              </CardTitle>
              <CardDescription>
                {locationChartType === 'asset' ? 'Asset distribution across locations' : 'Inventory distribution across locations'}
              </CardDescription>
            </div>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setLocationChartType('asset')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${locationChartType === 'asset' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Assets
              </button>
              <button
                onClick={() => setLocationChartType('inventory')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${locationChartType === 'inventory' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Inventory
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 relative min-h-[250px]">
            <div className="absolute inset-x-6 inset-y-0 bottom-6 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeLocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                  >
                    {activeLocationData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}
                    formatter={(value, entry: any) => `${value} (${entry.payload.value})`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (l.id === 'department') {
      return (
        <Card key="department" className="flex-1 basis-full lg:basis-[calc(33.33%-1rem)] min-w-[300px] shadow-sm border-border/50 flex flex-col bg-card/95 backdrop-blur-sm rounded-2xl h-[400px] resize overflow-auto">
          <CardHeader className="shrink-0">
            <CardTitle className="text-lg font-semibold text-foreground">Employees by Department</CardTitle>
            <CardDescription>Employee distribution across teams</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 relative min-h-[250px]">
            <div className="absolute inset-x-6 inset-y-0 bottom-6 flex items-center justify-center">
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
                    {departmentData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}
                    formatter={(value, entry: any) => `${value} (${entry.payload.value})`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (l.id === 'recent') {
      return (
        <Card key="recent" className="flex-[3_3_100%] basis-full min-w-full shadow-sm border-border/50 bg-card/95 backdrop-blur-sm rounded-2xl h-[400px] flex flex-col resize overflow-auto">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b border-border/50 pb-4 shrink-0">
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
      );
    }
    
    // Additional Layout Items
    if (l.id === 'category_list') {
      const activeList = categoryListChartType === 'asset' ? categoryData : inventoryCategoryData;
      const totalCount = categoryListChartType === 'asset' ? stats.totalAssets : stats.inventoryStock;
      
      return (
        <div key="category_list" className="flex-1 basis-full lg:basis-[calc(33.33%-1rem)] min-w-[300px] bg-white border border-[#e5e5e5] rounded-2xl shadow-sm p-6 flex flex-col h-[400px] resize overflow-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-[#1f1f1f]">
              {categoryListChartType === 'asset' ? 'Asset Categories' : 'Inventory Categories'}
            </h3>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => setCategoryListChartType('asset')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${categoryListChartType === 'asset' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Assets
              </button>
              <button
                onClick={() => setCategoryListChartType('inventory')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${categoryListChartType === 'inventory' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Inventory
              </button>
            </div>
            <Link to="/assets?groupBy=category" className="text-[#737373] hover:text-[#c5a059] transition-colors ml-4">
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          
          <div className="flex-1 space-y-6">
            {activeList.map((cat, i) => {
              const baseTotal = cat.targetStock && cat.targetStock > 0 ? cat.targetStock : totalCount;
              const percentage = Math.round((cat.value / (baseTotal || 1)) * 100);
              const fillPercentage = Math.min(100, percentage);
              return (
                <Link key={i} to={`/${categoryListChartType === 'asset' ? 'assets' : 'inventory'}?category=${encodeURIComponent(cat.name)}`} className="block group">
                  <div className="flex justify-between text-sm mb-2">
                    <div className="flex items-center gap-2 text-[#1f1f1f] font-medium group-hover:text-[#c5a059] transition-colors">
                      <Laptop className="w-4 h-4 text-[#737373] group-hover:text-[#c5a059] transition-colors" />
                      {cat.name}
                    </div>
                    <span className="text-[#737373]">{cat.value} {cat.targetStock ? `/ ${cat.targetStock} ` : ''}({percentage}%)</span>
                  </div>
                  <div className="w-full bg-[#f5f5f5] rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-[#c5a059] h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${fillPercentage}%` }}
                    ></div>
                  </div>
                </Link>
              );
            })}
          </div>
          
          <Link to="/assets?groupBy=category" className="mt-6 w-full flex items-center justify-center py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-medium text-[#1f1f1f] hover:bg-[#f5f5f5] transition-colors">
            View All Categories
          </Link>
        </div>
      );
    }

    if (l.id === 'activity_table') {
      return (
        <div key="activity_table" className="flex-[2_2_600px] basis-full lg:basis-[calc(66.66%-1rem)] min-w-[300px] shadow-sm border border-[#e5e5e5] bg-white rounded-2xl flex flex-col h-[400px] resize overflow-auto">
          <div className="p-6 border-b border-[#e5e5e5] flex justify-between items-center bg-white shrink-0">
            <div>
              <h3 className="font-semibold text-[#1f1f1f]">Recent Activity</h3>
              <p className="text-xs text-[#737373] mt-1">Latest asset movements and status updates</p>
            </div>
            <Link to="/reports">
               <button className="text-sm font-medium text-[#c5a059] hover:text-[#a38042] transition-colors">
                 View Complete Log
               </button>
            </Link>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#fdfbf7] border-b border-[#e5e5e5] text-[#737373] text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Asset</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">User / Assignee</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5]">
                {recentActivity.length === 0 ? (
                   <tr>
                     <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        No recent activity found.
                     </td>
                   </tr>
                ) : null}
                {recentActivity.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-[#fdfbf7]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1f1f1f] group-hover:text-[#c5a059] transition-colors">{log.asset}</div>
                      <div className="text-xs text-[#737373] font-mono mt-0.5">{log.assetId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        log.status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                        log.status === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        log.status === 'danger' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#e5e5e5] flex items-center justify-center text-xs font-bold text-[#737373]">
                          {(log.user || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-[#1f1f1f]">{log.user}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#737373]">
                      {log.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (l.id === 'inventory_recent') {
      return (
        <div key="inventory_recent" className="flex-[2_2_600px] basis-full lg:basis-[calc(66.66%-1rem)] min-w-[300px] shadow-sm border border-[oklch(0.922_0_0)] bg-white rounded-2xl flex flex-col h-[400px] resize overflow-auto">
          <div className="p-6 border-b border-[oklch(0.922_0_0)] flex justify-between items-center bg-white shrink-0">
            <div>
              <h3 className="font-semibold text-[oklch(0.205_0_0)]">Recent Inventory Transactions</h3>
              <p className="text-xs text-[oklch(0.205_0_0)]/50 mt-1">Latest stock consumption and additions</p>
            </div>
            <Link to="/inventory">
               <button className="text-sm font-medium text-[#c5a059] hover:text-[#a38042] transition-colors">
                 Manage Inventory
               </button>
            </Link>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#fdfbf7] border-b border-[oklch(0.922_0_0)] text-[oklch(0.205_0_0)]/50 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Item</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Quantity</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[oklch(0.922_0_0)]">
                {recentInventoryActivity.length === 0 ? (
                   <tr>
                     <td colSpan={4} className="px-6 py-8 text-center text-[oklch(0.205_0_0)]/50">
                        No recent inventory activity found.
                     </td>
                   </tr>
                ) : null}
                {recentInventoryActivity.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-[#fdfbf7]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[oklch(0.205_0_0)] group-hover:text-[#c5a059] transition-colors">{log.item}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        log.action === 'ADD' ? 'bg-green-50 text-green-700 border-green-200' :
                        log.action === 'CONSUME' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-[oklch(0.97_0_0)] text-[oklch(0.205_0_0)]/50 border-[oklch(0.922_0_0)]'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[oklch(0.205_0_0)] font-medium">
                      {log.action === 'ADD' ? '+' : log.action === 'CONSUME' ? '-' : ''}{log.qty}
                    </td>
                    <td className="px-6 py-4 text-sm text-[oklch(0.205_0_0)]/50">
                      {log.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (l.id === 'alerts') {
      return (
        <div key="alerts" className="flex-[2_2_600px] basis-full lg:basis-[calc(66.66%-1rem)] min-w-[300px] bg-white border border-[#e5e5e5] rounded-2xl shadow-sm p-6 flex flex-col h-[400px] resize overflow-auto">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-semibold text-[#1f1f1f]">Action Required</h3>
              <p className="text-xs text-[#737373] mt-1">Alerts and tasks needing your attention</p>
            </div>
            {alerts.length > 0 && alerts[0]?.id !== 'welcome' && (
              <div className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100">
                {alerts.length} Pending
              </div>
            )}
            {alerts.length > 0 && alerts[0]?.id === 'welcome' && (
              <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                All Clear
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-4">
            {alerts.map((alert) => {
              const alertBody = (
                <div className={`flex gap-4 p-4 rounded-xl border border-[#e5e5e5] hover:border-[#c5a059]/30 transition-colors group ${
                  alert.id !== 'welcome' ? 'cursor-pointer hover:bg-[#fdfbf7]/50' : 'bg-green-50/30'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    alert.type === 'danger' ? 'bg-red-50 text-red-600' :
                    alert.type === 'warning' ? 'bg-orange-50 text-orange-600' :
                    alert.type === 'success' ? 'bg-green-50 text-green-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-sm font-semibold text-[#1f1f1f] group-hover:text-[#c5a059] transition-colors truncate">{alert.title}</h4>
                      <span className="text-xs text-[#a3a3a3] whitespace-nowrap">{alert.time}</span>
                    </div>
                    <p className="text-sm text-[#737373] mt-1 truncate">{alert.desc}</p>
                  </div>
                  {alert.id !== 'welcome' && (
                     <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                       <ChevronRight className="w-5 h-5 text-[#c5a059]" />
                     </div>
                  )}
                </div>
              );

              return (
                <React.Fragment key={alert.id}>
                  {alert.data ? (
                    <div 
                       onClick={() => setSelectedAlert({ title: alert.title, data: alert.data, type: alert.dataType })}
                       className="block w-full cursor-pointer"
                    >
                      {alertBody}
                    </div>
                  ) : alert.link ? (
                    <Link to={alert.link} className="block w-full">
                      {alertBody}
                    </Link>
                  ) : alertBody}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    }

    if (l.id === 'financial') {
      return (
        <div key="financial" className="flex-1 basis-full lg:basis-[calc(33.33%-1rem)] min-w-[300px] bg-[#1f1f1f] rounded-2xl shadow-lg p-6 relative flex flex-col text-white h-[400px] resize overflow-auto">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#c5a059]/20 blur-[50px] rounded-full pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-8 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#c5a059]/20 border border-[#c5a059]/30 flex items-center justify-center">
              <Coins className="w-5 h-5 text-[#c5a059]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Financial Overview</h3>
              <p className="text-xs text-[#a3a3a3]">Current Fiscal Year</p>
            </div>
          </div>

          <div className="space-y-6 relative z-10 flex-1">
            <div>
              <div className="text-sm text-[#a3a3a3] mb-1">Total Asset Value</div>
              <div className="text-4xl font-bold tracking-tight text-white">{formatCurrency(financialStats.totalValue)}</div>
            </div>
            
            <div className="h-px w-full bg-white/10"></div>
            
            <div>
              <div className="flex items-center justify-between text-sm text-[#a3a3a3] mb-1">
                <span>YTD Depreciation</span>
                <span className="text-red-400 flex items-center gap-1 text-xs"><TrendingDown className="w-3 h-3" /> -{formatCurrency(financialStats.depreciation)}</span>
              </div>
              <div className="text-2xl font-semibold text-white">{formatCurrency(financialStats.netBookValue)} <span className="text-sm font-normal text-[#a3a3a3]">Net Book Value</span></div>
            </div>
          </div>

          <Link to="/reports" className="mt-6">
            <button className="w-full py-3 rounded-xl bg-[#c5a059] text-[#1f1f1f] text-sm font-bold hover:bg-[#dfc182] transition-colors relative z-10 shadow-[0_0_15px_rgba(197,160,89,0.2)]">
              View Finance Report
            </button>
          </Link>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground">Real-time status of all assets across the organization.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto mt-2 md:mt-0">
          <PageSettings
            title="Dashboard Settings"
            groups={[
              {
                id: 'kpi',
                title: 'Cards Layout',
                layout: kpiLayout,
                toggleVisibility: toggleKpi,
                moveItem: moveKpi,
                reorderItems: reorderKpi,
                labels: {total: 'Total Assets', assigned: 'Assigned', available: 'Available', maintenance: 'Maintenance', repair: 'In Repair', damaged: 'Damaged', inventory: 'Inventory Stock'}
              },
              {
                id: 'charts',
                title: 'Charts Layout',
                layout: chartLayout,
                toggleVisibility: toggleChart,
                moveItem: moveChart,
                reorderItems: reorderChart,
                labels: {category: 'Assets by Category', category_list: 'Category Distribution (List)', location: 'Assets by Location', department: 'Employees by Dept', recent: 'Recent Assets', activity_table: 'Recent Activity', alerts: 'Action Required', financial: 'Financial Overview', inventory_recent: 'Recent Inventory TX'}
              }
            ]}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Chart Position</span>
              <Button variant="outline" size="sm" onClick={() => setChartPosition(prev => prev === 'above' ? 'below' : 'above')} className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                <span>Move to {chartPosition === 'above' ? 'Bottom' : 'Top'}</span>
              </Button>
            </div>
          </PageSettings>
          <Link to="/assets" className="flex-1 sm:flex-none">
            <Button className="w-full bg-[#1f1f1f] hover:bg-[#1f1f1f]/90 text-white shadow-sm px-2 sm:px-4">
              <Plus className="w-4 h-4 shrink-0 mr-1.5 sm:mr-2" />
              <span className="truncate text-xs sm:text-sm">Add Asset</span>
            </Button>
          </Link>
          <Link to="/employees" className="flex-1 sm:flex-none">
            <Button className="w-full bg-[#c5a059] hover:bg-[#a38042] text-white shadow-sm px-2 sm:px-4">
              <UserPlus className="w-4 h-4 shrink-0 mr-1.5 sm:mr-2" />
              <span className="truncate text-xs sm:text-sm">Add Employee</span>
            </Button>
          </Link>
          <Link to="/assignments" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full shadow-sm border-[#e5e5e5] px-2 sm:px-4 hover:border-[#c5a059]/30">
              <ArrowLeftRight className="w-4 h-4 shrink-0 mr-1.5 sm:mr-2" />
              <span className="truncate text-xs sm:text-sm">Assign</span>
            </Button>
          </Link>
        </div>
      </div>

      {chartPosition === 'above' && (
        <div className="flex flex-wrap items-stretch gap-6 mb-8 mt-6">
          {chartLayout.filter(l => l.visible).map(l => renderChartLayoutItem(l))}
        </div>
      )}

      <div className="flex flex-wrap items-stretch gap-6">
        {kpiLayout.filter(l => l.visible).map(l => {
          switch(l.id) {
            case 'total': return <StatCard key="total" className="flex-1 basis-[160px] min-w-[160px]" title="Total Assets" value={stats.totalAssets} icon={Laptop} color="gold" onClick={() => handleStatClick('Total Assets', null)} />;
            case 'assigned': return <StatCard key="assigned" className="flex-1 basis-[160px] min-w-[160px]" title="Assigned" value={stats.assignedAssets} icon={CheckCircle2} color="green" onClick={() => handleStatClick('Assigned Assets', 'assigned')} />;
            case 'available': return <StatCard key="available" className="flex-1 basis-[160px] min-w-[160px]" title="Available" value={stats.availableAssets} icon={Clock} color="amber" onClick={() => handleStatClick('Available Assets', 'available')} />;
            case 'maintenance': return <StatCard key="maintenance" className="flex-1 basis-[160px] min-w-[160px]" title="Maintenance" value={stats.maintenanceAssets} icon={AlertCircle} color="red" onClick={() => handleStatClick('Assets in Maintenance', 'maintenance')} />;
            case 'repair': return <StatCard key="repair" className="flex-1 basis-[160px] min-w-[160px]" title="In Repair" value={stats.inRepairAssets} icon={Wrench} color="orange" onClick={() => handleStatClick('Assets in Repair', 'in repair')} />;
            case 'damaged': return <StatCard key="damaged" className="flex-1 basis-[160px] min-w-[160px]" title="Damaged" value={stats.damagedAssets} icon={AlertCircle} color="red" onClick={() => handleStatClick('Damaged Assets', 'damaged')} />;
            case 'inventory': return <StatCard key="inventory" className="flex-1 basis-[160px] min-w-[160px]" title="Total Inventory Stock" value={stats.inventoryStock} icon={Layers} color="indigo" onClick={handleInventoryClick} />;
            default: return null;
          }
        })}
      </div>

      {chartPosition === 'below' && (
        <div className="flex flex-wrap items-stretch gap-6 mt-8">
          {chartLayout.filter(l => l.visible).map(l => renderChartLayoutItem(l))}
        </div>
      )}

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

      <Dialog open={showInventoryModal} onOpenChange={setShowInventoryModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Item-wise Inventory Stock</DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[60vh] overflow-y-auto">
            {!inventoryModalData ? (
               <div className="flex justify-center p-8"><span className="animate-spin h-6 w-6 border-2 border-[#c5a059] border-t-transparent rounded-full" /></div>
            ) : inventoryModalData.length > 0 ? (
               <table className="w-full text-sm">
                 <thead>
                   <tr className="border-b text-left text-muted-foreground">
                     <th className="pb-2 font-medium">Item Code</th>
                     <th className="pb-2 font-medium">Name</th>
                     <th className="pb-2 font-medium text-right">Quantity</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {inventoryModalData.map((item: any) => (
                     <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                       <td className="py-3 pr-4 font-mono text-xs">{item.itemCode || item.id}</td>
                       <td className="py-3 pr-4 font-medium">{item.name}</td>
                       <td className="py-3 text-right">
                         <span className={cn(
                           "px-2 py-1 rounded-full text-xs font-medium",
                           item.quantity <= 10 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                         )}>
                           {item.quantity}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            ) : (
               <p className="text-muted-foreground text-center py-8">No inventory items found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedAlert?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {!selectedAlert?.data || selectedAlert.data.length === 0 ? (
               <p className="text-muted-foreground text-center py-4">No data available.</p>
            ) : selectedAlert.type === 'inventory' ? (
               <table className="w-full text-sm">
                 <thead>
                   <tr className="border-b text-left text-muted-foreground">
                     <th className="pb-2 font-medium">Name</th>
                     <th className="pb-2 font-medium">Category</th>
                     <th className="pb-2 font-medium text-right">Quantity</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {selectedAlert.data.map((item: any) => (
                     <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                       <td className="py-3 pr-4 font-medium">{item.name}</td>
                       <td className="py-3 pr-4 text-muted-foreground">{item.category}</td>
                       <td className="py-3 text-right">
                         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${item.quantity <= 10 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                           {item.quantity}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            ) : (
               <table className="w-full text-sm">
                 <thead>
                   <tr className="border-b text-left text-muted-foreground">
                     <th className="pb-2 font-medium">Asset</th>
                     <th className="pb-2 font-medium">Category</th>
                     <th className="pb-2 font-medium">Status</th>
                     <th className="pb-2 font-medium text-right">Details</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {selectedAlert.data.map((item: any) => (
                     <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                       <td className="py-3 pr-4">
                         <div className="font-medium text-foreground">{item.name}</div>
                         <div className="text-xs text-muted-foreground font-mono">{item.assetCode}</div>
                       </td>
                       <td className="py-3 pr-4 text-muted-foreground">{item.category}</td>
                       <td className="py-3">
                         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                           item.status === 'available' ? 'bg-green-50 text-green-700' :
                           item.status === 'assigned' ? 'bg-blue-50 text-blue-700' :
                           item.status === 'maintenance' || item.status === 'repair' || item.status === 'in repair' ? 'bg-orange-50 text-orange-700' :
                           'bg-muted text-muted-foreground'
                         }`}>
                           {item.status}
                         </span>
                       </td>
                       <td className="py-3 text-right text-xs text-muted-foreground">
                          {selectedAlert.title.includes('Warrant') && item.warrantyExpiry && `Exp: ${formatDate(item.warrantyExpiry, false)}`}
                          {selectedAlert.title.includes('Service') && item.nextServiceDate && `Due: ${formatDate(item.nextServiceDate, false)}`}
                          {selectedAlert.title.includes('End of Life') && item.purchaseDate && item.usefulLifeYears && `End: ${ (() => { const d = new Date(item.purchaseDate); d.setFullYear(d.getFullYear() + item.usefulLifeYears); return formatDate(d.toISOString(), false); })() }`}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}
          </div>
          <div className="flex justify-end pt-4 mt-2 border-t">
            <Link to={selectedAlert?.type === 'inventory' ? "/inventory" : `/assets?groupBy=all`} onClick={() => setSelectedAlert(null)}>
              <Button className="bg-[#c5a059] hover:bg-[#a38042] text-white">
                Manage {selectedAlert?.type === 'inventory' ? 'Inventory' : 'Assets'}
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, onClick, className }: any) {
  return (
    <div 
      className={cn(
        "bg-white p-6 rounded-2xl border border-[#e5e5e5] shadow-sm hover:border-[#c5a059]/30 transition-all duration-300 group",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-xl bg-[#fdfbf7] border border-[#e5e5e5] flex items-center justify-center group-hover:bg-[#c5a059]/10 group-hover:border-[#c5a059]/30 transition-colors">
          <Icon className="w-6 h-6 text-[#737373] group-hover:text-[#c5a059] transition-colors" />
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-[#737373] text-sm font-medium">{title}</h4>
        <div className="text-3xl font-bold text-[#1f1f1f]">{value}</div>
      </div>
    </div>
  );
}

