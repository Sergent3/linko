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

/** Come arrivano le novità: solo in Linko, anche subito su Telegram, o in un riepilogo al giorno. */
export type WatchDelivery = 'NORMAL' | 'INSTANT' | 'DIGEST';

export interface NotificationSettings {
  telegram: { configured: boolean; bot: string | null; linked: boolean };
  keywords: string;
  digestHour: number;
  nextDigestAt: string | null;
  lastDigestAt: string | null;
  instantSources: number;
  digestSources: number;
  chatName?: string;
}

export interface WatchSource {
  id: string;
  name: string;
  url: string;
  kind: 'SITE' | 'FORUM';
  mode: 'AREA' | 'FEED' | 'THREAD';
  selector: string | null;
  feedUrl: string | null;
  filter: string;
  category: string | null;
  position: number;
  delivery: WatchDelivery;
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
  source: { id: string; name: string; kind: 'SITE' | 'FORUM'; mode: 'AREA' | 'FEED' | 'THREAD'; delivery: WatchDelivery };
}

/** Contenuto di un elemento per l'anteprima (HTML già ripulito dal backend). */
export interface WatchItemContent {
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  image?: string;
  html: string;
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
  /** Presente se per il dominio c'è un accesso salvato */
  auth?: { domain: string; state: 'in' | 'out' | 'unknown'; status: number };
  /** Software del forum riconosciuto (XenForo, phpBB…) */
  forum?: string | null;
  /** L'indirizzo è una discussione: se ne seguono le nuove risposte */
  thread?: { url: string; title: string; postCount: number; sample: ExtractedItem[] };
}

export type CredentialStatus = 'UNVERIFIED' | 'OK' | 'EXPIRED';

export interface SiteCredential {
  id: string;
  domain: string;
  cookieNames: string[];
  hasUserAgent: boolean;
  status: CredentialStatus;
  lastError: string | null;
  lastUsedAt: string | null;
  lastStatus: number | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
}

export interface CredentialVerification {
  ok: boolean;
  state?: 'in' | 'out' | 'unknown';
  status?: number;
  finalUrl?: string;
  message?: string;
}

export interface SaveCredentialDto {
  site: string;
  cookie: string;
  userAgent?: string;
  testUrl?: string;
}

export interface UpdateWatchSourceDto {
  name?: string;
  url?: string;
  selector?: string;
  feedUrl?: string;
  /** Passa a seguire le nuove risposte della discussione indicata in url */
  thread?: boolean;
  kind?: 'SITE' | 'FORUM';
  filter?: string;
  intervalMinutes?: number;
  category?: string | null;
  delivery?: WatchDelivery;
  isActive?: boolean;
}

export interface CreateWatchSourceDto {
  name: string;
  url: string;
  selector?: string;
  feedUrl?: string;
  /** Segue le nuove risposte della discussione indicata in url */
  thread?: boolean;
  kind?: 'SITE' | 'FORUM';
  filter?: string;
  intervalMinutes: number;
  category?: string | null;
  delivery?: WatchDelivery;
  bookmarkId?: string;
}
