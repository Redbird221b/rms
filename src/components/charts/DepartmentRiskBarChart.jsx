import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useErm } from '../../app/context/ErmContext'
import { useI18n } from '../../app/context/I18nContext'
import EnterpriseTooltip from './EnterpriseTooltip'

export default function DepartmentRiskBarChart({ data }) {
  const { t, tr } = useI18n()
  const { theme } = useErm()
  const isDark = theme === 'dark'
  const hasData = data.some((item) => Number(item?.count || 0) > 0)

  const chartData = data.map((item) => ({
    ...item,
    departmentLabel: tr('department', item.department),
  }))

  return (
    <div className="panel rounded-[22px] p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.chartDept')}</h3>
      {hasData ? (
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
      ) : (
        <div className="mt-3 flex min-h-[260px] items-center justify-center rounded-[18px] border border-dashed border-[#D9E3F2] bg-[#FAFBFE] px-6 text-center dark:border-[#29497B] dark:bg-[#10203D]">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Нет данных по подразделениям</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Диаграмма заполнится после появления активных рисков в реестре.</p>
          </div>
        </div>
      )}
    </div>
  )
}
