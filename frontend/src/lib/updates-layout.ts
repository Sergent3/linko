'use client';

import { useCallback, useEffect, useState } from 'react';

/** Preferenze di layout della pagina Aggiornamenti, salvate nel browser. */
export type SourceSort = 'custom' | 'unread' | 'name' | 'recent';

export interface UpdatesLayout {
  /** Larghezza della colonna Fonti su desktop (px) */
  sidebarWidth: number;
  sidebarOpen: boolean;
  /** Altezza dell'elenco fonti (px); null = automatica */
  sidebarHeight: number | null;
  /** La colonna resta ferma mentre si scorre la pagina */
  sidebarSticky: boolean;
  /** Nomi delle fonti su più righe invece che troncati */
  wrapSourceNames: boolean;
  /** La pagina occupa tutta la larghezza dello schermo */
  fullWidth: boolean;
  /** Titoli su più righe invece che troncati */
  wrapTitles: boolean;
  compact: boolean;
  /** Accorpa gli aggiornamenti della stessa discussione o con lo stesso titolo */
  groupSimilar: boolean;
  /** Siti (con più fonti) chiusi nella colonna Fonti */
  collapsedSites: string[];
  /** Categorie chiuse ("-" = senza categoria) */
  collapsedCategories: string[];
  /** Ordine della colonna Fonti */
  sourceSort: SourceSort;
}

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 720;
export const LIST_MIN_HEIGHT = 120;
export const LIST_MAX_HEIGHT = 2000;
export const SIDEBAR_DEFAULT = 280;

const DEFAULTS: UpdatesLayout = {
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarOpen: true,
  sidebarHeight: null,
  sidebarSticky: false,
  wrapSourceNames: false,
  fullWidth: false,
  wrapTitles: false,
  compact: false,
  groupSimilar: true,
  collapsedSites: [],
  collapsedCategories: [],
  sourceSort: 'custom',
};

const STORAGE_KEY = 'linko_updates_layout';

export const clampWidth = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)));
export const clampHeight = (h: number) => Math.min(LIST_MAX_HEIGHT, Math.max(LIST_MIN_HEIGHT, Math.round(h)));

export function useUpdatesLayout(): [UpdatesLayout, (patch: Partial<UpdatesLayout>) => void] {
  const [layout, setLayout] = useState<UpdatesLayout>(DEFAULTS);

  // Letto dopo il montaggio: il server non conosce le preferenze del browser
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        const merged = { ...DEFAULTS, ...saved } as UpdatesLayout;
        setLayout({
          ...merged,
          sidebarWidth: clampWidth(Number(merged.sidebarWidth) || SIDEBAR_DEFAULT),
          collapsedSites: Array.isArray(merged.collapsedSites) ? merged.collapsedSites.filter((x) => typeof x === 'string') : [],
          collapsedCategories: Array.isArray(merged.collapsedCategories) ? merged.collapsedCategories.filter((x) => typeof x === 'string') : [],
          sourceSort: (['custom', 'unread', 'name', 'recent'] as const).includes(merged.sourceSort) ? merged.sourceSort : 'custom',
          sidebarHeight: merged.sidebarHeight == null ? null : clampHeight(Number(merged.sidebarHeight) || LIST_MIN_HEIGHT),
        });
      }
    } catch { /* storage non disponibile: valori predefiniti */ }
  }, []);

  const update = useCallback((patch: Partial<UpdatesLayout>) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage non disponibile */ }
      return next;
    });
  }, []);

  return [layout, update];
}
