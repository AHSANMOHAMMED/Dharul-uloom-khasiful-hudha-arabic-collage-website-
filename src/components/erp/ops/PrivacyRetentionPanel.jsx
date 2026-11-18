import { useState } from 'react';
import { AsyncView, Button, Card, Field, Input, PageHeader, Textarea, useAsync, useLang } from '../ui';
import { query, rpc } from '../../../lib/erp/rpc';
import { useAction } from '../campus/hooks';

const FIELDS = [
  ['identity_days', 'Identity', 'الهوية'],
  ['guardian_days', 'Guardian', 'ولي الأمر'],
  ['academic_days', 'Academic', 'أكاديمي'],
  ['financial_days', 'Financial', 'مالي'],
  ['welfare_days', 'Welfare', 'الرعاية'],
  ['hostel_days', 'Hostel', 'السكن'],
  ['comms_days', 'Comms', 'التواصل'],
  ['auth_days', 'Auth / devices', 'المصادقة'],
];

export default function PrivacyRetentionPanel() {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [state, reload] = useAsync(
    () => query('org_privacy_retention', (q) => q.select('*').maybeSingle()),
    [],
  );
  const [form, setForm] = useState(null);
  const data = form || state.data || {};

  const set = (k) => (e) => setForm({ ...data, [k]: e.target.value });

  const save = async () => {
    const payload = {};
    FIELDS.forEach(([k]) => { payload[k] = data[k] === '' || data[k] == null ? '' : String(data[k]); });
    payload.notes = data.notes || '';
    payload.policy_signed_off = Boolean(data.policy_signed_off);
    const res = await run(() => rpc('upsert_privacy_retention', { p_settings: payload }), t('Saved', 'تم الحفظ'));
    if (res.ok) { setForm(null); reload(); }
  };

  return (
    <div>
      <PageHeader
        title={t('Privacy retention', 'فترات الاحتفاظ بالخصوصية')}
        subtitle={t('Editable day counts only — Needs institutional policy before production PDPA claims.',
          'أرقام قابلة للتعديل فقط — يلزم اعتماد سياسة المؤسسة قبل ادعاءات PDPA.')}
      />
      <Card>
        <AsyncView state={state}>
          {() => (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map(([k, en, ar]) => (
                  <Field key={k} label={t(`${en} (days)`, `${ar} (أيام)`)}>
                    <Input type="number" min="0" value={data[k] ?? ''} onChange={set(k)} placeholder={t('Unset', 'غير محدد')} />
                  </Field>
                ))}
              </div>
              <Field label={t('Notes', 'ملاحظات')}>
                <Textarea value={data.notes || ''} onChange={set('notes')} rows={3} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(data.policy_signed_off)}
                  onChange={(e) => setForm({ ...data, policy_signed_off: e.target.checked })}
                />
                {t('Counsel / principal signed off (institutional)', 'تم اعتماد المستشار / المدير (مؤسسي)')}
              </label>
              <Button disabled={busy} onClick={save}>{t('Save retention settings', 'حفظ إعدادات الاحتفاظ')}</Button>
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
