import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let authState = {}
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }))

// Supabase is replaced per test through these handlers.
const rpcHandler = vi.fn()
const queryResult = { data: [], error: null }
vi.mock('../lib/supabaseClient', () => {
  const builder = () => {
    const b = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (res, rej) => Promise.resolve(queryResult).then(res, rej)
        if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: null, error: null })
        return () => b
      },
    })
    return b
  }
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: () => builder(),
      rpc: (name, params) => ({
        then: (res, rej) => Promise.resolve(rpcHandler(name, params)).then((data) => ({ data, error: null })).then(res, rej),
        range: async () => ({ data: [], error: null }),
      }),
      storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'blob:x' }, error: null }) }) },
    },
  }
})

const { sanitizeHtml } = await import('../lib/erp/documentsApi')
const { htmlToDocxBlob, docxToHtml } = await import('../lib/wordFiles')

describe('document HTML sanitising', () => {
  it('removes scripts, handlers, javascript: links, hot-linked images and CSS url()', () => {
    const out = sanitizeHtml(`
      <p onclick="steal()">Hi<script>alert(1)</script></p>
      <a href="javascript:alert(1)">x</a>
      <img src="https://evil.example/pixel.png">
      <img src="data:image/png;base64,iVBORw0KGgo=" alt="ok">
      <p style="background:url(https://evil.example/t)">styled</p>
      <p style="text-align:center">centred</p>
      <iframe src="https://evil.example"></iframe>`)
    expect(out).not.toMatch(/script|onclick|javascript:|evil\.example|iframe/i)
    expect(out).toContain('data:image/png;base64')
    expect(out).toContain('text-align:center')
    expect(out).toContain('styled')
  })
})

describe('Word interop', () => {
  it('exports HTML to a real .docx and imports it back', async () => {
    const blob = await htmlToDocxBlob({
      title: 'Test',
      html: '<h1>Notice</h1><p>Classes resume on <b>Monday</b>.</p><ol><li>Bring books</li></ol><table><tr><td>A</td><td>B</td></tr></table><p dir="rtl">السلام عليكم</p>',
      letterhead: null,
    })
    // jsdom's Blob has no arrayBuffer(); browsers do.
    const buf = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsArrayBuffer(blob)
    })
    expect(new Uint8Array(buf).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b])) // zip "PK"
    const file = new File([buf], 'notice.docx')
    file.arrayBuffer = async () => buf
    const html = await docxToHtml(file)
    expect(html).toContain('Notice')
    expect(html).toContain('<strong>Monday</strong>')
    expect(html).toContain('Bring books')
    expect(html).toContain('السلام عليكم')
  }, 20000)

  it('rejects non-docx files', async () => {
    await expect(docxToHtml(new File(['x'], 'a.doc'))).rejects.toThrow(/\.docx/)
  })
})

// ---------------------------------------------------------------------------
const { default: DocumentEditor } = await import('../components/erp/docs/DocumentEditor')
const { default: ChequesPanel } = await import('../components/erp/finance/ChequesPanel')

const paperDoc = { id: 'd1', title: 'Term 1 — Fiqh', kind: 'exam_paper', body_html: '<p>Q1</p>', version: 3, locked: false, letterhead_id: null, share_roles: [], share_users: [] }

beforeEach(() => {
  rpcHandler.mockReset()
  queryResult.data = []
})

describe('DocumentEditor', () => {
  it('shows a submitted exam paper read-only to its examiner and blocks sharing', async () => {
    authState = { user: { id: 'examiner-1' }, isAcademicAdmin: false, isItOfficer: false }
    rpcHandler.mockImplementation((name) => {
      if (name === 'open_document') return paperDoc
      if (name === 'can_edit_document') return false
      return null
    })
    render(<MemoryRouter><DocumentEditor docId="d1" onClose={() => {}} /></MemoryRouter>)
    expect(await screen.findByDisplayValue('Term 1 — Fiqh')).toBeDisabled()
    expect(screen.getByText(/Read only at this stage/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /document text/i })).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByRole('button', { name: /share file/i })).toBeDisabled()
    expect(screen.getByText(/cannot be sent outside the system/i)).toBeInTheDocument()
    expect(rpcHandler).toHaveBeenCalledWith('open_document', { p_doc: 'd1', p_action: 'viewed' })
  })

  it('lets the owner edit and save an ordinary letter', async () => {
    authState = { user: { id: 'u1' } }
    rpcHandler.mockImplementation((name) => {
      if (name === 'open_document') return { ...paperDoc, kind: 'letter', title: 'Letter to parents' }
      if (name === 'can_edit_document') return true
      return null
    })
    queryResult.data = [{ id: 'd1', version: 4, updated_at: '2026-11-08T10:00:00Z', locked: false }]
    render(<MemoryRouter><DocumentEditor docId="d1" onClose={() => {}} /></MemoryRouter>)
    const editor = await screen.findByRole('textbox', { name: /document text/i })
    await waitFor(() => expect(editor.innerHTML).toContain('Q1'))
    const save = screen.getByRole('button', { name: /^save$/i })
    expect(save).toBeDisabled()
    editor.innerHTML = '<p>Q1 edited</p>'
    fireEvent.input(editor)
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument()
    fireEvent.click(save)
    await waitFor(() => expect(screen.queryByText(/^unsaved$/i)).toBeNull())
  })
})

describe('ChequesPanel', () => {
  it('lists open cheques and records a bounce with the bank reason', async () => {
    authState = { isFinanceStaff: true, isFinanceViewer: true, isAdmin: false }
    queryResult.data = [
      { id: 'c1', direction: 'received', cheque_no: '000777', bank_name: 'BOC', amount: 5000, currency: 'LKR', cheque_date: '2026-01-01', party_name: 'Abdul Haleem', status: 'deposited' },
    ]
    rpcHandler.mockResolvedValue({ status: 'bounced', receipt_reversed: true })
    const prompts = vi.spyOn(window, 'prompt').mockReturnValueOnce('Insufficient funds').mockReturnValueOnce('2026-11-08')
    render(<MemoryRouter><ChequesPanel /></MemoryRouter>)
    expect(await screen.findByText('000777')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^bounced$/i }))
    await waitFor(() =>
      expect(rpcHandler).toHaveBeenCalledWith('update_cheque_status', { p_cheque: 'c1', p_status: 'bounced', p_on: '2026-11-08', p_note: 'Insufficient funds' })
    )
    prompts.mockRestore()
  })

  it('hides write actions from finance viewers who are not treasurer/accountant', async () => {
    authState = { isFinanceStaff: false, isFinanceViewer: true }
    queryResult.data = [
      { id: 'c1', direction: 'issued', cheque_no: '000123', bank_name: 'BOC', amount: 100, currency: 'LKR', cheque_date: '2026-01-01', party_name: 'Supplier', status: 'pending' },
    ]
    render(<MemoryRouter><ChequesPanel /></MemoryRouter>)
    expect(await screen.findByText('000123')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add cheque/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^cleared$/i })).toBeNull()
  })
})
