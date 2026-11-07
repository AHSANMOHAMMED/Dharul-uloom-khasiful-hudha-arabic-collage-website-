import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { toast } from 'react-toastify';

export default function ImportJobsPanel() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
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
      toast.success(ar ? 'تم وضع مهمة الاستيراد في الطابور' : 'Import job queued — run worker on DO/local');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            {ar ? 'استيراد مكتبة الشاملة' : 'Maktabah Shamela import'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {ar
              ? 'شغّل العامل على DigitalOcean أو الجهاز المحلي باستخدام npm run import:shamela'
              : 'Run the worker on DigitalOcean or a local machine with npm run import:shamela'}
          </p>
        </div>
        <button
          type="button"
          onClick={queueJob}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold"
        >
          Queue import job
        </button>
      </div>

      <pre className="text-xs bg-gray-950 border border-gray-800 rounded-xl p-4 text-emerald-300 overflow-x-auto">
{`# On DigitalOcean droplet (or strong local machine):
cp .env.example .env   # set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHAMELA_API_KEY
npm install
npm run import:shamela -- --concurrency 4
# Resume-safe; use --limit 50 for a smoke test first.`}
      </pre>

      <div className="space-y-2">
        {jobs.map((j) => (
          <div key={j.id} className="p-3 rounded-xl border border-gray-800 bg-gray-900/50 text-sm text-gray-200">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{j.job_type}</span>
              <span className="text-xs uppercase text-amber-300">{j.status}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {JSON.stringify(j.progress || {})}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">{new Date(j.created_at).toLocaleString()}</div>
            {j.error && <div className="text-xs text-red-400 mt-1">{j.error}</div>}
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="text-sm text-gray-500">No import jobs yet.</p>
        )}
      </div>
    </div>
  );
}
