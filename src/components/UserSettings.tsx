import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { useAuth } from '../lib/auth';
import { auth } from '../lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { Settings, User, Monitor, Clock, LayoutGrid, Shield } from 'lucide-react';
import { toast } from 'sonner';

export function UserSettings() {
  const { profile, updateProfile, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState(profile?.name || '');
  const [theme, setTheme] = useState(profile?.preferences?.theme || 'system');
  const [defaultPage, setDefaultPage] = useState(profile?.preferences?.defaultPage || '/');
  const [compactTable, setCompactTable] = useState(profile?.preferences?.compactTable ? 'true' : 'false');
  const [dateFormat, setDateFormat] = useState(profile?.preferences?.dateFormat || 'MMM d, yyyy');
  const [timeFormat, setTimeFormat] = useState(profile?.preferences?.timeFormat || '12h');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Reset form when opened
  React.useEffect(() => {
    if (isOpen && profile) {
      setName(profile.name || '');
      setTheme(profile.preferences?.theme || 'system');
      setDefaultPage(profile.preferences?.defaultPage || '/');
      setCompactTable(profile.preferences?.compactTable ? 'true' : 'false');
      setDateFormat(profile.preferences?.dateFormat || 'MMM d, yyyy');
      setTimeFormat(profile.preferences?.timeFormat || '12h');
      setCurrentPassword('');
      setNewPassword('');
    }
  }, [isOpen, profile]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateProfile({
        name,
        preferences: {
          ...profile?.preferences,
          theme: theme as 'light' | 'dark' | 'system',
          defaultPage,
          compactTable: compactTable === 'true',
          dateFormat,
          timeFormat: timeFormat as '12h' | '24h',
        }
      });
      toast.success('Settings saved successfully');
      setIsOpen(false);
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }

    if (!user || (!user.email && user.email !== '')) return;

    setIsChangingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email as string, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Incorrect current password.');
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error('Session expired. Please log out, log back in, and try again.');
      } else {
        toast.error(error.message || 'Failed to update password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="ghost" className="w-full justify-start gap-3" />}>
        <Settings className="w-5 h-5" />
        Settings
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-gold-600" />
              Profile Information
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Your Name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md border border-border truncate">
                  {profile?.email}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md border border-border capitalize">
                  {profile?.role}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gold-600" />
              General Preferences
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System Default</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Landing Page</label>
                <Select value={defaultPage} onValueChange={setDefaultPage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/">Dashboard</SelectItem>
                    <SelectItem value="/assets">Assets</SelectItem>
                    <SelectItem value="/employees">Employees</SelectItem>
                    <SelectItem value="/assignments">Assignments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-gold-600" />
              Display Settings
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Table Density</label>
              <Select value={compactTable} onValueChange={setCompactTable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Comfortable</SelectItem>
                  <SelectItem value="true">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-600" />
              Regional Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Format</label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MMM d, yyyy">Jan 1, 2026</SelectItem>
                    <SelectItem value="MM/dd/yyyy">12/31/2026</SelectItem>
                    <SelectItem value="dd/MM/yyyy">31/12/2026</SelectItem>
                    <SelectItem value="yyyy-MM-dd">2026-12-31</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Format</label>
                <Select value={timeFormat} onValueChange={setTimeFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (1:00 PM)</SelectItem>
                    <SelectItem value="24h">24-hour (13:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold-600" />
              Security
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input 
                  type="password"
                  placeholder="Enter current password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <div className="flex gap-2">
                  <Input 
                    type="password"
                    placeholder="New Password (min. 6 chars)" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || !currentPassword}
                    className="border-primary/20 hover:border-primary text-primary"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
