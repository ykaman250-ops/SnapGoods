import React, { useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Laptop, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  ArrowLeftRight,
  Database,
  BarChart3,
  Package,
  Undo2,
  Redo2
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { UserSettings } from './UserSettings';
import { useUndoRedo } from '../contexts/UndoRedoContext';
import { OrgSwitcher } from './OrgSwitcher';
import { useScrollPreservation } from '../lib/useScrollPreservation';

import { NotificationsDropdown } from './NotificationsDropdown';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Assets', href: '/assets', icon: Laptop },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Employees', href: '/employees', icon: Users },
  { name: 'Assignments', href: '/assignments', icon: ArrowLeftRight },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Configuration', href: '/asset-config', icon: Database },
  { name: 'Admin Settings', href: '/admin', icon: ShieldCheck },
];

export default function Layout() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const mainRef = useRef<HTMLElement>(null);
  useScrollPreservation(mainRef, location.pathname);

  return (
    <div className="min-h-[100dvh] bg-transparent flex">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar for desktop */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card/95 backdrop-blur-sm border-r border-border transform transition-transform duration-200 ease-in-out md:sticky md:top-0 md:h-[100dvh] md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-48 h-12 flex items-center justify-center">
                <Logo variant="full" />
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden -mr-2 text-muted-foreground hover:bg-muted/80"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.filter(item => !(item.name === 'Reports' && profile?.activeOrgId && profile?.orgRoles?.[profile.activeOrgId] === 'viewer')).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-zinc-100 text-zinc-900 border-l-2 border-zinc-900 dark:bg-zinc-800/50 dark:text-white dark:border-white pl-2.5" 
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}

            {((profile?.activeOrgId && profile.orgRoles && ['admin', 'owner', 'superadmin'].includes(profile.orgRoles[profile.activeOrgId])) || Object.values(profile?.orgRoles || {}).includes('superadmin')) && (
              <>
                <div className="pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  Administration
                </div>
                {adminNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-zinc-100 text-zinc-900 border-l-2 border-zinc-900 dark:bg-zinc-800/50 dark:text-white dark:border-white pl-2.5" 
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-border/50">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                {profile?.name?.charAt(0) || profile?.email?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">{profile?.activeOrgId && profile.orgRoles ? profile.orgRoles[profile.activeOrgId] : ''}</p>
              </div>
            </div>
            <UserSettings />
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 mt-1"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-card/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-between px-4 md:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </Button>
            
            <div className="hidden md:flex flex-col">
              <h2 className="text-sm font-semibold text-foreground/80 capitalize">
                {location.pathname === '/dashboard' ? 'Dashboard' : location.pathname.split('/')[1] || 'Welcome'}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <OrgSwitcher />
            <div className="flex items-center gap-1 border-r border-border pr-4 mr-0">
            </div>
            <NotificationsDropdown />
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-foreground">{profile?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.activeOrgId && profile?.orgRoles ? profile.orgRoles[profile.activeOrgId] : ''}</p>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0 relative">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full flex-1 flex flex-col min-h-0 h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
