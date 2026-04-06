import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useErm } from '../../app/context/ErmContext'
import { formatCompactCurrency, formatCurrency } from '../../lib/format'
import { useI18n } from '../../app/context/I18nContext'
import EnterpriseTooltip from './EnterpriseTooltip'

export default function ExpectedLossTrendChart({ data }) {
  const { t } = useI18n()
  const { theme } = useErm()
  const isDark = theme === 'dark'
  const hasData = data.some((item) => Number(item?.expectedLoss || 0) > 0)

  return (
    <div className="panel rounded-[22px] p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.chartTrend')}</h3>
      {hasData ? (
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#2A416D' : '#D9D9D9'}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: isDark ? '#9EB4E2' : '#6b7280' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: isDark ? '#9EB4E2' : '#6b7280' }}
                tickFormatter={formatCompactCurrency}
                width={84}
              />
              <Tooltip
                cursor={false}
                content={
                  <EnterpriseTooltip
                    isDark={isDark}
                    labelFormatter={(value) => value}
                    valueFormatter={(value) => formatCurrency(value)}
                    valueLabel="Expected loss"
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="expectedLoss"
                name="Expected loss"
                stroke="#DB4300"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 flex min-h-[300px] items-center justify-center rounded-[18px] border border-dashed border-[#D9E3F2] bg-[#FAFBFE] px-6 text-center dark:border-[#29497B] dark:bg-[#10203D]">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Нет данных для тренда</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Как только появятся активные риски с ожидаемым убытком, здесь будет показана динамика по месяцам.</p>
          </div>
        </div>
      )}
    </div>
  )
}
