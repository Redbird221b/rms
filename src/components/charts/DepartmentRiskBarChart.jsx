import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useErm } from '../../app/context/ErmContext'
import { useI18n } from '../../app/context/I18nContext'
import EnterpriseTooltip from './EnterpriseTooltip'

export default function DepartmentRiskBarChart({ data }) {
  const { t, tr } = useI18n()
  const { theme } = useErm()
  const isDark = theme === 'dark'

  const chartData = data.map((item) => ({
    ...item,
    departmentLabel: tr('department', item.department),
  }))

  return (
    <div className="panel p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.chartDept')}</h3>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 4, right: 10, top: 8, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#2A416D' : '#D9D9D9'}
            />
            <XAxis
              dataKey="departmentLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: isDark ? '#9EB4E2' : '#6b7280' }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: isDark ? '#9EB4E2' : '#6b7280' }}
            />
            <Tooltip
              cursor={false}
              content={
                <EnterpriseTooltip
                  isDark={isDark}
                  labelFormatter={(value) => value}
                  valueFormatter={(value) => value}
                  valueLabel="Count"
                />
              }
            />
            <Bar dataKey="count" name="Count" fill="#0041B6" radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
