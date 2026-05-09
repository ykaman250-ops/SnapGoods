import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Info, Clock, AlertCircle, ChevronLeft } from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'warning' | 'danger' | 'info';
  icon: any;
  colorClass: string;
  link?: string;
  data?: any[]; // The underlying assets/items
  dataType?: 'asset' | 'inventory_category' | 'inventory_item';
}

export function NotificationsDropdown() {
  const { organization } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!organization?.id) return;

    // We fetch assets and inventory to calculate alerts (expiring warranties, eol, low stock, service due)
    const qAssets = query(collection(db, 'assets'), where('orgId', '==', organization.id));
    const qInventory = query(collection(db, 'inventory_items'), where('orgId', '==', organization.id));
    const qCategories = query(collection(db, 'asset_categories'), where('orgId', '==', organization.id));

    let unsubscribeAssets = () => {};
    let unsubscribeInventory = () => {};
    let unsubscribeCategories = () => {};

    const calculateNotifications = async () => {
      let currentAssets: any[] = [];
      let currentInventory: any[] = [];
      let currentCategories: any[] = [];

      const triggerProcess = () => {
        if (currentAssets.length >= 0 && currentInventory.length >= 0) {
          processAlerts(currentAssets, currentInventory, currentCategories);
        }
      };

      unsubscribeAssets = onSnapshot(qAssets, (assetSnap) => {
        currentAssets = assetSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        triggerProcess();
      });

      unsubscribeInventory = onSnapshot(qInventory, (invSnap) => {
        currentInventory = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        triggerProcess();
      });

      unsubscribeCategories = onSnapshot(qCategories, (catSnap) => {
        currentCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        triggerProcess();
      });
    };

    calculateNotifications();

    return () => {
      unsubscribeAssets();
      unsubscribeInventory();
      unsubscribeCategories();
    };
  }, [organization?.id]);

  const processAlerts = (assets: any[], inventory: any[], categories: any[]) => {
    const generatedAlerts: AppNotification[] = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    
    const warrantiesExpiring: any[] = [];
    const serviceDue: any[] = [];
    const prolongedRepair: any[] = [];
    const eolApproaching: any[] = [];
    
    assets.forEach(asset => {
      if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) <= thirtyDaysFromNow && new Date(asset.warrantyExpiry) >= now) warrantiesExpiring.push(asset);
      if (asset.nextServiceDate && new Date(asset.nextServiceDate) <= thirtyDaysFromNow) serviceDue.push(asset);
      if (asset.usefulLifeYears && asset.purchaseDate) {
        const purchaseDate = new Date(asset.purchaseDate);
        const eolDate = new Date(purchaseDate.setFullYear(purchaseDate.getFullYear() + Number(asset.usefulLifeYears)));
        if (eolDate <= thirtyDaysFromNow && eolDate >= now) eolApproaching.push(asset);
      }
      if ((asset.status === 'repair' || asset.status === 'in repair' || asset.status === 'maintenance') && asset.updatedAt) {
        if (new Date(asset.updatedAt) <= fourteenDaysAgo) prolongedRepair.push(asset);
      }
    });

    if (warrantiesExpiring.length > 0) {
      generatedAlerts.push({
        id: 'warranty',
        title: 'Warranties Expiring',
        message: `${warrantiesExpiring.length} assets have warranties expiring in less than 30 days.`,
        time: 'Just now',
        read: false,
        type: 'warning',
        icon: Clock,
        colorClass: 'bg-yellow-100 text-yellow-600 border-yellow-200',
        data: warrantiesExpiring,
        dataType: 'asset'
      });
    }

    if (serviceDue.length > 0) {
      generatedAlerts.push({
        id: 'service',
        title: 'Service Due',
        message: `${serviceDue.length} assets have maintenance/service due soon or overdue.`,
        time: 'Just now',
        read: false,
        type: 'warning',
        icon: AlertCircle,
        colorClass: 'bg-orange-100 text-orange-600 border-orange-200',
        data: serviceDue,
        dataType: 'asset'
      });
    }

    if (prolongedRepair.length > 0) {
      generatedAlerts.push({
        id: 'repair',
        title: 'Prolonged Maintenance',
        message: `${prolongedRepair.length} assets have been in repair/maintenance for over 14 days.`,
        time: 'Just now',
        read: false,
        type: 'info',
        icon: Info,
        colorClass: 'bg-blue-100 text-blue-600 border-blue-200',
        data: prolongedRepair,
        dataType: 'asset'
      });
    }

    if (eolApproaching.length > 0) {
      generatedAlerts.push({
        id: 'eol',
        title: 'End of Life Approaching',
        message: `${eolApproaching.length} assets are reaching the end of their useful life.`,
        time: 'Just now',
        read: false,
        type: 'danger',
        icon: AlertTriangle,
        colorClass: 'bg-red-100 text-red-600 border-red-200',
        data: eolApproaching,
        dataType: 'asset'
      });
    }

    const lowStockItems: any[] = [];
    inventory.forEach(item => {
      const minStock = Number(item.minStock) || 0;
      const current = Number(item.quantity) || 0;
      if (minStock > 0 && current <= minStock) {
        lowStockItems.push(item);
      }
    });

    if (lowStockItems.length > 0) {
      generatedAlerts.push({
        id: 'low-stock',
        title: 'Low Stock Alerts',
        message: `${lowStockItems.length} inventory items have reached or fallen below minimum stock level.`,
        time: 'Just now',
        read: false,
        type: 'danger',
        icon: AlertTriangle,
        colorClass: 'bg-red-100 text-red-600 border-red-200',
        data: lowStockItems,
        dataType: 'inventory_item'
      });
    }

    const lowStockCategories: any[] = [];
    const categoryQuantities: Record<string, number> = {};
    
    inventory.forEach(item => {
      if (item.category) {
        categoryQuantities[item.category] = (categoryQuantities[item.category] || 0) + (Number(item.quantity) || 0);
      }
    });

    categories.forEach(cat => {
      if (cat.targetStock && cat.targetStock > 0) {
        const currentTotal = categoryQuantities[cat.name] || 0;
        if (currentTotal <= cat.targetStock * 0.20) {
          lowStockCategories.push({
            ...cat,
            currentTotal
          });
        }
      }
    });

    if (lowStockCategories.length > 0) {
      generatedAlerts.push({
        id: 'low-stock-category',
        title: 'Category Target Stock Alert',
        message: `${lowStockCategories.length} categories have inventory volume fallen below 20% of target stock.`,
        time: 'Just now',
        read: false,
        type: 'danger',
        icon: AlertTriangle,
        colorClass: 'bg-red-100 text-red-600 border-red-200',
        data: lowStockCategories,
        dataType: 'inventory_category'
      });
    }

    setNotifications(generatedAlerts);
    setUnreadCount(generatedAlerts.filter(a => !a.read).length);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button 
        onClick={() => {
          setIsNotificationsOpen(!isNotificationsOpen);
          if (!isNotificationsOpen) {
            setSelectedNotification(null);
            setShowAllInsights(false);
          }
        }}
        className={`relative p-2 rounded-full transition-all duration-200 ${isNotificationsOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background"></span>
        )}
      </button>

      {/* Notification Popup */}
      {isNotificationsOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-[450px] bg-card border border-border rounded-2xl shadow-lg overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
          
          {selectedNotification || showAllInsights ? (
            <div className="flex flex-col max-h-[600px]">
              {/* Detail Header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-muted/30 backdrop-blur-sm shrink-0">
                <button 
                  onClick={() => { setSelectedNotification(null); setShowAllInsights(false); }}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{showAllInsights ? 'All Insights' : selectedNotification?.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{showAllInsights ? 'Detailed view of all active alerts' : selectedNotification?.message}</p>
                </div>
              </div>
              
              {/* Detail Content */}
              <div className="overflow-y-auto custom-scrollbar p-0">
                {(showAllInsights ? notifications : (selectedNotification ? [selectedNotification] : [])).map((notif: any) => (
                  <div key={notif.id} className={showAllInsights ? 'border-b-[4px] border-border last:border-0' : ''}>
                    {showAllInsights && notif.data && notif.data.length > 0 && (
                      <div className="px-4 py-2 bg-muted/30 font-medium text-xs text-muted-foreground flex items-center gap-2 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
                        <notif.icon className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-wider font-semibold">{notif.title}</span>
                        <span className="ml-auto bg-background px-2 py-0.5 rounded-full border border-border text-foreground">{notif.data.length}</span>
                      </div>
                    )}
                    {notif.dataType === 'asset' && notif.data?.map((asset: any) => (
                      <Link 
                        key={asset.id} 
                        to={`/assets`}
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors bg-card"
                      >
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm text-foreground block truncate">{asset.name || 'Unnamed Asset'}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 block">{asset.assetCode}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">{asset.status}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center justify-between mt-2">
                          <span>{asset.category || 'Uncategorized'}</span>
                          {notif.id === 'warranty' && <span>Exp: {new Date(asset.warrantyExpiry).toLocaleDateString()}</span>}
                          {notif.id === 'service' && <span>Due: {asset.nextServiceDate ? new Date(asset.nextServiceDate).toLocaleDateString() : 'N/A'}</span>}
                          {notif.id === 'repair' && <span>Since: {asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString() : 'N/A'}</span>}
                        </div>
                      </Link>
                    ))}
                    
                    {notif.dataType === 'inventory_item' && notif.data?.map((item: any) => (
                      <Link 
                        key={item.id} 
                        to={`/inventory`}
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors bg-card"
                      >
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm text-foreground block truncate">{item.name || 'Unnamed Item'}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 block">{item.itemCode}</span>
                          </div>
                          <span className="text-xs font-bold text-red-500 shrink-0">{item.quantity} left</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Min Stock required: {item.minStock}
                        </div>
                      </Link>
                    ))}

                    {notif.dataType === 'inventory_category' && notif.data?.map((cat: any) => (
                      <Link 
                        key={cat.id} 
                        to={`/inventory`}
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors bg-card"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm text-foreground">{cat.name}</span>
                          <span className="text-xs font-bold text-red-500">{cat.currentTotal} items</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>Target: {cat.targetStock}</span>
                          <span>Below 20% limit ({Math.round(cat.targetStock * 0.2)})</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30 backdrop-blur-sm shrink-0">
                <h3 className="font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        onClick={() => {
                          if (notification.data && notification.data.length > 0) {
                            setSelectedNotification(notification);
                          }
                          // Only mark THIS notification as read
                          if (!notification.read) {
                            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
                            setUnreadCount(prev => prev - 1);
                          }
                        }}
                        className={`block p-5 transition-colors hover:bg-muted/50 cursor-pointer ${!notification.read ? 'bg-muted/20' : ''}`}
                      >
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notification.colorClass}`}>
                            <notification.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className={`text-sm font-semibold truncate pr-4 ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {notification.title}
                              </h4>
                              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{notification.time}</span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {notification.message}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="flex items-center justify-center shrink-0 pt-2">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground">
                    <Bell className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-sm">You're all caught up!</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border bg-card shrink-0">
                <button 
                  onClick={() => { setShowAllInsights(true); markAllAsRead(); }} 
                  className="block w-full py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors text-center"
                >
                  View all insights
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
