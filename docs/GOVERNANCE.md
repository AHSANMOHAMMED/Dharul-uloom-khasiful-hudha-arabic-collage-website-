# Governance: duties, mashoora, petty cash, tasks

Migration `0022_governance_duties_mashoora.sql`. ERP modules: **Duties**, **Mashoora**, **Petty cash**, **Tasks**
(web `/erp`, mobile *More → Duties / Tasks / Mashoora*). All screens are English / Arabic / Tamil.

## Yearly duties decided at the mashoora

1. Record the **annual mashoora** (ERP → Mashoora → new meeting, type *annual*).
2. At year end, **Duties → Year-end rotation** ends every active duty (`close_duty_year`). Nothing is deleted.
3. In the meeting, **Assign duties**: each duty (student leave, food, electrical, cleaning, maintenance, hostel,
   exams, library, discipline, masjid, events, sports, transport, admissions — editable catalog with
   English/Arabic/Tamil names) goes to a lecturer/staff member (`assign_duty`, linked to the meeting and academic year).
   Handing a duty to someone else mid-year ends the previous holder automatically; a co-holder can be added.
4. **History** (`duty_history`): for every duty, every holder with period, the mashoora that decided it,
   petty cash topped up / spent / pending / returned, purchases made through expense claims, and tasks completed.

Duty holders get the related powers automatically — e.g. the *Student leave* and *Discipline* holders can
approve student leave requests (`grants_leave_review`).

## Petty cash per duty

| Step | Who | Ledger |
|---|---|---|
| Top-up | treasurer / accountant (`petty_cash_topup`, within the fund limit) | Dr 1050 Petty Cash / Cr 1000 Cash or 1010 Bank |
| Spend (receipt) | the **current duty holder** (`petty_cash_spend`, cannot exceed the available balance) | — (submitted) |
| Approve / reject | accountant / admin, not the person who submitted (`review_petty_cash`) | Dr expense / Cr 1050 |
| Return unused cash | treasurer / accountant (`petty_cash_return`) | Dr 1000 / Cr 1050 |

Every entry stores the holder **at that moment**, so when the duty passes to the next lecturer the previous
lecturer's spending stays in their history. Larger purchases go through *Expenses* tagged with the duty.

## Weekly mashoora tasks (Kanban)

Columns: **To do → In progress → Review → Done**. The principal / admins assign tasks at the weekly mashoora
(`create_meeting_tasks`) or anytime. The assignee moves the card; when finished they move it to *Review* and the
person who assigned it marks it *Done* (enforced in the database). Comments and a full status history are kept;
assignees are notified (push) on assignment and the assigner on review. Lecturers can also keep their own tasks.

## Super admin: central control

The platform operator (super admin) can **Manage this institution** from *SaaS Platform* (`set_acting_org`) and then
works inside that college with full admin rights (duties, finance, academics…). A banner shows the institution
being managed and *Exit* returns to the platform view.

## Admissions: date of birth

The form takes a **date of birth**; the age is calculated (institution timezone) and must be within the
institution's limits — defaults 5–25, change per college:

```sql
update organizations set settings = settings || '{"admission_min_age":5,"admission_max_age":20}' where slug = 'kashiful-hudha';
```

Guest applications (`submit_public_admission`) now go straight into the Admissions CRM (stage *submitted*,
source *website*) and notify the admissions staff; duplicates within 10 minutes and invalid phone numbers are rejected.

Tests: section 11d of `supabase/tests/rls_erp_test.sql`.
