import React, { useEffect, useState } from 'react';
import { Bell, AlertCircle, RefreshCw, Archive, BellRing, Settings, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { api, handleFirestoreError, OperationType } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppNotification } from '../lib/types';
import { useNavigate } from 'react-router-dom';
import { where, orderBy, limit, query, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useDateFormatter } from '../lib/useDateFormatter';

export function NotificationsDropdown() {
  const { profile, organization } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const formatDate = useDateFormatter();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile || !organization) return;

    const fetchNotifications = async () => {
      try {
        const auth = (await import('../lib/firebase')).auth;
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed to fetch notifications: ${res.status} ${errText}`);
        }
        
        const data = await res.json();
        setNotifications(data);
        
        let unread = 0;
        data.forEach((n: AppNotification) => {
          if (!n.read) unread++;
        });
        setUnreadCount(unread);
      } catch (e) {
        console.error("Error fetching notifs:", e);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [profile, organization]);

  const markAsRead = async (id: string) => {
    try {
      const auth = (await import('../lib/firebase')).auth;
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifs.map(n => markAsRead(n.id!)));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.read) {
      markAsRead(notif.id!);
    }
    setOpen(false);
    
    // Navigate based on type
    if (notif.relatedEntityId) {
      if (notif.type === 'warranty' || notif.type === 'maintenance' || notif.type === 'lifecycle') {
        navigate(`/assets`); // Could navigate to specific asset detail modal if supported
      } else if (notif.type === 'billing') {
        navigate('/admin');
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warranty': return <ShieldCheck className="w-4 h-4 text-amber-500" />;
      case 'maintenance': return <Settings className="w-4 h-4 text-blue-500" />;
      case 'lifecycle': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'billing': return <Archive className="w-4 h-4 text-emerald-500" />;
      default: return <BellRing className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 flex items-center justify-center text-muted-foreground hover:bg-muted/80 rounded-md transition-colors outline-none">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-card" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-muted-foreground" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-4 text-left transition-colors border-b border-border/30 last:border-0 hover:bg-muted/50 ${!notif.read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-full ${!notif.read ? 'bg-background shadow-sm' : 'bg-muted'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm leading-tight ${!notif.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {formatDate(notif.createdAt)}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
