'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import Modal from './Modal';

/* ─────────────────────────────────────────────────────────────────────────────
 * Sostituti di alert / confirm / prompt nativi:
 *   const ui = useUI();
 *   ui.toast('Salvato');
 *   ui.toast('Eliminato', { action: { label: 'Annulla', onClick: undo } });
 *   if (await ui.confirm({ title: 'Eliminare?', danger: true })) …
 *   const name = await ui.prompt({ title: 'Nuova cartella' });
 * ───────────────────────────────────────────────────────────────────────────── */

interface ToastOptions {
  kind?: 'info' | 'error';
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
}

interface UIContextValue {
  toast: (message: string, opts?: ToastOptions) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

interface ToastItem extends ToastOptions { id: number; message: string }

type Dialog =
  | { type: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { type: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message: string, opts: ToastOptions = {}) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, message, ...opts }]);
    setTimeout(() => dismiss(id), opts.durationMs ?? (opts.action ? 6000 : 3500));
  }, [dismiss]);

  const confirm = useCallback((opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setDialog({ type: 'confirm', opts, resolve })), []);

  const prompt = useCallback((opts: PromptOptions) =>
    new Promise<string | null>((resolve) => {
      setPromptValue(opts.initialValue ?? '');
      setDialog({ type: 'prompt', opts, resolve });
    }), []);

  function closeDialog(result: boolean | string | null) {
    if (!dialog) return;
    if (dialog.type === 'confirm') dialog.resolve(result === true);
    else dialog.resolve(typeof result === 'string' ? result : null);
    setDialog(null);
  }

  return (
    <UIContext.Provider value={{ toast, confirm, prompt }}>
      {children}

      {dialog?.type === 'confirm' && (
        <Modal
          title={dialog.opts.title}
          onClose={() => closeDialog(false)}
          width={400}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => closeDialog(false)}>
                {dialog.opts.cancelLabel ?? 'Annulla'}
              </button>
              <button
                type="button"
                data-autofocus
                className={`btn ${dialog.opts.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => closeDialog(true)}
              >
                {dialog.opts.confirmLabel ?? 'Conferma'}
              </button>
            </>
          }
        >
          {dialog.opts.message && <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{dialog.opts.message}</div>}
        </Modal>
      )}

      {dialog?.type === 'prompt' && (
        <Modal title={dialog.opts.title} onClose={() => closeDialog(null)} width={400}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = promptValue.trim();
              if (v) closeDialog(v);
            }}
          >
            <label className="field-label" htmlFor="ui-prompt-input">{dialog.opts.label ?? 'Nome'}</label>
            <input
              id="ui-prompt-input"
              name="value"
              className="input"
              data-autofocus
              autoComplete="off"
              value={promptValue}
              placeholder={dialog.opts.placeholder}
              onChange={(e) => setPromptValue(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => closeDialog(null)}>Annulla</button>
              <button type="submit" className="btn btn-primary" disabled={!promptValue.trim()}>
                {dialog.opts.confirmLabel ?? 'Salva'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div
        aria-live="polite"
        style={{
          position: 'fixed', bottom: 'max(16px, env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.kind === 'error' ? ' toast-error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.kind === 'error'
              ? <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-hidden="true" />
              : <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} aria-hidden="true" />}
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ color: 'var(--accent-text)' }}
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="icon-btn icon-btn-sm" aria-label="Chiudi notifica" onClick={() => dismiss(t.id)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI va usato dentro UIProvider');
  return ctx;
}
