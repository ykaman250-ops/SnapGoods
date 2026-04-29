
export type AssetStatus = 'available' | 'assigned' | 'repair' | 'retired';
export type AssetCategoryName = 'IT' | 'Vehicle' | 'Machinery' | 'Tool' | 'Facility';

export interface Asset {
  id?: string;
  orgId: string;
  name: string;
  assetCode: string;
  category: AssetCategoryName | string;
  type?: string;
  status: AssetStatus;
  serialNumber?: string;
  purchaseDate: string;
  purchaseCost: number;
  vendorId?: string;
  warrantyExpiry?: string;
  locationId?: string;
  department?: string;
  assignedTo?: string; // employeeId
  remarks?: string;
  usefulLifeYears: number;
  salvageValue: number;
  depreciationMethod: 'straight_line' | 'wdv';
  customData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[]; // For select type
  required?: boolean;
  defaultValue?: any;
}

export interface AssetType {
  name: string;
  customFields?: CustomFieldDefinition[];
}

export interface AssetCategory {
  id?: string;
  orgId: string;
  name: string;
  assetTypes?: AssetType[];
  types?: string[]; // Keep for backward compatibility
  createdAt: string;
}

export interface Location {
  id?: string;
  orgId: string;
  name: string;
  address?: string;
  pinCode?: string;
  departments?: string[];
  createdAt: string;
}

export interface Vendor {
  id?: string;
  orgId: string;
  name: string;
  vendorCode?: string;
  phoneNumber?: string;
  emailAddress?: string;
  address?: string;
  contactInfo?: string;
  createdAt: string;
}

export interface Employee {
  id?: string;
  orgId: string;
  name: string;
  email: string;
  department?: string;
  employeeCode?: string;
  createdAt: string;
}

export interface AssetHistory {
  id?: string;
  assetId: string;
  orgId: string;
  action: 'created' | 'assigned' | 'moved' | 'status_changed' | 'updated';
  from?: string;
  to?: string;
  performedBy: string; // userId or name
  timestamp: string;
}

export interface Assignment {
  id?: string;
  assetId: string;
  orgId?: string;
  assigneeType: 'employee' | 'department';
  employeeId?: string;
  department?: string;
  assignedAt: string;
  returnedAt?: string;
  status: 'active' | 'returned';
  remarks?: string;
}

export interface MaintenanceLog {
  id?: string;
  assetId: string;
  orgId: string;
  type: 'service' | 'repair';
  date: string;
  cost: number;
  vendorId?: string;
  notes?: string;
}
