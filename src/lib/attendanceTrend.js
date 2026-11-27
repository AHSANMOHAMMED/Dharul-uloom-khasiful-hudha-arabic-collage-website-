export function getAttendanceTrend(records, locale) {
  const months = new Map();
  for (const record of records || []) {
    const match = String(record.date || '').match(/^(\d{4})-(\d{2})/);
    if (!match) continue;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue;

    const key = `${year}-${String(month).padStart(2, '0')}`;
    const current = months.get(key) || { sessions: 0, present: 0 };
    current.sessions += 1;
    if (record.status === 'present' || record.status === 'late') current.present += 1;
    months.set(key, current);
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, counts]) => {
      const [year, month] = key.split('-').map(Number);
      const date = new Date(year, month - 1, 15);
      return {
        month: key,
        label: new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(date),
        sessions: counts.sessions,
        rate: Math.round((counts.present / counts.sessions) * 100),
      };
    });
}
