import { useMemo, useState } from 'react'
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useErm } from '../../app/context/ErmContext'
import { useI18n } from '../../app/context/I18nContext'

export default function GlobalFilterBar() {
  const { globalFilters, setGlobalFilters, clearGlobalFilters, departments, statuses } = useErm()
  const { t, tr } = useI18n()
  const [expanded, setExpanded] = useState(false)

  const activeFilters = useMemo(() => {
    const items = []

    if (globalFilters.dateFrom || globalFilters.dateTo) {
      items.push(
        globalFilters.dateFrom && globalFilters.dateTo
          ? `${globalFilters.dateFrom} - ${globalFilters.dateTo}`
          : globalFilters.dateFrom || globalFilters.dateTo,
      )
    }

    if (globalFilters.department && globalFilters.department !== 'All') {
      items.push(tr('department', globalFilters.department))
    }

    if (globalFilters.status && globalFilters.status !== 'All') {
      items.push(tr('status', globalFilters.status))
    }

    return items
  }, [globalFilters.dateFrom, globalFilters.dateTo, globalFilters.department, globalFilters.status, tr])

  return (
    <section className="panel mb-4 rounded-[22px] p-3.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F4F8FF] text-[#0041B6] ring-1 ring-[#D8E6FF] dark:bg-[#17305B] dark:text-[#C7D8FF] dark:ring-[#2F4878]">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('filters.title')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeFilters.length
                  ? t('filters.summaryLabel', { count: activeFilters.length })
                  : t('filters.summaryEmpty')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-1 xl:flex-row xl:items-center xl:justify-end">
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {activeFilters.length ? (
              activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-[#2F4878] dark:bg-[#10203D]/70 dark:text-slate-300"
                >
                  {filter}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-dashed border-slate-200 px-2.5 py-1 text-xs text-slate-500 dark:border-[#2F4878] dark:text-slate-400">
                {t('filters.summaryEmpty')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="btn-secondary gap-1.5 !px-3.5 !py-2"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? t('filters.collapse') : t('filters.expand')}
            </button>
            <button
              type="button"
              onClick={clearGlobalFilters}
              className="btn-secondary gap-1.5 !px-3.5 !py-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t('filters.reset')}
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-slate-200 pt-4 md:grid-cols-2 xl:grid-cols-4 dark:border-[#243D69]">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('filters.dateFrom')}</span>
            <input
              type="date"
              value={globalFilters.dateFrom}
              onChange={(event) => setGlobalFilters({ dateFrom: event.target.value })}
              className="input-field"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('filters.dateTo')}</span>
            <input
              type="date"
              value={globalFilters.dateTo}
              onChange={(event) => setGlobalFilters({ dateTo: event.target.value })}
              className="input-field"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('filters.department')}</span>
            <select
              value={globalFilters.department}
              onChange={(event) => setGlobalFilters({ department: event.target.value })}
              className="input-field"
            >
              <option value="All">{t('common.all')}</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {tr('department', department)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('filters.status')}</span>
            <select
              value={globalFilters.status}
              onChange={(event) => setGlobalFilters({ status: event.target.value })}
              className="input-field"
            >
              <option value="All">{t('common.all')}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {tr('status', status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  )
}
