import { Link } from 'react-router-dom';
import { Card, PageHeader, useLang } from '../ui';

/** ERP entry point for library circulation (full UI remains on /library-admin). */
export default function LibraryErpLink() {
  const { t } = useLang();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Library', 'المكتبة')}
        subtitle={t('Catalog, loans, and circulation for librarians.', 'الفهرس والإعارة والتداول لأمناء المكتبة.')}
      />
      <Card>
        <p className="text-sm text-ink-text-secondary mb-4">
          {t(
            'Open the library desk for catalog search, loan checkout/return, and overdue follow-up.',
            'افتح مكتب المكتبة للبحث في الفهرس، الإعارة والإرجاع، ومتابعة المتأخرات.',
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/library-admin"
            className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <span className="material-symbols-outlined text-[18px]">local_library</span>
            {t('Open library desk', 'فتح مكتب المكتبة')}
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 rounded-[10px] border border-sand-border bg-paper-white px-4 py-2 text-sm font-medium text-ink-text-primary hover:border-emerald-700/40 transition"
          >
            {t('Public catalog', 'الفهرس العام')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
