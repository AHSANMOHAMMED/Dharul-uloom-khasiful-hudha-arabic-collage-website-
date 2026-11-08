import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ExcelJS from 'exceljs'
import { normalizeHeader, parseCsv, readSpreadsheet } from '../lib/spreadsheet'
import { pivotResults, totalsFor } from '../lib/erp/reportsApi'
import { formatCell, printTable } from '../lib/printReport'

describe('spreadsheet parsing', () => {
  it('normalises headers', () => {
    expect(normalizeHeader(' Date of Birth ')).toBe('date_of_birth')
    expect(normalizeHeader('INDEX-NUMBER')).toBe('index_number')
  })

  it('parses quoted CSV with commas, quotes, newlines and a BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\n"multi\nline",2\n')
    expect(rows).toEqual([['a', 'b'], ['x, y', 'he said "hi"'], ['multi\nline', '2']])
  })

  it('reads an .xlsx file: dates as YYYY-MM-DD, phone numbers keep leading zero, blank rows dropped', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('S')
    ws.addRow(['Index Number', 'Full Name', 'date_of_birth', 'phone'])
    ws.addRow(['KH-1', 'محمد', new Date(Date.UTC(2014, 2, 5)), '0771234567'])
    ws.addRow([])
    ws.addRow(['KH-2', 'Ali', '', ''])
    const buf = await wb.xlsx.writeBuffer()
    const file = new File([buf], 'students.xlsx')
    file.arrayBuffer = async () => buf
    const { headers, rows } = await readSpreadsheet(file)
    expect(headers).toEqual(['index_number', 'full_name', 'date_of_birth', 'phone'])
    expect(rows).toEqual([
      { index_number: 'KH-1', full_name: 'محمد', date_of_birth: '2014-03-05', phone: '0771234567' },
      { index_number: 'KH-2', full_name: 'Ali', date_of_birth: '', phone: '' },
    ])
  })

  it('rejects other file types', async () => {
    await expect(readSpreadsheet(new File(['x'], 'a.pdf'))).rejects.toThrow(/xlsx or \.csv/)
  })
})

describe('report helpers', () => {
  it('pivots results into a ranked mark sheet', () => {
    const { subjects, students } = pivotResults([
      { index_number: 'A', full_name: 'A', subject_code: 'QUR', subject: 'Quran', marks_obtained: 40, max_marks: 50 },
      { index_number: 'A', full_name: 'A', subject_code: 'ARB', subject: 'Arabic', marks_obtained: 80, max_marks: 100 },
      { index_number: 'B', full_name: 'B', subject_code: 'QUR', subject: 'Quran', marks_obtained: 50, max_marks: 50 },
      { index_number: 'B', full_name: 'B', subject_code: 'ARB', subject: 'Arabic', marks_obtained: 75, max_marks: 100 },
      { index_number: 'C', full_name: 'C', subject_code: 'QUR', subject: 'Quran', marks_obtained: 40, max_marks: 50 },
      { index_number: 'C', full_name: 'C', subject_code: 'ARB', subject: 'Arabic', marks_obtained: 80, max_marks: 100 },
    ])
    expect(subjects.map((s) => s.code)).toEqual(['QUR', 'ARB'])
    const a = students.find((s) => s.index_number === 'A')
    const b = students.find((s) => s.index_number === 'B')
    expect(a).toMatchObject({ sub_QUR: 40, sub_ARB: 80, total: 120, average_pct: 80, rank: 2 })
    const c = students.find((x) => x.index_number === 'C')
    expect(b).toMatchObject({ total: 125, rank: 1 })
    expect(c.rank).toBe(2) // ties share a rank
  })

  it('sums totals', () => {
    expect(totalsFor([{ paid: '10.5' }, { paid: 2 }], ['paid'])).toEqual({ paid: 12.5 })
    expect(totalsFor([{ paid: 1 }])).toBeNull()
  })

  it('formats cells', () => {
    expect(formatCell(null)).toBe('—')
    expect(formatCell(12.5, 'percent')).toBe('12.5%')
    expect(formatCell('2026-01-02T10:00:00Z', 'date')).toBe('2026-01-02')
  })

  it('escapes HTML in printed reports', () => {
    const doc = { open: vi.fn(), write: vi.fn(), close: vi.fn() }
    const spy = vi.spyOn(window, 'open').mockReturnValue({ document: doc })
    printTable({ title: 'T', columns: [{ key: 'n', label: 'Name' }], rows: [{ n: '<script>alert(1)</script>' }] })
    const html = doc.write.mock.calls[0][0]
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)')
    spy.mockRestore()
  })

  it('explains blocked pop-ups', () => {
    const spy = vi.spyOn(window, 'open').mockReturnValue(null)
    expect(() => printTable({ title: 'T', columns: [], rows: [] })).toThrow(/pop-ups/)
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Panels (backend mocked)
// ---------------------------------------------------------------------------
let authState = {}
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }))
// Fake Supabase client: rpc(name, params) supports .range() paging (set-returning
// report RPCs) and direct await (JSON-returning import RPCs).
let rpcRows = []
const rpcJson = vi.fn()
const rpcCalls = []
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (name, params) => {
      rpcCalls.push([name, params])
      return {
        range: async (from, to) => ({ data: rpcRows.slice(from, to + 1), error: null }),
        then: (res, rej) => Promise.resolve(rpcJson(name, params)).then((data) => ({ data, error: null })).then(res, rej),
      }
    },
  },
}))
vi.mock('../lib/erp/rpc', async (orig) => ({ ...(await orig()), query: async () => [] }))
const exportXlsx = vi.fn(async () => {})
vi.mock('../lib/spreadsheet', async (orig) => ({ ...(await orig()), exportXlsx: (...a) => exportXlsx(...a) }))

