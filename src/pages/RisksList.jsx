import { FilterX, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import DataTable from '../components/table/DataTable'
import { impactLevels } from '../lib/compute'
import { formatCurrency, formatDate } from '../lib/format'

function getRecordsLabel(count) {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return 'запись'
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'записи'
  }
  return 'записей'
}

export default function RisksList() {
  const navigate = useNavigate()
  const { filteredRisks, categories, isBackendConnected, backendError } = useErm()
  const { t, tr } = useI18n()
  const [localFilters, setLocalFilters] = useState({
    category: 'All',
    severity: 'All',
  })

  const visibleRisks = useMemo(() => {
    return filteredRisks.filter((risk) => {
      if (localFilters.category !== 'All' && risk.category !== localFilters.category) {
        return false
      }
      if (localFilters.severity !== 'All' && risk.severity !== localFilters.severity) {
        return false
      }
      return true
    })
  }, [filteredRisks, localFilters.category, localFilters.severity])

  const hasLocalFilters = localFilters.category !== 'All' || localFilters.severity !== 'All'

  const renderCompactRiskRow = (row) => (
    <div className="grid h-full gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-[#35548A] bg-[#102342] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#D6E4FF]">
            {row.riskNumber || row.id}
          </span>
          <StatusChip status={row.status} compact />
          <SeverityBadge severity={row.severity} compact />
        </div>

        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{row.title}</p>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {tr('category', row.category)} • {tr('department', row.department)}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Владелец</p>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">{row.owner || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Ответственный</p>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">{row.responsible || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Срок</p>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">{formatDate(row.dueDate)}</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-[#E6EDF6] pt-3 dark:border-[#28426E]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Ожидаемый убыток
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(row.expectedLoss)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Обновлён
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(row.updatedAt)}</p>
        </div>
      </div>
    </div>
  )

  const columns = useMemo(
    () => [
      {
        key: 'riskNumber',
        label: t('risks.col.id'),
        sortable: true,
        compactHidden: true,
        sortValue: (row) => row.riskNumber || row.id,
        render: (row) => (
          <span className="inline-flex rounded-xl border border-[#D9E3F2] bg-[#F8FAFD] px-2.5 py-1 text-xs font-semibold tracking-wide text-[#35588F] dark:border-[#35548A] dark:bg-[#102342] dark:text-[#D6E4FF]">
            {row.riskNumber || row.id}
          </span>
        ),
      },
      {
        key: 'title',
        label: t('risks.col.risk'),
        sortable: true,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-slate-100">{row.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">{tr('category', row.category)}</span>
              <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{tr('department', row.department)}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'department',
        label: t('risks.col.department'),
        sortable: true,
        compactHidden: true,
        render: (row) => tr('department', row.department),
      },
      { key: 'owner', label: t('risks.col.owner'), sortable: true, compactHidden: true },
      { key: 'responsible', label: t('risks.col.responsible'), sortable: true, defaultVisible: false, compactHidden: true },
      {
        key: 'status',
        label: t('risks.col.status'),
        sortable: true,
        render: (row, { density }) => <StatusChip status={row.status} compact={density === 'compact'} />,
      },
      {
        key: 'severity',
        label: t('risks.col.severity'),
        sortable: true,
        render: (row, { density }) => <SeverityBadge severity={row.severity} compact={density === 'compact'} />,
      },
      {
        key: 'expectedLoss',
        label: t('risks.col.expectedLoss'),
        sortable: true,
        align: 'right',
        render: (row) => <span className="font-medium">{formatCurrency(row.expectedLoss)}</span>,
      },
      {
        key: 'dueDate',
        label: t('risks.col.dueDate'),
        sortable: true,
        compactHidden: true,
        render: (row) => formatDate(row.dueDate),
      },
      {
        key: 'updatedAt',
        label: t('risks.col.updated'),
        sortable: true,
        compactHidden: true,
        render: (row) => formatDate(row.updatedAt),
        defaultVisible: false,
      },
    ],
    [t, tr],
  )

  if (!isBackendConnected && !backendError) {
    return <section className="panel p-4 text-sm text-slate-500 dark:text-slate-400">{t('common.loadingBackendData')}</section>
  }

  if (!isBackendConnected && backendError) {
    return <EmptyState title={t('common.backendUnavailable')} description={backendError || t('common.backendUnavailableDesc')} />
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-[#D9E3F2] bg-[#F7FAFF] px-3 py-1 text-xs font-medium text-[#35588F] dark:border-[#2F4878] dark:bg-[#10203D] dark:text-[#C9D8F7]">
              {visibleRisks.length} {getRecordsLabel(visibleRisks.length)}
            </span>
            {hasLocalFilters ? (
              <span className="inline-flex rounded-full border border-[#FFD9C7] bg-[#FFF3EE] px-3 py-1 text-xs font-medium text-[#B95428] dark:border-[#69422F] dark:bg-[#2A1D19] dark:text-[#FFBA97]">
                Локальные фильтры активны
              </span>
            ) : null}
          </div>

          <h1 className="text-[2rem] font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {t('risks.title')}
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Активные и архивные записи с быстрым переходом в карточку риска.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start xl:self-end">
          <Link to="/create" className="btn-primary">
            <Plus className="mr-1 h-4 w-4" />
            {t('risks.create')}
          </Link>
        </div>
      </section>

      <section className="panel rounded-[22px] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 xl:w-64">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Локальные фильтры</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-[#2F4878] dark:bg-[#10203D]/70 dark:text-slate-300">
                {visibleRisks.length} из {filteredRisks.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Категория и критичность поверх общих фильтров.
            </p>
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('risks.category')}</span>
              <select
                className="input-field"
                value={localFilters.category}
                onChange={(event) => setLocalFilters((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="All">{t('common.all')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {tr('category', category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('risks.severity')}</span>
              <select
                className="input-field"
                value={localFilters.severity}
                onChange={(event) => setLocalFilters((current) => ({ ...current, severity: event.target.value }))}
              >
                <option value="All">{t('common.all')}</option>
                {impactLevels.map((level) => (
                  <option key={level} value={level}>
                    {tr('severity', level)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setLocalFilters({ category: 'All', severity: 'All' })}
              >
                <FilterX className="mr-1 h-4 w-4" />
                {t('risks.resetLocal')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <DataTable
        title=""
        columns={columns}
        data={visibleRisks}
        compactRowRenderer={renderCompactRiskRow}
        initialSort={{ key: 'expectedLoss', direction: 'desc' }}
        storageKey="erm_risk_table_pref_v1"
        onRowClick={(row) => navigate(`/risks/${row.id}`)}
        emptyState={<EmptyState title={t('risks.emptyTitle')} description={t('risks.emptyDesc')} />}
      />
    </div>
  )
}
