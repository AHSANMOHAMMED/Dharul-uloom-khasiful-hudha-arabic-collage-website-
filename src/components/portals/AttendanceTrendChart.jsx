import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, ChartTooltip, GRID, Legend, SERIES, axisProps } from '../erp/ops/common';
import { Card, EmptyState, Table, useLang } from '../erp/ui';
import { getAttendanceTrend } from '../../lib/attendanceTrend';

export default function AttendanceTrendChart({ records = [] }) {
  const { t, lang } = useLang();
  const rows = useMemo(() => getAttendanceTrend(records, lang), [records, lang]);

  if (!rows.length) {
    return (
      <Card title={t('Attendance trend', 'اتجاه الحضور')}>
        <EmptyState text={t('No attendance history is available yet.', 'لا يتوفر سجل حضور بعد.')} />
      </Card>
    );
  }

  const table = (
    <Table
      rows={rows}
      rowKey="month"
      columns={[
        { key: 'label', label: t('Month', 'الشهر') },
        { key: 'sessions', label: t('Sessions', 'الجلسات'), className: 'text-end' },
        { key: 'rate', label: t('Attendance', 'الحضور'), render: (row) => `${row.rate}%`, className: 'text-end tabular-nums' },
      ]}
    />
  );

  return (
    <ChartCard
      title={t('Attendance trend', 'اتجاه الحضور')}
      subtitle={t('Monthly presence rate for the latest 6 months with recorded sessions.', 'نسبة الحضور الشهرية لآخر ٦ أشهر مسجلة.')}
      height={230}
      table={table}
      legend={<Legend line items={[{ label: t('Present or late', 'حاضر أو متأخر'), color: SERIES[0] }]} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            width={48}
            {...axisProps}
          />
          <Tooltip content={<ChartTooltip format={(value) => `${Math.round(value)}%`} />} />
          <Line
            type="monotone"
            dataKey="rate"
            name={t('Attendance rate', 'نسبة الحضور')}
            stroke={SERIES[0]}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 2, fill: '#FFFFFF' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
