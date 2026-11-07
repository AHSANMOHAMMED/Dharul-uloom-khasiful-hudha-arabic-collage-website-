import { normalizeArabic } from '../../lib/dictionaryApi';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { deleteRow, insertRow, insertRows, query, updateRow } from '../../lib/erp/rpc';
import { parseDictionaryCsv } from '../../lib/dictionaryCsv';
import { posLabel } from '../../lib/dictionaryApi';
import { tx } from '../../lib/tx';

const PAGE_SIZE = 50;
const CHUNK = 500;
const POS = ['noun', 'verb', 'particle', 'adjective', 'phrase', 'name', 'other'];
const COLS = 'id, arabic, root, part_of_speech, tamil, english, example_ar, example_ta, source, source_ref, verified, updated_at';
const EMPTY = { arabic: '', root: '', part_of_speech: '', tamil: '', english: '', example_ar: '', example_ta: '', verified: true };

const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';

function sanitizeSearch(q) {
  return String(q || '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 60);
}

function applyFilter(b, filter, search) {
  let q = b;
  if (filter === 'ai') q = q.eq('source', 'ai').eq('verified', false);
  else if (filter === 'unverified') q = q.eq('verified', false);
  else if (filter === 'verified') q = q.eq('verified', true);
  const s = sanitizeSearch(search);
  if (s) {
    // strip PostgREST filter syntax characters; match Arabic on the normalised headword
    const safe = s.replace(/[,()*%\\"']/g, ' ').trim();
    const norm = normalizeArabic(safe);
    if (norm) q = q.or(`arabic_normalized.ilike.*${norm}*,root.ilike.*${norm}*`);
    else if (safe) q = q.or(`tamil.ilike.*${safe}*,english.ilike.*${safe}*`);
  }
  return q;
}

async function countWhere(build) {
  const res = await query('dictionary_entries', (q) => build(q.select('id', { count: 'exact', head: true })).then((r) => ({ ...r, data: r.count ?? 0 })));
  return Number(res || 0);
}

function EntryForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const editing = Boolean(initial?.id);

  const save = async (e) => {
    e.preventDefault();
    if (!form.arabic.trim() || !form.tamil.trim()) {
      toast.error(tx('الكلمة العربية والمعنى التاميلي مطلوبان.', 'Arabic headword and Tamil meaning are required.'));
      return;
    }
    const row = {
      arabic: form.arabic.trim(),
      root: form.root.trim() || null,
      part_of_speech: POS.includes(form.part_of_speech) ? form.part_of_speech : null,
      tamil: form.tamil.trim(),
      english: form.english.trim() || null,
      example_ar: form.example_ar.trim() || null,
      example_ta: form.example_ta.trim() || null,
      verified: Boolean(form.verified),
    };
    // New entries are curated; edited AI suggestions keep their 'ai' origin (verified flag marks review).
    if (!editing) row.source = 'curated';
    setBusy(true);
    try {
      if (editing) await updateRow('dictionary_entries', initial.id, row);
      else await insertRow('dictionary_entries', row, 'id');
      toast.success(tx('تم حفظ المدخل.', 'Entry saved.'));
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <h4 className="font-bold text-emerald-900">{editing ? tx('تعديل المدخل', 'Edit entry') : tx('إضافة مدخل', 'Add entry')}</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          {tx('الكلمة العربية', 'Arabic word')} *
          <input dir="rtl" lang="ar" className={`${inputCls} font-arabic text-lg`} value={form.arabic} onChange={(e) => set({ arabic: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {tx('الجذر', 'Root')}
          <input dir="rtl" lang="ar" className={`${inputCls} font-arabic text-lg`} value={form.root || ''} onChange={(e) => set({ root: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {tx('المعنى بالتاميلية', 'Tamil meaning')} *
          <input lang="ta" className={inputCls} value={form.tamil} onChange={(e) => set({ tamil: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {tx('المعنى بالإنجليزية', 'English meaning')}
          <input dir="ltr" className={inputCls} value={form.english || ''} onChange={(e) => set({ english: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {tx('نوع الكلمة', 'Part of speech')}
          <select className={inputCls} value={form.part_of_speech || ''} onChange={(e) => set({ part_of_speech: e.target.value })}>
            <option value="">—</option>
            {POS.map((p) => (
              <option key={p} value={p}>
                {posLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={Boolean(form.verified)} onChange={(e) => set({ verified: e.target.checked })} />
          {tx('موثّق', 'Verified')}
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {tx('مثال بالعربية', 'Arabic example')}
          <input dir="rtl" lang="ar" className={`${inputCls} font-arabic`} value={form.example_ar || ''} onChange={(e) => set({ example_ar: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          {tx('ترجمة المثال بالتاميلية', 'Tamil example')}
          <input lang="ta" className={inputCls} value={form.example_ta || ''} onChange={(e) => set({ example_ta: e.target.value })} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          {tx('إلغاء', 'Cancel')}
        </button>
        <button type="submit" disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ', 'Save')}
        </button>
      </div>
    </form>
  );
}

function CsvImport({ onDone }) {
  const [progress, setProgress] = useState(null); // { done, total, inserted, skipped }
  const [busy, setBusy] = useState(false);

  const importFile = async (file) => {
    if (!file) return;
    let rows;
    try {
      rows = parseDictionaryCsv(await file.text());
    } catch (error) {
      toast.error(error.message);
      return;
    }
    if (!rows.length) {
      toast.error(tx('لا توجد صفوف صالحة في الملف.', 'No valid rows in the file.'));
      return;
    }
    const sourceRef = file.name.slice(0, 120);
    const payload = rows.map((r) => ({ ...r, source: 'import', source_ref: sourceRef, verified: false }));
    setBusy(true);
    let inserted = 0;
    let skipped = 0;
    setProgress({ done: 0, total: payload.length, inserted, skipped });
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        try {
          const res = await insertRows('dictionary_entries', chunk);
          inserted += res?.length || 0;
        } catch (error) {
          if (error?.cause?.code !== '23505') throw error;
          // some words already exist: insert the rest, skip duplicates
          const res = await query('dictionary_entries', (q) =>
            q.upsert(chunk, { onConflict: 'arabic_normalized,tamil', ignoreDuplicates: true }).select('id'),
          );
          inserted += res?.length || 0;
        }
        skipped = Math.min(i + chunk.length, payload.length) - inserted;
        setProgress({ done: Math.min(i + chunk.length, payload.length), total: payload.length, inserted, skipped });
      }
      toast.success(`${tx('تم الاستيراد', 'Import finished')}: ${inserted} / ${payload.length}`);
      onDone();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="font-bold text-slate-900">{tx('استيراد CSV', 'CSV import')}</h4>
      <p className="text-xs text-slate-600">
        {tx('الأعمدة', 'Columns')}: <code dir="ltr">arabic,tamil,english,root,part_of_speech</code>
      </p>
      <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
        {tx(
          'استورد فقط معاجم مرخّصة أو من إعدادك. لا يجوز نسخ معاجم محمية (مثل المنجد) دون إذن الناشر.',
          'Only import lexicons you are licensed to use or that you compiled yourself. Do not copy copyrighted dictionaries (e.g. al-Munjid) without the publisher’s permission.',
        )}
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={busy}
        onChange={(e) => {
          importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
        className="block text-sm"
      />
      {progress && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-600">
            {progress.done} / {progress.total} · {tx('أضيف', 'Added')} {progress.inserted} · {tx('مكرر', 'Duplicates skipped')} {progress.skipped}
          </p>
        </div>
      )}
      <p className="text-xs text-slate-500">
        {tx('للملفات الكبيرة استخدم سكربت الخادم', 'For very large files use the server script')}:{' '}
        <code dir="ltr">node scripts/library/importDictionary.mjs file.csv</code>
      </p>
    </div>
  );
}

/** Librarian screen for the Arabic → Tamil dictionary (dictionary_entries). */
export default function DictionaryAdmin() {
  useTranslation();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [state, setState] = useState({ loading: true, rows: [], total: 0, error: null });
  const [counts, setCounts] = useState(null);
  const [editing, setEditing] = useState(null); // entry or {} for new

  const loadCounts = useCallback(async () => {
    try {
      const [total, verified, ai] = await Promise.all([
        countWhere((q) => q),
        countWhere((q) => q.eq('verified', true)),
        countWhere((q) => q.eq('source', 'ai').eq('verified', false)),
      ]);
      setCounts({ total, verified, ai });
    } catch {
      setCounts(null);
    }
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await query('dictionary_entries', (q) =>
        applyFilter(q.select(COLS, { count: 'exact' }), filter, applied)
          .order('updated_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
          .then((r) => ({ ...r, data: { rows: r.data || [], total: r.count ?? 0 } })),
      );
      setState({ loading: false, rows: res.rows, total: res.total, error: null });
    } catch (error) {
      setState({ loading: false, rows: [], total: 0, error });
    }
  }, [filter, applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const refresh = () => {
    setEditing(null);
    load();
    loadCounts();
  };

  const verify = async (row) => {
    try {
      await updateRow('dictionary_entries', row.id, { verified: true });
      toast.success(tx('تم التوثيق.', 'Entry verified.'));
      refresh();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`${tx('حذف المدخل؟', 'Delete this entry?')} ${row.arabic}`)) return;
    try {
      await deleteRow('dictionary_entries', row.id);
      toast.info(tx('تم حذف المدخل.', 'Entry deleted.'));
      refresh();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const filters = [
    ['all', tx('الكل', 'All')],
    ['ai', tx('اقتراحات آلية غير موثقة', 'Unverified AI suggestions')],
    ['unverified', tx('غير موثق', 'Unverified')],
    ['verified', tx('موثّق', 'Verified')],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5">
          <div className="text-sm text-gray-500">{tx('إجمالي المدخلات', 'Total entries')}</div>
          <div className="mt-2 text-3xl font-bold text-emerald-800">{counts ? counts.total : '—'}</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5">
          <div className="text-sm text-gray-500">{tx('موثّق', 'Verified')}</div>
          <div className="mt-2 text-3xl font-bold text-emerald-800">{counts ? counts.verified : '—'}</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5">
          <div className="text-sm text-gray-500">{tx('اقتراحات آلية بانتظار المراجعة', 'AI suggestions awaiting review')}</div>
          <div className="mt-2 text-3xl font-bold text-amber-700">{counts ? counts.ai : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setApplied(search);
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx('ابحث بالعربية أو التاميلية أو الإنجليزية', 'Search Arabic, Tamil or English')}
              className={`${inputCls} min-w-0 flex-1`}
            />
            <button type="submit" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
              {tx('بحث', 'Search')}
            </button>
            <button type="button" onClick={() => setEditing({})} className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">
              + {tx('إضافة مدخل', 'Add entry')}
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {filters.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFilter(id);
                  setPage(0);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === id ? 'bg-emerald-700 text-white' : 'border border-emerald-200 bg-white text-emerald-800'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {editing && <EntryForm initial={editing.id ? editing : null} onCancel={() => setEditing(null)} onSaved={refresh} />}

          {state.loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-emerald-600" />
            </div>
          ) : state.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error.message}</div>
          ) : state.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{tx('لا توجد مدخلات.', 'No entries found.')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-start">{tx('الكلمة', 'Word')}</th>
                    <th className="px-3 py-2 text-start">{tx('المعنى بالتاميلية', 'Tamil meaning')}</th>
                    <th className="px-3 py-2 text-start">{tx('المصدر', 'Source')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2">
                        <div dir="rtl" lang="ar" className="font-arabic text-xl text-slate-900">
                          {r.arabic}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.root ? (
                            <span dir="rtl" lang="ar" className="font-arabic">
                              {r.root}
                            </span>
                          ) : null}
                          {r.part_of_speech ? ` · ${posLabel(r.part_of_speech)}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div lang="ta" className="font-semibold text-emerald-800">
                          {r.tamil}
                        </div>
                        {r.english && <div className="text-xs text-slate-500">{r.english}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${r.source === 'ai' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {r.source}
                        </span>
                        <div className={`mt-1 font-semibold ${r.verified ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {r.verified ? tx('موثّق', 'Verified') : tx('غير موثق', 'Unverified')}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!r.verified && (
                            <button type="button" onClick={() => verify(r)} className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                              {tx('توثيق', 'Verify')}
                            </button>
                          )}
                          <button type="button" onClick={() => setEditing(r)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700">
                            {tx('تعديل', 'Edit')}
                          </button>
                          <button type="button" onClick={() => remove(r)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700">
                            {tx('حذف', 'Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-600" dir="ltr">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
              ‹ {tx('السابق', 'Previous')}
            </button>
            <span>
              {page + 1} / {pages} · {state.total}
            </span>
            <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
              {tx('التالي', 'Next')} ›
            </button>
          </div>
        </div>

        <CsvImport onDone={refresh} />
      </div>
    </div>
  );
}
