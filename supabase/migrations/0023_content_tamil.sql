-- =============================================================================
-- 0023_content_tamil.sql
-- Tamil versions of public website content (news, faculty, courses, gallery).
-- Curriculum keeps its JSONB { en, ar } objects — add a "ta" key the same way.
-- The site falls back to English when a Tamil field is empty.
-- =============================================================================
alter table public.news            add column if not exists title_ta text, add column if not exists content_ta text;
alter table public.faculty         add column if not exists name_ta text, add column if not exists role_ta text, add column if not exists bio_ta text;
alter table public.course_programs add column if not exists title_ta text, add column if not exists duration_ta text,
                                   add column if not exists description_ta text;
alter table public.gallery_items   add column if not exists title_ta text;
