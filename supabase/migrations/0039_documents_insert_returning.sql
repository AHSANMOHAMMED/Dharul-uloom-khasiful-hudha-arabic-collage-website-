-- =============================================================================
-- 0039_documents_insert_returning.sql
-- Creating a document failed in the app with "new row violates row-level
-- security policy": PostgREST inserts with RETURNING, and the read policy
-- called can_read_document(id), which looks the row up by id in the
-- statement's snapshot — where the row being inserted is not yet visible.
-- The creator is always the owner, so check ownership on the row itself first.
-- =============================================================================

drop policy if exists "documents: read" on public.documents;
create policy "documents: read" on public.documents for select to authenticated
  using (
    (owner_id = (select auth.uid()) and org_id = (select public.current_org_id()) and (select public.mfa_ok()))
    or public.can_read_document(id)
  );
