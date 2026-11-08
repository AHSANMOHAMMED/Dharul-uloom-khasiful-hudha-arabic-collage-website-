import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import { tx } from '../lib/tx';

export default function ImportJobsPanel() {
  useTranslation(); // re-render on language change
  const [jobs, setJobs] = useState([]);

  const load = async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error(error);
      return;
    }
    setJobs(data || []);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const queueJob = async () => {
    const { error } = await supabase.from('import_jobs').insert({
      job_type: 'shamela',
      status: 'queued',
      progress: { books_done: 0, books_total: null },
      checkpoint: {},
    });
    if (error) toast.error(error.message);
    else {
      toast.success(tx('تم وضع مهمة الاستيراد في الطابور', 'Import job queued — worker will resume ingestion'));
      load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E1D0]">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
            {tx('استيراد مكتبة الشاملة والمخطوطات', 'Maktabah Shamela Bulk Import Engine')}
          </h2>
          <p className="text-xs text-[#4A5E56] mt-0.5">
            {tx('تشغيل مهمة الاستيراد التلقائي للكتب الكبرى والمصادر التراثية مع حفظ التقدم', 'Background batch catalog ingestion with auto-checkpointing and Google Drive integration')}
          </p>
        </div>
        <button
          type="button"
          onClick={queueJob}
          className="px-4 py-2 rounded-xl bg-[#11694A] hover:bg-[#0B3B2E] text-white text-xs font-bold transition shadow-sm"
        >
          {tx('وضع مهمة في الطابور', 'Queue Import Job')}
        </button>
      </div>

      <pre className="text-xs bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl p-4 text-[#0B3B2E] font-mono overflow-x-auto leading-relaxed">
{`# Run worker worker locally or in background:
cp .env.example .env   # Verify SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm run import:shamela -- --concurrency 4
# Checkpointing is safe and idempotent.`}
      </pre>

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">{tx('سجل تنفيذ المهام', 'Job Execution History')}</h3>
        {jobs.map((j) => (
          <div key={j.id} className="p-3.5 rounded-xl border border-[#E8E1D0] bg-[#FBF8F0] text-xs space-y-1">
            <div className="flex justify-between items-center gap-2">
              <span className="font-bold text-[#0B3B2E]">{j.job_type}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                j.status === 'completed' ? 'bg-[#E3F1EA] text-[#11694A]' : 'bg-[#F7EDD2] text-[#C29A3A]'
              }`}>{j.status}</span>
            </div>
            <div className="text-[11px] text-[#4A5E56] font-mono">
              {tx('التقدم:', 'Progress:')} {JSON.stringify(j.progress || {})}
            </div>
            <div className="text-[10px] text-[#60736C]">{new Date(j.created_at).toLocaleString()}</div>
            {j.error && <div className="text-xs text-[#B91C1C] mt-1">{j.error}</div>}
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="text-xs text-[#4A5E56] text-center py-6">{tx('لا توجد مهام استيراد في الطابور بعد.', 'No background import jobs queued yet.')}</p>
        )}
      </div>
    </div>
  );
}
