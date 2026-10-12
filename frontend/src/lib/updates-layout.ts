'use client';

import { useCallback, useEffect, useState } from 'react';

/** Preferenze di layout della pagina Aggiornamenti, salvate nel browser. */
export interface UpdatesLayout {
  /** Larghezza della colonna Fonti su desktop (px) */
  sidebarWidth: number;
  sidebarOpen: boolean;
  /** La pagina occupa tutta la larghezza dello schermo */
  fullWidth: boolean;
  /** Titoli su più righe invece che troncati */
  wrapTitles: boolean;
  compact: boolean;
  /** Accorpa gli aggiornamenti della stessa discussione o con lo stesso titolo */
  groupSimilar: boolean;
}

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 560;
export const SIDEBAR_DEFAULT = 280;

const DEFAULTS: UpdatesLayout = {
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarOpen: true,
  fullWidth: false,
  wrapTitles: false,
  compact: false,
  groupSimilar: true,
};

const STORAGE_KEY = 'linko_updates_layout';

export const clampWidth = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)));

export function useUpdatesLayout(): [UpdatesLayout, (patch: Partial<UpdatesLayout>) => void] {
  const [layout, setLayout] = useState<UpdatesLayout>(DEFAULTS);

  // Letto dopo il montaggio: il server non conosce le preferenze del browser
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved === 'object') {
        const merged = { ...DEFAULTS, ...saved } as UpdatesLayout;
        setLayout({ ...merged, sidebarWidth: clampWidth(Number(merged.sidebarWidth) || SIDEBAR_DEFAULT) });
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
