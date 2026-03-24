export default function EnterpriseTooltip({
  active,
  payload,
  label,
  isDark,
  labelFormatter,
  valueFormatter,
  valueLabel,
}) {
  if (!active || !payload?.length) {
    return null
  }

  const themeClass = isDark
    ? 'border-[#2F4878] bg-[#132547] text-[#E5ECFF]'
    : 'border-[#D9D9D9] bg-white text-slate-900'

  const labelClass = isDark ? 'text-[#E5ECFF]' : 'text-slate-900'
  const metaClass = isDark ? 'text-[#9EB4E2]' : 'text-slate-500'
  const itemClass = isDark ? 'text-[#E5ECFF]' : 'text-slate-700'

  return (
    <div className={`min-w-[200px] rounded-xl border px-3 py-2 shadow-xl ${themeClass}`}>
      <div className={`text-xs font-semibold ${labelClass}`}>
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      <div className={`mt-2 space-y-1.5 text-sm ${itemClass}`}>
        {payload.map((entry) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? '#0041B6' }}
              />
              <span className={metaClass}>{entry.name ?? valueLabel ?? 'Value'}</span>
            </div>
            <span className="font-semibold">
              {valueFormatter ? valueFormatter(entry.value, entry.name, entry) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
