import type {
  AuthResponse,
  Bookmark,
  BookmarkFilters,
  BookmarkListResponse,
  CreateBookmarkDto,
  Folder,
  ImportResult,
  Tag,
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
let refreshQueue: Array<(token: string) => void> = [];

async function doRefresh(): Promise<string> {
  const raw = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refresh }),
  });
  if (!raw.ok) {
    tokens.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }
  const data: AuthResponse = await raw.json();
  tokens.set(data.accessToken, data.refreshToken);
  return data.accessToken;
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

  if (res.status === 401 && retry && tokens.refresh) {
    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve) => {
        refreshQueue.push(resolve);
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      return request<T>(path, { ...options, headers }, false);
    }

    isRefreshing = true;
    try {
      const newToken = await doRefresh();
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      headers['Authorization'] = `Bearer ${newToken}`;
      return request<T>(path, { ...options, headers }, false);
    } finally {
      isRefreshing = false;
    }
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
