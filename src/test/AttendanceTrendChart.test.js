import { describe, expect, it } from 'vitest';
import { getAttendanceTrend } from '../lib/attendanceTrend';

describe('getAttendanceTrend', () => {
  it('groups presence by month, counts late sessions, and keeps the latest six months with data', () => {
    const records = [
      { date: '2024-12-01', status: 'absent' },
      { date: '2025-01-04', status: 'present' },
      { date: '2025-01-11', status: 'late' },
      { date: '2025-02-02', status: 'absent' },
      { date: '2025-03-02', status: 'present' },
      { date: '2025-04-02', status: 'present' },
      { date: '2025-05-02', status: 'present' },
      { date: '2025-06-02', status: 'present' },
      { date: '2025-07-02', status: 'present' },
      { date: 'invalid-date', status: 'present' },
    ];

    const rows = getAttendanceTrend(records, 'en');

    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.month)).toEqual([
      '2025-02',
      '2025-03',
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
    ]);
    expect(rows[0]).toMatchObject({ sessions: 1, rate: 0 });
    expect(getAttendanceTrend(records.slice(1, 3), 'en')[0]).toMatchObject({ month: '2025-01', sessions: 2, rate: 100 });
  });

  it('returns no chart rows when attendance dates are invalid', () => {
    expect(getAttendanceTrend([{ date: '2025-13-01', status: 'present' }], 'en')).toEqual([]);
  });
});
