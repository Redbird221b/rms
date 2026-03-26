import { FilterX, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import DataTable from '../components/table/DataTable'
import { impactLevels } from '../lib/compute'
import { formatCurrency, formatDate } from '../lib/format'

export default function RisksList() {
  const navigate = useNavigate()
  const { filteredRisks, categories } = useErm()
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

  const columns = useMemo(
    () => [
      { key: 'id', label: t('risks.col.id'), sortable: true },
      {
        key: 'title',
        label: t('risks.col.risk'),
        sortable: true,
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{row.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tr('category', row.category)}</p>
          </div>
        ),
      },
      { key: 'department', label: t('risks.col.department'), sortable: true, render: (row) => tr('department', row.department) },
      { key: 'owner', label: t('risks.col.owner'), sortable: true },
      { key: 'responsible', label: t('risks.col.responsible'), sortable: true, defaultVisible: false },
      {
        key: 'status',
        label: t('risks.col.status'),
        sortable: true,
        render: (row) => <StatusChip status={row.status} />,
      },
      {
        key: 'severity',
        label: t('risks.col.severity'),
        sortable: true,
        render: (row) => <SeverityBadge severity={row.severity} />,
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
        render: (row) => formatDate(row.dueDate),
      },
      {
        key: 'updatedAt',
        label: t('risks.col.updated'),
        sortable: true,
        render: (row) => formatDate(row.updatedAt),
        defaultVisible: false,
      },
    ],
    [t, tr],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('risks.title')}
        subtitle={t('risks.subtitle')}
        actions={
          <Link to="/create" className="btn-primary">
            <Plus className="mr-1 h-4 w-4" />
            {t('risks.create')}
          </Link>
        }
      />

      <section className="panel p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1">
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
          <label className="space-y-1">
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
      </section>

      <DataTable
        title={t('risks.title')}
        columns={columns}
        data={visibleRisks}
        initialSort={{ key: 'expectedLoss', direction: 'desc' }}
        storageKey="erm_risk_table_pref_v1"
        onRowClick={(row) => navigate(`/risks/${row.id}`)}
        emptyState={
          <EmptyState
            title={t('risks.emptyTitle')}
            description={t('risks.emptyDesc')}
          />
        }
      />
    </div>
  )
}
