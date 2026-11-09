import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { auditUntranslated, loadAllowlist, withoutAllowed } from '../../scripts/i18n/auditUntranslated.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Owned by another engineer (governance work in progress) — audited separately.
const EXCLUDED = new Set([
  'src/pages/erp/ErpWorkspace.jsx',
  'src/components/erp/campus/PlatformPanel.jsx',
  'src/components/erp/finance/ExpensesPanel.jsx',
  'src/components/erp/campus/MySelfServicePanel.jsx',
  // Platform operator console is English + LTR by design (see the file header).
  'src/pages/SuperAdminConsole.jsx',
])

describe('every UI string can be shown in English, Arabic and Tamil', () => {
  const allowlist = loadAllowlist(ROOT)

  it('allow-list entries are justified', () => {
    for (const a of allowlist) {
      expect(a.file && a.text && a.reason, JSON.stringify(a)).toBeTruthy()
    }
  })

  it('the audit finds nothing untranslatable', () => {
    const findings = withoutAllowed(auditUntranslated(ROOT), allowlist).filter((f) => !EXCLUDED.has(f.file))
    expect(findings.map((f) => `${f.file}:${f.line} ${f.kind} ${f.text || ''}`.trim())).toEqual([])
  }, 60000)
})
