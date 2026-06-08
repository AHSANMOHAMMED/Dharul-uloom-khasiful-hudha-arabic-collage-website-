-- =============================================================================
-- 0011_library_seed.sql
-- Sample categories, authors, books, and reader pages for the digital library.
-- Idempotent — safe to re-run.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- Categories
insert into public.categories (name_ar, name_en, slug, sort_order)
values
  ('الحديث', 'Hadith', 'hadith', 1),
  ('التفسير', 'Tafsir', 'tafsir', 2),
  ('الفقه', 'Fiqh', 'fiqh', 3),
  ('العقيدة', 'Aqidah', 'aqidah', 4),
  ('السيرة', 'Seerah', 'seerah', 5),
  ('التزكية', 'Spirituality', 'tazkiyah', 6)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order;

-- Authors
insert into public.authors (shamela_id, name_ar, name_en, death_year)
values
  (800001, 'الإمام النووي', 'Imam al-Nawawi', 676),
  (800002, 'الإمام البخاري', 'Imam al-Bukhari', 256),
  (800003, 'ابن كثير', 'Ibn Kathir', 774),
  (800004, 'الإمام الغزالي', 'Imam al-Ghazali', 505),
  (800005, 'ابن القيم', 'Ibn al-Qayyim', 751)
on conflict (shamela_id) do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  death_year = excluded.death_year;

-- Resolve IDs (stable via slug / name)
do $$
declare
  v_hadith bigint;
  v_tafsir bigint;
  v_fiqh bigint;
  v_aqidah bigint;
  v_seerah bigint;
  v_tazkiyah bigint;
  v_nawawi bigint;
  v_bukhari bigint;
  v_ibn_kathir bigint;
  v_ghazali bigint;
  v_ibn_qayyim bigint;
  v_book1 uuid;
  v_book2 uuid;
  v_book3 uuid;
  v_book4 uuid;
  v_book5 uuid;
  v_book6 uuid;
