import { useState } from 'react';
import { PageHeader, Tabs, useLang } from '../ui';
import AcctAccounts from './AcctAccounts';
import AcctJournals from './AcctJournals';
import AcctLedger from './AcctLedger';
import AcctReports from './AcctReports';
import AcctPeriodLock from './AcctPeriodLock';

export default function AccountingPanel() {
  const { t } = useLang();
  const [tab, setTab] = useState('accounts');
  const tabs = [
    { id: 'accounts', label: t('Chart of accounts', 'دليل الحسابات') },
    { id: 'journals', label: t('Journals', 'القيود') },
    { id: 'ledger', label: t('Ledger', 'دفتر الأستاذ') },
    { id: 'reports', label: t('Reports', 'التقارير') },
    { id: 'lock', label: t('Period lock', 'إقفال الفترة') },
  ];
  return (
    <div>
      <PageHeader
        title={t('Accounting', 'المحاسبة')}
        subtitle={t('Double-entry general ledger, financial statements and period close.', 'دفتر الأستاذ العام بالقيد المزدوج والقوائم المالية وإقفال الفترات.')}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'accounts' && <AcctAccounts />}
      {tab === 'journals' && <AcctJournals />}
      {tab === 'ledger' && <AcctLedger />}
      {tab === 'reports' && <AcctReports />}
      {tab === 'lock' && <AcctPeriodLock />}
    </div>
  );
}
