import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { getDefaultOrganization, updateOrganizationBranding } from '../lib/orgApi';

export default function OrgAdminPanel() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({
    primaryColor: '#0B3B2E',
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
          primaryColor: data.branding.primaryColor || '#0B3B2E',
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
      toast.success(ar ? 'تم حفظ إعدادات المؤسسة بنجاح' : 'Organization branding saved');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!org) {
    return <p className="text-xs text-[#4A5E56] py-8 text-center">Loading organization settings…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="pb-3 border-b border-[#E8E1D0]">
        <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
          {ar ? 'إعدادات المؤسسة والهوية البصرية' : 'College Branding & Multi-Tenant Settings'}
        </h2>
        <p className="text-xs text-[#4A5E56] mt-0.5">
          {org.name_en} · slug: <code className="font-mono text-[#11694A] font-bold">{org.slug}</code>
        </p>
      </div>

      <form onSubmit={onSave} className="grid md:grid-cols-2 gap-3.5 bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0]">
        <input
          className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none"
          value={form.tagline_en}
          placeholder="Institutional Tagline (English)"
          onChange={(e) => setForm({ ...form, tagline_en: e.target.value })}
        />
        <input
          className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none"
          dir="rtl"
          value={form.tagline_ar}
          placeholder="شعار المؤسسة (بالعربية)"
          onChange={(e) => setForm({ ...form, tagline_ar: e.target.value })}
        />
        <input
          className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none"
          value={form.supportEmail}
          placeholder="Official Support Email"
          onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
        />
        <input
          className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none"
          value={form.supportPhone}
          placeholder="Campus Hotline Phone"
          onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
        />
        <label className="flex items-center gap-3 text-xs font-bold text-[#4A5E56] uppercase tracking-wider md:col-span-2">
          <span>Primary Institutional Color:</span>
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            className="w-8 h-8 rounded border border-[#E8E1D0] cursor-pointer"
          />
          <span className="font-mono text-xs text-[#0B3B2E]">{form.primaryColor}</span>
        </label>
        <button type="submit" className="md:col-span-2 py-2.5 rounded-xl bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold text-xs transition shadow-sm">
          {ar ? 'حفظ إعدادات الهوية' : 'Save Institutional Branding'}
        </button>
      </form>

      <p className="text-[11px] text-[#60736C]">
        Multi-tenant tenancy is protected via org_id on core database tables and Supabase RLS policies.
      </p>
    </div>
  );
}
