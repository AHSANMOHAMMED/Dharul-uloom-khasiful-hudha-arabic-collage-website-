-- =============================================================================
-- 0008_gallery_courses_cms.sql
-- Gallery photos and public course programs + content storage buckets.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- gallery_items
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_items (
  id           uuid primary key default extensions.gen_random_uuid(),
  title_en     text not null,
  title_ar     text,
  category     text not null default 'facilities'
               check (category in ('facilities', 'events')),
  image_url    text,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_gallery_published_sort
  on public.gallery_items (is_published, sort_order);

create trigger trg_gallery_items_updated_at
  before update on public.gallery_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- course_programs (public-facing programs page; distinct from admissions.course)
-- ---------------------------------------------------------------------------
create table if not exists public.course_programs (
  id              uuid primary key default extensions.gen_random_uuid(),
  slug            text not null unique,
  title_en        text not null,
  title_ar        text,
  duration_en     text,
  duration_ar     text,
  description_en  text,
  description_ar  text,
  icon            text default '📚',
  admission_code  text check (admission_code in ('quran', 'arabic', 'hadith', 'fiqh', 'islamic')),
  sort_order      int not null default 0,
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_course_programs_published_sort
  on public.course_programs (is_published, sort_order);

create trigger trg_course_programs_updated_at
  before update on public.course_programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.gallery_items    enable row level security;
alter table public.course_programs  enable row level security;

create policy "gallery: public read published"
  on public.gallery_items for select
  using (is_published or public.is_staff());

create policy "gallery: staff write"
  on public.gallery_items for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "course_programs: public read published"
  on public.course_programs for select
  using (is_published or public.is_staff());

create policy "course_programs: staff write"
  on public.course_programs for all
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Storage: gallery (public) + content (public read for CMS images)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do nothing;

create policy "gallery bucket: public read"
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy "gallery bucket: staff write"
  on storage.objects for insert
  with check (bucket_id = 'gallery' and public.is_staff());

create policy "gallery bucket: staff update"
  on storage.objects for update
  using (bucket_id = 'gallery' and public.is_staff());

create policy "gallery bucket: staff delete"
  on storage.objects for delete
  using (bucket_id = 'gallery' and public.is_staff());

create policy "content bucket: public read"
  on storage.objects for select
  using (bucket_id = 'content');

create policy "content bucket: staff write"
  on storage.objects for insert
  with check (bucket_id = 'content' and public.is_staff());

create policy "content bucket: staff update"
  on storage.objects for update
  using (bucket_id = 'content' and public.is_staff());

create policy "content bucket: staff delete"
  on storage.objects for delete
  using (bucket_id = 'content' and public.is_staff());

-- ---------------------------------------------------------------------------
-- Seed default course programs (from former static Courses.jsx)
-- ---------------------------------------------------------------------------
insert into public.course_programs (slug, title_en, title_ar, duration_en, duration_ar, description_en, description_ar, icon, admission_code, sort_order)
values
  ('quran-memorization', 'Quran Memorization (Hifz)', 'حفظ القرآن', '3-5 years', '3-5 سنوات',
   'Complete memorization of the Holy Quran with proper Tajweed and recitation techniques.',
   'حفظ كامل للقرآن الكريم مع التجويد الصحيح وتقنيات التلاوة.', '📖', 'quran', 1),
  ('arabic-grammar', 'Arabic Grammar', 'النحو العربي', '2 years', 'سنتان',
   'Comprehensive study of Arabic grammar including Nahw and Sarf.',
   'دراسة شاملة للنحو العربي بما في ذلك النحو والصرف.', '✍️', 'arabic', 2),
  ('hadith-studies', 'Hadith Studies', 'دراسة الحديث', '1-2 years', '1-2 سنة',
   'Study of authentic Hadith collections including Sahih al-Bukhari and Muslim.',
   'دراسة مجموعات الأحاديث الصحيحة بما في ذلك صحيح البخاري ومسلم.', '📜', 'hadith', 3),
  ('islamic-jurisprudence', 'Islamic Jurisprudence (Fiqh)', 'الفقه الإسلامي', '1-2 years', '1-2 سنة',
   'Basic Islamic law and jurisprudence for daily life applications.',
   'الفقه الإسلامي الأساسي وتطبيقاته في الحياة اليومية.', '⚖️', 'fiqh', 4),
  ('islamic-studies', 'Islamic Studies', 'الدراسات الإسلامية', '1 year', 'سنة واحدة',
   'Comprehensive Islamic education including Aqeedah, Tafseer, and Islamic history.',
   'تعليم إسلامي شامل بما في ذلك العقيدة والتفسير والتاريخ الإسلامي.', '🕌', 'islamic', 5)
on conflict (slug) do nothing;

-- Seed gallery placeholders (no images until admin uploads)
insert into public.gallery_items (title_en, title_ar, category, sort_order)
select v.title_en, v.title_ar, v.category, v.sort_order
from (values
  ('Main Building', 'المبنى الرئيسي', 'facilities', 1),
  ('Classroom', 'الفصل الدراسي', 'facilities', 2),
  ('Quran Competition 2024', 'مسابقة القرآن 2024', 'events', 3),
  ('Graduation Ceremony', 'حفل التخرج', 'events', 4),
  ('Library', 'المكتبة', 'facilities', 5),
  ('Eid Celebration', 'احتفال العيد', 'events', 6)
) as v(title_en, title_ar, category, sort_order)
where not exists (select 1 from public.gallery_items limit 1);