const { default: ReportsPanel } = await import('../components/erp/ops/ReportsPanel')
const { default: ImportPanel } = await import('../components/erp/ops/ImportPanel')

beforeEach(() => {
  rpcRows = []
  rpcCalls.length = 0
  rpcJson.mockReset()
  exportXlsx.mockClear()
})

describe('ReportsPanel', () => {
  it('shows only reports allowed for the role, runs one and exports every row', async () => {
    authState = { isEmployee: true, isFinanceViewer: false, isAdmin: false, user: { username: 'Ustadh' } }
    // 2,450 rows: more than two server pages, so paging must fetch all of them.
    rpcRows = Array.from({ length: 2450 }, (_, i) => ({ index_number: `KH-${i}`, full_name: `S${i}`, class_number: 1 }))
    render(<MemoryRouter><ReportsPanel /></MemoryRouter>)
    expect(screen.queryByText(/Fee collection/)).toBeNull()
    expect(screen.queryByText(/Staff directory/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /run report/i }))
    await waitFor(() => expect(rpcCalls[0]).toEqual(['report_student_roster', { p_class: null, p_status: null }]))
    expect(await screen.findByText(/first 200 rows/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^excel$/i }))
    await waitFor(() => expect(exportXlsx).toHaveBeenCalled())
    expect(exportXlsx.mock.calls[0][0].sheets[0].rows).toHaveLength(2450)
    expect(rpcCalls).toHaveLength(3)
  })
})

describe('ImportPanel', () => {
  it('validates on the server, blocks import while rows have errors, then commits', async () => {
    authState = { isAdmin: true, isEmployee: true, isHrStaff: true }
    render(<MemoryRouter><ImportPanel /></MemoryRouter>)
    const csv = 'index_number,full_name,class_number,shoe_size\nKH-1,Ali,1,42\nKH-2,Omar,9,40\n'
    const file = new File([csv], 'students.csv', { type: 'text/csv' })
    file.text = async () => csv
    fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [file] } })
    expect(await screen.findByText(/not recognised/i)).toHaveTextContent('shoe_size')

    rpcJson.mockResolvedValueOnce({
      total: 2, errors: 1, created: 1, updated: 0, committed: false,
      rows: [
        { row: 1, key: 'KH-1', name: 'Ali', action: 'create', errors: [] },
        { row: 2, key: 'KH-2', name: 'Omar', action: 'error', errors: ['class_number must be 1-7'] },
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: /check rows/i }))
    await waitFor(() =>
      expect(rpcJson).toHaveBeenCalledWith('import_students', {
        p_rows: [{ index_number: 'KH-1', full_name: 'Ali', class_number: '1' }, { index_number: 'KH-2', full_name: 'Omar', class_number: '9' }],
        p_commit: false,
      })
    )
    expect(await screen.findByText('class_number must be 1-7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^import/i })).toBeDisabled()
  })

  it('reports missing required columns', async () => {
    authState = { isAdmin: true, isEmployee: true }
    render(<MemoryRouter><ImportPanel /></MemoryRouter>)
    const csv = 'full_name\nAli\n'
    const file = new File([csv], 's.csv')
    file.text = async () => csv
    fireEvent.change(document.querySelector('input[type=file]'), { target: { files: [file] } })
    expect(await screen.findByText(/Missing required columns/i)).toHaveTextContent('index_number, class_number')
  })
})
