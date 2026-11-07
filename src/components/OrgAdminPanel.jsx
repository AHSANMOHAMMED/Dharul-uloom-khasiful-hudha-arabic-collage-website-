import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { getDefaultOrganization, updateOrganizationBranding } from '../lib/orgApi';
import { tx } from '../lib/tx';

export default function OrgAdminPanel() {
  useTranslation(); // subscribe: re-render on language change
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({
    primaryColor: '#047857',
    tagline_en: '',
    tagline_ar: '',
    supportEmail: '',
    supportPhone: '',
  });

  useEffect(() => {
    (async () => {
      const data = await getDefaultOrganization();
      setOrg(data);
      if (data?.branding) {
        setForm({
          primaryColor: data.branding.primaryColor || '#047857',
          tagline_en: data.branding.tagline_en || '',
          tagline_ar: data.branding.tagline_ar || '',
          supportEmail: data.branding.supportEmail || '',
          supportPhone: data.branding.supportPhone || '',
        });
      }
    })();
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    if (!org?.id) return;
    try {
      const updated = await updateOrganizationBranding(org.id, form);
      setOrg(updated);
      toast.success(tx('تم حفظ إعدادات المؤسسة', 'Organization branding saved'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!org) {
    return <p className="text-sm text-gray-400">Loading organization…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">{tx('إعدادات المؤسسة (SaaS)', 'Organization (SaaS foundation)')}</h2>
        <p className="text-sm text-gray-400 mt-1">
          {org.name_en} · slug: <code className="text-emerald-300">{org.slug}</code>
        </p>
      </div>
      <form onSubmit={onSave} className="grid md:grid-cols-2 gap-3">
        <input
          className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
          value={form.tagline_en}
          placeholder="Tagline EN"
          onChange={(e) => setForm({ ...form, tagline_en: e.target.value })}
        />
        <input
          className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
          dir="rtl"
          value={form.tagline_ar}
          placeholder="Tagline AR"
          onChange={(e) => setForm({ ...form, tagline_ar: e.target.value })}
        />
        <input
          className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
          value={form.supportEmail}
          placeholder="Support email"
          onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
        />
        <input
          className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
          value={form.supportPhone}
          placeholder="Support phone"
          onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
        />
        <label className="flex items-center gap-3 text-sm text-gray-300 md:col-span-2">
          Primary color
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
          />
        </label>
        <button type="submit" className="md:col-span-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
          Save branding
        </button>
      </form>
      <p className="text-xs text-gray-500">
        Multi-tenant SaaS billing is scaffolded via org_id on core tables. Add more colleges later by inserting
        organizations rows and scoping RLS by org_id.
      </p>
    </div>
  );
}
