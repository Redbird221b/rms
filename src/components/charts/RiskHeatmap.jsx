import { buildHeatmapMatrix } from '../../lib/compute'
import { useI18n } from '../../app/context/I18nContext'

function getCellStyle(value, max) {
  if (value === 0) {
    return 'bg-[#F1F1F1] text-slate-400 dark:bg-[#13264A] dark:text-slate-500'
  }
  const ratio = value / Math.max(1, max)
  if (ratio >= 0.75) {
    return 'bg-[#DB4300] text-white dark:bg-[#DB4300]/85 dark:text-white'
  }
  if (ratio >= 0.5) {
    return 'bg-[#FFF1EA] text-[#B53700] dark:bg-[#DB4300]/35 dark:text-[#FFDACC]'
  }
  if (ratio >= 0.25) {
    return 'bg-[#E8EFFF] text-[#0041B6] dark:bg-[#0041B6]/35 dark:text-[#BDD2FF]'
  }
  return 'bg-[#DDE8FF] text-[#0041B6] dark:bg-[#0041B6]/30 dark:text-[#BDD2FF]'
}

export default function RiskHeatmap({ risks }) {
  const { t } = useI18n()
  const matrix = buildHeatmapMatrix(risks)
  const values = matrix.flat()
  const max = Math.max(...values, 0)
  const hasData = max > 0

  return (
    <div className="panel rounded-[22px] p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.chartHeatmap')}</h3>
      {hasData ? (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[360px] sm:min-w-[460px]">
            <div className="mb-2 grid grid-cols-6 gap-1 text-xs text-slate-500 dark:text-slate-400">
              <div />
              <div className="text-center">1</div>
              <div className="text-center">2</div>
              <div className="text-center">3</div>
              <div className="text-center">4</div>
              <div className="text-center">5</div>
            </div>
            {[...matrix]
              .reverse()
              .map((row, rowIndex) => (
                <div key={rowIndex} className="mb-1 grid grid-cols-6 gap-1">
                  <div className="flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    {5 - rowIndex}
                  </div>
                  {row.map((value, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`flex h-10 items-center justify-center rounded-md text-xs font-medium sm:h-12 sm:text-sm ${getCellStyle(
                        value,
                        max,
                      )}`}
                    >
                      {value}
                    </div>
                  ))}
                </div>
              ))}
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('dashboard.chartHeatmapHint')}</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-[18px] border border-dashed border-[#D9E3F2] bg-[#FAFBFE] px-6 text-center sm:min-h-[300px] dark:border-[#29497B] dark:bg-[#10203D]">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('dashboard.chartHeatmapEmptyTitle')}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('dashboard.chartHeatmapEmptyDesc')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
