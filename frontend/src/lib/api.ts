import type {
  AuthResponse,
  Bookmark,
  BookmarkFilters,
  BookmarkListResponse,
  CreateBookmarkDto,
  Folder,
  ImportResult,
  Tag,
  CreateWatchSourceDto,
  WatchItem,
  WatchItemContent,
  WatchItemListResponse,
  WatchPreview,
  WatchSource,
  UpdateWatchSourceDto,
  SiteCredential,
  CredentialVerification,
  SaveCredentialDto,
} from '@/types/api';

const BASE = '/api/v1';

// ── Token storage ──────────────────────────────────────────────────────────────

export const tokens = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('linko_access');
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('linko_refresh');
  },
  set(access: string, refresh: string) {
    localStorage.setItem('linko_access', access);
    localStorage.setItem('linko_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('linko_access');
    localStorage.removeItem('linko_refresh');
    localStorage.removeItem('linko_user');
  },
};

// ── Core fetch wrapper ─────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

/** La sessione è davvero finita (token rifiutato dal server): si torna al login. */
function endSession(): never {
  tokens.clear();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
  throw new Error('Sessione scaduta');
}

/**
 * Rinnova l'access token. Le schede aperte si coordinano con un lock: se nel
 * frattempo un'altra scheda ha già ruotato il refresh token, si usa il suo.
 * Errori di rete o del server (backend che si riavvia, 502…) NON fanno uscire:
 * solo un rifiuto esplicito del token (401/403) chiude la sessione.
 */
async function doRefresh(): Promise<string> {
  const used = tokens.refresh;
  const run = async (): Promise<string> => {
    const current = tokens.refresh;
    if (!current) endSession();
    if (current !== used && tokens.access) return tokens.access!;
    const raw = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current }),
    });
    if (raw.status === 401 || raw.status === 403) endSession();
    if (!raw.ok) throw new Error('Server non raggiungibile, riprova tra poco');
    const data: AuthResponse = await raw.json();
    tokens.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request('linko-refresh', run) : run();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const access = tokens.access;
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && tokens.refresh && !path.startsWith('/auth/')) {
    let newToken: string | null;
    if (isRefreshing) {
      newToken = await new Promise<string | null>((resolve) => { refreshQueue.push(resolve); });
      if (!newToken) throw new Error('Server non raggiungibile, riprova tra poco');
    } else {
      isRefreshing = true;
      try {
        newToken = await doRefresh();
      } catch (err) {
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        throw err;
      } finally {
        isRefreshing = false;
      }
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
    }
    headers['Authorization'] = `Bearer ${newToken}`;
    return request<T>(path, { ...options, headers }, false);
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error ?? body.message ?? 'Errore sconosciuto') as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }

  return body as T;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: tokens.refresh }),
    }).finally(() => tokens.clear()),
};

// ── Bookmarks ──────────────────────────────────────────────────────────────────

export const bookmarks = {
  list: (filters: BookmarkFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null)
        params.set(k, String(v));
    });
    const qs = params.toString();
    return request<BookmarkListResponse>(`/bookmarks${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => request<Bookmark>(`/bookmarks/${id}`),

  create: (dto: CreateBookmarkDto) =>
    request<Bookmark>('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  update: (id: string, dto: Partial<CreateBookmarkDto>) =>
    request<Bookmark>(`/bookmarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  delete: (id: string) =>
    request<void>(`/bookmarks/${id}`, { method: 'DELETE' }),

  trash: () =>
    request<Bookmark[]>('/bookmarks/trash'),

  restore: (id: string) =>
    request<Bookmark>(`/bookmarks/${id}/restore`, { method: 'PATCH' }),

  emptyTrash: () =>
    request<void>('/bookmarks/trash', { method: 'DELETE' }),

  exportHtml: async () => {
    const access = tokens.access;
    const headers: Record<string, string> = access ? { 'Authorization': `Bearer ${access}` } : {};
    const res = await fetch(`${BASE}/bookmarks/export/html`, { headers });
    if (!res.ok) throw new Error('Errore durante export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linko_bookmarks.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// ── Folders ────────────────────────────────────────────────────────────────────

export const folders = {
  list: () => request<Folder[]>('/folders'),

  create: (name: string, parentId?: string) =>
    request<Folder>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    }),

  update: (id: string, name: string) =>
    request<Folder>(`/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  delete: (id: string) =>
    request<void>(`/folders/${id}`, { method: 'DELETE' }),
};

// ── Tags ───────────────────────────────────────────────────────────────────────

export const tags = {
  list: () => request<Tag[]>('/tags'),
  delete: (id: string) => request<void>(`/tags/${id}`, { method: 'DELETE' }),
};

// ── Import ─────────────────────────────────────────────────────────────────────

export const importApi = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ImportResult>('/import', { method: 'POST', body: fd });
  },
};

// ── Aggiornamenti (monitoraggio fonti) ─────────────────────────────────────────

export const watchApi = {
  preview: (url: string, selector?: string) =>
    request<WatchPreview>('/watch/preview', {
      method: 'POST',
      body: JSON.stringify({ url, selector }),
    }),

  sources: () => request<WatchSource[]>('/watch/sources'),

  createSource: (dto: CreateWatchSourceDto) =>
    request<WatchSource>('/watch/sources', { method: 'POST', body: JSON.stringify(dto) }),

  updateSource: (id: string, dto: UpdateWatchSourceDto) =>
    request<WatchSource>(`/watch/sources/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  deleteSource: (id: string) => request<void>(`/watch/sources/${id}`, { method: 'DELETE' }),

  /** Salva l'ordine personalizzato delle fonti (tutti gli id, nell'ordine voluto). */
  reorderSources: (ids: string[]) =>
    request<WatchSource[]>('/watch/sources/order', { method: 'PUT', body: JSON.stringify({ ids }) }),

  /** Rinomina una categoria su tutte le sue fonti; con to = null la toglie. */
  renameCategory: (from: string, to: string | null) =>
    request<{ updated: number }>('/watch/categories/rename', { method: 'POST', body: JSON.stringify({ from, to }) }),

  checkNow: (id: string) => request<WatchSource>(`/watch/sources/${id}/check`, { method: 'POST' }),

  items: (filters: { page?: number; limit?: number; sourceId?: string; domain?: string; category?: string; unread?: boolean } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v));
    });
    const qs = params.toString();
    return request<WatchItemListResponse>(`/watch/items${qs ? `?${qs}` : ''}`);
  },

  updateItem: (id: string, dto: Partial<Pick<WatchItem, 'isRead' | 'isHidden'>>) =>
    request<WatchItem>(`/watch/items/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  readAll: (scope: { sourceId?: string; domain?: string; category?: string } = {}) =>
    request<{ updated: number }>('/watch/items/read-all', { method: 'POST', body: JSON.stringify(scope) }),

  saveItem: (id: string) => request<WatchItem>(`/watch/items/${id}/save`, { method: 'POST' }),

  /** Post o articolo da leggere nell'anteprima. */
  itemContent: (id: string) => request<WatchItemContent>(`/watch/items/${id}/content`),

  // Accessi ai siti con login (cookie di sessione)
  credentials: () => request<SiteCredential[]>('/watch/credentials'),
  saveCredential: (dto: SaveCredentialDto) =>
    request<{ credential: SiteCredential; verification: CredentialVerification }>('/watch/credentials', {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  verifyCredential: (id: string, testUrl?: string) =>
    request<CredentialVerification>(`/watch/credentials/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ testUrl }),
    }),
  deleteCredential: (id: string) => request<void>(`/watch/credentials/${id}`, { method: 'DELETE' }),
};
