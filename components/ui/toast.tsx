'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icon';

export type ToastKind = 'default' | 'success' | 'error' | 'info';

export type ToastOptions = {
  kind?: ToastKind;
  duration?: number;
};

export type ToastFn = (msg: string, opts?: ToastOptions) => void;

declare global {
  interface Window {
    toast?: ToastFn;
  }
}

type ToastEntry = {
  id: string;
  msg: string;
  kind: ToastKind;
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const fn: ToastFn = (msg, opts = {}) => {
      const id = Math.random().toString(36).slice(2);
      const kind: ToastKind = opts.kind ?? 'default';
      setToasts((t) => [...t, { id, msg, kind }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, opts.duration ?? 2400);
    };
    window.toast = fn;
    return () => {
      if (window.toast === fn) {
        window.toast = undefined;
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass anim-slide-up"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {t.kind === 'success' && <Icon name="check" size={14} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export function toast(msg: string, opts?: ToastOptions): void {
  if (typeof window === 'undefined') return;
  window.toast?.(msg, opts);
}
