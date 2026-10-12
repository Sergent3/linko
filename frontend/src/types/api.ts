export type EnrichStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type TagSource = 'REGEX' | 'AI' | 'MANUAL';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Tag {
  id: string;
  name: string;
  source: TagSource;
  _count?: { bookmarks: number };
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children?: Folder[];
  _count?: { bookmarks: number };
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string | null;
  favicon: string | null;
  imageUrl: string | null;
  httpStatus: number | null;
  enrichStatus: EnrichStatus;
  folderId: string | null;
  folder?: Folder | null;
  deletedAt: string | null;
  createdAt: string;
  isRead: boolean;
  contentMarkdown?: string | null;
  tags: Array<{ tag: Tag; source: TagSource }>;
}

export interface BookmarkListResponse {
  data: Bookmark[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface BookmarkFilters {
  page?: number;
  limit?: number;
  folderId?: string;
  tagId?: string;
  search?: string;
  enrichStatus?: EnrichStatus;
}

export interface CreateBookmarkDto {
  url: string;
  title: string;
  description?: string;
  folderId?: string;
  tags?: string[];
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  stats: {
    totalBookmarks: number;
    totalFolders: number;
    duplicatesSkipped: number;
    malformedSkipped: number;
  };
}

export interface ApiError {
  message: string;
  status: number;
}

// ── Aggiornamenti (monitoraggio fonti) ─────────────────────────────────────────

export type WatchStatus = 'PENDING' | 'OK' | 'ERROR';

export interface WatchSource {
  id: string;
  name: string;
  url: string;
  kind: 'SITE' | 'FORUM';
  mode: 'AREA' | 'FEED';
  selector: string | null;
  feedUrl: string | null;
  filter: string;
  intervalMinutes: number;
  currentIntervalMinutes: number;
  isActive: boolean;
  status: WatchStatus;
  lastError: string | null;
  failCount: number;
  lastCheckedAt: string | null;
  nextCheckAt: string;
  bookmarkId: string | null;
  createdAt: string;
  unreadCount: number;
}

export interface WatchItem {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  publishedAt: string | null;
  kind: 'NEW' | 'UPDATED';
  matchedTerms: string[];
  isRead: boolean;
  isHidden: boolean;
  savedBookmarkId: string | null;
  firstSeenAt: string;
  source: { id: string; name: string; kind: 'SITE' | 'FORUM' };
}

export interface WatchItemListResponse {
  data: WatchItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ExtractedItem {
  title: string;
  url: string;
  publishedAt?: string;
}

export interface SuggestedArea {
  selector: string;
  label: string;
  itemCount: number;
  sample: ExtractedItem[];
  isNavigation: boolean;
}

export interface FoundFeed {
  url: string;
  title: string;
  itemCount: number;
  sample: ExtractedItem[];
}

export interface WatchPreview {
  finalUrl: string;
  status: number;
  isFeed: boolean;
  feeds: FoundFeed[];
  areas: SuggestedArea[];
  items: ExtractedItem[];
}

export interface CreateWatchSourceDto {
  name: string;
  url: string;
  selector?: string;
  feedUrl?: string;
  filter?: string;
  intervalMinutes: number;
  bookmarkId?: string;
}
