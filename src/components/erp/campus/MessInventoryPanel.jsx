import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, query, rpc, today } from '../../../lib/erp/rpc';
import { appConfirm } from '../../../lib/appDialog';
import { useStaff } from '../governance/common';

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'pkt', 'box', 'bag', 'bottle', 'dozen'];
const CATEGORIES = [
  { value: 'grains', en: 'Grains & Rice', ar: 'الحبوب والأرز' },
  { value: 'spices', en: 'Spices & Condiments', ar: 'التوابل والبهارات' },
  { value: 'vegetables', en: 'Vegetables & Fruits', ar: 'الخضروات والفواكه' },
  { value: 'meat_dairy', en: 'Meat, Fish & Dairy', ar: 'اللحوم والألبان' },
  { value: 'oil_ghee', en: 'Oil & Ghee', ar: 'الزيوت والسمن' },
  { value: 'beverages', en: 'Tea, Coffee & Beverages', ar: 'المشروبات' },
  { value: 'fuel_gas', en: 'Cooking Gas & Fuel', ar: 'الغاز والوقود' },
  { value: 'cleaning', en: 'Cleaning & Hygiene', ar: 'التنظيف والنظافة' },
  { value: 'equipment', en: 'Kitchen Utensils', ar: 'أدوات المطبخ' },
  { value: 'other', en: 'Other', ar: 'أخرى' },
];
const MEAL_TYPES = [
  { value: 'breakfast', en: 'Breakfast', ar: 'الإفطار', tone: 'amber' },
  { value: 'lunch', en: 'Lunch', ar: 'الغداء', tone: 'green' },
  { value: 'dinner', en: 'Dinner', ar: 'العشاء', tone: 'blue' },
];
const MEAL_STATUS = {
  planned: { en: 'Planned', ar: 'مخطط', tone: 'gray' },
  prepared: { en: 'Prepared', ar: 'جاهز', tone: 'amber' },
  served: { en: 'Served', ar: 'تم التقديم', tone: 'green' },
};

const compatibleUnits = (baseUnit) => {
  if (baseUnit === 'kg' || baseUnit === 'g') return ['kg', 'g'];
  if (baseUnit === 'L' || baseUnit === 'ml') return ['L', 'ml'];
  return [baseUnit || 'pcs'];
};

