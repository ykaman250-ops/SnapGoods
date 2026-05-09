import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingDown, 
  Layers, 
  Activity, 
  Wrench, 
  ShieldCheck, 
  Download, 
  ArrowLeft,
  Calendar as CalendarIcon,
  X,
  Plus,
  Trash2,
  FileText,
  Check,
  Edit,
  ArrowUpDown
} from 'lucide-react';
import { api } from '../lib/api';
import { Asset, MaintenanceLog } from '../lib/types';
import { useAuth } from '../lib/auth';
import { calculateDepreciation } from '../lib/depreciation';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import { PageSettings } from '../components/PageSettings';
import { useCardLayout } from '../lib/useCardLayout';
import { useCurrencyFormatter } from '../lib/useCurrencyFormatter';

export interface CustomReport {
  id?: string;
  name: string;
  description?: string;
  columns: string[];
}

export const AVAILABLE_COLUMNS = [
  { id: 'assetCode', label: 'Asset ID' },
  { id: 'name', label: 'Name' },
  { id: 'category', label: 'Category' },
  { id: 'status', label: 'Status' },
  { id: 'department', label: 'Department' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'purchaseCost', label: 'Original Cost' },
  { id: 'purchaseDate', label: 'Purchase Date' },
  { id: 'salvageValue', label: 'Salvage Value' },
  { id: 'usefulLifeYears', label: 'Useful Life (Yrs)' },
];

