/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { tx } from './tx';

let listener = null;

function openDialog(payload) {
  if (!listener) {
    // Graceful fallback in isolated unit tests without <AppDialogHost />
    if (payload.mode === 'prompt') {
      try {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          return Promise.resolve(window.prompt(payload.message, payload.defaultValue ?? ''));
        }
      } catch {
        // jsdom unmocked window.prompt throws Not implemented
      }
      return Promise.resolve(payload.defaultValue ?? '');
    }
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    listener({ ...payload, resolve });
  });
}

/**
 * In-app confirmation modal replacing native window.confirm().
 * Accepts either a message string or an options object.
 */
export function appConfirm(opts) {
  const o = typeof opts === 'string' ? { message: opts } : opts || {};
  return openDialog({
    mode: 'confirm',
    title: o.title || tx('تأكيد الإجراء', 'Confirm Action'),
    message: o.message || '',
    confirmLabel: o.confirmLabel || tx('تأكيد', 'Confirm'),
    cancelLabel: o.cancelLabel || tx('إلغاء', 'Cancel'),
    danger: Boolean(o.danger),
  });
}

/**
 * In-app input modal replacing native window.prompt().
 * Resolves to the entered string, or null if cancelled.
 */
export function appPrompt(opts, defaultValue = '') {
  const o = typeof opts === 'string' ? { message: opts, defaultValue } : opts || {};
  return openDialog({
    mode: 'prompt',
    title: o.title || tx('إدخال البيانات', 'Input Required'),
    message: o.message || '',
    defaultValue: o.defaultValue ?? '',
    placeholder: o.placeholder || '',
    confirmLabel: o.confirmLabel || tx('حفظ', 'Submit'),
    cancelLabel: o.cancelLabel || tx('إلغاء', 'Cancel'),
    required: Boolean(o.required),
  });
}

export function AppDialogHost() {
  const [dlg, setDlg] = useState(null);
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    listener = (next) => {
      setInputVal(next.defaultValue ?? '');
      setDlg(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!dlg) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        dlg.resolve(dlg.mode === 'prompt' ? null : false);
        setDlg(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dlg]);

  if (!dlg) return null;

  const close = (result) => {
    const r = dlg.resolve;
    setDlg(null);
    r(result);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => close(dlg.mode === 'prompt' ? null : false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        dir={tx('rtl', 'ltr')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-serif text-base font-bold text-[#0B3B2E]">{dlg.title}</h3>
          <button
            type="button"
            onClick={() => close(dlg.mode === 'prompt' ? null : false)}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none px-1"
            aria-label={tx('إغلاق', 'Close')}
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-3">
          {dlg.message && <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{dlg.message}</p>}
          {dlg.mode === 'prompt' && (
            <input
              autoFocus
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={dlg.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (!dlg.required || inputVal.trim())) {
                  close(inputVal);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#11694A] focus:bg-white"
            />
          )}
        </div>
        <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => close(dlg.mode === 'prompt' ? null : false)}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {dlg.cancelLabel}
          </button>
          <button
            type="button"
            disabled={dlg.mode === 'prompt' && dlg.required && !inputVal.trim()}
            onClick={() => close(dlg.mode === 'prompt' ? inputVal : true)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs disabled:opacity-50 ${
              dlg.danger ? 'bg-[#B3261E] hover:bg-red-700' : 'bg-[#11694A] hover:bg-[#0B3B2E]'
            }`}
          >
            {dlg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
