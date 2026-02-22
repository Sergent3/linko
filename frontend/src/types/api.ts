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
