export interface Note {
  id: string;
  title: string;
  content: string;
  plainText: string;
  folderId: string | null;
  tagIds: string[];
  isPinned: boolean;
  isLocked: boolean;
  isArchived: boolean;
  isEncrypted: boolean;
  encryptedContent?: string;
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  plainText: string;
  createdAt: number;
  version: number;
  summary?: string;
}

export interface Attachment {
  id: string;
  noteId: string;
  type: 'image' | 'file' | 'audio' | 'video';
  filename: string;
  mimeType: string;
  size: number;
  data?: Blob;
  url?: string;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type CloudProvider = 'baidu' | 'google' | 'quark' | 'onedrive';

export interface CloudAccount {
  id: string;
  provider: CloudProvider;
  displayName: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  isConnected: boolean;
  lastSyncAt: number | null;
  autoSync: boolean;
  syncInterval: number;
  remotePath: string;
  sortOrder: number;
}

export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict';

export interface SyncLog {
  id: string;
  noteId: string;
  action: 'create' | 'update' | 'delete';
  provider: CloudProvider;
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  message?: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  content: string;
  category: 'blank' | 'diary' | 'meeting' | 'todo' | 'reading' | 'project' | 'custom';
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ImportSource = 'apple-notes' | 'markdown' | 'txt' | 'pdf' | 'json' | 'html';
export type ExportFormat = 'markdown' | 'pdf' | 'word' | 'json' | 'html';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export type ThemeMode = 'auto' | 'dark' | 'light' | 'custom';
export type ResolvedTheme = 'dark' | 'light';
export type ViewMode = 'grid' | 'list' | 'kanban' | 'timeline';

export type AccentColor = 'mint' | 'ocean' | 'sunset' | 'rose' | 'violet';

export interface AppSettings {
  theme: ThemeMode;
  viewMode: ViewMode;
  homeViewMode: ViewMode;
  foldersViewMode: 'list' | 'grid';
  defaultFolderId: string | null;
  fontSize: 'small' | 'medium' | 'large';
  autoSave: boolean;
  autoSaveInterval: number;
  markdownDefault: boolean;
  showLineNumbers: boolean;
  spellCheck: boolean;
  accentColor: AccentColor;
  backgroundColor: AccentColor;
  deepseekApiKey: string;
  showHomeTitle: boolean;
  homeStatOrder: string[];
  collapsedSections: string[];
}
