import { RotateCcw } from 'lucide-react'
import { useErm } from '../../app/context/ErmContext'
import { useI18n } from '../../app/context/I18nContext'

export default function GlobalFilterBar() {
  const { globalFilters, setGlobalFilters, clearGlobalFilters, departments, statuses } = useErm()
  const { t, tr } = useI18n()

  return (
    <section className="panel mb-4 rounded-[24px] p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Фильтры</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Диапазон дат, подразделение и текущий статус риска.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
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
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearGlobalFilters}
            className="btn-secondary w-full gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            {t('filters.reset')}
          </button>
        </div>
      </div>
    </section>
  )
}
