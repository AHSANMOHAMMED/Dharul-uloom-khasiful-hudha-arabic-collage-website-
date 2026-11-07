# Role & RLS matrix (HRM / portal)

| Capability | Student | Parent | Tutor | Treasurer | Principal/VP | Librarian | Admin |
|---|---|---|---|---|---|---|---|
| Public content read | yes | yes | yes | yes | yes | yes | yes |
| Own profile | yes | yes | yes | yes | yes | yes | yes |
| Approve signups | — | — | — | — | tutors | — | all |
| CRM admissions | — | — | — | — | view | — | full |
| Staff HR records | — | — | self read | — | — | — | full |
| Fees / PayHere | own | child | — | manage | overview | — | full |
| LMS class | own class | child | own class | — | — | — | full |
| Library catalog | read | read | read | read | read | manage | manage |
| message_outbox | — | — | — | — | — | read | read |
| organizations | — | — | — | — | — | — | manage* |

\* Multi-tenant org management lands after `org_id` backfill; default org is `kashiful-hudha`.

Policies live in `supabase/migrations/0002_rls.sql`, `0006_role_based_portal.sql`, `0012_messaging_receipts.sql`, `0013_crm_hrm_saas.sql`.
