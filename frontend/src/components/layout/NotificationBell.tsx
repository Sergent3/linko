'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, Download, HardDrive, TriangleAlert } from 'lucide-react';
import { appNotificationsApi, type AppNotification } from '@/lib/api';
import { disablePush, enablePush, pushState, refreshPush, type PushState } from '@/lib/push';
import { useUI } from '@/components/ui/UIProvider';

const KIND_ICON: Record<string, typeof Bell> = {
  download_done: Download,
  download_space: HardDrive,
  download_failed: TriangleAlert,
};

const timeFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function when(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 6 * 3600) return `${Math.floor(diff / 3600)} h fa`;
  return timeFmt.format(new Date(iso));
}

/** Campanella dell'intestazione: avvisi di Linko e attivazione delle notifiche sul dispositivo. */
export default function NotificationBell() {
  const router = useRouter();
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [push, setPush] = useState<PushState>('unsupported');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    appNotificationsApi.list().then((r) => { setItems(r.items); setUnread(r.unread); }).catch(() => {});
  }, []);

  // All'avvio, ogni minuto, tornando sulla pagina e quando arriva un push
  useEffect(() => {
    load();
    pushState().then(setPush).catch(() => {});
    refreshPush();
    const t = setInterval(load, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const onSw = (e: MessageEvent) => {
      if (e.data?.type === 'linko:notification') load();
      if (e.data?.type === 'linko:notification-open' && e.data.id) appNotificationsApi.markRead(e.data.id).then(load).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onSw);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onSw);
    };
  }, [load]);

  // Chiusura con click esterno o Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) appNotificationsApi.markRead(n.id).then(load).catch(() => {});
    if (!n.url) return;
    // /viewer non fa parte dell'app Next: navigazione completa
    if (n.url.startsWith('/viewer')) window.location.href = n.url;
    else router.push(n.url);
  }

  async function readAll() {
    await appNotificationsApi.markAllRead().catch(() => {});
    load();
  }

  async function togglePush() {
    setBusy(true);
    try {
      const next = push === 'on' ? await disablePush() : await enablePush();
      setPush(next);
      if (next === 'on') ui.toast('Notifiche attive su questo dispositivo');
      else if (next === 'denied') ui.toast('Notifiche bloccate: riattivale dalle impostazioni del browser per questo sito', { kind: 'error' });
    } catch {
      ui.toast('Attivazione non riuscita. Riprova tra qualche istante.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    try { await appNotificationsApi.testPush(); ui.toast('Notifica di prova inviata'); }
    catch { ui.toast('Invio non riuscito', { kind: 'error' }); }
  }

  const pushHint: Partial<Record<PushState, string>> = {
    unsupported: 'Le notifiche sul dispositivo funzionano solo aprendo Linko in HTTPS.',
    'ios-home': 'Su iPhone e iPad: tocca Condividi → "Aggiungi alla schermata Home", apri Linko da lì e attiva le notifiche.',
    denied: 'Notifiche bloccate per questo sito: riattivale dalle impostazioni del browser.',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="icon-btn relative"
        aria-label={unread ? `Avvisi: ${unread} non letti` : 'Avvisi'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="badge notif-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="menu notif-panel" role="dialog" aria-label="Avvisi">
          <div className="notif-head">
            <strong>Avvisi</strong>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={readAll}>
                <CheckCheck size={14} aria-hidden="true" /> Segna tutti come letti
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 && <p className="notif-empty">Nessun avviso. Qui arrivano, per esempio, i download del viewer finiti.</p>}
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <button key={n.id} type="button" className={`notif-item${n.readAt ? '' : ' unread'}`} onClick={() => openItem(n)}>
                  <Icon size={16} aria-hidden="true" className="notif-icon" />
                  <span className="notif-text">
                    <span className="notif-title">{n.title}</span>
                    {n.body && <span className="notif-body">{n.body}</span>}
                    <span className="notif-time">{when(n.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="notif-foot">
            {pushHint[push] ? (
              <p>{pushHint[push]}</p>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={togglePush}>
                  {push === 'on' ? <BellOff size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
                  {push === 'on' ? 'Disattiva su questo dispositivo' : 'Attiva notifiche su questo dispositivo'}
                </button>
                {push === 'on' && <button type="button" className="btn btn-ghost btn-sm" onClick={testPush}>Prova</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
