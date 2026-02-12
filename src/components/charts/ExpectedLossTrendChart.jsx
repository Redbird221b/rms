import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactCurrency, formatCurrency } from '../../lib/format'
import { useI18n } from '../../app/context/I18nContext'

export default function ExpectedLossTrendChart({ data }) {
  const { t } = useI18n()

  return (
    <div className="panel p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.chartTrend')}</h3>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 6, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={formatCompactCurrency}
              width={84}
            />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{
                borderRadius: '0.65rem',
                border: '1px solid #D9D9D9',
                backgroundColor: '#ffffff',
              }}
            />
            <Line
              type="monotone"
              dataKey="expectedLoss"
              stroke="#DB4300"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
