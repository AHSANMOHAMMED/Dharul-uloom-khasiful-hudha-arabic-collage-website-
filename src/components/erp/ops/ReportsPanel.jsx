import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { Button, ErrorNote, Field, Input, Loading, PageHeader, Select, Table, useLang } from '../ui';
import { ClassSelect } from '../campus/common';
import { REPORTS, pivotResults, totalsFor } from '../../../lib/erp/reportsApi';
import { query } from '../../../lib/erp/rpc';
import { exportCsv, exportXlsx } from '../../../lib/spreadsheet';
import { formatCell, printTable } from '../../../lib/printReport';

const PREVIEW_ROWS = 200;

/** Reports centre: pick a report, set filters, preview, export to Excel / PDF / CSV. */
export default function ReportsPanel() {
  const auth = useAuth();
  const { t, ar, lang } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const available = useMemo(() => REPORTS.filter((r) => r.show(auth)), [auth]);
  const [activeId, setActiveId] = useState(available[0]?.id);
  const report = available.find((r) => r.id === activeId) || available[0];

  const [params, setParams] = useState({});
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [exams, setExams] = useState([]);

  // Reset filters to the report's defaults when switching report.
  useEffect(() => {
    if (!report) return;
    setParams(Object.fromEntries(report.filters.map((f) => [f.key, f.default ? f.default() : ''])));
    setRows(null);
    setError(null);
  }, [report]);

  useEffect(() => {
    if (!report?.filters.some((f) => f.type === 'exam')) return;
    query('exams', (q) => q.select('id, name, class_number, status').order('created_at', { ascending: false }).limit(200))
      .then(setExams)
      .catch(() => setExams([]));
  }, [report]);

  if (!report) {
    return <p className="text-sm text-ink-text-secondary">{t('No reports are available for your role.', 'لا توجد تقارير متاحة لدورك.')}</p>;
  }

  const columns = report.columns.map((c) => ({ ...c, label: tt(c.label) }));
  const missing = (report.required || []).filter((k) => !params[k]);

  const run = async () => {
    if (missing.length) {
      setError(new Error(t('Fill in the required filters first.', 'أكمل عوامل التصفية المطلوبة أولاً.')));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setRows(await report.load(params));
    } catch (e) {
      setError(e);
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  // Human-readable filter summary for the export headers.
  const filterSummary = report.filters
    .filter((f) => params[f.key])
    .map((f) => {
      let v = params[f.key];
      if (f.type === 'select') v = tt(f.options.find(([k]) => k === v)?.[1] || [v, v]);
      if (f.type === 'exam') v = exams.find((e) => e.id === v)?.name || v;
      if (f.type === 'class') v = `${t('Class', 'الصف')} ${v}`;
      return [tt(f.label), String(v)];
    });
  const title = tt(report.title);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileBase = `${report.id}-report-${stamp}`;
  const totals = rows ? totalsFor(rows, report.totals) : null;

  const toExcel = async () => {
    try {
      const sheets = [{ name: title, title, subtitle: filterSummary.map(([k, v]) => `${k}: ${v}`).join(' · '), columns, rows }];
      if (report.id === 'results' && rows.length) {
        const { subjects, students } = pivotResults(rows);
        sheets.unshift({
          name: t('Mark sheet', 'كشف الدرجات'),
          title: `${title} — ${t('Mark sheet', 'كشف الدرجات')}`,
          subtitle: filterSummary.map(([k, v]) => `${k}: ${v}`).join(' · '),
          columns: [
            { key: 'rank', label: t('Rank', 'الترتيب'), type: 'number', width: 7 },
            { key: 'index_number', label: t('Index no.', 'رقم القيد'), width: 12 },
            { key: 'full_name', label: t('Name', 'الاسم'), width: 28 },
            ...subjects.map((s) => ({ key: `sub_${s.code}`, label: s.name, type: 'number', width: 10 })),
            { key: 'total', label: t('Total', 'المجموع'), type: 'number', width: 9 },
            { key: 'average_pct', label: t('Average %', 'المعدل %'), type: 'percent', width: 10 },
          ],
          rows: students.sort((a, b) => a.rank - b.rank),
        });
      }
      if (totals) sheets[sheets.length - 1].rows = [...rows, { ...totals, full_name: t('Total', 'المجموع') }];
      await exportXlsx({ filename: fileBase, sheets, rtl: ar });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toPdf = () => {
    try {
      const printCols = report.printColumns ? columns.filter((c) => report.printColumns.includes(c.key)) : columns;
      printTable({
        title,
        columns: printCols,
        rows,
        filters: filterSummary,
        totals,
        dir: document.documentElement.dir || 'ltr',
        lang,
        generatedBy: `${t('Prepared by', 'أعدّه')}: ${auth.user?.username || auth.user?.email || ''}`,
        signatures: report.id === 'fees' ? [t('Treasurer', 'أمين الصندوق'), t('Principal', 'المدير')] : [],
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('Reports', 'التقارير')}
        subtitle={t('Run a report, check the preview, then download it as Excel or save it as PDF.', 'شغّل التقرير وراجع المعاينة ثم نزّله بصيغة Excel أو احفظه PDF.')}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {available.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveId(r.id)}
            aria-pressed={r.id === report.id}
            className={`text-start rounded-[14px] border p-4 transition ${
              r.id === report.id
                ? 'border-emerald-700 bg-mint-wash-100 shadow-manuscript-sm'
                : 'border-sand-border bg-paper-white hover:border-emerald-700/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-[20px]" aria-hidden>{r.icon}</span>
              <span className="font-semibold text-ink-green-900 text-sm">{tt(r.title)}</span>
            </div>
            <p className="text-xs text-ink-text-secondary mt-1.5 leading-relaxed">{tt(r.description)}</p>
          </button>
        ))}
      </div>

      <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          {report.filters.map((f) => {
            const label = `${tt(f.label)}${(report.required || []).includes(f.key) ? ' *' : ''}`;
            const set = (v) => setParams((p) => ({ ...p, [f.key]: v }));
            return (
              <Field key={f.key} label={label}>
                {f.type === 'class' && <ClassSelect value={params[f.key]} onChange={set} allLabel={t('All classes', 'كل الصفوف')} />}
                {f.type === 'month' && <Input type="month" value={params[f.key] || ''} onChange={(e) => set(e.target.value)} />}
                {f.type === 'date' && <Input type="date" value={params[f.key] || ''} onChange={(e) => set(e.target.value)} />}
                {f.type === 'select' && (
                  <Select
                    value={params[f.key] || ''}
                    onChange={(e) => set(e.target.value)}
                    placeholder={t('All', 'الكل')}
                    options={f.options.map(([v, l]) => ({ value: v, label: tt(l) }))}
                  />
                )}
                {f.type === 'exam' && (
                  <Select
                    value={params[f.key] || ''}
                    onChange={(e) => set(e.target.value)}
                    placeholder={t('Choose an exam', 'اختر امتحاناً')}
                    options={exams.map((e) => ({
                      value: e.id,
                      label: `${e.name}${e.class_number ? ` · ${t('Class', 'الصف')} ${e.class_number}` : ''} (${e.status})`,
                    }))}
                  />
                )}
              </Field>
            );
          })}
          <Button type="submit" disabled={busy || missing.length > 0}>
            {busy ? t('Running…', 'جارٍ التشغيل…') : t('Run report', 'تشغيل التقرير')}
          </Button>
        </form>

        <ErrorNote error={error} />
        {busy && <Loading />}

        {rows && !busy && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-border pt-4">
              <div className="text-sm text-ink-text-secondary">
                <b className="text-ink-green-900">{rows.length.toLocaleString()}</b> {t('records', 'سجل')}
                {totals &&
                  report.totals.map((k) => (
                    <span key={k} className="ms-3">
                      {columns.find((c) => c.key === k)?.label}: <b className="text-ink-green-900">{formatCell(totals[k], 'money')}</b>
                    </span>
                  ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={toExcel} disabled={!rows.length}>
                  <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'table_view'}</span>
                  {t('Excel', 'Excel')}
                </Button>
                <Button variant="secondary" onClick={toPdf} disabled={!rows.length}>
                  <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'picture_as_pdf'}</span>
                  {t('PDF / Print', 'PDF / طباعة')}
                </Button>
                <Button variant="ghost" onClick={() => exportCsv({ filename: fileBase, columns, rows })} disabled={!rows.length}>
                  {t('CSV', 'CSV')}
                </Button>
              </div>
            </div>
            <Table
              columns={columns.map((c) => ({
                ...c,
                // Codes, dates and numbers must not break mid-value (KH-2026-001).
                className: c.type || ['index_number', 'phone', 'guardian_phone', 'employee_no', 'subject_code'].includes(c.key) ? 'whitespace-nowrap' : '',
                render: (r) => formatCell(r[c.key], c.type),
              }))}
              rows={rows.slice(0, PREVIEW_ROWS)}
              rowKey="__none__"
              empty={t('No records match these filters.', 'لا توجد سجلات مطابقة لعوامل التصفية.')}
            />
            {rows.length > PREVIEW_ROWS && (
              <p className="text-xs text-ink-text-muted">
                {t('Showing the first 200 rows. Exports include every row.', 'تُعرض أول 200 صف فقط. ملفات التصدير تشمل كل الصفوف.')}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
