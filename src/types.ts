export interface Link {
  id: string;
  title: string;
  url: string;
  description?: string;
  isStaffOnly: boolean;
  clickCount: number;
  createdAt: string;
  thumbnailUrl?: string;
  isPinned?: boolean;
}

export interface User {
  username: string;
  role: 'superadmin' | 'admin';
  pinnedLinks: string[];
}

export interface AuthCredentials {
  username?: string;
  password?: string;
}

export interface AdminConfig {
  adminPassword?: string;
  announcementText?: string;
  isAnnouncementActive?: boolean;
  staffPasswords?: string[];
  googleSheetId?: string;
  isGoogleSheetSyncEnabled?: boolean;
  googleAppsScriptUrl?: string;
  syncInterval?: number;
  siteTitle?: string;
  siteLogoUrl?: string;
}
