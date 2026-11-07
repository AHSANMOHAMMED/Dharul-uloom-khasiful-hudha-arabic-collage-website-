import { useState } from 'react';
import { AsyncView, Button, Card, Field, Input, Modal, Select, StatusBadge, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, formatMoney, formatDate } from '../../../lib/erp/rpc';
import { accountLabel, listCashBankAccounts, num, profilesMap, runAction } from '../../../lib/erp/financeApi';
import { EmployeePicker, Num } from './shared';

function AdvanceForm({ onClose, onSaved }) {
  const { t, ar } = useLang();
  const [form, setForm] = useState({ profile_id: null, amount: '', monthly: '', reason: '', from: '1000' });
  const [busy, setBusy] = useState(false);
  const [accounts] = useAsync(() => listCashBankAccounts(), []);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const amount = num(form.amount);
  const monthly = num(form.monthly);
  const valid = form.profile_id && amount > 0 && monthly > 0 && monthly <= amount && form.reason.trim();
  const options = (accounts.data || []).length
    ? accounts.data.map((a) => ({ value: a.code, label: accountLabel(a, ar) }))
    : [
        { value: '1000', label: '1000 · Cash in Hand' },
        { value: '1010', label: '1010 · Bank - Current Account' },
      ];

  const save = async () => {
    if (!window.confirm(t(`Issue an advance of ${formatMoney(amount)}?`, `صرف سلفة بقيمة ${formatMoney(amount)}؟`))) return;
    setBusy(true);
    const ok = await runAction(
      () =>
        rpc('issue_staff_advance', {
          p_profile: form.profile_id,
          p_amount: Math.round(amount * 100) / 100,
          p_monthly_recovery: Math.round(monthly * 100) / 100,
          p_reason: form.reason.trim(),
          p_paid_from_code: form.from,
        }),
      t('Advance issued', 'تم صرف السلفة'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={t('Issue staff advance', 'صرف سلفة لموظف')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={save} disabled={!valid || busy}>
            {t('Issue', 'صرف')}
          </Button>
        </>
      }
    >
      <EmployeePicker value={form.profile_id} onChange={(v) => set({ profile_id: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Amount', 'المبلغ')}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field
          label={t('Monthly recovery', 'الاسترداد الشهري')}
          hint={amount > 0 && monthly > 0 ? `≈ ${Math.ceil(amount / monthly)} ${t('months', 'أشهر')}` : undefined}
        >
          <Input type="number" min="0" step="0.01" value={form.monthly} onChange={(e) => set({ monthly: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Paid from', 'الدفع من')}>
        <Select value={form.from} onChange={(e) => set({ from: e.target.value })} options={options} />
      </Field>
      <Field label={t('Reason', 'السبب')}>
        <Textarea rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function PayAdvances() {
  const { t } = useLang();
  const { isAccountant, isTreasurer } = useAuth();
  const [creating, setCreating] = useState(false);
  const [state, reload] = useAsync(async () => {
    const rows = await query('staff_advances', (q) => q.select('*').order('issued_on', { ascending: false }).limit(500));
    const people = await profilesMap(rows.flatMap((r) => [r.profile_id, r.approved_by]));
    return { rows, people };
  }, []);

  return (
    <Card
      title={t('Staff advances', 'سلف الموظفين')}
      actions={
        (isAccountant || isTreasurer) && (
          <Button size="sm" onClick={() => setCreating(true)}>
            + {t('Issue advance', 'صرف سلفة')}
          </Button>
        )
      }
    >
      <AsyncView state={state}>
        {({ rows, people }) => (
          <Table
            rows={rows}
            empty={t('No advances', 'لا توجد سلف')}
            columns={[
              {
                key: 'employee',
                label: t('Employee', 'الموظف'),
                render: (r) => (
                  <div>
                    <div>{people[r.profile_id]?.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">{r.reason}</div>
                  </div>
                ),
              },
              { key: 'issued_on', label: t('Issued', 'تاريخ الصرف'), render: (r) => formatDate(r.issued_on) },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => <Num>{formatMoney(r.amount)}</Num> },
              { key: 'monthly_recovery', label: t('Monthly', 'شهريًا'), render: (r) => <Num>{formatMoney(r.monthly_recovery)}</Num> },
              {
                key: 'progress',
                label: t('Recovered', 'المسترد'),
                render: (r) => {
                  const pct = Math.min(100, (num(r.recovered_amount) / Math.max(num(r.amount), 0.01)) * 100);
                  return (
                    <div className="min-w-[10rem]">
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-2 bg-emerald-600" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-400 mt-1 tabular-nums">
                        {formatMoney(r.recovered_amount)} / {formatMoney(r.amount)} · {t('left', 'متبقٍ')} {formatMoney(num(r.amount) - num(r.recovered_amount))}
                      </div>
                    </div>
                  );
                },
              },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        )}
      </AsyncView>
      {creating && (
        <AdvanceForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </Card>
  );
}
