export type TargetAudience = 'both' | 'student' | 'staff';
export type LinkCategory = 'university' | 'faculty';

export interface Link {
  id: string;
  title: string;
  url: string;
  description?: string;
  isStaffOnly: boolean;
  targetAudience?: TargetAudience;
  category?: LinkCategory;
  order?: number;
  clickCount: number;
  createdAt: string;
  thumbnailUrl?: string;
  isPinned?: boolean;
  isMaintenance?: boolean;
  maintenanceNote?: string;
}

export interface User {
  username: string;
  role: 'superadmin' | 'admin' | 'staff';
  pinnedLinks: string[];
}

export interface AuthCredentials {
  username?: string;
  password?: string;
}

export interface StaffPasswordItem {
  id: string;
  label: string;
  code: string;
  department?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AdminConfig {
  adminPassword?: string;
  announcementText?: string;
  isAnnouncementActive?: boolean;
  staffPasswords?: string[];
  staffPasswordItems?: StaffPasswordItem[];
  staffCodeHashes?: string[];
  googleSheetId?: string;
  isGoogleSheetSyncEnabled?: boolean;
  googleAppsScriptUrl?: string;
  syncInterval?: number;
  siteTitle?: string;
  siteLogoUrl?: string;
}

