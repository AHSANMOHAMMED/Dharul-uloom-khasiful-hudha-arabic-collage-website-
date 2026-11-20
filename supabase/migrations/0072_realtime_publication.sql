-- Enable Realtime for application tables. Migrations that add tables before
-- this point may have predated Realtime setup or run against projects where
-- the supabase_realtime publication was not configured.

do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'notifications',
    'student_fees',
    'fee_invoices',
    'fee_receipts',
    'fee_payments',
    'attendance',
    'announcements',
    'leave_requests',
    'staff_leave_requests',
    'payslips',
    'chat_messages',
    'chat_conversations',
    'duties',
    'duty_assignments',
    'meetings',
    'meeting_tasks',
    'mashoora_records',
    'petty_cash_requests'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication does not exist';
    return;
  end if;

  foreach t in array tables
  loop
    if to_regclass(format('public.%I', t)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
