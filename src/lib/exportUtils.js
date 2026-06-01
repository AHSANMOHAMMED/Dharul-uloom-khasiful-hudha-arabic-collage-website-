/**
 * exportUtils.js
 * Utility functions for data export: CSV download and printable fee receipts.
 */

// ── CSV Export ────────────────────────────────────────────────────────────────

/**
 * Convert an array of objects to a CSV string and trigger a browser download.
 * @param {Array<Object>} data   - Array of flat objects (rows)
 * @param {string}        filename - e.g. "fee_report_2026-06.csv"
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        // Wrap in quotes if value contains comma, quote, or newline
        const str = String(val).replace(/"/g, '""');
        return /[",\n]/.test(str) ? `"${str}"` : str;
      }).join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Fee Receipt Generator ─────────────────────────────────────────────────────

/**
 * Generate a printable fee receipt in a new browser window.
 * @param {Object} student  - { full_name, index_number, class_number }
 * @param {Object} fee      - { month, total_due, paid_amount, status, payments[] }
 * @param {string} receivedBy - Name of treasurer who issued receipt
 */
export function generateFeeReceipt(student, fee, receivedBy = 'Treasurer') {
  const remaining = (fee.total_due - fee.paid_amount).toFixed(2);
  const now = new Date();
  const receiptNo = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-5)}`;

  const paymentRows = (fee.payments || [])
    .map(
      (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
        <td style="text-align:right;">LKR ${Number(p.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
        <td>${p.note || '—'}</td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Fee Receipt — ${student.full_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 700px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a5c38; padding-bottom: 16px; margin-bottom: 24px; }
    .college-name { font-size: 20px; font-weight: 900; color: #1a5c38; }
    .college-sub { font-size: 11px; color: #555; margin-top: 2px; }
    .arabic { font-size: 22px; color: #c9a227; font-weight: bold; direction: rtl; }
    .receipt-title { text-align: center; font-size: 18px; font-weight: 700; color: #1a5c38; margin-bottom: 20px; letter-spacing: 2px; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f7faf8; border: 1px solid #d4e8dc; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px; }
    .meta-label { color: #666; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    .meta-value { color: #111; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th { background: #1a5c38; color: #fff; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #f9fafb; }
    .totals { border-top: 2px solid #1a5c38; padding-top: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 13px; }
    .total-row { display: flex; gap: 24px; }
    .total-row span:first-child { color: #666; min-width: 140px; text-align: right; }
    .total-row span:last-child { font-weight: 700; min-width: 80px; text-align: right; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .status-completed { background: #d1fae5; color: #065f46; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-unpaid { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid #999; width: 160px; margin: 32px auto 4px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="college-name">Dharul Uloom Kashiful Hudha</div>
      <div class="college-sub">Arabic College · Kalpitiya, Sri Lanka</div>
    </div>
    <div class="arabic">دار العلوم كاشف الهدى</div>
  </div>

  <div class="receipt-title">📄 Fee Payment Receipt</div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Receipt No.</div>
      <div class="meta-value">${receiptNo}</div>
    </div>
    <div>
      <div class="meta-label">Issue Date</div>
      <div class="meta-value">${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
    <div>
      <div class="meta-label">Student Name</div>
      <div class="meta-value">${student.full_name}</div>
    </div>
    <div>
      <div class="meta-label">Index Number</div>
      <div class="meta-value" style="font-family:monospace;">${student.index_number || '—'}</div>
    </div>
    <div>
      <div class="meta-label">Class</div>
      <div class="meta-value">Class ${student.class_number || '—'}</div>
    </div>
    <div>
      <div class="meta-label">Billing Month</div>
      <div class="meta-value">${fee.month}</div>
    </div>
  </div>

  <span class="status-badge status-${fee.status}">${fee.status}</span>

  ${fee.payments && fee.payments.length > 0 ? `
  <table>
    <thead>
      <tr><th>#</th><th>Payment Date</th><th>Amount (LKR)</th><th>Note</th></tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>` : '<p style="color:#888;font-size:13px;margin-bottom:16px;">No payment records logged yet.</p>'}

  <div class="totals">
    <div class="total-row"><span>Total Due:</span><span>LKR ${Number(fee.total_due).toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
    <div class="total-row"><span>Total Paid:</span><span style="color:#065f46;">LKR ${Number(fee.paid_amount).toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
    <div class="total-row"><span style="font-weight:700;color:#1a1a1a;">Balance Remaining:</span><span style="color:${remaining > 0 ? '#991b1b' : '#065f46'};">LKR ${remaining}</span></div>
  </div>

  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div><strong>${receivedBy}</strong></div>
      <div style="color:#aaa;">Treasurer / Finance Officer</div>
    </div>
    <div style="text-align:right;max-width:200px;">
      <div style="font-weight:700;color:#1a5c38;">Dharul Uloom Kashiful Hudha</div>
      <div>This is a computer-generated receipt.</div>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:32px;">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a5c38;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">🖨 Print Receipt</button>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=750,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── Attendance CSV Export helper ──────────────────────────────────────────────

/**
 * Export student attendance records to CSV.
 * @param {Array} records - from supabase attendance table
 * @param {string} studentName
 */
export function exportAttendanceCSV(records, studentName = 'student') {
  const data = records.map((r) => ({
    Date: r.date,
    Status: r.status,
    'Excuse Note': r.excuse_note || '',
  }));
  exportToCSV(data, `attendance_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export fee records to CSV.
 * @param {Array} records - from supabase student_fees table (joined with student name)
 */
export function exportFeesCSV(records, filename = 'fee_report') {
  const data = records.map((r) => ({
    'Student Name': r.profiles?.full_name || r.student_name || '',
    'Index Number': r.profiles?.index_number || '',
    Month: r.month,
    'Total Due (LKR)': r.total_due,
    'Paid (LKR)': r.paid_amount,
    'Balance (LKR)': (r.total_due - r.paid_amount).toFixed(2),
    Status: r.status,
  }));
  exportToCSV(data, `${filename}_${new Date().toISOString().slice(0, 7)}.csv`);
}

/**
 * Export student results to CSV.
 */
export function exportResultsCSV(records) {
  const data = records.map((r) => ({
    Student: r.profiles?.full_name || '',
    Class: r.profiles?.class_number || '',
    Exam: r.exam_name,
    Subject: r.subject,
    'Marks Obtained': r.marks_obtained,
    'Max Marks': r.max_marks,
    'Percentage (%)': ((r.marks_obtained / r.max_marks) * 100).toFixed(1),
    Grade: r.grade,
    Remarks: r.remarks || '',
  }));
  exportToCSV(data, `results_${new Date().toISOString().slice(0, 10)}.csv`);
}
