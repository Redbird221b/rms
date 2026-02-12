import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../app/context/I18nContext'

export default function DepartmentRiskBarChart({ data }) {
  const { t, tr } = useI18n()

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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D9D9D9" />
            <XAxis dataKey="departmentLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{
                borderRadius: '0.65rem',
                border: '1px solid #D9D9D9',
                backgroundColor: '#ffffff',
              }}
            />
            <Bar dataKey="count" fill="#0041B6" radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
