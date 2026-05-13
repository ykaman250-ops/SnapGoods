import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuth, Organization } from '../lib/auth';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export function OrgSwitcher() {
  const { profile, organization, switchOrganization } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchOrgNames() {
      if (profile?.orgRoles) {
        const names: Record<string, string> = {};
        for (const orgId of Object.keys(profile.orgRoles)) {
          if (organization?.id === orgId) {
            names[orgId] = organization.name;
          } else {
            const orgData = await api.get('organizations', orgId);
            if (orgData) {
              names[orgId] = (orgData as Organization).name;
            } else {
              names[orgId] = orgId; // fallback to ID
            }
          }
        }
        setOrgNames(names);
      }
    }
    fetchOrgNames();
  }, [profile?.orgRoles, organization]);

  if (!profile || !profile.orgRoles || Object.keys(profile.orgRoles).length <= 1) {
    return null; // Don't show switcher if user only has 1 or 0 orgs
  }

  const handleSelect = async (orgId: string) => {
    try {
      setIsOpen(false);
      await switchOrganization(orgId);
    } catch (e) {
      console.error(e);
      alert('Failed to switch organization');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">
          {organization?.name || 'Switch Org'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-56 rounded-md bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-800 z-50 py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Organizations
            </div>
            {Object.keys(profile.orgRoles).map((orgId) => {
              const isActive = profile.activeOrgId === orgId;
              const role = profile.orgRoles[orgId];
              return (
                <button
                  key={orgId}
                  onClick={() => handleSelect(orgId)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className={cn(
                      "font-medium",
                      isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"
                    )}>
                      {orgNames[orgId] || orgId}
                    </span>
                    <span className="text-xs text-gray-500 uppercase">{role}</span>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
