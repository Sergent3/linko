'use client';

import { useEffect, useState } from 'react';

/**
 * Il viewer remoto (/viewer, servito da Caddy) esiste solo sulla versione HTTPS:
 * sulla versione HTTP i suoi pulsanti non compaiono.
 * Lo stato parte da false e si aggiorna dopo il montaggio, per non creare
 * differenze tra rendering lato server e lato browser.
 */
export function useViewerAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => { setAvailable(window.location.protocol === 'https:'); }, []);
  return available;
}

/** Pagina seguita in Aggiornamenti aperta nel viewer remoto. */
export function viewerSourceHref(sourceId: string): string {
  return `/viewer/view?source=${encodeURIComponent(sourceId)}`;
}