export default function MessInventoryPanel() {
  const { t } = useLang();
  const [tab, setTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [mealDate, setMealDate] = useState(today());
  const [itemModal, setItemModal] = useState(null);
  const [mealModal, setMealModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const staff = useStaff();

  const loadAll = useCallback(async () => {
    const [summary, items, movements, meals] = await Promise.all([
      rpc('mess_inventory_summary').catch(() => null),
      query('inventory_items', (q) => q.select('*').eq('is_active', true).order('name')),
      query('inventory_movements', (q) => q.select('*, item:item_id(name, unit)').order('created_at', { ascending: false }).limit(150)),
      query('daily_meals', (q) => q.select('*').order('meal_date', { ascending: false }).limit(90)),
    ]);
    return { summary, items, movements, meals };
  }, []);

  const [state, reload] = useAsync(loadAll, [loadAll]);
  const [purchaseForm, setPurchaseForm] = useState({
    item_id: '', quantity: '', unit: 'kg', unit_cost: '', total_cost: '',
    supplier_name: '', invoice_no: '', payment_method: 'cash', record_expense: true, notes: '',
  });
  const [issueForm, setIssueForm] = useState({
    item_id: '', quantity: '', unit: 'kg', meal_date: today(), meal_type: 'lunch', issued_to: '', notes: '',
  });

  const items = useMemo(() => state.data?.items || [], [state.data?.items]);
  const lowStockItems = useMemo(() => items.filter((i) => Number(i.current_stock) <= Number(i.min_stock_level)), [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (lowOnly && Number(i.current_stock) > Number(i.min_stock_level)) return false;
      if (catFilter && i.category !== catFilter) return false;
      if (q && !`${i.name} ${i.name_ar || ''} ${i.storage_location || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, catFilter, lowOnly]);

  const purchaseItem = items.find((i) => i.id === purchaseForm.item_id);
  const issueItem = items.find((i) => i.id === issueForm.item_id);

  const saveItem = async (e) => {
    e.preventDefault();
    if (!itemModal?.name?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: itemModal.name.trim(),
        name_ar: itemModal.name_ar?.trim() || null,
        category: itemModal.category || 'grains',
        unit: itemModal.unit || 'kg',
        current_stock: Number(itemModal.current_stock || 0),
        min_stock_level: Number(itemModal.min_stock_level || 0),
        unit_cost: Number(itemModal.unit_cost || 0),
        storage_location: itemModal.storage_location?.trim() || null,
        assigned_manager_id: itemModal.assigned_manager_id || null,
        notes: itemModal.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (itemModal.id) {
        await query('inventory_items', (q) => q.update(payload).eq('id', itemModal.id));
        toast.success(t('Item updated', 'تم تحديث الصنف'));
      } else {
        await query('inventory_items', (q) => q.insert(payload));
        toast.success(t('Item added to store', 'تمت إضافة الصنف للمخزن'));
      }
      setItemModal(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item) => {
    const ok = await appConfirm({
      title: t('Archive store item', 'أرشفة صنف المخزن'),
      message: `${t('Remove from active inventory:', 'إزالة من المخزن النشط:')} ${item.name}?`,
      danger: true,
    });
    if (!ok) return;
    try {
      await query('inventory_items', (q) => q.update({ is_active: false }).eq('id', item.id));
      toast.success(t('Item archived', 'تمت أرشفة الصنف'));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.item_id || Number(purchaseForm.quantity) <= 0) return;
    setSaving(true);
    try {
      const res = await rpc('record_inventory_purchase', {
        p_item_id: purchaseForm.item_id,
        p_quantity: Number(purchaseForm.quantity),
        p_unit: purchaseForm.unit || purchaseItem?.unit || 'kg',
        p_unit_cost: Number(purchaseForm.unit_cost || 0),
        p_total_cost: Number(purchaseForm.total_cost || 0),
        p_supplier_name: purchaseForm.supplier_name || null,
        p_invoice_no: purchaseForm.invoice_no || null,
        p_payment_method: purchaseForm.payment_method || 'cash',
        p_record_expense: Boolean(purchaseForm.record_expense),
        p_notes: purchaseForm.notes || null,
      });
      toast.success(
        res?.expense_id
          ? t('Stock added & Kitchen Expense recorded', 'تمت إضافة المخزون وتسجيل مصروف المطبخ')
          : t('Stock purchase recorded', 'تم تسجيل شراء المخزون'),
      );
      setPurchaseForm({
        item_id: '', quantity: '', unit: 'kg', unit_cost: '', total_cost: '',
        supplier_name: '', invoice_no: '', payment_method: 'cash', record_expense: true, notes: '',
      });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitIssue = async (e) => {
    e.preventDefault();
    if (!issueForm.item_id || Number(issueForm.quantity) <= 0) return;
    setSaving(true);
    try {
      const res = await rpc('issue_inventory_to_kitchen', {
        p_item_id: issueForm.item_id,
        p_quantity: Number(issueForm.quantity),
        p_unit: issueForm.unit || issueItem?.unit || 'kg',
        p_meal_date: issueForm.meal_date || today(),
        p_meal_type: issueForm.meal_type || 'general',
        p_issued_to: issueForm.issued_to || null,
        p_notes: issueForm.notes || null,
      });
      toast.success(t('Issued to kitchen', 'تم الصرف للمطبخ'));
      if (res?.low_stock) {
        toast.warning(t('Warning: item is now at low stock level!', 'تنبيه: الصنف وصل إلى حد النقص!'));
      }
      setIssueForm({ ...issueForm, item_id: '', quantity: '', notes: '' });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendLowStockReminder = async () => {
    try {
      const count = await rpc('notify_low_stock_items');
      if (count > 0) toast.success(`${t('Low stock alert sent to staff:', 'تم إرسال تنبيه النقص للموظفين:')} ${count}`);
      else toast.info(t('All store items are above minimum stock.', 'جميع أصناف المخزن فوق الحد الأدنى.'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveMeal = async (e) => {
    e.preventDefault();
    if (!mealModal?.menu_items?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        meal_date: mealModal.meal_date || mealDate,
        meal_type: mealModal.meal_type || 'lunch',
        menu_items: mealModal.menu_items.trim(),
        expected_count: Number(mealModal.expected_count || 0),
        served_count: Number(mealModal.served_count || 0),
        estimated_cost: Number(mealModal.estimated_cost || 0),
        status: mealModal.status || 'planned',
        notes: mealModal.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (mealModal.id) {
        await query('daily_meals', (q) => q.update(payload).eq('id', mealModal.id));
      } else {
        await query('daily_meals', (q) => q.upsert(payload, { onConflict: 'org_id,meal_date,meal_type' }));
      }
      toast.success(t('Daily meal saved', 'تم حفظ الوجبة اليومية'));
      setMealModal(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateMealStatus = async (meal, status) => {
    try {
      await query('daily_meals', (q) => q.update({ status, updated_at: new Date().toISOString() }).eq('id', meal.id));
      toast.success(t('Meal status updated', 'تم تحديث حالة الوجبة'));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteMeal = async (meal) => {
    const ok = await appConfirm({
      title: t('Delete meal plan', 'حذف خطة الوجبة'),
      message: `${formatDate(meal.meal_date)} (${meal.meal_type})?`,
      danger: true,
    });
    if (!ok) return;
    try {
      await query('daily_meals', (q) => q.delete().eq('id', meal.id));
      toast.success(t('Meal deleted', 'تم حذف الوجبة'));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const tabs = [
    { id: 'inventory', label: t('Store Inventory', 'مخزن المواد') },
    { id: 'purchase', label: t('Purchase & Expense', 'الشراء والمصروفات') },
    { id: 'issue', label: t('Issue to Kitchen', 'الصرف للمطبخ') },
    { id: 'meals', label: t('Daily Meals (B/L/D)', 'الوجبات اليومية') },
    { id: 'ledger', label: t('Movement Ledger', 'سجل الحركة') },
  ];

  const catLabel = (c) => {
    const found = CATEGORIES.find((x) => x.value === c);
    return found ? t(found.en, found.ar) : c;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Mess, Kitchen & Store Inventory', 'المطبخ والوجبات ومخزن الكلية')}
        subtitle={t('Daily Breakfast/Lunch/Dinner planning, store stock (kg/g/L/ml/pcs), kitchen issues, expenses & low-stock alerts.', 'تخطيط الإفطار والغداء والعشاء، إدارة المخزن بالكيلو واللتر والقطعة، الصرف للمطبخ، وتنبيهات نقص المخزون.')}
        actions={
          <div className="flex flex-wrap gap-2">
            {lowStockItems.length > 0 && (
              <Button variant="danger" size="sm" onClick={sendLowStockReminder}>
                {t('Send Low Stock Alert', 'إرسال تنبيه النقص')} ({lowStockItems.length})
              </Button>
            )}
            <Button size="sm" onClick={() => setItemModal({ name: '', category: 'grains', unit: 'kg', current_stock: 0, min_stock_level: 5, unit_cost: 0 })}>
              + {t('Add Store Item', 'إضافة صنف')}
            </Button>
          </div>
        }
      />

      <AsyncView state={state}>
        {({ summary, movements, meals }) => {
          const dayMeals = meals.filter((m) => m.meal_date === mealDate);
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
                <Stat label={t('Store Items', 'أصناف المخزن')} value={items.length} hint={t('Active tracked items', 'أصناف نشطة')} />
                <Stat
                  label={t('Low Stock Alerts', 'تنبيهات نقص المخزون')}
                  value={lowStockItems.length}
                  hint={lowStockItems.length ? t('Restock required', 'يلزم إعادة التزويد') : t('All stock healthy', 'المخزون كافٍ')}
                  tone={lowStockItems.length ? 'red' : 'emerald'}
                />
                <Stat
                  label={t('Kitchen Purchases (Month)', 'مشتريات المطبخ (الشهر)')}
                  value={formatMoney(summary?.purchases_month || 0)}
                  hint={t('Store stock intake', 'إجمالي مشتريات الشهر')}
                  tone="blue"
                />
                <Stat
                  label={t("Today's Meals", 'وجبات اليوم')}
                  value={`${(summary?.today_meals || []).filter((m) => m.status === 'served').length} / 3`}
                  hint={t('Breakfast · Lunch · Dinner', 'إفطار · غداء · عشاء')}
                  tone="amber"
                />
              </div>

              {lowStockItems.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-red-900">
                    <strong className="font-bold">{t('Low Stock Reminder:', 'تنبيه نقص المخزون:')}</strong>{' '}
                    {lowStockItems.slice(0, 6).map((i) => `${i.name} (${i.current_stock} ${i.unit})`).join(' · ')}
                    {lowStockItems.length > 6 ? ` +${lowStockItems.length - 6}` : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setTab('inventory'); setLowOnly(true); }}>
                      {t('View Low Stock', 'عرض النواقص')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={sendLowStockReminder}>
                      {t('Notify Staff', 'تنبيه المسؤول')}
                    </Button>
                  </div>
                </div>
              )}

              <Tabs tabs={tabs} active={tab} onChange={setTab} />

              {tab === 'inventory' && (
                <Card
                  title={t('Store Stock Register', 'سجل مخزون المتجر')}
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search item…', 'ابحث عن صنف…')} className="w-44" />
                      <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-44">
                        <option value="">{t('All categories', 'كل الفئات')}</option>
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.en, c.ar)}</option>)}
                      </Select>
                      <Button size="sm" variant={lowOnly ? 'danger' : 'secondary'} onClick={() => setLowOnly((v) => !v)}>
                        {lowOnly ? t('Showing Low Stock', 'النواقص فقط') : t('Low Stock Filter', 'تصفية النواقص')}
                      </Button>
                    </div>
                  }
                >
                  <Table
                    rows={filteredItems}
                    empty={t('No store items found. Add your first item.', 'لا توجد أصناف في المخزن.')}
                    columns={[
                      {
                        key: 'name',
                        label: t('Item', 'الصنف'),
                        render: (r) => (
                          <div>
                            <div className="font-semibold text-ink-green-900">{r.name}</div>
                            {r.storage_location && <div className="text-xs text-ink-text-muted">{r.storage_location}</div>}
                          </div>
                        ),
                      },
                      { key: 'category', label: t('Category', 'الفئة'), render: (r) => catLabel(r.category) },
                      {
                        key: 'current_stock',
                        label: t('Available Stock', 'الرصيد المتاح'),
                        render: (r) => {
                          const isLow = Number(r.current_stock) <= Number(r.min_stock_level);
                          return (
                            <Badge tone={isLow ? 'red' : 'green'}>
                              {r.current_stock} {r.unit}
                            </Badge>
                          );
                        },
                      },
                      {
                        key: 'min_stock_level',
                        label: t('Min Alert Level', 'حد التنبيه'),
                        render: (r) => `${r.min_stock_level} ${r.unit}`,
                      },
                      {
                        key: 'unit_cost',
                        label: t('Unit Cost', 'سعر الوحدة'),
                        className: 'text-end',
                        render: (r) => formatMoney(r.unit_cost),
                      },
                      {
                        key: 'actions',
                        label: t('Actions', 'الإجراءات'),
                        render: (r) => (
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => { setPurchaseForm({ ...purchaseForm, item_id: r.id, unit: r.unit, unit_cost: r.unit_cost || '' }); setTab('purchase'); }}>
                              {t('Buy', 'شراء')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setIssueForm({ ...issueForm, item_id: r.id, unit: r.unit }); setTab('issue'); }}>
                              {t('Issue', 'صرف')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setItemModal(r)}>{t('Edit', 'تعديل')}</Button>
                            <Button size="sm" variant="ghost" onClick={() => removeItem(r)}>{t('Delete', 'حذف')}</Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              )}

              {tab === 'purchase' && (
                <Card title={t('Record Store Purchase & Kitchen Expense', 'تسجيل مشتريات المخزن ومصروف المطبخ')}>
                  <form onSubmit={submitPurchase} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label={t('Store Item', 'الصنف')}>
                      <Select
                        value={purchaseForm.item_id}
                        onChange={(e) => {
                          const it = items.find((x) => x.id === e.target.value);
                          setPurchaseForm({ ...purchaseForm, item_id: e.target.value, unit: it?.unit || 'kg', unit_cost: it?.unit_cost || '' });
                        }}
                      >
                        <option value="">{t('Select item…', 'اختر الصنف…')}</option>
                        {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</option>)}
                      </Select>
                    </Field>
                    <Field label={t('Quantity', 'الكمية')}>
                      <Input type="number" step="0.001" min="0.001" required value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} />
                    </Field>
                    <Field label={t('Measure Unit', 'وحدة القياس')}>
                      <Select value={purchaseForm.unit} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit: e.target.value })}>
                        {(purchaseItem ? compatibleUnits(purchaseItem.unit) : UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label={t('Unit Cost', 'سعر الوحدة')}>
                      <Input type="number" step="0.01" min="0" value={purchaseForm.unit_cost} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })} />
                    </Field>
                    <Field label={t('Total Cost (optional if unit cost set)', 'التكلفة الإجمالية')}>
                      <Input type="number" step="0.01" min="0" value={purchaseForm.total_cost} onChange={(e) => setPurchaseForm({ ...purchaseForm, total_cost: e.target.value })} />
                    </Field>
                    <Field label={t('Supplier Name', 'المورد')}>
                      <Input value={purchaseForm.supplier_name} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })} />
                    </Field>
                    <Field label={t('Invoice / Bill No', 'رقم الفاتورة')}>
                      <Input value={purchaseForm.invoice_no} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_no: e.target.value })} />
                    </Field>
                    <Field label={t('Payment Method', 'طريقة الدفع')}>
                      <Select value={purchaseForm.payment_method} onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_method: e.target.value })}>
                        <option value="cash">{t('Cash', 'نقدًا')}</option>
                        <option value="bank_transfer">{t('Bank Transfer', 'تحويل بنكي')}</option>
                        <option value="cheque">{t('Cheque', 'شيك')}</option>
                      </Select>
                    </Field>
                    <Field label={t('Notes', 'ملاحظات')}>
                      <Input value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} />
                    </Field>
                    <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sand-border">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-ink-green-900">
                        <input
                          type="checkbox"
                          checked={purchaseForm.record_expense}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, record_expense: e.target.checked })}
                          className="rounded border-slate-300 text-emerald-700"
                        />
                        {t('Also submit as College Kitchen Expense in Finance', 'إرسال أيضاً كمصروف مطبخ في المالية')}
                      </label>
                      <Button type="submit" disabled={saving || !purchaseForm.item_id}>
                        {saving ? t('Saving…', 'جارٍ الحفظ…') : t('Record Purchase & Update Stock', 'تسجيل الشراء وتحديث المخزون')}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {tab === 'issue' && (
                <Card title={t('Issue Items from Store to Kitchen', 'صرف مواد من المخزن إلى المطبخ')}>
                  <form onSubmit={submitIssue} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label={t('Store Item', 'الصنف')}>
                      <Select
                        value={issueForm.item_id}
                        onChange={(e) => {
                          const it = items.find((x) => x.id === e.target.value);
                          setIssueForm({ ...issueForm, item_id: e.target.value, unit: it?.unit || 'kg' });
                        }}
                      >
                        <option value="">{t('Select item…', 'اختر الصنف…')}</option>
                        {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</option>)}
                      </Select>
                    </Field>
                    <Field label={t('Quantity to Issue', 'الكمية المصروفة')}>
                      <Input type="number" step="0.001" min="0.001" required value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} />
                    </Field>
                    <Field label={t('Unit', 'الوحدة')}>
                      <Select value={issueForm.unit} onChange={(e) => setIssueForm({ ...issueForm, unit: e.target.value })}>
                        {(issueItem ? compatibleUnits(issueItem.unit) : UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label={t('Meal Date', 'تاريخ الوجبة')}>
                      <Input type="date" value={issueForm.meal_date} onChange={(e) => setIssueForm({ ...issueForm, meal_date: e.target.value })} />
                    </Field>
                    <Field label={t('Meal Session', 'الوجبة')}>
                      <Select value={issueForm.meal_type} onChange={(e) => setIssueForm({ ...issueForm, meal_type: e.target.value })}>
                        {MEAL_TYPES.map((m) => <option key={m.value} value={m.value}>{t(m.en, m.ar)}</option>)}
                        <option value="general">{t('General Kitchen Use', 'استخدام عام للمطبخ')}</option>
                      </Select>
                    </Field>
                    <Field label={t('Issued To (Cook / Staff)', 'المستلم (الطباخ / الموظف)')}>
                      <Input value={issueForm.issued_to} onChange={(e) => setIssueForm({ ...issueForm, issued_to: e.target.value })} />
                    </Field>
                    <div className="md:col-span-3">
                      <Field label={t('Notes', 'ملاحظات')}>
                        <Input value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} />
                      </Field>
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                      <Button type="submit" disabled={saving || !issueForm.item_id}>
                        {saving ? t('Issuing…', 'جارٍ الصرف…') : t('Issue to Kitchen', 'صرف للمطبخ')}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {tab === 'meals' && (
                <div className="space-y-4">
                  <Card
                    title={t('Daily College Meals (Breakfast, Lunch, Dinner)', 'الوجبات اليومية للكلية (إفطار، غداء، عشاء)')}
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value || today())} className="w-40" />
                        <Button size="sm" onClick={() => setMealModal({ meal_date: mealDate, meal_type: 'breakfast', menu_items: '', expected_count: 100, served_count: 0, estimated_cost: 0, status: 'planned' })}>
                          + {t('Plan Meal', 'تخطيط وجبة')}
                        </Button>
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {MEAL_TYPES.map((mt) => {
                        const row = dayMeals.find((m) => m.meal_type === mt.value);
                        const st = row ? MEAL_STATUS[row.status] : null;
                        return (
                          <div key={mt.value} className="rounded-2xl border border-sand-border bg-white p-4 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-bold text-ink-green-900">{t(mt.en, mt.ar)}</h4>
                                {st ? <Badge tone={st.tone}>{t(st.en, st.ar)}</Badge> : <Badge tone="gray">{t('Not planned', 'غير مخطط')}</Badge>}
                              </div>
                              {row ? (
                                <div className="mt-2 space-y-1.5 text-sm">
                                  <p className="text-ink-text-primary whitespace-pre-wrap">{row.menu_items}</p>
                                  <p className="text-xs text-ink-text-muted">
                                    {t('Expected', 'المتوقع')}: {row.expected_count} · {t('Served', 'المقدم')}: {row.served_count} · {formatMoney(row.estimated_cost)}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-ink-text-muted">{t('No menu planned for this date.', 'لم تُخطط قائمة لهذا التاريخ.')}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-sand-border">
                              {row ? (
                                <>
                                  {row.status === 'planned' && <Button size="sm" variant="secondary" onClick={() => updateMealStatus(row, 'prepared')}>{t('Mark Prepared', 'جاهز')}</Button>}
                                  {row.status !== 'served' && <Button size="sm" onClick={() => updateMealStatus(row, 'served')}>{t('Mark Served', 'تم التقديم')}</Button>}
                                  <Button size="sm" variant="ghost" onClick={() => setMealModal(row)}>{t('Edit', 'تعديل')}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => deleteMeal(row)}>{t('Delete', 'حذف')}</Button>
                                </>
                              ) : (
                                <Button size="sm" variant="secondary" onClick={() => setMealModal({ meal_date: mealDate, meal_type: mt.value, menu_items: '', expected_count: 100, served_count: 0, estimated_cost: 0, status: 'planned' })}>
                                  + {t('Add Menu', 'إضافة قائمة')}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Table
                      rows={meals}
                      empty={t('No meals recorded yet.', 'لا توجد وجبات مسجلة بعد.')}
                      columns={[
                        { key: 'meal_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.meal_date) },
                        { key: 'meal_type', label: t('Meal', 'الوجبة'), render: (r) => { const m = MEAL_TYPES.find((x) => x.value === r.meal_type); return m ? t(m.en, m.ar) : r.meal_type; } },
                        { key: 'menu_items', label: t('Menu', 'القائمة') },
                        { key: 'served_count', label: t('Served / Expected', 'المقدم / المتوقع'), render: (r) => `${r.served_count} / ${r.expected_count}` },
                        { key: 'estimated_cost', label: t('Cost', 'التكلفة'), className: 'text-end', render: (r) => formatMoney(r.estimated_cost) },
                        { key: 'status', label: t('Status', 'الحالة'), render: (r) => { const st = MEAL_STATUS[r.status] || MEAL_STATUS.planned; return <Badge tone={st.tone}>{t(st.en, st.ar)}</Badge>; } },
                      ]}
                    />
                  </Card>
                </div>
              )}

              {tab === 'ledger' && (
                <Card title={t('Store Purchases & Kitchen Issue History', 'سجل المشتريات والصرف للمطبخ')}>
                  <Table
                    rows={movements}
                    empty={t('No stock movements yet.', 'لا توجد حركات مخزون بعد.')}
                    columns={[
                      { key: 'created_at', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.meal_date || r.created_at) },
                      {
                        key: 'movement_type',
                        label: t('Type', 'النوع'),
                        render: (r) => (
                          <Badge tone={r.movement_type === 'purchase' ? 'green' : r.movement_type === 'kitchen_issue' ? 'amber' : 'blue'}>
                            {r.movement_type === 'purchase' ? t('Purchase', 'شراء') : r.movement_type === 'kitchen_issue' ? t('Kitchen Issue', 'صرف للمطبخ') : t('Adjustment', 'تعديل')}
                          </Badge>
                        ),
                      },
                      { key: 'item', label: t('Item', 'الصنف'), render: (r) => r.item?.name || '—' },
                      { key: 'quantity', label: t('Quantity', 'الكمية'), render: (r) => `${r.quantity} ${r.unit} (${r.base_quantity} ${r.item?.unit || r.unit})` },
                      { key: 'total_cost', label: t('Cost', 'التكلفة'), className: 'text-end', render: (r) => formatMoney(r.total_cost) },
                      { key: 'details', label: t('Details', 'التفاصيل'), render: (r) => r.supplier_name || r.meal_type || r.issued_to || r.notes || '—' },
                    ]}
                  />
                </Card>
              )}
            </div>
          );
        }}
      </AsyncView>

      {itemModal && (
        <Modal title={itemModal.id ? t('Edit Store Item', 'تعديل صنف المخزن') : t('Add Store Item', 'إضافة صنف للمخزن')} onClose={() => setItemModal(null)}>
          <form onSubmit={saveItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('Item Name', 'اسم الصنف')}>
                <Input required value={itemModal.name || ''} onChange={(e) => setItemModal({ ...itemModal, name: e.target.value })} />
              </Field>
              <Field label={t('Category', 'الفئة')}>
                <Select value={itemModal.category || 'grains'} onChange={(e) => setItemModal({ ...itemModal, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.en, c.ar)}</option>)}
                </Select>
              </Field>
              <Field label={t('Base Unit (kg, g, L, ml, pcs…)', 'وحدة القياس')}>
                <Select value={itemModal.unit || 'kg'} onChange={(e) => setItemModal({ ...itemModal, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label={t('Current Stock', 'الرصيد الحالي')}>
                <Input type="number" step="0.001" min="0" value={itemModal.current_stock ?? 0} onChange={(e) => setItemModal({ ...itemModal, current_stock: e.target.value })} />
              </Field>
              <Field label={t('Low Stock Alert Threshold', 'حد تنبيه النقص')}>
                <Input type="number" step="0.001" min="0" value={itemModal.min_stock_level ?? 5} onChange={(e) => setItemModal({ ...itemModal, min_stock_level: e.target.value })} />
              </Field>
              <Field label={t('Unit Cost', 'سعر الوحدة')}>
                <Input type="number" step="0.01" min="0" value={itemModal.unit_cost ?? 0} onChange={(e) => setItemModal({ ...itemModal, unit_cost: e.target.value })} />
              </Field>
              <Field label={t('Assigned Store Manager', 'مسؤول المخزن المعيّن')}>
                <Select value={itemModal.assigned_manager_id || ''} onChange={(e) => setItemModal({ ...itemModal, assigned_manager_id: e.target.value })}>
                  <option value="">{t('Unassigned', 'غير معيّن')}</option>
                  {staff.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label={t('Storage Location', 'موقع التخزين')}>
                <Input value={itemModal.storage_location || ''} onChange={(e) => setItemModal({ ...itemModal, storage_location: e.target.value })} />
              </Field>
            </div>
            <Field label={t('Notes', 'ملاحظات')}>
              <Textarea rows={2} value={itemModal.notes || ''} onChange={(e) => setItemModal({ ...itemModal, notes: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setItemModal(null)}>{t('Cancel', 'إلغاء')}</Button>
              <Button type="submit" disabled={saving}>{saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save Item', 'حفظ الصنف')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {mealModal && (
        <Modal title={t('Daily Meal Plan', 'خطة الوجبة اليومية')} onClose={() => setMealModal(null)}>
          <form onSubmit={saveMeal} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('Date', 'التاريخ')}>
                <Input type="date" required value={mealModal.meal_date || mealDate} onChange={(e) => setMealModal({ ...mealModal, meal_date: e.target.value })} />
              </Field>
              <Field label={t('Meal Type', 'نوع الوجبة')}>
                <Select value={mealModal.meal_type || 'lunch'} onChange={(e) => setMealModal({ ...mealModal, meal_type: e.target.value })}>
                  {MEAL_TYPES.map((m) => <option key={m.value} value={m.value}>{t(m.en, m.ar)}</option>)}
                </Select>
              </Field>
              <Field label={t('Expected Headcount', 'العدد المتوقع')}>
                <Input type="number" min="0" value={mealModal.expected_count ?? 0} onChange={(e) => setMealModal({ ...mealModal, expected_count: e.target.value })} />
              </Field>
              <Field label={t('Served Headcount', 'العدد المقدم')}>
                <Input type="number" min="0" value={mealModal.served_count ?? 0} onChange={(e) => setMealModal({ ...mealModal, served_count: e.target.value })} />
              </Field>
              <Field label={t('Estimated Cost', 'التكلفة التقديرية')}>
                <Input type="number" step="0.01" min="0" value={mealModal.estimated_cost ?? 0} onChange={(e) => setMealModal({ ...mealModal, estimated_cost: e.target.value })} />
              </Field>
              <Field label={t('Status', 'الحالة')}>
                <Select value={mealModal.status || 'planned'} onChange={(e) => setMealModal({ ...mealModal, status: e.target.value })}>
                  <option value="planned">{t('Planned', 'مخطط')}</option>
                  <option value="prepared">{t('Prepared', 'جاهز')}</option>
                  <option value="served">{t('Served', 'تم التقديم')}</option>
                </Select>
              </Field>
            </div>
            <Field label={t('Menu Items / Dishes', 'قائمة الطعام / الأطباق')}>
              <Textarea rows={3} required value={mealModal.menu_items || ''} onChange={(e) => setMealModal({ ...mealModal, menu_items: e.target.value })} placeholder={t('e.g. Rice, Dhal Curry, Chicken Curry, Salad…', 'مثال: أرز، عدس، كاري دجاج، سلطة…')} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMealModal(null)}>{t('Cancel', 'إلغاء')}</Button>
              <Button type="submit" disabled={saving}>{saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save Meal', 'حفظ الوجبة')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
