import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { UndoRedoProvider } from './contexts/UndoRedoContext';
import { ActionManagerProvider } from './lib/actionManager';
import { Toaster } from './components/ui/sonner';
import { Lock, UserX, LogOut } from 'lucide-react';
import { Button } from './components/ui/button';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Employees from './pages/Employees';
import Assignments from './pages/Assignments';
import Admin from './pages/Admin';
import AssetConfiguration from './pages/AssetConfiguration';
import AssetPrint from './pages/AssetPrint';
import Landing from './pages/Landing';
import Reports from './pages/Reports';
import Inventory from './pages/Inventory';
import { LoadingScreen } from './components/LoadingScreen';

function ProtectedRoute({ children, requiredRole, forbiddenRoles }: { children: React.ReactNode, requiredRole?: string, forbiddenRoles?: string[] }) {
  const { user, profile, loading, logout } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (user && !profile) return <LoadingScreen />;
  
  if (profile?.status === 'frozen') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-muted">
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 text-center max-w-md">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Frozen</h2>
          <p className="text-muted-foreground mb-6">Your account has been temporarily frozen for security reasons. Please contact your system administrator to unlock it.</p>
          <Button onClick={logout} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (profile?.status === 'inactive') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-muted">
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 text-center max-w-md">
          <div className="w-16 h-16 bg-muted/80 text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Deactivated</h2>
          <p className="text-muted-foreground mb-6">This account is no longer active. If you believe this is a mistake, please contact your administrator or support team.</p>
          <Button onClick={logout} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const activeRole = profile?.activeOrgId && profile.orgRoles ? profile.orgRoles[profile.activeOrgId] : null;

  if (forbiddenRoles && activeRole && forbiddenRoles.includes(activeRole)) {
    return <Navigate to="/dashboard" />;
  }

  if (requiredRole && activeRole !== requiredRole && activeRole !== 'admin' && activeRole !== 'owner' && activeRole !== 'superadmin') {
    return <Navigate to="/" />;
  }

  return (
    <UndoRedoProvider>
      <ActionManagerProvider>
        {children}
      </ActionManagerProvider>
    </UndoRedoProvider>
  );
}

function ProtectedLayout() {
  return <Layout />;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  
  React.useEffect(() => {
    const root = window.document.documentElement;
    const theme = profile?.preferences?.theme || 'system';
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      root.classList.remove('light', 'dark');
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    };
    
    applyTheme();
    
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [profile?.preferences?.theme]);
  
  return <>{children}</>;
}

function RootRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && !profile) return <LoadingScreen />;
  if (user && profile) return <Navigate to="/dashboard" />;
  return <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route element={
              <ProtectedRoute>
                <ProtectedLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/reports" element={
                <ProtectedRoute forbiddenRoles={['viewer']}>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/asset-config" element={
                <ProtectedRoute requiredRole="admin">
                  <AssetConfiguration />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <Admin />
                </ProtectedRoute>
              } />
            </Route>
            <Route path="/print-labels" element={
              <ProtectedRoute>
                <AssetPrint />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  );
}
