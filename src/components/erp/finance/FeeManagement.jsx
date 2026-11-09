import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import FeeReceive from './FeeReceive';
import FeeOverview from './FeeOverview';
import FeeInvoices from './FeeInvoices';
import FeeGenerate from './FeeGenerate';
import FeeSetup from './FeeSetup';
import FeeConcessions from './FeeConcessions';
import FeeOutstanding from './FeeOutstanding';
import { useUrlState } from '../../../lib/useTabParam';

export default function FeeManagement({ embedded = false }) {
  const { t } = useLang();
  const { isFinanceStaff } = useAuth();
  // Deep link from a student record: ?module=fees&student=<profile id>
  const [params, setParams] = useSearchParams();
  const studentFilter = params.get('student');
  // In the URL (?fees=) so Back/Forward and links reach this tab.
  const [tab, setTab] = useUrlState('fees', studentFilter ? 'invoices' : isFinanceStaff ? 'receive' : 'overview');
  const clearStudent = () => {
    const next = new URLSearchParams(params);
    next.delete('student');
    setParams(next);
  };

  const tabs = [
    ...(isFinanceStaff ? [{ id: 'receive', label: t('Receive payment', 'استلام دفعة') }] : []),
    { id: 'overview', label: t('Overview', 'نظرة عامة') },
    { id: 'invoices', label: t('Invoices', 'الفواتير') },
    ...(isFinanceStaff ? [{ id: 'generate', label: t('Generate invoices', 'إنشاء الفواتير') }] : []),
    { id: 'setup', label: t('Fee setup', 'إعداد الرسوم') },
    { id: 'concessions', label: t('Concessions', 'الإعفاءات') },
    { id: 'outstanding', label: t('Outstanding', 'المستحقات') },
  ];

  return (
    <div className={embedded ? 'erp-embed' : undefined}>
      {!embedded && (
        <PageHeader
          title={t('Student Fees', 'رسوم الطلاب')}
          subtitle={t(
            'Invoices, receipts, concessions and collections — every change is posted to the ledger.',
            'الفواتير والإيصالات والإعفاءات والتحصيل — كل عملية تُرحَّل إلى دفتر الأستاذ.',
          )}
        />
      )}
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'receive' && <FeeReceive />}
      {tab === 'overview' && <FeeOverview />}
      {tab === 'invoices' && <FeeInvoices studentId={studentFilter} onClearStudent={clearStudent} />}
      {tab === 'generate' && <FeeGenerate />}
      {tab === 'setup' && <FeeSetup />}
      {tab === 'concessions' && <FeeConcessions />}
      {tab === 'outstanding' && <FeeOutstanding />}
    </div>
  );
}
