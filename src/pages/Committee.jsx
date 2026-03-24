import { useMemo, useState } from 'react'
import { useErm } from '../app/context/ErmContext'
import { useI18n } from '../app/context/I18nContext'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import SeverityBadge from '../components/common/SeverityBadge'
import StatusChip from '../components/common/StatusChip'
import ActionModal from '../components/modals/ActionModal'
import DataTable from '../components/table/DataTable'
import { isOverdue, sortRisksByExpectedLoss } from '../lib/compute'
import { formatCurrency, formatDate } from '../lib/format'

const decisionOptions = ['Approve', 'Reject', 'Request Info', 'Accept Residual Risk']

export default function Committee() {
  const { risks, queueStatuses, decisionLogs, addDecision, updateRisk, addToast } = useErm()
  const { t, tr } = useI18n()
  const [decisionType, setDecisionType] = useState('Approve')
  const [activeRisk, setActiveRisk] = useState(null)
  const [logFilter, setLogFilter] = useState('All')

  const agenda = useMemo(() => {
    const top = sortRisksByExpectedLoss(risks)
      .slice(0, 5)
      .map((risk) => ({ ...risk, reason: t('committee.reason.top') }))
    const overdue = risks
      .filter(isOverdue)
      .slice(0, 5)
      .map((risk) => ({ ...risk, reason: t('committee.reason.overdue') }))
    const requested = risks
      .filter((risk) => queueStatuses.includes(risk.status))
      .slice(0, 5)
      .map((risk) => ({ ...risk, reason: t('committee.reason.requested') }))

    const map = new Map()
    ;[...top, ...overdue, ...requested].forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item)
      }
    })
    return Array.from(map.values()).slice(0, 10)
  }, [queueStatuses, risks, t])

  const visibleLogs = useMemo(() => {
    if (logFilter === 'All') {
      return decisionLogs
    }
    return decisionLogs.filter((entry) => entry.decisionType === logFilter)
  }, [decisionLogs, logFilter])

  const logColumns = [
    { key: 'id', label: t('committee.col.id'), sortable: true },
    {
      key: 'riskId',
      label: t('committee.col.risk'),
      sortable: true,
      render: (entry) => {
        const risk = risks.find((item) => item.id === entry.riskId)
        return (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{entry.riskId}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{risk?.title || t('common.unknownRisk')}</p>
          </div>
        )
      },
    },
    { key: 'decisionType', label: t('committee.col.decision'), sortable: true, render: (entry) => tr('decisionType', entry.decisionType) },
    { key: 'decidedBy', label: t('committee.col.by'), sortable: true },
    { key: 'decidedAt', label: t('committee.col.date'), sortable: true, render: (entry) => formatDate(entry.decidedAt) },
    {
      key: 'notes',
      label: t('committee.col.notes'),
      render: (entry) => <p className="max-w-xs truncate text-xs text-slate-600 dark:text-slate-300">{entry.notes}</p>,
    },
  ]

  const applyDecision = (comment) => {
    if (!activeRisk) {
      return
    }
    const now = new Date().toISOString()
    const decision = decisionType
    const statusMap = {
      Approve: 'Approved',
      Reject: 'Rejected',
      'Request Info': 'Requested Info',
      'Accept Residual Risk': 'Approved',
    }
    const status = statusMap[decision] || activeRisk.status

    addDecision({
      riskId: activeRisk.id,
      decisionType: decision,
      decidedBy: 'Risk Committee',
      decidedAt: now,
      notes: comment || `${decision} recorded in committee`,
    })

    updateRisk(
      activeRisk.id,
      {
        status,
        committee: { lastDecision: decision, lastDecisionAt: now },
        lastReviewedAt: now,
      },
      {
        type: 'decision',
        title: `${t('committee.col.decision')}: ${tr('decisionType', decision)}`,
        notes: comment || '',
        by: 'Risk Committee',
      },
    )

    addToast({
      title: t('committee.toast.logged'),
      message: t('committee.toast.marked', { riskId: activeRisk.id, decision: tr('decisionType', decision) }),
      type: decision === 'Reject' ? 'error' : 'success',
    })
    setActiveRisk(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('committee.title')}
        subtitle={t('committee.subtitle')}
      />

      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('committee.agenda')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('committee.decisionType')}</span>
            <select
              className="input-field !w-44 !py-1.5"
              value={decisionType}
              onChange={(event) => setDecisionType(event.target.value)}
            >
              {decisionOptions.map((option) => (
                <option key={option} value={option}>
                  {tr('decisionType', option)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {agenda.map((risk) => (
            <article
              key={risk.id}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2F4878] dark:bg-[#10203D]/70"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{risk.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {risk.id} · {risk.reason}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <SeverityBadge severity={risk.severity} />
                  <StatusChip status={risk.status} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{tr('department', risk.department)}</span>
                <span>{formatCurrency(risk.expectedLoss)}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn-secondary !py-1.5" onClick={() => setActiveRisk(risk)}>
                  {t('committee.record')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('committee.log')}</h2>
          <select
            className="input-field !w-52 !py-1.5"
            value={logFilter}
            onChange={(event) => setLogFilter(event.target.value)}
          >
            <option value="All">{t('committee.all')}</option>
            {decisionOptions.map((option) => (
              <option key={option} value={option}>
                {tr('decisionType', option)}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          title={t('committee.tableTitle')}
          columns={logColumns}
          data={visibleLogs}
          initialSort={{ key: 'decidedAt', direction: 'desc' }}
          emptyState={<EmptyState title={t('committee.emptyTitle')} description={t('committee.emptyDesc')} />}
        />
      </section>

      <ActionModal
        open={Boolean(activeRisk)}
        title={activeRisk ? t('committee.modalTitle', { decision: tr('decisionType', decisionType) }) : t('committee.record')}
        description={activeRisk ? `${activeRisk.id} · ${activeRisk.title}` : ''}
        confirmLabel={t('committee.confirm', { decision: tr('decisionType', decisionType) })}
        requireComment={decisionType === 'Reject' || decisionType === 'Request Info'}
        onClose={() => setActiveRisk(null)}
        onConfirm={applyDecision}
      />
    </div>
  )
}

