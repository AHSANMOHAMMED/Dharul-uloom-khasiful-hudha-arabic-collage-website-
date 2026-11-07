-- =============================================================================
-- 20240730000000_create_books_table.sql  (superseded — intentionally a no-op)
--
-- This file was an early stand-alone draft of the books table. The canonical
-- library schema (books, authors, categories, pages, FTS, RLS) is created by
-- 0001_init_schema.sql – 0004_storage.sql. Because this file's version sorts
-- after 0014, running it on a fresh database failed with
-- `relation "books" already exists`, breaking clean deploys.
--
-- It is kept (as a no-op) so that databases which already recorded this
-- version in supabase_migrations stay in sync. Its over-broad
-- "Public users can view books" policy (USING true — exposed non-public books)
-- is dropped by 0015_security_tenancy.sql if it was ever applied.
-- =============================================================================

select 1;
