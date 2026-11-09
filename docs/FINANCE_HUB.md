# Finance Hub

Billing jobs, unified finance documents (fees / donations / sadaqah / sales / quotations), amend-with-reason, and WhatsApp/SMS public links.

## Entry points
- ERP module: `/erp?module=financehub` (accountants, finance viewers, super admin via acting org)
- Super Admin sidebar → **Finance hub** (sets acting org then opens ERP)
- Mobile: `/finance-hub` (staff) and Super Admin **Finance** section on `/platform`

## Document types
`fee_invoice`, `donation`, `sadaqah`, `sale`, `bill`, `quotation`, `receipt`

## Public share links
- Quotation: `/q/{public_token}`
- Bill / donation / sale: `/b/{public_token}`
- Fee receipts (existing): `/r/{token}`

## Privilege notes
- Create / issue / amend / void: finance staff, admin, principal/VP, super admin
- Hard delete voided finance documents: **super admin only** (`hard_delete_finance_document`)
- Amendments and voids require a non-empty reason and write `audit_logs`