begin
  select id into v_hadith from public.categories where slug = 'hadith';
  select id into v_tafsir from public.categories where slug = 'tafsir';
  select id into v_fiqh from public.categories where slug = 'fiqh';
  select id into v_aqidah from public.categories where slug = 'aqidah';
  select id into v_seerah from public.categories where slug = 'seerah';
  select id into v_tazkiyah from public.categories where slug = 'tazkiyah';

  select id into v_nawawi from public.authors where shamela_id = 800001;
  select id into v_bukhari from public.authors where shamela_id = 800002;
  select id into v_ibn_kathir from public.authors where shamela_id = 800003;
  select id into v_ghazali from public.authors where shamela_id = 800004;
  select id into v_ibn_qayyim from public.authors where shamela_id = 800005;

  insert into public.books (shamela_id, title_ar, title_en, description, language, year, pages, is_public, tags, author_id, category_id, full_text)
  values
    (900001, 'رياض الصالحين', 'Riyad al-Salihin',
     'مختارات من الأحاديث النبوية الشريفة في الأخلاق والآداب.',
     'ar', 676, 1200, true, array['hadith','akhlaq'],
     v_nawawi, v_hadith,
     'باب الإخلاص وإحضار النية. إنما الأعمال بالنيات.'),
    (900002, 'صحيح البخاري — مختارات', 'Sahih al-Bukhari (Selections)',
     'مختارات من صحيح الإمام البخاري.',
     'ar', 256, 800, true, array['hadith','sahih'],
     v_bukhari, v_hadith,
     'قال رسول الله صلى الله عليه وسلم: إنما الأعمال بالنيات.'),
    (900003, 'تفسير آية الكرسي', 'Tafsir Ayat al-Kursi',
     'شرح موجز لآية الكرسي من سورة البقرة.',
     'ar', 774, 48, true, array['tafsir','quran'],
     v_ibn_kathir, v_tafsir,
     'الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم.'),
    (900004, 'أحكام الوضوء', 'Rules of Wudu',
     'خلاصة في أحكام الوضوء للمبتدئين.',
     'ar', 505, 64, true, array['fiqh','taharah'],
     v_ghazali, v_fiqh,
     'الوضوء شرط لصحة الصلاة. يبدأ بالنية ثم غسل الوجه.'),
    (900005, 'أصول الإيمان', 'Foundations of Faith',
     'بيان أركان الإيمان الستة للطلاب.',
     'ar', 751, 72, true, array['aqidah','iman'],
     v_ibn_qayyim, v_aqidah,
     'الإيمان قول وعمل واعتقاد. يزيد وينقص.'),
    (900006, 'غزوة بدر', 'Battle of Badr',
     'ملخص تاريخي لغزوة بدر الكبرى.',
     'ar', 774, 56, true, array['seerah','history'],
     v_ibn_kathir, v_seerah,
     'كانت غزوة بدر أول معركة فاصلة في الإسلام.'),
    (900099, 'كتاب خاص — للمو Staff فقط', 'Staff-only sample book',
     'كتاب غير عام لاختبار صلاحيات RLS.',
     'ar', 2026, 10, false, array['internal'],
     v_nawawi, v_tazkiyah,
     'هذا الكتاب خاص ولا يظهر للزوار.')
  on conflict (shamela_id) do update set
    title_ar = excluded.title_ar,
    title_en = excluded.title_en,
    description = excluded.description,
    is_public = excluded.is_public,
    author_id = excluded.author_id,
    category_id = excluded.category_id,
    full_text = excluded.full_text;

  select id into v_book1 from public.books where shamela_id = 900001;
  select id into v_book2 from public.books where shamela_id = 900002;
  select id into v_book3 from public.books where shamela_id = 900003;
  select id into v_book4 from public.books where shamela_id = 900004;
  select id into v_book5 from public.books where shamela_id = 900005;
  select id into v_book6 from public.books where shamela_id = 900006;

  -- Reader pages for Riyad al-Salihin
  delete from public.book_pages where book_id = v_book1;
  insert into public.book_pages (book_id, page_index, page_label, part, content) values
    (v_book1, 0, '1', 'مقدمة', 'بسم الله الرحمن الرحيم. الحمد لله رب العالمين، والصلاة والسلام على رسول الله صلى الله عليه وسلم.'),
    (v_book1, 1, '2', 'باب الإخلاص', 'عن أمير المؤمنين أبي حفص عمر بن الخطاب رضي الله عنه قال: سمعت رسول الله صلى الله عليه وسلم يقول: «إنما الأعمال بالنيات».'),
    (v_book1, 2, '3', 'باب الإخلاص', 'وعن عائشة رضي الله عنها أن رسول الله صلى الله عليه وسلم قال: «من أحدث في أمرنا هذا ما ليس منه فهو رد».'),
    (v_book1, 3, '4', 'باب الصدق', 'عن عبد الله بن مسعود رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «عليكم بالصدق فإن الصدق يهدي إلى البر».');

  -- Reader pages for Tafsir sample
  delete from public.book_pages where book_id = v_book3;
  insert into public.book_pages (book_id, page_index, page_label, part, content) values
    (v_book3, 0, '1', 'آية الكرسي', '﴿ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ﴾'),
    (v_book3, 1, '2', 'شرح', '«الحي القيوم»: الحي الذي لا يموت، القيوم الذي قام بنفسه وقام بكل شيء.'),
    (v_book3, 2, '3', 'فضل', 'من قرأ آية الكرسي عند النوم لم يزل عليه من الله حافظ.');

  -- Short pages for other public books
  delete from public.book_pages where book_id in (v_book2, v_book4, v_book5, v_book6);
  insert into public.book_pages (book_id, page_index, page_label, part, content) values
    (v_book2, 0, '1', 'مقدمة', 'الحمد لله الذي أنزل على عبده الكتاب ولم يجعل له عوجاً.'),
    (v_book2, 1, '2', 'كتاب الإيمان', 'باب: كيف كان بدء الوحي إلى رسول الله صلى الله عليه وسلم.'),
    (v_book4, 0, '1', 'الوضوء', 'الوضوء: غسل الوجه واليدين إلى المرفقين ومسح الرأس وغسل الرجلين.'),
    (v_book5, 0, '1', 'الإيمان', 'تؤمن بالله وملائكته وكتبه ورسله واليوم الآخر والقدر خيره وشره.'),
    (v_book6, 0, '1', 'بدر', 'خرج رسول الله صلى الله عليه وسلم يطلب عير قريش فتحول الأمر إلى بدر.');
end $$;
