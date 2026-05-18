
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
  quantity?: number;
  serialNumber?: string;
  assetTag?: string;
  purchaseDate: string;
  purchaseCost: number;
  vendorId?: string;
  warrantyExpiry?: string;
  nextServiceDate?: string;
  locationId?: string;
  department?: string;
  assignedTo?: string; // employeeId
  remarks?: string;
  usefulLifeYears: number;
  lastLifecycleAlertSentAt?: string;
  lastMaintenanceAlertSentAt?: string;
  lastWarrantyAlertSentAt?: string;
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
  usage?: 'asset' | 'inventory' | 'both';
  includeSerialNumber?: boolean;
  includeAssetTag?: boolean;
  customFields?: CustomFieldDefinition[];
}

export interface AssetCategory {
  id?: string;
  orgId: string;
  name: string;
  usage?: 'asset' | 'inventory' | 'both';
  targetStock?: number;
  assetTypes?: AssetType[];
  types?: string[]; // Keep for backward compatibility
  createdAt: string;
}

export interface Location {
  id?: string;
  orgId: string;
  name: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
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
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  contactInfo?: string;
  createdAt: string;
}

export interface Employee {
  id?: string;
  orgId: string;
  name: string;
  email: string;
  locationId?: string;
  department?: string;
  employeeCode?: string;
  dateOfJoining?: string;
  dateOfLeaving?: string;
  createdAt: string;
}


export interface InventoryItem {
  id?: string;
  orgId: string;
  name: string;
  itemCode: string; // SKU or internal code
  category: string;
  type?: string;
  locationId: string;
  quantity: number;
  lowStockThreshold?: number;
  purchaseCost?: number;
  vendorId?: string;
  remarks?: string;
  customData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id?: string;
  orgId: string;
  itemId: string;
  action: 'add' | 'consume' | 'audit' | 'move';
  quantity: number; // positive for add, negative for consume
  previousQuantity: number;
  newQuantity: number;
  locationId?: string; // If applicable
  notes?: string;
  userId: string;
  timestamp: string;
}

export interface Organization {
  id?: string;
  name: string;
  ownerId?: string;
  createdBy?: string;
  ownerIds?: string[];
  userCount?: number;
  plan?: string;
  currency?: string;
  billing?: {
    nextBillingDate?: string;
  };
  createdAt?: string;
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
