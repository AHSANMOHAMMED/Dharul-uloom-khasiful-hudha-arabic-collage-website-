import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { deleteRow, formatDate, formatMoney, insertRow, query, today, updateRow } from '../../../lib/erp/rpc';
import { studentLabel } from '../../../lib/erp/campusApi';
import { StudentPicker } from './common';
import { useAction, useEmployees, useStudents } from './hooks';

function useHostelData() {
  return useAsync(async () => {
    const [hostels, rooms, allocations] = await Promise.all([
      query('hostels', (q) => q.select('*, warden:profiles!warden_id(full_name)').order('name')),
      query('hostel_rooms', (q) => q.select('*').order('room_no')),
      query('hostel_allocations', (q) => q.select('*, student:profiles!student_id(full_name, index_number, class_number)').eq('status', 'active')),
    ]);
    return { hostels, rooms, allocations };
  }, []);
}

function Occupancy({ data, canManage, onAllocate, onEnd, busy }) {
  const { t } = useLang();
  const occ = (roomId) => data.allocations.filter((a) => a.room_id === roomId);
  const beds = data.rooms.filter((r) => r.is_active).reduce((s, r) => s + r.capacity, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('Hostels', 'المساكن')} value={data.hostels.length} tone="gray" />
        <Stat label={t('Beds', 'الأسرة')} value={beds} tone="blue" />
        <Stat label={t('Occupied', 'المشغولة')} value={data.allocations.length} />
        <Stat label={t('Occupancy', 'الإشغال')} value={beds ? `${Math.round((data.allocations.length * 100) / beds)}%` : '—'} tone="amber" />
      </div>
      {!data.hostels.length && <Card><p className="text-sm text-gray-400">{t('No hostels yet — add one in the Hostels & rooms tab.', 'لا توجد مساكن — أضف واحدًا.')}</p></Card>}
      {data.hostels.map((h) => (
        <Card key={h.id} title={`${h.name} · ${h.gender}`} actions={canManage && <Button size="sm" onClick={() => onAllocate(null)}>{t('Allocate student', 'تخصيص طالب')}</Button>}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.rooms.filter((r) => r.hostel_id === h.id).map((r) => {
              const list = occ(r.id);
              const full = list.length >= r.capacity;
              return (
                <div key={r.id} className={`rounded-xl border p-3 ${r.is_active ? 'border-gray-800' : 'border-gray-900 opacity-60'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white">{t('Room', 'غرفة')} {r.room_no}</span>
                    <Badge tone={full ? 'red' : list.length ? 'amber' : 'green'}>{list.length}/{r.capacity}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{formatMoney(r.monthly_fee)} / {t('month', 'شهر')}</div>
                  <ul className="space-y-1 text-sm">
                    {list.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span className="text-gray-200">{a.student?.full_name}{a.bed_no ? ` · ${t('bed', 'سرير')} ${a.bed_no}` : ''}</span>
                        {canManage && <button type="button" disabled={busy} className="text-xs text-red-400 hover:underline" onClick={() => onEnd(a)}>{t('End', 'إنهاء')}</button>}
                      </li>
                    ))}
                  </ul>
                  {canManage && r.is_active && !full && (
                    <button type="button" className="text-xs text-emerald-400 hover:underline mt-2" onClick={() => onAllocate(r.id)}>+ {t('Allocate', 'تخصيص')}</button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function HostelsAndRooms({ data, reload, canManage }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [emps] = useEmployees();
  const [hModal, setHModal] = useState(null);
  const [rModal, setRModal] = useState(null);
  const saveHostel = async () => {
    const row = { name: hModal.name.trim(), gender: hModal.gender, warden_id: hModal.warden_id || null, address: hModal.address || null, is_active: Boolean(hModal.is_active) };
    const res = await run(() => (hModal.id ? updateRow('hostels', hModal.id, row) : insertRow('hostels', row)), t('Hostel saved', 'تم الحفظ'));
    if (res.ok) { setHModal(null); reload(); }
  };
  const saveRoom = async () => {
    const row = { hostel_id: rModal.hostel_id, room_no: rModal.room_no.trim(), capacity: Number(rModal.capacity) || 1, monthly_fee: Number(rModal.monthly_fee) || 0, is_active: Boolean(rModal.is_active) };
    const res = await run(() => (rModal.id ? updateRow('hostel_rooms', rModal.id, row) : insertRow('hostel_rooms', row)), t('Room saved', 'تم الحفظ'));
    if (res.ok) { setRModal(null); reload(); }
  };
  const removeHostel = async (h) => {
    if (!window.confirm(t(`Delete ${h.name} and all its rooms? Rooms with allocation history cannot be deleted.`, `حذف ${h.name} وكل غرفه؟`))) return;
    const res = await run(() => deleteRow('hostels', h.id), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  const removeRoom = async (r) => {
    if (!window.confirm(t(`Delete room ${r.room_no}? Rooms with allocation history cannot be deleted — deactivate instead.`, `حذف الغرفة ${r.room_no}؟`))) return;
    const res = await run(() => deleteRow('hostel_rooms', r.id), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  const occ = (id) => data.allocations.filter((a) => a.room_id === id).length;
  return (
    <div className="space-y-6">
      <Card title={t('Hostels', 'المساكن')} actions={canManage && <Button onClick={() => setHModal({ name: '', gender: 'male', warden_id: '', address: '', is_active: true })}>{t('New hostel', 'سكن جديد')}</Button>}>
        <Table rows={data.hostels} empty={t('No hostels.', 'لا توجد مساكن.')} columns={[
          { key: 'name', label: t('Name', 'الاسم') },
          { key: 'gender', label: t('Gender', 'الجنس') },
          { key: 'warden', label: t('Warden', 'المشرف'), render: (h) => h.warden?.full_name || '—' },
          { key: 'rooms', label: t('Rooms', 'الغرف'), render: (h) => data.rooms.filter((r) => r.hostel_id === h.id).length },
          { key: 'is_active', label: t('Active', 'نشط'), render: (h) => (h.is_active ? '✓' : '—') },
          { key: 'act', label: '', render: (h) => canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRModal({ hostel_id: h.id, room_no: '', capacity: '4', monthly_fee: '0', is_active: true })}>+ {t('Room', 'غرفة')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setHModal({ ...h, warden_id: h.warden_id || '', address: h.address || '' })}>{t('Edit', 'تعديل')}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeHostel(h)}>{t('Delete', 'حذف')}</Button>
            </div>
          ) },
        ]} />
      </Card>
      <Card title={t('Rooms', 'الغرف')}>
        <Table rows={data.rooms} empty={t('No rooms.', 'لا توجد غرف.')} columns={[
          { key: 'hostel', label: t('Hostel', 'السكن'), render: (r) => data.hostels.find((h) => h.id === r.hostel_id)?.name },
          { key: 'room_no', label: t('Room', 'الغرفة') },
          { key: 'capacity', label: t('Capacity', 'السعة'), render: (r) => `${occ(r.id)} / ${r.capacity}` },
          { key: 'monthly_fee', label: t('Monthly fee', 'الرسوم الشهرية'), render: (r) => formatMoney(r.monthly_fee) },
          { key: 'is_active', label: t('Active', 'نشطة'), render: (r) => (r.is_active ? '✓' : '—') },
          { key: 'act', label: '', render: (r) => canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRModal({ ...r, capacity: String(r.capacity), monthly_fee: String(r.monthly_fee) })}>{t('Edit', 'تعديل')}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeRoom(r)}>{t('Delete', 'حذف')}</Button>
            </div>
          ) },
        ]} />
        <p className="text-xs text-gray-500 mt-3">{t('Monthly fees are added automatically to each resident’s monthly fee invoice.', 'تضاف الرسوم الشهرية تلقائيًا إلى فاتورة الطالب.')}</p>
      </Card>
      <Modal open={Boolean(hModal)} title={t('Hostel', 'السكن')} onClose={() => setHModal(null)}
        footer={<><Button variant="ghost" onClick={() => setHModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !hModal?.name} onClick={saveHostel}>{t('Save', 'حفظ')}</Button></>}>
        {hModal && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label={t('Name', 'الاسم')}><Input value={hModal.name} onChange={(e) => setHModal({ ...hModal, name: e.target.value })} /></Field></div>
            <Field label={t('Gender', 'الجنس')}><Select value={hModal.gender} onChange={(e) => setHModal({ ...hModal, gender: e.target.value })} options={[{ value: 'male', label: t('Male', 'ذكور') }, { value: 'female', label: t('Female', 'إناث') }, { value: 'mixed', label: t('Mixed', 'مختلط') }]} /></Field>
            <Field label={t('Warden', 'المشرف')}><Select value={hModal.warden_id} onChange={(e) => setHModal({ ...hModal, warden_id: e.target.value })} placeholder="—" options={(emps.data || []).map((p) => ({ value: p.id, label: p.full_name || p.email }))} /></Field>
            <div className="col-span-2"><Field label={t('Address', 'العنوان')}><Input value={hModal.address} onChange={(e) => setHModal({ ...hModal, address: e.target.value })} /></Field></div>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" className="accent-emerald-600" checked={Boolean(hModal.is_active)} onChange={(e) => setHModal({ ...hModal, is_active: e.target.checked })} />{t('Active', 'نشط')}</label>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(rModal)} title={t('Room', 'الغرفة')} onClose={() => setRModal(null)}
        footer={<><Button variant="ghost" onClick={() => setRModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !rModal?.room_no} onClick={saveRoom}>{t('Save', 'حفظ')}</Button></>}>
        {rModal && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Room no.', 'رقم الغرفة')}><Input value={rModal.room_no} onChange={(e) => setRModal({ ...rModal, room_no: e.target.value })} /></Field>
            <Field label={t('Capacity (beds)', 'السعة')}><Input type="number" min="1" value={rModal.capacity} onChange={(e) => setRModal({ ...rModal, capacity: e.target.value })} /></Field>
            <Field label={t('Monthly fee (LKR)', 'الرسوم الشهرية')}><Input type="number" min="0" step="0.01" value={rModal.monthly_fee} onChange={(e) => setRModal({ ...rModal, monthly_fee: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-300 mt-6"><input type="checkbox" className="accent-emerald-600" checked={Boolean(rModal.is_active)} onChange={(e) => setRModal({ ...rModal, is_active: e.target.checked })} />{t('Active', 'نشطة')}</label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Residents({ canManage, onChanged }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('active');
  const [state, reload] = useAsync(
    () => query('hostel_allocations', (q) =>
      q.select('*, student:profiles!student_id(full_name, index_number, class_number), hostel_rooms(room_no, hostels(name))').eq('status', status).order('start_date', { ascending: false }).limit(1000)),
    [status]
  );
  const end = async (a) => {
    if (!window.confirm(t(`End the allocation of ${a.student?.full_name}? Hostel fees stop from next month.`, `إنهاء سكن ${a.student?.full_name}؟`))) return;
    const res = await run(() => updateRow('hostel_allocations', a.id, { status: 'ended', end_date: today() }), t('Allocation ended', 'تم الإنهاء'));
    if (res.ok) { reload(); onChanged(); }
  };
  return (
    <Card title={t('Residents', 'المقيمون')} actions={<div className="w-36"><Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'active', label: t('Active', 'نشط') }, { value: 'ended', label: t('Ended', 'منتهٍ') }]} /></div>}>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No allocations.', 'لا يوجد.')} columns={[
            { key: 'student', label: t('Student', 'الطالب'), render: (a) => studentLabel(a.student) },
            { key: 'room', label: t('Hostel / room', 'السكن / الغرفة'), render: (a) => `${a.hostel_rooms?.hostels?.name || ''} · ${a.hostel_rooms?.room_no || ''}${a.bed_no ? ` · ${a.bed_no}` : ''}` },
            { key: 'start_date', label: t('From', 'من'), render: (a) => formatDate(a.start_date) },
            { key: 'end_date', label: t('To', 'إلى'), render: (a) => formatDate(a.end_date) },
            { key: 'notes', label: t('Notes', 'ملاحظات') },
            { key: 'act', label: '', render: (a) => (canManage && a.status === 'active' ? <Button size="sm" variant="danger" disabled={busy} onClick={() => end(a)}>{t('End', 'إنهاء')}</Button> : null) },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

export default function HostelPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const canManage = auth.isHostelStaff;
  const [tab, setTab] = useState('occupancy');
  const [state, reload] = useHostelData();
  const [students] = useStudents();
  const [busy, run] = useAction();
  const [alloc, setAlloc] = useState(null);

  const freeRooms = useMemo(() => {
    const d = state.data;
    if (!d) return [];
    return d.rooms.filter((r) => r.is_active).map((r) => {
      const used = d.allocations.filter((a) => a.room_id === r.id).length;
      const h = d.hostels.find((x) => x.id === r.hostel_id);
      return { value: r.id, label: `${h?.name || ''} · ${r.room_no} (${used}/${r.capacity})`, disabled: used >= r.capacity };
    }).filter((o) => !o.disabled);
  }, [state.data]);
  const housed = new Set((state.data?.allocations || []).map((a) => a.student_id));

  const allocate = async () => {
    const res = await run(() => insertRow('hostel_allocations', {
      student_id: alloc.student_id, room_id: alloc.room_id, bed_no: alloc.bed_no || null, start_date: alloc.start_date, notes: alloc.notes || null,
    }), t('Student allocated', 'تم تخصيص الطالب'));
    if (res.ok) { setAlloc(null); reload(); }
  };
  const endAlloc = async (a) => {
    if (!window.confirm(t(`End the allocation of ${a.student?.full_name}?`, `إنهاء سكن ${a.student?.full_name}؟`))) return;
    const res = await run(() => updateRow('hostel_allocations', a.id, { status: 'ended', end_date: today() }), t('Allocation ended', 'تم الإنهاء'));
    if (res.ok) reload();
  };

  return (
    <div>
      <PageHeader title={t('Hostel & boarding', 'السكن الداخلي')} subtitle={t('Rooms, occupancy and residents. Fees flow into monthly invoices.', 'الغرف والإشغال والمقيمون.')}
        actions={canManage && <Button onClick={() => setAlloc({ student_id: '', room_id: '', bed_no: '', start_date: today(), notes: '' })}>{t('Allocate student', 'تخصيص طالب')}</Button>} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'occupancy', label: t('Occupancy', 'الإشغال') },
        { id: 'residents', label: t('Residents', 'المقيمون') },
        { id: 'setup', label: t('Hostels & rooms', 'المساكن والغرف') },
      ]} />
      <AsyncView state={state}>
        {(d) => (
          <>
            {tab === 'occupancy' && <Occupancy data={d} canManage={canManage} busy={busy} onEnd={endAlloc}
              onAllocate={(roomId) => setAlloc({ student_id: '', room_id: roomId || '', bed_no: '', start_date: today(), notes: '' })} />}
            {tab === 'residents' && <Residents canManage={canManage} onChanged={reload} />}
            {tab === 'setup' && <HostelsAndRooms data={d} reload={reload} canManage={canManage} />}
          </>
        )}
      </AsyncView>
      <Modal open={Boolean(alloc)} title={t('Allocate student', 'تخصيص طالب')} onClose={() => setAlloc(null)}
        footer={<><Button variant="ghost" onClick={() => setAlloc(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !alloc?.student_id || !alloc?.room_id} onClick={allocate}>{t('Allocate', 'تخصيص')}</Button></>}>
        {alloc && (
          <div className="space-y-3">
            <Field label={t('Student', 'الطالب')}>
              <StudentPicker students={(students.data || []).filter((s) => !housed.has(s.id))} value={alloc.student_id} onChange={(v) => setAlloc({ ...alloc, student_id: v })} />
            </Field>
            <Field label={t('Room', 'الغرفة')}><Select value={alloc.room_id} onChange={(e) => setAlloc({ ...alloc, room_id: e.target.value })} placeholder={t('Select room with free beds…', 'اختر غرفة بها أسرة شاغرة…')} options={freeRooms} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Bed no.', 'رقم السرير')}><Input value={alloc.bed_no} onChange={(e) => setAlloc({ ...alloc, bed_no: e.target.value })} /></Field>
              <Field label={t('Start date', 'تاريخ البدء')}><Input type="date" value={alloc.start_date} onChange={(e) => setAlloc({ ...alloc, start_date: e.target.value })} /></Field>
            </div>
            <Field label={t('Notes', 'ملاحظات')}><Textarea value={alloc.notes} onChange={(e) => setAlloc({ ...alloc, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