const exportToCSV = (data: any[], filename: string) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(val => `"${val}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

function KPICard({ title, value, highlight = false }: { title: string, value: string | number, highlight?: boolean }) {
  return (
    <div className={`p-5 rounded-xl border min-w-0 ${highlight ? 'border-[#c5a059] bg-[#c5a059]/5' : 'border-[oklch(0.922_0_0)] bg-white'} shadow-sm flex flex-col justify-center transition-all`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.205_0_0)]/50 mb-1 block truncate">{title}</span>
      <span className={`text-2xl font-semibold tracking-tight break-words break-all ${highlight ? 'text-[#c5a059]' : 'text-[oklch(0.205_0_0)]'}`}>{value}</span>
    </div>
  );
}

function ReportSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.205_0_0)]/50 ml-1">{title}</h3>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

function ReportCard({ icon, title, desc, onClick }: { icon: React.ReactElement, title: string, desc: string, onClick: () => void }) {
  return (
    <div 
      className="group p-5 rounded-xl border border-[oklch(0.922_0_0)] bg-white shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all cursor-pointer flex items-start gap-4"
      onClick={onClick}
    >
      <div className="p-2.5 rounded-lg bg-[oklch(0.97_0_0)] text-[#c5a059] group-hover:bg-[#c5a059] group-hover:text-white transition-colors">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
      </div>
      <div>
        <h4 className="font-semibold text-[oklch(0.205_0_0)]">{title}</h4>
        <p className="text-sm text-[oklch(0.205_0_0)]/60 mt-1 leading-relaxed">{desc}</p>
        <span className="text-xs font-semibold text-[#c5a059] mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          View Report <ArrowLeft size={12} className="rotate-180" />
        </span>
      </div>
    </div>
  );
}

function ReportDetailView({ 
  reportId, 
  assets, 
  maintenanceLogs, 
  inventoryItems,
  inventoryTransactions,
  onBack, 
  formatCurrency, 
  customReports 
}: { 
  reportId: string, 
  assets: Asset[], 
  maintenanceLogs: MaintenanceLog[], 
  inventoryItems: any[],
  inventoryTransactions: any[],
  onBack: () => void, 
  formatCurrency: (val: number | string | undefined) => string, 
  customReports: CustomReport[] 
}) {
  const getReportConfig = () => {
    if (reportId.startsWith('custom_')) {
      const dbId = reportId.replace('custom_', '');
      const customReport = customReports.find(r => r.id === dbId);
      if (customReport) {
        return {
          title: customReport.name,
          columns: customReport.columns.map(cId => AVAILABLE_COLUMNS.find(ac => ac.id === cId)?.label || cId),
          data: assets.map(a => {
            const row: any = {};
            customReport.columns.forEach(cId => {
              const label = AVAILABLE_COLUMNS.find(ac => ac.id === cId)?.label || cId;
              let val: any = (a as any)[cId];
              if (cId === 'purchaseCost' || cId === 'salvageValue') {
                val = formatCurrency(val || 0);
              }
              if (cId === 'assetCode') {
                val = a.assetCode || a.id;
              }
              row[label] = val || '-';
            });
            return row;
          })
        };
      }
    }

    switch(reportId) {
      case 'valuation':
        return {
          title: 'Asset Valuation Report',
          columns: ['Asset ID', 'Name', 'Category', 'Purchase Date', 'Original Cost'],
          data: assets.map(a => ({
            ID: a.assetCode || a.id,
            Name: a.name,
            Category: a.category,
            Date: a.purchaseDate,
            Cost: formatCurrency(a.purchaseCost || 0)
          }))
        };
      case 'depreciation':
        return {
          title: 'Depreciation & Net Worth',
          columns: ['Asset ID', 'Name', 'Original Cost', 'Method', 'Est. Current Value'],
          data: assets.map(a => {
            const dep = calculateDepreciation(
              a.purchaseCost || 0,
              a.salvageValue || 0,
              a.usefulLifeYears || 5,
              a.purchaseDate || new Date(),
              a.depreciationMethod || 'straight_line'
            );
            return {
              ID: a.assetCode || a.id,
              Name: a.name,
              Cost: formatCurrency(a.purchaseCost || 0),
              Method: a.depreciationMethod === 'wdv' ? 'WDV' : 'SLM',
              CurrentValue: formatCurrency(dep.currentValue)
            };
          })
        };
      case 'allocation':
        return {
          title: 'Asset Allocation',
          columns: ['Asset ID', 'Name', 'Category', 'Department', 'Status'],
          data: assets.map(a => ({
            ID: a.assetCode || a.id,
            Name: a.name,
            Category: a.category,
            Department: a.department || 'Unassigned',
            Status: a.status.toUpperCase(),
          }))
        };
      case 'status':
        return {
          title: 'Asset Status Overview',
          columns: ['Asset ID', 'Name', 'Department', 'Status', 'Cost'],
          data: assets
            .map(a => ({
              ID: a.assetCode || a.id,
              Name: a.name,
              Department: a.department || 'Unassigned',
              Status: a.status.toUpperCase(),
              Cost: formatCurrency(a.purchaseCost || 0)
            }))
        };
      case 'inventory_stock':
        return {
          title: 'Inventory Stock Level Report',
          columns: ['Item Code', 'Name', 'Category', 'Quantity in Stock'],
          data: inventoryItems.map(item => ({
            'Item Code': item.itemCode || item.id,
            Name: item.name,
            Category: item.category,
            'Quantity in Stock': item.quantity
          }))
        };
      case 'inventory_txs':
        return {
          title: 'Inventory Transactions/Usage',
          columns: ['Date', 'Item Name', 'Action', 'Qty', 'Notes'],
          data: inventoryTransactions.map(tx => {
            const item = inventoryItems.find(i => i.id === tx.itemId);
            return {
              Date: new Date(tx.timestamp).toLocaleString(),
              'Item Name': item?.name || tx.itemId,
              Action: tx.action.toUpperCase(),
              Qty: Math.abs(tx.quantity).toString(),
              Notes: tx.notes || '-'
            };
          })
        };
      case 'maintenance':
        return {
          title: 'Maintenance Log',
          columns: ['Date', 'Asset ID', 'Asset Name', 'Type', 'Cost', 'Notes'],
          data: maintenanceLogs
            .filter(log => assets.some(a => a.id === log.assetId))
            .map(log => {
            const asset = assets.find(a => a.id === log.assetId);
            return {
              Date: new Date(log.date).toLocaleDateString(),
              'Asset ID': asset?.assetCode || asset?.id || log.assetId,
              'Asset Name': asset?.name || 'Unknown',
              Type: log.type === 'repair' ? 'Repair' : 'Service',
              Cost: formatCurrency(log.cost || 0),
              Notes: log.notes || '-'
            };
          })
        };
      case 'audit':
      default:
        return {
          title: 'Comprehensive Asset Register',
          columns: ['Asset ID', 'Name', 'Category', 'Dept', 'Status', 'Original Cost'],
          data: assets.map(a => ({
            ID: a.assetCode || a.id,
            Name: a.name,
            Category: a.category,
            Dept: a.department || 'Unassigned',
            Status: a.status.toUpperCase(),
            Cost: formatCurrency(a.purchaseCost || 0)
          }))
        };
    }
  };

  const config = getReportConfig();

  return (
    <div className="bg-white border border-[oklch(0.922_0_0)] rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between p-6 border-b border-[oklch(0.922_0_0)] bg-[oklch(0.97_0_0)]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-[#fdfbf7] rounded-lg transition-colors text-[oklch(0.205_0_0)]/60 hover:text-[oklch(0.205_0_0)] focus:outline-none focus:ring-2 focus:ring-[#c5a059]/50"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-[oklch(0.205_0_0)]">{config.title}</h2>
            <p className="text-sm text-[oklch(0.205_0_0)]/50 mt-0.5">Showing {config.data.length} records based on current filters</p>
          </div>
        </div>
        <button 
          onClick={() => exportToCSV(config.data, `SnapGoods_${reportId}_Report`)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#c5a059] text-white rounded-lg text-sm font-medium hover:bg-[#b08d4b] transition-all shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-[#c5a059]"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto flex-1 bg-white p-2 w-full max-w-full">
        <table className="w-full text-left text-sm text-[oklch(0.205_0_0)] border-collapse min-w-max">
          <thead>
            <tr>
              {config.columns.map(col => (
                <th key={col} className="px-6 py-4 font-semibold text-[oklch(0.205_0_0)]/60 text-[11px] tracking-wider border-b border-[oklch(0.922_0_0)] whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.data.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length} className="px-6 py-12 text-center text-[oklch(0.205_0_0)]/50 bg-[oklch(0.97_0_0)]/30 rounded-lg">
                  No data found matching the current criteria.
                </td>
              </tr>
            ) : (
              config.data.map((row, idx) => (
                <tr key={idx} className="border-b border-[oklch(0.922_0_0)]/50 hover:bg-[oklch(0.97_0_0)]/50 transition-colors group">
                  {Object.values(row).map((val: any, i) => (
                    <td key={i} className="px-6 py-4 whitespace-nowrap">
                      {val === 'ACTIVE' || val === 'ASSIGNED' || val === 'AVAILABLE' ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 capitalize">{val.toLowerCase()}</span> : 
                       val === 'REPAIR' || val === 'MAINTENANCE' ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 capitalize">{val.toLowerCase()}</span> : 
                       val === 'RETIRED' || val === 'INACTIVE' ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">{val.toLowerCase()}</span> : 
                       val}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Reports() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<any[]>([]);
  const [customReports, setCustomReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ department: '', category: '', startDate: '', endDate: '' });
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const { layout: kpiLayout, toggleVisibility: toggleKpi, moveItem: moveKpi, reorderItems: reorderKpi } = useCardLayout('reports_kpi', ['value', 'networth', 'total', 'inuse', 'repair', 'inventory_items']);
  const { layout: sectionsLayout, toggleVisibility: toggleSections, moveItem: moveSections, reorderItems: reorderSections } = useCardLayout('reports_sections', ['financial', 'operational', 'compliance', 'inventory', 'custom']);
  const { layout: chartLayout, toggleVisibility: toggleChart, moveItem: moveChart, reorderItems: reorderChart } = useCardLayout('reports_chart', ['distribution']);

  const [chartPosition, setChartPosition] = useState<'above' | 'below'>(() => {
    return (localStorage.getItem('reports_chart_position') as 'above' | 'below') || 'above';
  });

  useEffect(() => {
    localStorage.setItem('reports_chart_position', chartPosition);
  }, [chartPosition]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [newReport, setNewReport] = useState<{name: string, description: string, columns: string[]}>({ name: '', description: '', columns: [] });

  const isManageAllowed = profile?.role === 'admin' || profile?.role === 'owner' || profile?.role === 'superadmin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedAssets = await api.list('assets') as Asset[];
        setAssets(fetchedAssets || []);
      } catch (error: any) {
        console.error("Failed to load assets:", error);
        toast.error("Failed to load assets: " + (error.message || String(error)));
      }

      try {
        const fetchedLogs = await api.list('maintenance_logs') as MaintenanceLog[];
        setMaintenanceLogs(fetchedLogs || []);
      } catch (error: any) {
        console.error("Failed to load maintenance logs:", error);
      }
      
      try {
        const fetchedInventoryItems = await api.list('inventory_items');
        setInventoryItems(fetchedInventoryItems || []);
      } catch (error: any) {
        console.error("Failed to load inventory items:", error);
      }

      try {
        const fetchedInventoryTxs = await api.list('inventory_transactions');
        setInventoryTransactions(fetchedInventoryTxs || []);
      } catch (error: any) {
        console.error("Failed to load inventory transactions:", error);
      }
      
      try {
        const fetchedCustomReports = await api.list('custom_reports') as CustomReport[];
        setCustomReports(fetchedCustomReports || []);
      } catch (error: any) {
        console.error("Failed to load reports data:", error);
        toast.error("Failed to load custom reports: " + (error.message || String(error)));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveCustomReport = async () => {
    if (!newReport.name) {
      toast.error('Please provide a report name');
      return;
    }
    if (newReport.columns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    try {
      if (editingReportId) {
        await api.update('custom_reports', editingReportId, newReport);
        setCustomReports(customReports.map(r => r.id === editingReportId ? { ...newReport, id: editingReportId } : r));
        toast.success('Custom report updated successfully');
      } else {
        const id = await api.create('custom_reports', newReport);
        setCustomReports([...customReports, { ...newReport, id }]);
        toast.success('Custom report created successfully');
      }
      setIsCreateModalOpen(false);
      setEditingReportId(null);
      setNewReport({ name: '', description: '', columns: [] });
    } catch (e) {
      toast.error(`Failed to ${editingReportId ? 'update' : 'create'} report`);
      console.error(e);
    }
  };

  const openCreateModal = () => {
    setEditingReportId(null);
    setNewReport({ name: '', description: '', columns: [] });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, report: CustomReport) => {
    e.stopPropagation();
    setEditingReportId(report.id || null);
    setNewReport({ name: report.name, description: report.description || '', columns: report.columns });
    setIsCreateModalOpen(true);
  };

  const handleDeleteCustomReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await api.delete('custom_reports', id);
      setCustomReports(customReports.filter(r => r.id !== id));
      toast.success('Report deleted');
    } catch (e) {
      toast.error('Failed to delete report');
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (filters.category && asset.category !== filters.category) return false;
      if (filters.department && asset.department !== filters.department) return false;
      if (filters.startDate && new Date(asset.purchaseDate || 0) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(asset.purchaseDate || 0) > new Date(filters.endDate)) return false;
      return true;
    });
  }, [assets, filters]);

  const kpis = useMemo(() => {
    return filteredAssets.reduce(
      (acc, asset) => {
        acc.totalAssets += 1;
        acc.totalAssetValue += asset.purchaseCost || 0;
        
        const dep = calculateDepreciation(
          asset.purchaseCost || 0,
          asset.salvageValue || 0,
          asset.usefulLifeYears || 5,
          asset.purchaseDate || new Date().toISOString(),
          asset.depreciationMethod || 'straight_line'
        );
        acc.currentNetWorth += dep.currentValue;

        if (asset.status === 'assigned') acc.assetsInUse += 1;
        if (asset.status === 'repair') acc.assetsUnderMaintenance += 1;
        return acc;
      },
      { totalAssets: 0, totalAssetValue: 0, currentNetWorth: 0, assetsInUse: 0, assetsUnderMaintenance: 0 }
    );
  }, [filteredAssets]);

  const formatCurrency = useCurrencyFormatter();

  // Extract unique categories and departments for filters
  const categories = useMemo(() => Array.from(new Set(assets.map(a => a.category).filter(Boolean))), [assets]);
  const departments = useMemo(() => Array.from(new Set(assets.map(a => a.department).filter(Boolean))), [assets]);

  // Chart data
  const distributionData = useMemo(() => {
    const counts = filteredAssets.reduce((acc, a) => {
      const cat = a.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredAssets]);

  const COLORS = ['#c5a059', 'oklch(0.205 0 0)', '#a38042', '#dfc182', '#664d23', 'oklch(0.556 0 0)'];

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading reports...</div>;
  }

  return (
    <div className="text-[oklch(0.205_0_0)] font-sans h-full overflow-y-auto">
      <div>
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[oklch(0.205_0_0)]">Reports & Analytics</h1>
            <p className="text-sm text-[oklch(0.205_0_0)]/60 mt-1">Financial and operational insights for your hardware assets.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-[oklch(0.922_0_0)] shadow-sm">
            <Popover>
              <PopoverTrigger className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[oklch(0.205_0_0)]/80 hover:bg-[oklch(0.97_0_0)] rounded-lg transition-colors border border-transparent hover:border-[oklch(0.922_0_0)] outline-none focus:ring-1 focus:ring-[#c5a059]">
                  <CalendarIcon size={16} className="text-[#c5a059]" />
                  {filters.startDate || filters.endDate ? (
                    <span>
                      {filters.startDate ? new Date(filters.startDate).toLocaleDateString() : 'Any'} 
                      {' - '} 
                      {filters.endDate ? new Date(filters.endDate).toLocaleDateString() : 'Any'}
                    </span>
                  ) : (
                    "Filter by Period"
                  )}
                  {(filters.startDate || filters.endDate) && (
                    <X 
                      size={14} 
                      className="ml-1 opacity-50 hover:opacity-100 p-0.5 rounded-full hover:bg-[oklch(0.922_0_0)] transition-all" 
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setFilters({ ...filters, startDate: '', endDate: '' });
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setFilters({ ...filters, startDate: '', endDate: '' });
                      }}
                    />
                  )}
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 rounded-xl border-[oklch(0.922_0_0)] shadow-lg" align="start">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-[oklch(0.205_0_0)]">Purchase Date Range</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.205_0_0)]/50">From</label>
                      <input 
                        type="date" 
                        className="w-full bg-white text-sm border border-[oklch(0.922_0_0)] rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#c5a059]"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.205_0_0)]/50">To</label>
                      <input 
                        type="date" 
                        className="w-full bg-white text-sm border border-[oklch(0.922_0_0)] rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#c5a059]"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-[oklch(0.922_0_0)]/50">
                    <button 
                      className="text-xs font-semibold text-[oklch(0.205_0_0)]/50 hover:text-[#c5a059] transition-colors"
                      onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })}
                    >
                      Clear Range
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="w-px h-5 bg-[oklch(0.922_0_0)] hidden sm:block"></div>
            <select 
              className="bg-transparent text-sm border-none focus:ring-0 outline-none px-3 py-1 cursor-pointer font-medium text-[oklch(0.205_0_0)]/80 min-w-[140px]"
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              value={filters.category}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="w-px h-5 bg-[oklch(0.922_0_0)]"></div>
            <select 
              className="bg-transparent text-sm border-none focus:ring-0 outline-none px-3 py-1 cursor-pointer font-medium text-[oklch(0.205_0_0)]/80 min-w-[140px]"
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              value={filters.department}
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {activeReport ? (
          <ReportDetailView 
            reportId={activeReport} 
            assets={filteredAssets} 
            maintenanceLogs={maintenanceLogs}
            inventoryItems={inventoryItems}
            inventoryTransactions={inventoryTransactions}
            onBack={() => setActiveReport(null)} 
            formatCurrency={formatCurrency}
            customReports={customReports}
          />
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 mt-8">
              <h2 className="text-xl font-bold">Metrics Overview</h2>
              <div className="flex flex-wrap items-center gap-2">
                <PageSettings
                  title="Reports Page Settings"
                  groups={[
                    {
                      id: 'kpi',
                      title: 'Cards Layout',
                      layout: kpiLayout,
                      toggleVisibility: toggleKpi,
                      moveItem: moveKpi,
                      reorderItems: reorderKpi,
                      labels: {value: 'Total Asset Value', networth: 'Current Net Worth', total: 'Total Assets', inuse: 'Assets In Use', repair: 'Under Repair', inventory_items: 'Total Inv. Items'}
                    },
                    {
                      id: 'charts',
                      title: 'Charts Layout',
                      layout: chartLayout,
                      toggleVisibility: toggleChart,
                      moveItem: moveChart,
                      reorderItems: reorderChart,
                      labels: {distribution: 'Asset Distribution'}
                    },
                    {
                      id: 'categories',
                      title: 'Categories Layout',
                      layout: sectionsLayout,
                      toggleVisibility: toggleSections,
                      moveItem: moveSections,
                      reorderItems: reorderSections,
                      labels: {financial: 'Financial', operational: 'Operational', compliance: 'Compliance', inventory: 'Inventory', custom: 'Custom Reports'}
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
              </div>
            </div>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
              {kpiLayout.filter(l => l.visible).map(l => {
                switch(l.id) {
                  case 'value': return <KPICard key="value" title="Total Asset Value" value={formatCurrency(kpis.totalAssetValue)} />;
                  case 'networth': return <KPICard key="networth" title="Current Net Worth" value={formatCurrency(kpis.currentNetWorth)} highlight />;
                  case 'total': return <KPICard key="total" title="Total Assets" value={kpis.totalAssets.toString()} />;
                  case 'inuse': return <KPICard key="inuse" title="Assets In Use" value={kpis.assetsInUse.toString()} />;
                  case 'repair': return <KPICard key="repair" title="Under Repair" value={kpis.assetsUnderMaintenance.toString()} />;
                  case 'inventory_items': return <KPICard key="inventory_items" title="Inventory Stock (Items)" value={inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0).toString()} />;
                  default: return null;
                }
              })}
            </div>

            {chartPosition === 'above' && (
              <>
                {chartLayout.filter(l => l.visible).map(l => {
                  if (l.id === 'distribution' && distributionData.length > 0) {
                    return (
                      <div key="distribution" className="mb-8 bg-white border border-[oklch(0.922_0_0)] p-6 rounded-xl shadow-sm">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.205_0_0)]/50 mb-4">Asset Distribution</h3>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={distributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {distributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid oklch(0.922 0 0)', color: 'oklch(0.205 0 0)' }}
                                itemStyle={{ color: 'oklch(0.205 0 0)', fontWeight: 500 }}
                              />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 mt-8">
              <h2 className="text-xl font-bold">Report Categories</h2>
            </div>
            {/* Report Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
              {sectionsLayout.filter(l => l.visible).map(l => {
                switch(l.id) {
                  case 'financial':
                    return (
                      <ReportSection key="financial" title="Financial Reports">
                        <ReportCard icon={<BarChart3 />} title="Asset Valuation" desc="Total original cost value and category-based financial breakdown." onClick={() => setActiveReport('valuation')} />
                        <ReportCard icon={<TrendingDown />} title="Depreciation Analysis" desc="Per-asset depreciation calculations & estimated net worth." onClick={() => setActiveReport('depreciation')} />
                      </ReportSection>
                    );
                  case 'operational':
                    return (
                      <ReportSection key="operational" title="Operational Reports">
                        <ReportCard icon={<Layers />} title="Asset Allocation" desc="Detailed views of hardware assigned to employees and departments." onClick={() => setActiveReport('allocation')} />
                        <ReportCard icon={<Activity />} title="Asset Status Summary" desc="Breakdown of active, inactive, and repairing resources." onClick={() => setActiveReport('status')} />
                      </ReportSection>
                    );
                  case 'compliance':
                    return (
                      <ReportSection key="compliance" title="Compliance & Maintenance">
                        <ReportCard icon={<Wrench />} title="Maintenance Log" desc="Overview of all items currently undergoing repairs or service." onClick={() => setActiveReport('maintenance')} />
                        <ReportCard icon={<ShieldCheck />} title="Comprehensive Audit" desc="Complete asset register for compliance and accounting." onClick={() => setActiveReport('audit')} />
                      </ReportSection>
                    );
                  case 'inventory':
                    return (
                      <ReportSection key="inventory" title="Inventory">
                        <ReportCard icon={<Layers />} title="Inventory Stock Levels" desc="Detailed breakdown of currently available consumable inventory." onClick={() => setActiveReport('inventory_stock')} />
                        <ReportCard icon={<Activity />} title="Inventory Transactions" desc="Log of inventory added, consumed, audited, and moved." onClick={() => setActiveReport('inventory_txs')} />
                      </ReportSection>
                    );
                  case 'custom':
                    return (
                      <ReportSection key="custom" title="Custom Reports">
                        {isManageAllowed && (
                          <div className="group p-5 rounded-xl border border-dashed border-[#c5a059] bg-[#c5a059]/5 hover:bg-[#c5a059]/10 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[104px]" onClick={openCreateModal}>
                            <Plus size={20} className="text-[#c5a059]" />
                            <span className="font-semibold text-[#c5a059]">Create Custom Report</span>
                          </div>
                        )}
                        {customReports.map(report => (
                          <div key={report.id} className="group p-5 rounded-xl border border-[oklch(0.922_0_0)] bg-white shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all cursor-pointer flex items-start justify-between gap-4" onClick={() => setActiveReport(`custom_${report.id}`)}>
                            <div className="flex items-start gap-4">
                              <div className="p-2.5 rounded-lg bg-[oklch(0.97_0_0)] text-[#c5a059] group-hover:bg-[#c5a059] group-hover:text-white transition-colors">
                                <FileText size={22} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-[oklch(0.205_0_0)] break-words max-w-[150px]">{report.name}</h4>
                                <span className="text-[10px] uppercase text-[#c5a059] mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">View Report &rarr;</span>
                              </div>
                            </div>
                            {isManageAllowed && (
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button onClick={(e) => openEditModal(e, report)} className="p-1.5 text-[oklch(0.205_0_0)]/40 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit size={16} /></button>
                                <button onClick={(e) => handleDeleteCustomReport(e, report.id!)} className="p-1.5 text-[oklch(0.205_0_0)]/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </ReportSection>
                    );
                  default: return null;
                }
              })}
            </div>

            {chartPosition === 'below' && (
              <div className="mt-8">
                {chartLayout.filter(l => l.visible).map(l => {
                  if (l.id === 'distribution' && distributionData.length > 0) {
                    return (
                      <div key="distribution" className="mb-8 bg-white border border-[oklch(0.922_0_0)] p-6 rounded-xl shadow-sm">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.205_0_0)]/50 mb-4">Asset Distribution</h3>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={distributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {distributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid oklch(0.922 0 0)', color: 'oklch(0.205 0 0)' }}
                                itemStyle={{ color: 'oklch(0.205 0 0)', fontWeight: 500 }}
                              />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Custom Report Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingReportId ? 'Edit Custom Report' : 'Create Custom Report'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[oklch(0.205_0_0)]">Report Name</label>
              <Input 
                placeholder="e.g. IT Assets 2024" 
                value={newReport.name}
                onChange={e => setNewReport({...newReport, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[oklch(0.205_0_0)]">Description (optional)</label>
              <Input 
                placeholder="Brief description of the report" 
                value={newReport.description}
                onChange={e => setNewReport({...newReport, description: e.target.value})}
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium text-[oklch(0.205_0_0)]">Select Columns</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {AVAILABLE_COLUMNS.map(col => {
                  const isSelected = newReport.columns.includes(col.id);
                  return (
                    <div 
                      key={col.id}
                      onClick={() => {
                        if (isSelected) {
                          setNewReport({...newReport, columns: newReport.columns.filter(c => c !== col.id)});
                        } else {
                          setNewReport({...newReport, columns: [...newReport.columns, col.id]});
                        }
                      }}
                      className={`p-3 rounded-lg border text-sm cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'border-[#c5a059] bg-[#c5a059]/5 text-[#a38042]' : 'border-[oklch(0.922_0_0)] text-[oklch(0.205_0_0)]/70 hover:border-[#c5a059]/50'}`}
                    >
                      <span className="truncate">{col.label}</span>
                      {isSelected && <Check size={14} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCustomReport} className="bg-[#c5a059] text-white hover:bg-[#b08d4b]">{editingReportId ? 'Update Report' : 'Save Report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
