import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useAsync } from '../ui';
import { fetchEmployees, fetchStudents, errMsg } from '../../../lib/erp/campusApi';

export function useStudents(opts = {}) {
  const include = Boolean(opts.includeUnapproved);
  return useAsync(() => fetchStudents({ includeUnapproved: include }), [include]);
}

export function useEmployees(opts = {}) {
  const include = Boolean(opts.includeUnapproved);
  return useAsync(() => fetchEmployees({ includeUnapproved: include }), [include]);
}

/**
 * Wrap an async action with busy state + toast feedback.
 * run(fn, successMessage) → resolves to { ok, data }.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      const res = await fn();
      if (success) toast.success(typeof success === 'function' ? success(res) : success);
      return { ok: true, data: res };
    } catch (e) {
      toast.error(errMsg(e));
      return { ok: false, data: null };
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

/** Controlled form state helper. */
export function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set = useCallback((key) => (e) => {
    const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [key]: v }));
  }, []);
  return [form, set, setForm];
}
